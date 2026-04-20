// 알림 관리 유틸리티
import { logger } from './logger';
import { getBadgeDisplayNameFromName } from './badgeSystem';
import {
  fetchNotificationsSupabase,
  insertNotificationSupabase,
  markAllNotificationsReadSupabase,
  markNotificationReadSupabase,
  deleteNotificationSupabase,
  deleteAllNotificationsSupabase,
} from '../api/notificationsSupabase';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

const NOTIFICATIONS_KEY = 'notifications';

// 알림 타입별 기본 설정
const NOTIFICATION_TYPES = {
  badge: {
    icon: 'military_tech',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary'
  },
  like: {
    icon: 'favorite',
    iconBg: 'bg-red-100 dark:bg-red-900/20',
    iconColor: 'text-red-500'
  },
  comment: {
    icon: 'comment',
    iconBg: 'bg-blue-100 dark:bg-blue-900/20',
    iconColor: 'text-blue-500'
  },
  follow: {
    icon: 'person_add',
    iconBg: 'bg-green-100 dark:bg-green-900/20',
    iconColor: 'text-green-500'
  },
  post: {
    icon: 'photo_camera',
    iconBg: 'bg-purple-100 dark:bg-purple-900/20',
    iconColor: 'text-primary'
  },
  system: {
    icon: 'notifications',
    iconBg: 'bg-gray-100 dark:bg-gray-900/20',
    iconColor: 'text-gray-500'
  }
};

// 알림 목록 가져오기 (저장소 전체)
export const getNotifications = () => {
  try {
    const notifications = localStorage.getItem(NOTIFICATIONS_KEY);
    return notifications ? JSON.parse(notifications) : [];
  } catch (error) {
    logger.error('알림 불러오기 실패:', error);
    return [];
  }
};

const getCurrentUserIdFromStorage = () => {
  try {
    const u = localStorage.getItem('user');
    if (!u) return null;
    const o = JSON.parse(u);
    return o?.id ? String(o.id) : null;
  } catch {
    return null;
  }
};

/** 알림 수신자 식별용 — AuthContext보다 먼저 쓸 때 동일 규칙으로 id 조회 */
export const getNotificationStoredUserId = () => getCurrentUserIdFromStorage();

/**
 * 현재 로그인 사용자에게 보여야 할 알림만 (recipientUserId가 있으면 해당 유저만)
 */
export const getNotificationsForCurrentUser = () => {
  const uid = getCurrentUserIdFromStorage();
  const all = getNotifications();
  if (!uid) return all.filter((n) => !n.recipientUserId);
  return all.filter((n) => !n.recipientUserId || String(n.recipientUserId) === uid);
};

/** DB 제약: type은 like | comment | follow | post | badge | system */
const toDbNotificationType = (t) => {
  const x = String(t || 'system');
  if (x === 'like' || x === 'comment' || x === 'follow' || x === 'post' || x === 'badge' || x === 'system') return x;
  return 'system';
};

const buildInsertPayloadForSelf = (notification, recipientUserId) => {
  const postId = notification.postId ? String(notification.postId) : null;
  return {
    recipient_user_id: String(recipientUserId),
    actor_user_id: notification.actorUserId && isValidUuid(String(notification.actorUserId))
      ? String(notification.actorUserId)
      : null,
    type: toDbNotificationType(notification.type),
    post_id: postId && isValidUuid(postId) ? postId : null,
    actor_username: notification.actorUsername || null,
    actor_avatar_url: notification.actorAvatar || null,
    thumbnail_url: notification.thumbnailUrl || null,
    message: String(notification.message || notification.title || '알림').slice(0, 2000),
    read: !!notification.read,
  };
};

// Supabase 알림을 localStorage 캐시에 덮어쓰기(동일 계정이면 모든 기기에서 같은 목록)
export const syncNotificationsFromSupabase = async (userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return [];
  const rows = await fetchNotificationsSupabase(uid, { limit: 100 });
  const mapped = (rows || []).map((r) => {
    const rawType = r.type || 'system';
    const typ =
      rawType === 'badge'
        ? 'badge'
        : rawType === 'system' && String(r.message || '').includes('뱃지를 획득')
          ? 'badge'
          : rawType === 'post'
            ? 'post'
            : rawType;
    const actorId = r.actor_user_id ? String(r.actor_user_id) : null;
    let link = '/main';
    if (r.post_id) link = `/post/${r.post_id}`;
    else if (typ === 'follow' && actorId) link = `/user/${actorId}`;
    else if (typ === 'badge') link = '/profile';
    const typeConfig = NOTIFICATION_TYPES[typ] || NOTIFICATION_TYPES.system;
    return {
      id: String(r.id),
      read: !!r.read,
      time: r.created_at ? getTimeAgo(r.created_at) : '방금',
      timestamp: r.created_at || new Date().toISOString(),
      type: typ,
      title: '',
      message: r.message || '',
      actorUsername: r.actor_username || null,
      actorAvatar: r.actor_avatar_url || null,
      actorUserId: actorId,
      thumbnailUrl: r.thumbnail_url || null,
      postId: r.post_id ? String(r.post_id) : null,
      recipientUserId: r.recipient_user_id ? String(r.recipient_user_id) : null,
      kind:
        typ === 'follow'
          ? String(r.message || '').includes('회원님을')
            ? 'follow_received'
            : 'follow_started'
          : undefined,
      link,
      icon: typeConfig.icon,
      iconBg: typeConfig.iconBg,
      iconColor: typeConfig.iconColor,
    };
  });

  const capped = mapped.slice(0, 100);

  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(capped));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('notificationUpdate'));
  window.dispatchEvent(new Event('notificationCountChanged'));
  return capped;
};

// 다른 사용자에게 보내는 알림은 Supabase로 전송(수신자 계정에서 보이도록)
export const sendNotificationToUser = async (notification) => {
  const recipient = notification?.recipientUserId ? String(notification.recipientUserId) : null;
  if (!recipient) return { success: false };
  const pid = notification.postId ? String(notification.postId) : null;
  const payload = {
    recipient_user_id: recipient,
    actor_user_id: notification.actorUserId ? String(notification.actorUserId) : null,
    type: toDbNotificationType(notification.type),
    post_id: pid && isValidUuid(pid) ? pid : null,
    actor_username: notification.actorUsername || null,
    actor_avatar_url: notification.actorAvatar || null,
    thumbnail_url: notification.thumbnailUrl || null,
    message: notification.message || notification.title || '알림',
    read: false,
  };
  return await insertNotificationSupabase(payload);
};

// 알림 추가 — 로그인(UUID) 시 Supabase에 저장 후 동기화하여 기기 간 동일 목록 유지
export const addNotification = (notification) => {
  const uid = getCurrentUserIdFromStorage();
  const recipient = notification.recipientUserId ? String(notification.recipientUserId) : uid;

  // 수신자가 다른 사람인 알림은 로컬에 쌓지 않음(상대 기기는 서버 동기화만 사용)
  if (recipient && uid && String(recipient) !== String(uid)) {
    return null;
  }

  try {
    const newNotification = {
      id: Date.now().toString(),
      read: false,
      time: getTimeAgo(new Date()),
      timestamp: new Date().toISOString(),
      ...notification,
    };

    const typeConfig = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
    newNotification.icon = newNotification.icon || typeConfig.icon;
    newNotification.iconBg = newNotification.iconBg || typeConfig.iconBg;
    newNotification.iconColor = newNotification.iconColor || typeConfig.iconColor;

    if (isValidUuid(uid) && recipient && String(recipient) === String(uid)) {
      void (async () => {
        const payload = buildInsertPayloadForSelf(newNotification, uid);
        const res = await insertNotificationSupabase(payload);
        if (res?.success) {
          await syncNotificationsFromSupabase(uid);
        } else {
          try {
            const notifications = getNotifications();
            notifications.unshift(newNotification);
            localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 100)));
            window.dispatchEvent(new Event('notificationUpdate'));
            window.dispatchEvent(new Event('notificationCountChanged'));
          } catch (e) {
            logger.error('알림 로컬 폴백 실패:', e);
          }
        }
      })();
      logger.log('✅ 알림(Supabase 동기화 요청):', newNotification.message || newNotification.title);
      return newNotification;
    }

    const notifications = getNotifications();
    notifications.unshift(newNotification);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 100)));
    window.dispatchEvent(new Event('notificationUpdate'));
    window.dispatchEvent(new Event('notificationCountChanged'));
    logger.log('✅ 알림 추가(로컬):', newNotification.message || newNotification.title);
    return newNotification;
  } catch (error) {
    logger.error('알림 추가 실패:', error);
    return null;
  }
};

// 알림 읽음 처리
export const markNotificationAsRead = (notificationId) => {
  try {
    const notifications = getNotifications();
    const updated = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));

    // 알림 카운트 업데이트 이벤트 발생
    window.dispatchEvent(new Event('notificationUpdate'));
    window.dispatchEvent(new Event('notificationCountChanged'));

    // Supabase에도 best-effort 반영
    markNotificationReadSupabase(notificationId, true);

    return true;
  } catch (error) {
    logger.error('알림 읽음 처리 실패:', error);
    return false;
  }
};

// 모든 알림 읽음 처리 (현재 사용자에게 보이는 항목만 읽음 처리)
export const markAllNotificationsAsRead = () => {
  try {
    const all = getNotifications();
    const visibleIds = new Set(getNotificationsForCurrentUser().map((n) => n.id));
    const updated = all.map((n) => (visibleIds.has(n.id) ? { ...n, read: true } : n));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));

    window.dispatchEvent(new Event('notificationUpdate'));
    window.dispatchEvent(new Event('notificationCountChanged'));

    logger.log('✅ 모든 알림 읽음 처리');
    const uid = getCurrentUserIdFromStorage();
    if (uid && isValidUuid(uid)) markAllNotificationsReadSupabase(uid);
    return true;
  } catch (error) {
    logger.error('모든 알림 읽음 처리 실패:', error);
    return false;
  }
};

// 알림 삭제
export const deleteNotification = (notificationId) => {
  try {
    const notifications = getNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));

    // 알림 카운트 업데이트 이벤트 발생
    window.dispatchEvent(new Event('notificationUpdate'));
    window.dispatchEvent(new Event('notificationCountChanged'));

    // Supabase에도 best-effort 반영
    deleteNotificationSupabase(notificationId);

    return true;
  } catch (error) {
    logger.error('알림 삭제 실패:', error);
    return false;
  }
};

// 읽지 않은 알림 개수 (현재 사용자 기준)
export const getUnreadCount = () => {
  try {
    return getNotificationsForCurrentUser().filter((n) => !n.read).length;
  } catch (error) {
    logger.error('읽지 않은 알림 개수 조회 실패:', error);
    return 0;
  }
};

// 모든 알림 삭제 (로그인 시 서버에서도 삭제 → 모든 기기 반영)
export const clearAllNotifications = () => {
  try {
    const uid = getCurrentUserIdFromStorage();
    if (uid && isValidUuid(uid)) {
      void deleteAllNotificationsSupabase(uid).then(async () => {
        await syncNotificationsFromSupabase(uid);
      });
    } else {
      localStorage.removeItem(NOTIFICATIONS_KEY);
      window.dispatchEvent(new Event('notificationUpdate'));
      window.dispatchEvent(new Event('notificationCountChanged'));
    }
    logger.log('✅ 모든 알림 삭제');
    return true;
  } catch (error) {
    logger.error('모든 알림 삭제 실패:', error);
    return false;
  }
};

// 시간 표시 유틸리티
const getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
};

// 뱃지 획득 알림
export const notifyBadge = (badgeName, difficulty = '중') => {
  const display = getBadgeDisplayNameFromName(badgeName);
  addNotification({
    type: 'badge',
    title: '',
    message: `"${display}" 뱃지를 획득했습니다!`,
    badge: badgeName,
    badgeDisplayName: display,
    difficulty,
    icon: 'military_tech',
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-700',
    link: '/profile',
  });
};

// 좋아요 알림 (썸네일·게시글 링크는 opts로 전달, 타인 수신은 서버 sendNotificationToUser 경로만 사용)
export const notifyLike = (username, postLocation, opts = {}) => {
  const me = getCurrentUserIdFromStorage();
  if (opts.recipientUserId && me && String(opts.recipientUserId) !== String(me)) {
    return null;
  }
  const postId = opts.postId;
  addNotification({
    type: 'like',
    title: '',
    message: `${username}님이 회원님이 올린 정보를 좋아합니다`,
    subMessage: postLocation || '',
    actorUsername: username,
    actorAvatar: opts.actorAvatar || null,
    actorUserId: opts.actorUserId ? String(opts.actorUserId) : null,
    thumbnailUrl: opts.thumbnailUrl || null,
    postId: postId || null,
    recipientUserId: opts.recipientUserId ? String(opts.recipientUserId) : null,
    link: postId ? `/post/${postId}` : '/main',
  });
};

// 댓글 알림 (타인 수신은 서버 경로만)
export const notifyComment = (username, postLocation, comment, opts = {}) => {
  const me = getCurrentUserIdFromStorage();
  if (opts.recipientUserId && me && String(opts.recipientUserId) !== String(me)) {
    return null;
  }
  const preview =
    typeof comment === 'string' && comment.trim()
      ? comment.trim().slice(0, 72) + (comment.trim().length > 72 ? '…' : '')
      : '';
  addNotification({
    type: 'comment',
    title: '',
    message: `${username}님이 회원님이 올린 정보에 댓글을 남겼습니다`,
    subMessage: preview || postLocation || '',
    actorUsername: username,
    recipientUserId: opts.recipientUserId ? String(opts.recipientUserId) : null,
    postId: opts.postId || null,
    link: opts.postId ? `/post/${opts.postId}` : '/main'
  });
};

/** 피팔로우 유저에게 — 실제 알림은 follow() → sendNotificationToUser 로만 전달(중복 로컬 저장 방지) */
export const notifyFollowReceived = (followerUsername, recipientUserId, opts = {}) => {
  if (!recipientUserId) return null;
  return null;
};

/** 팔로우를 시작한 사람에게: 상대 프로필로 이동 */
export const notifyFollowingStarted = (targetUsername, recipientUserId, opts = {}) => {
  if (!recipientUserId) return null;
  const tid = opts.targetUserId ? String(opts.targetUserId) : null;
  return addNotification({
    type: 'follow',
    kind: 'follow_started',
    title: '',
    message: `${targetUsername}님을 팔로우하기 시작했습니다`,
    actorUsername: targetUsername,
    actorAvatar: opts.targetAvatar || null,
    targetUserId: tid,
    recipientUserId: String(recipientUserId),
    link: tid ? `/user/${tid}` : '/main',
  });
};

/** @deprecated recipientUserId 없음 — 가능하면 notifyFollowReceived / notifyFollowingStarted 사용 */
export const notifyFollow = (username) => {
  addNotification({
    type: 'follow',
    title: '👥 새로운 팔로워',
    message: `${username}님이 회원님을 팔로우하기 시작했습니다.`,
    link: '/profile',
  });
};

// 시스템 알림
export const notifySystem = (title, message, link = null) => {
  addNotification({
    type: 'system',
    title,
    message,
    link
  });
};


export default {
  getNotifications,
  getNotificationsForCurrentUser,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  clearAllNotifications,
  notifyBadge,
  notifyLike,
  notifyComment,
  notifyFollow,
  notifyFollowReceived,
  notifyFollowingStarted,
  notifySystem,
};

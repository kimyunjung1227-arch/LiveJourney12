// 알림 관리 유틸리티
import { logger } from './logger';
import {
  fetchNotificationsSupabase,
  insertNotificationSupabase,
  markAllNotificationsReadSupabase,
  markNotificationReadSupabase,
  deleteNotificationSupabase,
} from '../api/notificationsSupabase';

const NOTIFICATIONS_KEY = 'notifications';

// 알림 타입별 기본 설정
const NOTIFICATION_TYPES = {
  badge: {
    icon: 'military_tech',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary'
  },
  interest: {
    icon: 'place',
    iconBg: 'bg-teal-100 dark:bg-teal-900/20',
    iconColor: 'text-teal-600'
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

/**
 * 현재 로그인 사용자에게 보여야 할 알림만 (recipientUserId가 있으면 해당 유저만)
 */
export const getNotificationsForCurrentUser = () => {
  const uid = getCurrentUserIdFromStorage();
  const all = getNotifications();
  if (!uid) return all.filter((n) => !n.recipientUserId);
  return all.filter((n) => !n.recipientUserId || String(n.recipientUserId) === uid);
};

// Supabase(멀티계정) 알림을 localStorage 캐시에 동기화
export const syncNotificationsFromSupabase = async (userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return [];
  const rows = await fetchNotificationsSupabase(uid, { limit: 100 });
  const mapped = (rows || []).map((r) => ({
    id: String(r.id),
    read: !!r.read,
    time: r.created_at ? getTimeAgo(r.created_at) : '방금',
    timestamp: r.created_at || new Date().toISOString(),
    type: r.type || 'system',
    title: '',
    message: r.message || '',
    actorUsername: r.actor_username || null,
    actorAvatar: r.actor_avatar_url || null,
    actorUserId: r.actor_user_id ? String(r.actor_user_id) : null,
    thumbnailUrl: r.thumbnail_url || null,
    postId: r.post_id ? String(r.post_id) : null,
    recipientUserId: r.recipient_user_id ? String(r.recipient_user_id) : null,
    link: r.post_id ? `/post/${r.post_id}` : '/main',
  }));
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(mapped));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('notificationUpdate'));
  window.dispatchEvent(new Event('notificationCountChanged'));
  return mapped;
};

// 다른 사용자에게 보내는 알림은 Supabase로 전송(수신자 계정에서 보이도록)
export const sendNotificationToUser = async (notification) => {
  const recipient = notification?.recipientUserId ? String(notification.recipientUserId) : null;
  if (!recipient) return { success: false };
  const payload = {
    recipient_user_id: recipient,
    actor_user_id: notification.actorUserId ? String(notification.actorUserId) : null,
    type: notification.type || 'system',
    post_id: notification.postId ? String(notification.postId) : null,
    actor_username: notification.actorUsername || null,
    actor_avatar_url: notification.actorAvatar || null,
    thumbnail_url: notification.thumbnailUrl || null,
    message: notification.message || notification.title || '알림',
    read: false,
  };
  return await insertNotificationSupabase(payload);
};

// 알림 추가
export const addNotification = (notification) => {
  try {
    const notifications = getNotifications();
    const newNotification = {
      id: Date.now().toString(),
      read: false,
      time: getTimeAgo(new Date()),
      timestamp: new Date().toISOString(),
      ...notification
    };

    // 타입별 기본 설정 적용
    const typeConfig = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
    newNotification.icon = newNotification.icon || typeConfig.icon;
    newNotification.iconBg = newNotification.iconBg || typeConfig.iconBg;
    newNotification.iconColor = newNotification.iconColor || typeConfig.iconColor;

    notifications.unshift(newNotification);

    // 최대 100개까지만 저장
    const limitedNotifications = notifications.slice(0, 100);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(limitedNotifications));

    // 알림 업데이트 이벤트 발생
    window.dispatchEvent(new Event('notificationUpdate'));
    window.dispatchEvent(new Event('notificationCountChanged'));

    logger.log('✅ 알림 추가:', newNotification.title);
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
    if (uid) markAllNotificationsReadSupabase(uid);
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

// 모든 알림 삭제
export const clearAllNotifications = () => {
  try {
    localStorage.removeItem(NOTIFICATIONS_KEY);

    // 알림 업데이트 이벤트 발생
    window.dispatchEvent(new Event('notificationUpdate'));
    window.dispatchEvent(new Event('notificationCountChanged'));

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
  addNotification({
    type: 'badge',
    title: '',
    message: `"${badgeName}" 뱃지를 획득했습니다!`,
    badge: badgeName,
    difficulty,
    icon: 'military_tech',
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-700',
    link: '/badges',
  });
};

// 좋아요 알림 (썸네일·게시글 링크는 opts로 전달, recipientUserId가 있으면 해당 유저에게만 표시)
export const notifyLike = (username, postLocation, opts = {}) => {
  const postId = opts.postId;
  addNotification({
    type: 'like',
    title: '',
    message: `${username}님이 회원님의 게시물을 좋아합니다`,
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

// 댓글 알림 (recipientUserId/postId 지정 가능)
export const notifyComment = (username, postLocation, comment, opts = {}) => {
  const preview =
    typeof comment === 'string' && comment.trim()
      ? comment.trim().slice(0, 72) + (comment.trim().length > 72 ? '…' : '')
      : '';
  addNotification({
    type: 'comment',
    title: '💬 새로운 댓글',
    message: `${username}님이 회원님의 게시물에 댓글을 남겼습니다`,
    subMessage: preview || postLocation || '',
    actorUsername: username,
    recipientUserId: opts.recipientUserId ? String(opts.recipientUserId) : null,
    postId: opts.postId || null,
    link: opts.postId ? `/post/${opts.postId}` : '/main'
  });
};

/** 피팔로우 유저에게: 누군가 나를 팔로우함 — recipient = 피알림자(나) */
export const notifyFollowReceived = (followerUsername, recipientUserId, opts = {}) => {
  if (!recipientUserId) return null;
  const actorId = opts.actorUserId ? String(opts.actorUserId) : null;
  return addNotification({
    type: 'follow',
    kind: 'follow_received',
    title: '',
    message: `${followerUsername}님이 회원님을 팔로우하기 시작했습니다`,
    actorUsername: followerUsername,
    actorAvatar: opts.actorAvatar || null,
    actorUserId: actorId,
    recipientUserId: String(recipientUserId),
    link: actorId ? `/user/${actorId}` : '/main',
  });
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

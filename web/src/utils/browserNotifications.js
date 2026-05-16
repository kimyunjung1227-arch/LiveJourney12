// 브라우저 푸시 알림 유틸리티
import { addNotification } from './notifications';
import { logger } from './logger';

// 알림 권한 요청
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// 알림 권한 상태 확인
export const getNotificationPermission = () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

// 브라우저 푸시 알림 발송
export const sendBrowserNotification = (title, options = {}) => {
  // ✅ 개발 환경에서는 브라우저 푸시가 실제로 나가든 아니든
  //    알림 센터(NotificationsScreen)에서도 확인할 수 있도록 기록을 남긴다.
  try {
    if (import.meta.env.DEV) {
      addNotification({
        type: 'system',
        title,
        message: options.body || '브라우저 푸시 알림 (개발 환경 미러링)',
        link: options.link || null,
      });
    }
  } catch (e) {
    logger.warn('개발용 알림 미러링 실패:', e);
  }

  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다.');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('알림 권한이 없습니다.');
    return null;
  }

  const defaultOptions = {
    // 아이콘/배지 제거 → 브라우저 기본 스타일만 사용
    icon: undefined,
    badge: undefined,
    tag: 'livejourney-notification',
    requireInteraction: false,
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions);
    
    // 알림 클릭 시 앱으로 포커스
    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // 링크가 있으면 이동
      if (options.link) {
        window.location.href = options.link;
      }
    };

    // 알림 자동 닫기 (5초 후)
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch (error) {
    logger.error('알림 발송 실패:', error);
    return null;
  }
};

// ─────────────────────────────────────────────
// 알림 빈도 제어 (스팸 방지)
// 같은 게시물은 6시간 쿨다운, 사용자 전체 알림은 하루 최대 3회
// ─────────────────────────────────────────────
const FEEDBACK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6시간
const FEEDBACK_DAILY_CAP = 3;                     // 하루 최대 3건
const FEEDBACK_LOG_KEY = 'helpfulNotifLog';       // [{ key, postId, ts }]

const readFeedbackLog = () => {
  try {
    const raw = localStorage.getItem(FEEDBACK_LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const writeFeedbackLog = (log) => {
  try {
    localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(log.slice(-50)));
  } catch {}
};

const canSendFeedback = (key, postId) => {
  const now = Date.now();
  const log = readFeedbackLog().filter((e) => now - e.ts < 7 * 24 * 60 * 60 * 1000);
  // 1) 같은 key(=같은 milestone/같은 post)는 1회만
  if (log.some((e) => e.key === key)) return false;
  // 2) 같은 게시물은 쿨다운 6시간
  if (postId && log.some((e) => e.postId === postId && now - e.ts < FEEDBACK_COOLDOWN_MS)) return false;
  // 3) 하루 전체 한도
  const last24h = log.filter((e) => now - e.ts < 24 * 60 * 60 * 1000);
  if (last24h.length >= FEEDBACK_DAILY_CAP) return false;
  return true;
};

const recordFeedback = (key, postId) => {
  const log = readFeedbackLog();
  log.push({ key, postId: postId || null, ts: Date.now() });
  writeFeedbackLog(log);
};

// 카테고리/상황 → 사람들이 무엇을 보고 도움받았는지 구체 문구
const describeHelpContext = (post) => {
  const cat = String(post?.category || post?.categoryName || '').toLowerCase();
  const name = String(post?.categoryName || '');
  const tags = Array.isArray(post?.tags) ? post.tags.map((t) => String(t)) : [];
  const tagText = tags.join(' ').toLowerCase();
  const weather = post?.weather || post?.weatherSnapshot;

  if (cat.includes('waiting') || name.includes('웨이팅') || /웨이팅|대기|줄서/.test(tagText)) {
    return '실시간 웨이팅·대기 현황';
  }
  if (cat.includes('food') || name.includes('맛집') || /맛집|카페|디저트|음식/.test(tagText)) {
    return '맛집·카페 정보';
  }
  if (cat.includes('bloom') || name.includes('개화') || /벚꽃|개화|만개|튤립|유채/.test(tagText)) {
    return '실시간 개화 상태';
  }
  if (cat.includes('landmark') || name.includes('명소')) {
    return '명소 방문 정보';
  }
  if (weather && (weather.condition || weather.temperature)) {
    return `현장 날씨(${weather.condition || ''} ${weather.temperature || ''})`.trim();
  }
  if (cat.includes('scenic') || name.includes('추천')) {
    return '현장 풍경·분위기';
  }
  return '실시간 현장 정보';
};

const resolveAuthorName = (post) => {
  const u = post?.user;
  if (typeof u === 'string') return u;
  return u?.username || u?.name || post?.username || '회원';
};

const resolveLocation = (post, fallback = '') =>
  post?.placeName || post?.detailedLocation || post?.location || fallback || '내 장소';

// 좋아요 milestone 알림 (게시물 단위)
//  - 기준점 상향: 10/50/100/500/1000 → 25/100/500/2000
//  - 같은 milestone 중복 방지 + 게시물 쿨다운 + 일일 한도
//  - 메시지에 "어떤 정보를 보고" 도움받았는지 포함
export const notifyLikeMilestone = async (postId, newLikeCount, postLocation, post = {}) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const milestones = [25, 100, 500, 2000];
  const milestone = milestones.find((m) => newLikeCount === m);
  if (!milestone) return;

  const key = `milestone-${postId}-${milestone}`;
  if (!canSendFeedback(key, postId)) return;

  const author = resolveAuthorName(post);
  const place = resolveLocation(post, postLocation);
  const ctx = describeHelpContext(post);

  sendBrowserNotification(
    `🎉 ${milestone}명이 도움받았어요!`,
    {
      body: `${milestone}명이 ${author}님의 ‘${place}’ ${ctx}를 보고 도움을 받았어요.`,
      tag: key,
      link: `/post/${postId}`,
    }
  );
  recordFeedback(key, postId);
};

// 내 전체 좋아요 milestone (프로필 누적)
//  - 기준점 상향: 10/50/100… → 100/500/2000/10000
export const notifyTotalLikesMilestone = async (totalLikes, previousTotal, profile = {}) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const milestones = [100, 500, 2000, 10000];
  const milestone = milestones.find((m) => previousTotal < m && totalLikes >= m);
  if (!milestone) return;

  const key = `total-${milestone}`;
  if (!canSendFeedback(key, null)) return;

  const me = profile?.username || profile?.name || '회원';
  sendBrowserNotification(
    `🌟 누적 ${milestone.toLocaleString()}명이 도움받았어요!`,
    {
      body: `지금까지 총 ${milestone.toLocaleString()}명이 ${me}님이 공유한 실시간 정보를 보고 도움을 받았어요.`,
      tag: key,
      link: '/profile',
    }
  );
  recordFeedback(key, null);
};

// 단건 좋아요 알림 — 너무 자주 떠서 비활성화(쿨다운/한도 통과 시에만 1회)
//  - 같은 게시물 6시간 쿨다운, 일일 한도 적용
export const notifyNewLike = async (postId, postLocation, likeCount, post = {}) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;
  if (document.hasFocus()) return; // 앱이 켜져 있으면 푸시 생략

  const key = `like-${postId}`;
  if (!canSendFeedback(key, postId)) return;

  const author = resolveAuthorName(post);
  const place = resolveLocation(post, postLocation);
  const ctx = describeHelpContext(post);

  sendBrowserNotification(
    '💚 누군가가 도움을 받았어요',
    {
      body: `방금 ${author}님의 ‘${place}’ ${ctx}를 보고 도움을 받았어요. (지금까지 ${likeCount}명)`,
      tag: key,
      link: `/post/${postId}`,
    }
  );
  recordFeedback(key, postId);
};

// 게시물이 도움됐을 때 (외부 푸시)
export const notifyPostHelped = async (postId, postLocation, likeCount, post = {}) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const key = `helped-${postId}-${likeCount}`;
  if (!canSendFeedback(key, postId)) return;

  const author = resolveAuthorName(post);
  const place = resolveLocation(post, postLocation);
  const ctx = describeHelpContext(post);

  sendBrowserNotification(
    '💚 내 게시물이 도움이 되었어요',
    {
      body: `${likeCount}명이 ${author}님의 ‘${place}’ ${ctx}를 보고 도움을 받았어요.`,
      tag: key,
      link: `/post/${postId}`,
    }
  );
  recordFeedback(key, postId);
};

export default {
  requestNotificationPermission,
  getNotificationPermission,
  sendBrowserNotification,
  notifyLikeMilestone,
  notifyTotalLikesMilestone,
  notifyNewLike,
  notifyPostHelped
};




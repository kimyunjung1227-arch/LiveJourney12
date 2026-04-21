/**
 * 소셜 기능 유틸리티
 * 좋아요, 댓글, 북마크 관리
 */

import api from '../api/axios';
import { notifyLikeMilestone, notifyTotalLikesMilestone, notifyNewLike, notifyPostHelped } from './browserNotifications';
import { checkNewBadges, awardBadge, calculateUserStats, getEarnedBadges, BADGES } from './badgeSystem';
import { getTrustRawScore, getTrustGrade, getTrustBadgeIdForScore } from './trustIndex';
import { logger } from './logger';
import { notifyLike, notifyComment } from './notifications';

const POST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 사용자가 눌렀는데 서버 동기화가 아직 따라오지 않은 상태를 저장.
// - 서버 응답이 pendingDesired와 일치하는 순간에만 pending을 해제한다.
// - 시간 기반이 아니라 "상호작용→서버확인" 기반으로 초기화(되돌림) 방지.
const LIKED_POSTS_PENDING_KEY = 'likedPostsPendingDesired';

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
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

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

const likedPostsKeyForUser = (userId) => {
  const uid = userId ? String(userId).trim() : '';
  return isValidUuid(uid) ? `likedPosts_v2:${uid}` : 'likedPosts';
};

const likedPostsPendingKeyForUser = (userId) => {
  const uid = userId ? String(userId).trim() : '';
  return isValidUuid(uid) ? `${LIKED_POSTS_PENDING_KEY}:v2:${uid}` : LIKED_POSTS_PENDING_KEY;
};

/**
 * isPostLiked()가 읽는 likedPosts 캐시 갱신 — Supabase post_likes 토글 직후 호출 필수
 */
export const setLikedPostLocalCache = (postId, isLiked) => {
  try {
    const id = String(postId || '');
    if (!id) return;
    const uid = getCurrentUserIdFromStorage();
    const likesKey = likedPostsKeyForUser(uid);
    const pendingKey = likedPostsPendingKeyForUser(uid);
    const likes = readJson(likesKey, {});
    likes[id] = !!isLiked;
    writeJson(likesKey, likes);

    // 상호작용 기반 pending 표시
    const pending = readJson(pendingKey, {});
    pending[id] = !!isLiked;
    writeJson(pendingKey, pending);

    window.dispatchEvent(new CustomEvent('likedPostsCacheUpdated', { detail: { postId: id, liked: !!isLiked } }));
  } catch {
    /* ignore */
  }
};

/**
 * 피드 로드 시 post_likes 조회 결과를 반영. 비-UUID(로컬 전용) 좋아요 키는 유지.
 * @param {string[]} queriedPostIds - 이번에 서버와 맞출 UUID 게시물 id 목록
 * @param {string[]} likedIdsFromServer - 현재 사용자가 좋아요한 id 목록
 */
export const mergeLikedPostsFromServer = (queriedPostIds, likedIdsFromServer, userId = null) => {
  try {
    const uid = userId ? String(userId) : getCurrentUserIdFromStorage();
    const likesKey = likedPostsKeyForUser(uid);
    const pendingKey = likedPostsPendingKeyForUser(uid);
    const prev = readJson(likesKey, {});
    const pending = readJson(pendingKey, {});
    const likedSet = new Set((likedIdsFromServer || []).map((x) => String(x)));
    // 기존 UUID 좋아요 캐시를 지우지 말고(피드에 없다고 삭제하면 "추적이 안됨"으로 보임),
    // 이번에 조회한 ID만 서버 기준으로 덮어쓴다.
    const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
    (queriedPostIds || []).forEach((pid) => {
      const id = String(pid);
      if (!POST_ID_UUID_RE.test(id)) return;
      const serverLiked = likedSet.has(id);
      const pendingDesired = pending && Object.prototype.hasOwnProperty.call(pending, id) ? !!pending[id] : null;
      if (pendingDesired === null) {
        next[id] = serverLiked;
        return;
      }

      // 서버가 pending과 같은 상태를 반환하면 이제 확정된 것이므로 pending 해제
      if (serverLiked === pendingDesired) {
        next[id] = serverLiked;
        delete pending[id];
        return;
      }

      // 서버가 아직 따라오지 않은 상태면, 상호작용 결과를 유지(초기화 방지)
      next[id] = pendingDesired;
    });
    writeJson(likesKey, next);
    writeJson(pendingKey, pending);
    window.dispatchEvent(new CustomEvent('postLikesSynced', { detail: { count: likedIdsFromServer?.length || 0 } }));
  } catch {
    /* ignore */
  }
};

// 좋아요 토글
// currentLikes: 현재 화면에서 보이는 좋아요 수 (Supabase 게시물용, 선택 인자)
export const toggleLike = (postId, currentLikes) => {
  const likes = JSON.parse(localStorage.getItem('likedPosts') || '{}');
  const isLiked = likes[postId] || false;

  // 현재 사용자 정보
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = currentUser.id;

  // 게시물 정보 가져오기 (localStorage 기반 게시물)
  const storagePosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
  let post = storagePosts.find(p => p.id === postId);
  let posts = storagePosts;

  // localStorage 기반 게시물이 아닐 수도 있음 (백엔드에서 불러온 경우)
  const existsInStorage = !!post;

  // 항상 좋아요 상태는 저장
  likes[postId] = !isLiked;
  localStorage.setItem('likedPosts', JSON.stringify(likes));

  // Supabase 등 서버 기반 게시물: localStorage에는 없지만, 화면에서 보이는 좋아요 수를 기반으로 계산
  if (!post) {
    const baseLikes = typeof currentLikes === 'number' ? currentLikes : 0;
    const delta = isLiked ? -1 : 1;
    const newLikeCount = Math.max(0, baseLikes + delta);

    // 좋아요 수 변경 이벤트 전파 (메인/실시간 피드 등에서 동기화)
    try {
      window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId, likesCount: newLikeCount } }));
    } catch {
      // window가 없는 환경에서는 무시
    }

    return {
      isLiked: !isLiked,
      newCount: newLikeCount,
      existsInStorage: false
    };
  }

  const oldLikes = post.likes || 0;
  const isMyPost = post.userId === userId;

  // 게시물의 좋아요 수 업데이트
  const updatedPosts = posts.map(p => {
    if (p.id === postId) {
      const newLikes = (p.likes || 0) + (isLiked ? -1 : 1);
      return { ...p, likes: Math.max(0, newLikes) };
    }
    return p;
  });

  localStorage.setItem('uploadedPosts', JSON.stringify(updatedPosts));

  const updatedPost = updatedPosts.find(p => p.id === postId);
  const newLikeCount = updatedPost?.likes || 0;

  // 좋아요 수 변경 이벤트 전파 (메인/실시간 피드 등에서 동기화)
  try {
    window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId, likesCount: newLikeCount } }));
  } catch {
    // window가 없는 환경에서는 무시
  }

  // 좋아요가 증가했고, 내 게시물인 경우 알림 발송 및 뱃지 체크
  // (알림도 현재 사용자에게만 노출되도록 recipientUserId 지정)
  if (!isLiked && isMyPost && newLikeCount > oldLikes) {
    const actorName = currentUser?.username || currentUser?.email?.split('@')[0] || '여행자';
    // 내 게시물에 "다른 사용자"가 좋아요한 것처럼 보이게 하려면, 실제 멀티유저 서버가 필요합니다.
    // 현재 구현은 동일 브라우저 localStorage 기반이므로 actor는 현재 사용자 정보로만 표시됩니다.
    notifyLike(actorName, post.location || '여행지', {
      recipientUserId: userId,
      postId,
      actorUserId: currentUser?.id || null,
      actorAvatar: currentUser?.profileImage || null,
      thumbnailUrl: post?.images?.[0] || post?.image || post?.thumbnail || null,
    });

    // 내 게시물이 도움되었습니다 알림 (앱 내부 + 브라우저 푸시)
    notifyPostHelped(postId, post.location || '여행지', newLikeCount);

    // 개별 게시물 좋아요 수 기준점 알림 (10, 50, 100명 등)
    notifyLikeMilestone(postId, newLikeCount, post.location || '여행지');

    // 내 게시물들의 총 좋아요 수 계산
    const myPosts = updatedPosts.filter(p => {
      const postUserId = p.userId ||
        (typeof p.user === 'string' ? p.user : p.user?.id) ||
        p.user;
      return postUserId === userId;
    });
    const previousTotal = myPosts.reduce((sum, p) => {
      if (p.id === postId) {
        return sum + oldLikes;
      }
      return sum + (p.likes || 0);
    }, 0);
    const totalLikes = myPosts.reduce((sum, p) => sum + (p.likes || 0), 0);

    notifyTotalLikesMilestone(totalLikes, previousTotal);

    // 뱃지 체크 (비동기로 처리)
    logger.log('🎯 좋아요 받음 - 뱃지 체크 시작');
    logger.log(`   게시물 ID: ${postId}`);
    logger.log(`   사용자 ID: ${userId}`);
    logger.log(`   이전 좋아요: ${oldLikes}, 현재 좋아요: ${newLikeCount}`);
    logger.log(`   내 게시물 수: ${myPosts.length}개`);
    logger.log(`   총 좋아요 수: ${totalLikes}개`);

    setTimeout(() => {
      try {
        // 데이터가 저장되었는지 확인
        const verifyPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
        const verifyPost = verifyPosts.find(p => p.id === postId);
        const verifyMyPosts = verifyPosts.filter(p => {
          const postUserId = p.userId ||
            (typeof p.user === 'string' ? p.user : p.user?.id) ||
            p.user;
          return postUserId === userId;
        });
        const verifyTotalLikes = verifyMyPosts.reduce((sum, p) => sum + (p.likes || 0), 0);

        console.log('🔍 데이터 검증:');
        console.log(`   게시물 좋아요 수: ${verifyPost?.likes || 0}`);
        console.log(`   내 게시물 수: ${verifyMyPosts.length}개`);
        console.log(`   총 좋아요 수: ${verifyTotalLikes}개`);

        console.log('🔍 뱃지 체크 실행 중...');

        // 사용자 통계 계산
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const stats = calculateUserStats(verifyMyPosts, currentUser);

        console.log('📊 현재 통계:', {
          totalPosts: stats.totalPosts,
          totalLikes: stats.totalLikes,
          maxLikes: stats.maxLikes
        });

        const newBadges = checkNewBadges(stats);
        console.log(`📋 발견된 새 뱃지: ${newBadges.length}개`);

        if (newBadges.length > 0) {
          const badge = newBadges[0];
          console.log(`🎁 뱃지 획득 시도: ${badge.name}`);
          const awarded = awardBadge(badge, { region: stats?.topRegionName, userId: currentUser?.id });

          if (awarded) {
            console.log(`✅ 뱃지 획득 성공: ${badge.name}`);
            // 뱃지 획득 이벤트 발생
            window.dispatchEvent(new CustomEvent('badgeEarned', { detail: badge }));
          } else {
            console.log(`❌ 뱃지 획득 실패: ${badge.name}`);
          }
        } else {
          console.log('📭 획득 가능한 새 뱃지 없음');
          console.log(`   totalLikes: ${stats.totalLikes}`);
          console.log(`   첫 좋아요 조건: ${stats.totalLikes >= 1}`);
        }
      } catch (error) {
        console.error('❌ 뱃지 체크 실패:', error);
      }
    }, 1000); // 500ms -> 1000ms로 증가하여 데이터 저장 시간 확보
  }

  // 게시물 업데이트 이벤트 발생
  window.dispatchEvent(new CustomEvent('postsUpdated', { detail: { postId, newLikeCount } }));

  return {
    isLiked: !isLiked,
    newCount: newLikeCount,
    existsInStorage: true
  };
};

// 좋아요 여부 확인
export const isPostLiked = (postId) => {
  const uid = getCurrentUserIdFromStorage();
  const likesKey = likedPostsKeyForUser(uid);
  const likes = readJson(likesKey, {});
  return !!likes[String(postId)];
};

export const isPostLikedForUser = (postId, userId) => {
  const likesKey = likedPostsKeyForUser(userId);
  const likes = readJson(likesKey, {});
  return !!likes[String(postId)];
};

// 댓글 추가
export const addComment = (postId, comment, username = '익명', userId = null) => {
  const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');

  // 현재 사용자 정보 가져오기
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  if (!userId) {
    userId = currentUser.id;
  }

  // 게시물이 uploadedPosts에 있는지 확인
  let postIndex = posts.findIndex(post => post.id === postId);
  let targetPosts = [...posts];

  if (postIndex === -1) {
    logger.error('❌ 댓글을 추가할 게시물을 찾을 수 없습니다:', postId);
    return [];
  }

  const newComment = {
    id: `comment-${Date.now()}`,
    user: { username, id: userId },
    userId: userId,
    content: comment,
    timestamp: new Date().toISOString(),
    avatar: currentUser?.profileImage && currentUser.profileImage !== 'default' ? currentUser.profileImage : null
  };

  targetPosts[postIndex] = {
    ...targetPosts[postIndex],
    comments: [...(targetPosts[postIndex].comments || []), newComment]
  };

  localStorage.setItem('uploadedPosts', JSON.stringify(targetPosts));

  // 게시물 업데이트 이벤트 발생
  window.dispatchEvent(new CustomEvent('postsUpdated', { detail: { postId, comments: targetPosts[postIndex].comments } }));

  // 댓글 알림: 작성자에게만 (localStorage 게시물은 userId 필드가 있으면 사용)
  try {
    const postAuthorId = targetPosts[postIndex]?.userId || targetPosts[postIndex]?.user?.id || targetPosts[postIndex]?.user;
    if (postAuthorId && String(postAuthorId) !== String(userId)) {
      notifyComment(username, targetPosts[postIndex]?.location || targetPosts[postIndex]?.placeName || '', comment, {
        recipientUserId: postAuthorId,
        postId,
      });
    }
  } catch (_) {}

  return targetPosts[postIndex].comments || [];
};

// 댓글 삭제 (localStorage 게시물용)
export const deleteCommentFromPost = (postId, commentId) => {
  const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) return [];
  const nextComments = (posts[idx].comments || []).filter((c) => c.id !== commentId);
  posts[idx] = { ...posts[idx], comments: nextComments };
  localStorage.setItem('uploadedPosts', JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('postsUpdated', { detail: { postId, comments: nextComments } }));
  return nextComments;
};

// 댓글 수정 (localStorage 게시물용)
export const updateCommentInPost = (postId, commentId, newContent) => {
  const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) return [];
  const nextComments = (posts[idx].comments || []).map((c) =>
    c.id === commentId ? { ...c, content: newContent } : c
  );
  posts[idx] = { ...posts[idx], comments: nextComments };
  localStorage.setItem('uploadedPosts', JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('postsUpdated', { detail: { postId, comments: nextComments } }));
  return nextComments;
};

// 북마크 토글
export const toggleBookmark = (post) => {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarkedPosts') || '[]');
  const isBookmarked = bookmarks.some(b => b.id === post.id);

  let updatedBookmarks;
  if (isBookmarked) {
    updatedBookmarks = bookmarks.filter(b => b.id !== post.id);
  } else {
    updatedBookmarks = [...bookmarks, post];
  }

  localStorage.setItem('bookmarkedPosts', JSON.stringify(updatedBookmarks));

  return {
    isBookmarked: !isBookmarked,
    totalBookmarks: updatedBookmarks.length
  };
};

// 북마크 여부 확인
export const isPostBookmarked = (postId) => {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarkedPosts') || '[]');
  return bookmarks.some(b => b.id === postId);
};

// 북마크 목록 가져오기
export const getBookmarkedPosts = () => {
  return JSON.parse(localStorage.getItem('bookmarkedPosts') || '[]');
};

// --- 정보 정확도 평가 (다른 사용자 게시물에 대한 "정보가 정확해요" 표시) ---
const ACCURACY_COUNT_KEY = 'postAccuracyCount';
const USER_ACCURACY_MARKS_KEY = 'userAccuracyMarks';

/** 게시물별 정확도 평가 수 조회 */
export const getPostAccuracyCount = (postId) => {
  const counts = JSON.parse(localStorage.getItem(ACCURACY_COUNT_KEY) || '{}');
  return Number(counts[postId]) || 0;
};

/** 현재 사용자가 해당 게시물에 "정확해요"를 눌렀는지 */
export const hasUserMarkedAccurate = (postId) => {
  const marks = JSON.parse(localStorage.getItem(USER_ACCURACY_MARKS_KEY) || '{}');
  return !!marks[postId];
};

const isServerPostId = (id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);

/** "정보가 정확해요" 토글 — 다른 사용자가 누르면 게시물 작성자 신뢰지수 상승 (서버 우선, 없으면 로컬) */
export const toggleAccuracyFeedback = async (postId) => {
  if (isServerPostId(postId)) {
    try {
      const res = await api.post(`/posts/${postId}/accuracy`);
      const data = res.data || {};
      if (data.success) {
        const marked = !!data.marked;
        const newCount = Number(data.accuracyCount) || 0;
        const marks = JSON.parse(localStorage.getItem(USER_ACCURACY_MARKS_KEY) || '{}');
        marks[postId] = marked;
        localStorage.setItem(USER_ACCURACY_MARKS_KEY, JSON.stringify(marks));
        window.dispatchEvent(new CustomEvent('trustIndexUpdated'));
        return { marked, newCount };
      }
    } catch (err) {
      logger.warn('정확해요 API 실패, 로컬 처리:', err?.message);
    }
  }

  const marks = JSON.parse(localStorage.getItem(USER_ACCURACY_MARKS_KEY) || '{}');
  const counts = JSON.parse(localStorage.getItem(ACCURACY_COUNT_KEY) || '{}');
  const wasMarked = !!marks[postId];
  const currentCount = Number(counts[postId]) || 0;

  marks[postId] = !wasMarked;
  counts[postId] = Math.max(0, currentCount + (wasMarked ? -1 : 1));

  localStorage.setItem(USER_ACCURACY_MARKS_KEY, JSON.stringify(marks));
  localStorage.setItem(ACCURACY_COUNT_KEY, JSON.stringify(counts));

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = currentUser?.id ? String(currentUser.id) : null;
  const storagePosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
  const post = storagePosts.find((p) => p.id === postId);
  const postAuthorId = post && (post.userId ?? (typeof post.user === 'string' ? post.user : post.user?.id) ?? post.user);
  const authorIsMe = postAuthorId != null && String(postAuthorId) === currentUserId;

  if (authorIsMe) {
    try {
      const raw = getTrustRawScore();
      const badgeId = getTrustBadgeIdForScore(raw);
      if (badgeId && BADGES[badgeId] && !getEarnedBadges().some((b) => b.name === badgeId)) {
        const awarded = awardBadge(BADGES[badgeId], { userId: currentUser?.id });
        if (awarded) {
          window.dispatchEvent(new CustomEvent('badgeEarned', { detail: BADGES[badgeId] }));
        }
      }
      window.dispatchEvent(new CustomEvent('trustIndexUpdated', { detail: { score: raw, grade: getTrustGrade(raw).grade } }));
    } catch (e) {
      logger.error('신뢰지수 뱃지 부여 확인 실패', e);
    }
  }

  return {
    marked: !wasMarked,
    newCount: counts[postId]
  };
};



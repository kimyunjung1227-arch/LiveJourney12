/**
 * 소셜 기능 유틸리티
 * 좋아요, 댓글, 북마크 관리
 */

import api from '../api/axios';
import { awardBadge, getEarnedBadges, BADGES } from './badgeSystem';
import { getTrustRawScore, getTrustGrade, getTrustBadgeIdForScore } from './trustIndex';
import { logger } from './logger';
import { notifyComment } from './notifications';

// NOTE: 좋아요 상태/카운트는 Supabase(post_likes, posts.likes_count)가 단일 진실.
// 과거 localStorage 캐시(likedPosts_v2, postLikesPendingDesired, postLikesByUser_v1)는 제거됨.
// 좋아요 토글은 `../api/socialSupabase.togglePostLikeSupabase` + `../utils/postLikeActions.toggleLikeForPost` 사용.

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



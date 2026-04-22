/**
 * 소셜 기능 유틸리티
 * 좋아요, 댓글, 북마크 관리
 */

import api from '../api/axios';
import { awardBadge, getEarnedBadges, BADGES } from './badgeSystem';
import { getTrustRawScore, getTrustGrade, getTrustBadgeIdForScore } from './trustIndex';
import { logger } from './logger';
import { notifyComment } from './notifications';

// 서버 운영 전환: localStorage 제거 → 북마크/로컬 댓글은 세션 메모리만 사용
const bookmarksCache = [];

// NOTE: 좋아요 상태/카운트는 Supabase(post_likes, posts.likes_count)가 단일 진실.
// 과거 localStorage 캐시(likedPosts_v2, postLikesPendingDesired, postLikesByUser_v1)는 제거됨.
// 좋아요 토글은 `../api/socialSupabase.togglePostLikeSupabase` + `../utils/postLikeActions.toggleLikeForPost` 사용.

// 댓글 추가
export const addComment = (postId, comment, username = '익명', userId = null) => {
  logger.warn('addComment(local) deprecated:', postId);
  return [];
};

// 댓글 삭제 (localStorage 게시물용)
export const deleteCommentFromPost = (postId, commentId) => {
  logger.warn('deleteCommentFromPost(local) deprecated:', postId);
  return [];
};

// 댓글 수정 (localStorage 게시물용)
export const updateCommentInPost = (postId, commentId, newContent) => {
  logger.warn('updateCommentInPost(local) deprecated:', postId);
  return [];
};

// 북마크 토글
export const toggleBookmark = (post) => {
  const id = post?.id;
  const isBookmarked = bookmarksCache.some((b) => b?.id === id);
  if (isBookmarked) {
    const idx = bookmarksCache.findIndex((b) => b?.id === id);
    if (idx >= 0) bookmarksCache.splice(idx, 1);
  } else if (post) {
    bookmarksCache.unshift(post);
  }
  return { isBookmarked: !isBookmarked, totalBookmarks: bookmarksCache.length };
};

// 북마크 여부 확인
export const isPostBookmarked = (postId) => {
  return bookmarksCache.some((b) => b?.id === postId);
};

// 북마크 목록 가져오기
export const getBookmarkedPosts = () => {
  return [...bookmarksCache];
};

// --- 정보 정확도 평가 (다른 사용자 게시물에 대한 "정보가 정확해요" 표시) ---
const ACCURACY_COUNT_KEY = 'postAccuracyCount';
const USER_ACCURACY_MARKS_KEY = 'userAccuracyMarks';

const accuracyCountsCache = {};
const accuracyMarksCache = {};

/** 게시물별 정확도 평가 수 조회 */
export const getPostAccuracyCount = (postId) => {
  return Number(accuracyCountsCache[String(postId)]) || 0;
};

/** 현재 사용자가 해당 게시물에 "정확해요"를 눌렀는지 */
export const hasUserMarkedAccurate = (postId) => {
  return !!accuracyMarksCache[String(postId)];
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
        accuracyMarksCache[String(postId)] = marked;
        accuracyCountsCache[String(postId)] = newCount;
        window.dispatchEvent(new CustomEvent('trustIndexUpdated'));
        return { marked, newCount };
      }
    } catch (err) {
      logger.warn('정확해요 API 실패, 로컬 처리:', err?.message);
    }
  }

  const key = String(postId);
  const wasMarked = !!accuracyMarksCache[key];
  const currentCount = Number(accuracyCountsCache[key]) || 0;

  accuracyMarksCache[key] = !wasMarked;
  accuracyCountsCache[key] = Math.max(0, currentCount + (wasMarked ? -1 : 1));

  return {
    marked: !wasMarked,
    newCount: accuracyCountsCache[key]
  };
};



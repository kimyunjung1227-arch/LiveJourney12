/**
 * 소셜 기능 유틸리티
 * 좋아요, 댓글, 북마크 관리
 */

import api from '../api/axios';
import { notifyLikeMilestone, notifyTotalLikesMilestone, notifyNewLike, notifyPostHelped } from './browserNotifications';
import { checkNewBadges, awardBadge, calculateUserStats, getEarnedBadges, BADGES } from './badgeSystem';
import { getTrustScore, getTrustGrade, getTrustBadgeIdForScore } from './trustIndex';
import { logger } from './logger';

// 좋아요 토글
export const toggleLike = (postId) => {
  const likes = JSON.parse(localStorage.getItem('likedPosts') || '{}');
  const isLiked = likes[postId] || false;

  // 현재 사용자 정보
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = currentUser.id;

  // 게시물 정보 가져오기
  const storagePosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
  let post = storagePosts.find(p => p.id === postId);
  let posts = storagePosts;

  // localStorage 기반 게시물이 아닐 수도 있음 (백엔드에서 불러온 경우)
  const existsInStorage = !!post;

  if (!post) {
    // 업로드된 게시물 목록에 없으면 서버 데이터 기반 게시물로 간주
    // -> 로컬 좋아요 상태만 저장하고, 카운트는 화면 쪽에서 기존 값 기준으로 증감 처리
    likes[postId] = !isLiked;
    localStorage.setItem('likedPosts', JSON.stringify(likes));

    return {
      isLiked: !isLiked,
      newCount: 0,
      existsInStorage: false
    };
  }

  const oldLikes = post.likes || 0;
  const isMyPost = post.userId === userId;

  likes[postId] = !isLiked;
  localStorage.setItem('likedPosts', JSON.stringify(likes));

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

  // 좋아요가 증가했고, 내 게시물인 경우 알림 발송 및 뱃지 체크
  if (!isLiked && isMyPost && newLikeCount > oldLikes) {
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
  const likes = JSON.parse(localStorage.getItem('likedPosts') || '{}');
  return likes[postId] || false;
};

// 댓글 추가
export const addComment = (postId, comment, username = '익명', userId = null) => {
  const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');

  // 현재 사용자 정보 가져오기
  if (!userId) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    userId = user.id;
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
    user: username,
    userId: userId,
    content: comment,
    timestamp: new Date().toISOString(),
    avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`
  };

  targetPosts[postIndex] = {
    ...targetPosts[postIndex],
    comments: [...(targetPosts[postIndex].comments || []), newComment]
  };

  localStorage.setItem('uploadedPosts', JSON.stringify(targetPosts));

  // 게시물 업데이트 이벤트 발생
  window.dispatchEvent(new CustomEvent('postsUpdated', { detail: { postId, comments: targetPosts[postIndex].comments } }));

  return targetPosts[postIndex].comments || [];
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
      const score = getTrustScore();
      const badgeId = getTrustBadgeIdForScore(score);
      if (badgeId && BADGES[badgeId] && !getEarnedBadges().some((b) => b.name === badgeId)) {
        const awarded = awardBadge(BADGES[badgeId], { userId: currentUser?.id });
        if (awarded) {
          window.dispatchEvent(new CustomEvent('badgeEarned', { detail: BADGES[badgeId] }));
        }
      }
      window.dispatchEvent(new CustomEvent('trustIndexUpdated', { detail: { score, grade: getTrustGrade(score).grade } }));
    } catch (e) {
      logger.error('신뢰지수 뱃지 부여 확인 실패', e);
    }
  }

  return {
    marked: !wasMarked,
    newCount: counts[postId]
  };
};



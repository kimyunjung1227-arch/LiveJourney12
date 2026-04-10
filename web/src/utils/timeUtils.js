// 실시간 시간 계산 유틸리티
import { logger } from './logger';

/**
 * timestamp를 현재 시각 기준으로 상대적 시간으로 변환
 * @param {Date|string|number} timestamp - 업로드 시각
 * @returns {string} - "방금", "5분 전", "1시간 전" 등
 */
export const getTimeAgo = (timestamp) => {
  if (!timestamp) return '방금';
  
  try {
    const now = new Date();
    const uploadTime = new Date(timestamp);
    
    // 유효한 날짜인지 확인
    if (isNaN(uploadTime.getTime())) {
      return '방금';
    }
    
    const diffMs = now - uploadTime; // 밀리초 차이
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    // 음수면 미래 시각 (오류)
    if (diffSeconds < 0) return '방금';
    
    // 초 단위
    if (diffSeconds < 60) return '방금';
    
    // 분 단위
    if (diffMinutes < 60) {
      if (diffMinutes < 5) return '방금';
      if (diffMinutes < 10) return '5분 전';
      if (diffMinutes < 30) return '10분 전';
      return '30분 전';
    }
    
    // 시간 단위
    if (diffHours < 24) {
      if (diffHours === 1) return '1시간 전';
      return `${diffHours}시간 전`;
    }
    
    // 일 단위
    if (diffDays < 7) {
      return `${diffDays}일 전`;
    }
    
    // 주 단위
    if (diffWeeks < 4) {
      return `${diffWeeks}주 전`;
    }
    
    // 월 단위
    if (diffMonths < 12) {
      return `${diffMonths}개월 전`;
    }
    
    // 년 단위
    return `${diffYears}년 전`;
    
  } catch (error) {
    logger.error('시간 계산 오류:', error);
    return '방금';
  }
};

/**
 * 여러 게시물의 시간을 일괄 업데이트
 * @param {Array} posts - 게시물 배열
 * @returns {Array} - timeLabel이 업데이트된 게시물 배열
 */
export const updatePostTimes = (posts) => {
  if (!Array.isArray(posts)) return [];
  
  return posts.map(post => ({
    ...post,
    timeLabel: getTimeAgo(post.timestamp || post.createdAt || post.uploadedAt)
  }));
};

/**
 * 현재 시각을 timestamp로 반환
 * @returns {string} - ISO 8601 형식
 */
export const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

// React Hook은 각 컴포넌트에서 직접 구현
// useEffect + setInterval 사용

/**
 * timestamp를 숫자로 변환 (정렬용)
 * @param {Date|string|number} timestamp
 * @returns {number} - 밀리초
 */
export const timestampToNumber = (timestamp) => {
  if (!timestamp) return 0;
  
  try {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch (error) {
    return 0;
  }
};

/**
 * 시간순 정렬 (최신순)
 * @param {Array} posts - 게시물 배열
 * @returns {Array} - 정렬된 배열
 */
export const sortByTime = (posts) => {
  return [...posts].sort((a, b) => {
    const timeA = timestampToNumber(a.timestamp || a.createdAt || a.uploadedAt);
    const timeB = timestampToNumber(b.timestamp || b.createdAt || b.uploadedAt);
    return timeB - timeA; // 최신순
  });
};

// 2일(48시간) 이상 지났는지 확인
export const isOlderThanTwoDays = (timestamp) => {
  if (!timestamp) return false;
  
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffHours = (now - postDate) / (1000 * 60 * 60);
  
  return diffHours >= 48; // 48시간 = 2일
};

// 게시물을 최신순으로 정렬하고 지정된 시간 이상 된 것은 필터링
// @param {Array} posts - 게시물 배열
// @param {number} maxDays - 최대 일수 (기본값: 2일)
// @param {number} maxHours - 최대 시간 (maxDays보다 우선순위 높음, 선택사항)
export const filterRecentPosts = (posts, maxDays = 2, maxHours = null) => {
  if (!posts || posts.length === 0) return [];
  
  // maxHours가 지정되면 그것을 사용, 아니면 maxDays * 24 사용
  const hoursLimit = maxHours !== null ? maxHours : (maxDays * 24);
  const now = new Date();
  
  return posts
    .filter(post => {
      const timestamp = post.timestamp || post.createdAt;
      if (!timestamp) return true; // 시간 정보 없으면 유지
      
      const postDate = new Date(timestamp);
      const diffHours = (now - postDate) / (1000 * 60 * 60);
      
      return diffHours < hoursLimit;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0);
      const timeB = new Date(b.timestamp || b.createdAt || 0);
      return timeB - timeA; // 최신순
    });
};

// 48시간 이내 게시물만 노출 (피드/검색/추천용 공통)
export const filterActivePosts48 = (posts) => filterRecentPosts(posts, 2, 48);

/**
 * 업로드 후 30분 이내인지 여부 (LIVE 뱃지 표시용)
 * @param {Date|string|number} timestamp - 업로드 시각
 * @param {number} maxMinutes - 기준 분 (기본 30분)
 * @returns {boolean}
 */
export const isPostLive = (timestamp, maxMinutes = 30) => {
  if (!timestamp) return false;
  try {
    const postTime = new Date(timestamp).getTime();
    if (isNaN(postTime)) return false;
    const diffMs = Date.now() - postTime;
    return diffMs >= 0 && diffMs < maxMinutes * 60 * 1000;
  } catch {
    return false;
  }
};

// 게시물 나이(시간) 계산 (시간 단위)
export const getPostAgeInHours = (timestamp) => {
  if (!timestamp) return 0;
  
  const now = new Date();
  const postDate = new Date(timestamp);
  return (now - postDate) / (1000 * 60 * 60);
};

/**
 * 추천 카드 투명성: "20시간 전", "어제 오후 3시" 등 구체적 표기
 */
export const getRecommendationTransparencyLabel = (timestamp) => {
  if (!timestamp) return '시간 미상';
  try {
    const d = new Date(timestamp);
    const now = new Date();
    if (isNaN(d.getTime())) return '시간 미상';
    const diffMs = now - d;
    if (diffMs < 0) return '방금';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffMins < 1) return '방금';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) {
      const h = Math.floor(diffHours);
      const m = Math.floor(diffHours * 60) % 60;
      if (m >= 1) return `${h}시간 ${m}분 전`;
      return `${h}시간 전`;
    }
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfPostDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((startOfToday - startOfPostDay) / 86400000);
    const hh = d.getHours();
    const ap = hh < 12 ? '오전' : '오후';
    const h12 = hh % 12 || 12;
    if (dayDiff === 1) return `어제 ${ap} ${h12}시`;
    if (dayDiff === 0) return `오늘 ${ap} ${h12}시`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${ap} ${h12}시`;
  } catch {
    return '시간 미상';
  }
};

export default {
  getTimeAgo,
  updatePostTimes,
  getCurrentTimestamp,
  timestampToNumber,
  sortByTime,
  isOlderThanTwoDays,
  filterRecentPosts,
  getPostAgeInHours,
  isPostLive,
  getRecommendationTransparencyLabel,
};


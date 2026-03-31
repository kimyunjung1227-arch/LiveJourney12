/**
 * 추천 여행지 엔진
 * 고객들이 올린 데이터를 분석하여 추천 여행지를 생성합니다.
 * - "시간"과 "태그" 중심으로 실시간성을 최대한 반영합니다.
 */

import { filterRecentPosts, getTimeAgo, getPostAgeInHours, isPostLive } from './timeUtils';

/**
 * 지역별 통계 계산
 */
const calculateRegionStats = (posts, regionName) => {
  const regionPosts = posts.filter(post => 
    post.location?.includes(regionName) || post.location === regionName
  );

  const total = regionPosts.length;
  const hasCat = (p, slug) =>
    p.category === slug || (Array.isArray(p.categories) && p.categories.includes(slug));
  const bloomCount = regionPosts.filter(p => hasCat(p, 'bloom')).length;
  const foodCount = regionPosts.filter(p => hasCat(p, 'food')).length;
  const waitingCount = regionPosts.filter(p => hasCat(p, 'waiting')).length;
  const scenicCount = regionPosts.filter(p =>
    hasCat(p, 'landmark') || hasCat(p, 'scenic')
  ).length;
  
  // 최근 3시간 / 1시간 / 24시간 이내 게시물 수
  const recent3hPosts = filterRecentPosts(regionPosts, 2, 3);   // 3시간 이내
  const recent1hPosts = filterRecentPosts(regionPosts, 2, 1);   // 1시간 이내
  const recent24hPosts = filterRecentPosts(regionPosts, 1, 24); // 24시간 이내
  const recent3hCount = recent3hPosts.length;
  const recent1hCount = recent1hPosts.length;
  const recent24hCount = recent24hPosts.length;
  
  // 평균 좋아요 수
  const totalLikes = regionPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const avgLikes = total > 0 ? totalLikes / total : 0;
  
  // 24시간 이내 개화 게시물 수 (개화 정보용)
  const bloomRecentPosts = recent24hPosts.filter(p => hasCat(p, 'bloom'));
  const bloomRecentCount = bloomRecentPosts.length;

  // 개화상태 퍼센트 (전체 대비 개화 카테고리 게시물 비율)
  const bloomPercentage = total > 0 ? (bloomCount / total) * 100 : 0;

  // 최근 활동 점수 (실시간성 강조: 3시간/1시간/좋아요 가중치)
  const activityScore = recent3hCount * 3 + recent1hCount * 5 + avgLikes * 0.3;

  // 인기도 점수 (누적 게시물 수 + 좋아요 가중치)
  const popularityScore = total * 1.5 + avgLikes;

  // 가장 최근 게시물 기준 시간 정보
  const latestPost = recent24hPosts[0] || regionPosts
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0);
      const timeB = new Date(b.timestamp || b.createdAt || 0);
      return timeB - timeA;
    })[0];

  const latestTimestamp = latestPost ? (latestPost.timestamp || latestPost.createdAt) : null;
  const lastPostAgeHours = latestTimestamp ? getPostAgeInHours(latestTimestamp) : null;
  const lastPostAgeMinutes = lastPostAgeHours != null ? Math.round(lastPostAgeHours * 60) : null;
  const lastPostTimeAgoLabel = latestTimestamp ? getTimeAgo(latestTimestamp) : null;
  const isLiveRegion = latestTimestamp ? isPostLive(latestTimestamp, 30) : false;

  return {
    regionName,
    total,
    bloomCount,
    foodCount,
    waitingCount,
    scenicCount,
    recentCount: recent24hCount,
    recent3hCount,
    recent1hCount,
    recent24hCount,
    bloomRecentCount,
    avgLikes: Math.round(avgLikes * 10) / 10,
    bloomPercentage: Math.round(bloomPercentage * 10) / 10,
    activityScore: Math.round(activityScore * 10) / 10,
    popularityScore: Math.round(popularityScore * 10) / 10,
    lastPostAgeMinutes,
    lastPostTimeAgoLabel,
    isLive: isLiveRegion,
    // 대표 이미지 (가장 최근 게시물의 images[0] → thumbnail → image)
    representativeImage: (() => {
      const withImage = regionPosts
        .filter(p => p.images?.[0] || p.thumbnail || p.image)
        .sort((a, b) => {
          const timeA = a.timestamp || a.createdAt || a.time || 0;
          const timeB = b.timestamp || b.createdAt || b.time || 0;
          return timeB - timeA;
        });
      const first = withImage[0];
      if (!first) return null;
      const raw = first.images?.[0] ?? first.thumbnail ?? first.image;
      return typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null);
    })(),
    // 최근 게시물 샘플
    recentPosts: recent24hPosts.slice(0, 3),
  };
};

/**
 * 추천 타입별 추천 지역 계산
 */
export const getRecommendedRegions = (posts, recommendationType = 'blooming') => {
  // 모든 지역 목록
  const allRegions = [
    '서울', '부산', '제주', '경주', '강릉', '전주', '여수', '속초',
    '인천', '대구', '광주', '대전', '울산', '수원', '용인', '성남', '고양', '부천', '포항', '창원'
  ];

  // 지역별 통계 계산
  const regionStats = allRegions
    .map(region => calculateRegionStats(posts, region))
    .filter(stat => stat.total > 0); // 게시물이 있는 지역만

  let recommended = [];

  switch (recommendationType) {
    case 'blooming':
      // 최근 24시간 이내 꽃 정보가 활발한 곳
      recommended = regionStats
        .filter(stat => stat.bloomRecentCount > 0)
        .sort((a, b) => {
          // 최근 24시간 꽃 게시물 수 우선, 같으면 가장 최근 업데이트 순
          if (a.bloomRecentCount !== b.bloomRecentCount) {
            return b.bloomRecentCount - a.bloomRecentCount;
          }
          return (a.lastPostAgeMinutes ?? 999999) - (b.lastPostAgeMinutes ?? 999999);
        })
        .slice(0, 10)
        .map(stat => ({
          regionName: stat.regionName,
          title: stat.regionName,
          description: `${stat.lastPostTimeAgoLabel || '방금'} 꽃 소식이 올라왔어요! | 최근 24시간 ${stat.bloomRecentCount}개`,
          image: stat.representativeImage,
          badge: `🌸 실시간 개화`,
          stats: {
            bloomPercentage: stat.bloomPercentage,
            recentCount: stat.recent24hCount,
            bloomRecentCount: stat.bloomRecentCount,
            isLive: stat.isLive
          }
        }));
      break;

    case 'active':
      // 최근 3시간 이내 업로드가 많은 곳 (지금 북적이는 곳)
      recommended = regionStats
        .filter(stat => stat.recent3hCount > 0)
        .sort((a, b) => {
          // 1. 최근 3시간 게시물 수 (밀집도)
          if (a.recent3hCount !== b.recent3hCount) {
            return b.recent3hCount - a.recent3hCount;
          }
          // 2. 최근 1시간 게시물 수
          if (a.recent1hCount !== b.recent1hCount) {
            return b.recent1hCount - a.recent1hCount;
          }
          // 3. 가장 최근 업데이트가 빠른 순
          return (a.lastPostAgeMinutes ?? 999999) - (b.lastPostAgeMinutes ?? 999999);
        })
        .slice(0, 10)
        .map(stat => ({
          regionName: stat.regionName,
          title: stat.regionName,
          description: `${stat.lastPostTimeAgoLabel || '방금'} 새로운 소식이 올라왔어요! | 최근 3시간 ${stat.recent3hCount}개`,
          image: stat.representativeImage,
          badge: stat.isLive ? '🔥 LIVE' : '🔥 지금 북적',
          stats: {
            recentCount: stat.recent24hCount,
            recent3hCount: stat.recent3hCount,
            recent1hCount: stat.recent1hCount,
            avgLikes: stat.avgLikes,
            activityScore: stat.activityScore,
            isLive: stat.isLive,
            lastPostTimeAgoLabel: stat.lastPostTimeAgoLabel
          }
        }));
      break;

    // 'popular', 'food', 'waiting' 타입은 현재 UI에서 사용하지 않음

    case 'scenic':
      // 가볼만한 곳이 많은 곳
      recommended = regionStats
        .filter(stat => stat.scenicCount > 0)
        .sort((a, b) => {
          // 명소 게시물 수 우선, 같으면 최근 업데이트 순
          if (a.scenicCount !== b.scenicCount) {
            return b.scenicCount - a.scenicCount;
          }
          return (a.lastPostAgeMinutes ?? 999999) - (b.lastPostAgeMinutes ?? 999999);
        })
        .slice(0, 10)
        .map(stat => ({
          regionName: stat.regionName,
          title: stat.regionName,
          description: `${stat.lastPostTimeAgoLabel || '방금'} 업데이트된 추천 장소 | 명소 제보 ${stat.scenicCount}개`,
          image: stat.representativeImage,
          badge: `🏞️ 추천장소 ${stat.scenicCount}개`,
          stats: {
            scenicCount: stat.scenicCount,
            recentCount: stat.recent24hCount,
            total: stat.total,
            lastPostTimeAgoLabel: stat.lastPostTimeAgoLabel
          }
        }));
      break;

    default:
      // 기본: 최근 활동이 많은 곳
      recommended = regionStats
        .filter(stat => stat.recent24hCount > 0)
        .sort((a, b) => {
          // 최근 24시간 게시물 수 + 최신성
          if (a.recent24hCount !== b.recent24hCount) {
            return b.recent24hCount - a.recent24hCount;
          }
          return (a.lastPostAgeMinutes ?? 999999) - (b.lastPostAgeMinutes ?? 999999);
        })
        .slice(0, 10)
        .map(stat => ({
          regionName: stat.regionName,
          title: stat.regionName,
          description: `${stat.lastPostTimeAgoLabel || '방금'} 새 소식 | 최근 24시간 ${stat.recent24hCount}개`,
          image: stat.representativeImage,
          badge: stat.isLive ? '🔥 LIVE' : '🔥 활발',
          stats: {
            recentCount: stat.recent24hCount,
            activityScore: stat.activityScore,
            lastPostTimeAgoLabel: stat.lastPostTimeAgoLabel,
            isLive: stat.isLive
          }
        }));
  }

  return recommended;
};

/**
 * 추천 타입 목록 (활발한 지역 먼저 노출)
 */
export const RECOMMENDATION_TYPES = [
  {
    id: 'active',
    name: '🔥 지금 북적이는 곳',
    description: '최근 3시간 동안 게시물이 가장 많이 올라온 지역',
    icon: '🔥'
  },
  {
    id: 'blooming',
    name: '🌸 개화 정보',
    description: '최근 하루 동안 꽃 소식이 활발한 지역',
    icon: '🌸'
  },
  {
    id: 'scenic',
    name: '📍 가볼만한 곳',
    description: '검증된 명소·풍경 제보가 많은 지역',
    icon: '🏞️'
  }
];

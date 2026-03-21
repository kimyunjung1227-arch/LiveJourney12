import { filterRecentPosts } from './timeUtils';
import { buildMediaItemsFromPost } from './postMedia';

/** 추천 여행지 카드용: 해당 지역 게시물의 사진·동영상 피드(posterUri 포함) */
export const buildRegionMediaFeedItems = (posts, regionName, maxItems = 10) => {
    if (!regionName || !Array.isArray(posts)) return [];
    const match = (post) => {
        const loc = String(post.location || '');
        const pn = String(post.placeName || '');
        const dl = String(post.detailedLocation || '');
        return (
            loc.includes(regionName) ||
            pn.includes(regionName) ||
            dl.includes(regionName) ||
            loc === regionName
        );
    };
    const regionPosts = posts
        .filter(match)
        .sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
    const out = [];
    const seen = new Set();
    for (const p of regionPosts) {
        for (const m of buildMediaItemsFromPost(p)) {
            const key = `${m.type}:${m.uri}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(m);
            if (out.length >= maxItems) return out;
        }
    }
    return out;
};

const calculateRegionStats = (posts, regionName) => {
    const regionPosts = posts.filter(post =>
        post.location?.includes(regionName) || post.location === regionName
    );

    const total = regionPosts.length;
    const bloomCount = regionPosts.filter(p => p.category === 'bloom').length;
    const foodCount = regionPosts.filter(p => p.category === 'food').length;
    const scenicCount = regionPosts.filter(p =>
        p.category === 'landmark' || p.category === 'scenic'
    ).length;

    const recentPosts = filterRecentPosts(regionPosts, 7);
    const recentCount = recentPosts.length;

    const totalLikes = regionPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const avgLikes = total > 0 ? totalLikes / total : 0;

    const bloomPercentage = total > 0 ? (bloomCount / total) * 100 : 0;
    const activityScore = recentCount * 2 + avgLikes * 0.5;
    const popularityScore = total * 1.5 + avgLikes;

    return {
        regionName,
        total,
        bloomCount,
        foodCount,
        scenicCount,
        recentCount,
        avgLikes: Math.round(avgLikes * 10) / 10,
        bloomPercentage: Math.round(bloomPercentage * 10) / 10,
        activityScore: Math.round(activityScore * 10) / 10,
        popularityScore: Math.round(popularityScore * 10) / 10,
        representativeImage: regionPosts
            .filter(p => p.image || p.images?.[0])
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0]?.image || regionPosts[0]?.images?.[0] || null,
        recentPosts: recentPosts.slice(0, 3)
    };
};

export const getRecommendedRegions = (posts, recommendationType = 'blooming') => {
    const allRegions = [
        '서울', '부산', '제주', '경주', '강릉', '전주', '여수', '속초',
        '인천', '대구', '광주', '대전', '울산', '수원', '용인', '성남', '고양', '부천', '포항', '창원'
    ];

    const regionStats = allRegions
        .map(region => calculateRegionStats(posts, region))
        .filter(stat => stat.total > 0);

    let recommended = [];

    switch (recommendationType) {
        case 'blooming':
            recommended = regionStats
                .filter(stat => stat.bloomPercentage >= 80 || stat.bloomCount >= 3)
                .sort((a, b) => {
                    if (Math.abs(a.bloomPercentage - b.bloomPercentage) > 5) {
                        return b.bloomPercentage - a.bloomPercentage;
                    }
                    return b.activityScore - a.activityScore;
                })
                .slice(0, 10)
                .map(stat => ({
                    regionName: stat.regionName,
                    title: stat.regionName,
                    description: `개화상태 ${stat.bloomPercentage}% | 최근 게시물 ${stat.recentCount}개`,
                    image: stat.representativeImage,
                    badge: `🌸 개화 ${stat.bloomPercentage}%`,
                    mediaFeed: buildRegionMediaFeedItems(posts, stat.regionName),
                }));
            break;

        case 'active':
            recommended = regionStats
                .filter(stat => stat.recentCount > 0)
                .sort((a, b) => b.activityScore - a.activityScore)
                .slice(0, 10)
                .map(stat => ({
                    regionName: stat.regionName,
                    title: stat.regionName,
                    description: `최근 7일간 ${stat.recentCount}개 게시물`,
                    image: stat.representativeImage,
                    badge: `🔥 활발 ${stat.recentCount}개`,
                    mediaFeed: buildRegionMediaFeedItems(posts, stat.regionName),
                }));
            break;

        case 'popular':
            recommended = regionStats
                .filter(stat => stat.avgLikes > 0)
                .sort((a, b) => b.popularityScore - a.popularityScore)
                .slice(0, 10)
                .map(stat => ({
                    regionName: stat.regionName,
                    title: stat.regionName,
                    description: `평균 좋아요 ${stat.avgLikes} | 총 ${stat.total}개 게시물`,
                    image: stat.representativeImage,
                    badge: `⭐ 인기 ${stat.avgLikes}❤️`,
                    mediaFeed: buildRegionMediaFeedItems(posts, stat.regionName),
                }));
            break;

        case 'food':
            recommended = regionStats
                .filter(stat => stat.foodCount > 0)
                .sort((a, b) => {
                    if (a.foodCount !== b.foodCount) return b.foodCount - a.foodCount;
                    return b.activityScore - a.activityScore;
                })
                .slice(0, 10)
                .map(stat => ({
                    regionName: stat.regionName,
                    title: stat.regionName,
                    description: `맛집 정보 ${stat.foodCount}개 | 최근 게시물 ${stat.recentCount}개`,
                    image: stat.representativeImage,
                    badge: `🍜 맛집 ${stat.foodCount}개`,
                    mediaFeed: buildRegionMediaFeedItems(posts, stat.regionName),
                }));
            break;

        case 'scenic':
            recommended = regionStats
                .filter(stat => stat.scenicCount > 0)
                .sort((a, b) => {
                    if (a.scenicCount !== b.scenicCount) return b.scenicCount - a.scenicCount;
                    return b.activityScore - a.activityScore;
                })
                .slice(0, 10)
                .map(stat => ({
                    regionName: stat.regionName,
                    title: stat.regionName,
                    description: `추천 장소 ${stat.scenicCount}개 | 최근 게시물 ${stat.recentCount}개`,
                    image: stat.representativeImage,
                    badge: `🏞️ 명소 ${stat.scenicCount}개`,
                    mediaFeed: buildRegionMediaFeedItems(posts, stat.regionName),
                }));
            break;

        default:
            recommended = regionStats
                .filter(stat => stat.recentCount > 0)
                .sort((a, b) => b.activityScore - a.activityScore)
                .slice(0, 10)
                .map(stat => ({
                    regionName: stat.regionName,
                    title: stat.regionName,
                    description: `최근 7일간 ${stat.recentCount}개 게시물`,
                    image: stat.representativeImage,
                    badge: `🔥 활발`,
                    mediaFeed: buildRegionMediaFeedItems(posts, stat.regionName),
                }));
    }

    return recommended;
};

export const RECOMMENDATION_TYPES = [
    { id: 'blooming', name: '🌸 개화 정보', description: '개화상태 80% 이상인 곳', icon: '🌸' },
    { id: 'active', name: '🔥 활발한 지역', description: '최근 업로드가 많은 곳', icon: '🔥' },
    { id: 'popular', name: '⭐ 인기 지역', description: '좋아요가 많은 곳', icon: '⭐' },
    { id: 'food', name: '🍜 맛집 정보', description: '맛집 정보가 많은 곳', icon: '🍜' },
    { id: 'scenic', name: '🏞️ 추천 장소', description: '가볼만한 곳이 많은 곳', icon: '🏞️' }
];

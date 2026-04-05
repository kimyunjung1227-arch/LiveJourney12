import {
    getHotFeedAddressLine,
    getCityDongLine,
    getPhotoCaptionLine,
    getAvatarUrls,
    computeHotFeedViewingCount,
    getHotCategoryLabel,
    getPhotoCategoryLabels,
} from './hotPlaceDisplay';

/**
 * 메인·실시간 핫플 더보기 공통 — 카드에 필요한 props 계산
 */
export function buildHotFeedCardProps(post, weatherByRegion = {}) {
    if (!post) return null;
    const title = getHotFeedAddressLine(post);
    const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
    const weather = post.weatherSnapshot || post.weather || weatherByRegion[regionKey] || null;
    const hasWeather = weather && (weather.icon || weather.temperature);
    const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
    const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
    const photoCount = Math.max(1, Math.min(99, (likeCount + commentCount * 2) % 28 + 4));
    const viewingCount = computeHotFeedViewingCount(post);
    const avatars = getAvatarUrls(post);
    const regionShort = post.region || (post.location || '').trim().split(/\s+/).slice(0, 2).join(' ') || '위치';
    const engagementTier = getHotCategoryLabel(post);
    const tagHint = (post.reasonTags && post.reasonTags[0])
        ? String(post.reasonTags[0]).replace(/#/g, '').replace(/_/g, ' ').trim()
        : ((Array.isArray(post.aiHotTags) && post.aiHotTags[0])
            ? String(post.aiHotTags[0]).replace(/#/g, '').trim()
            : '');
    let whyHotLine = '';
    if (post._impactLabel) {
        whyHotLine = post._impactLabel;
    } else if (engagementTier === '급상승') {
        whyHotLine = tagHint ? `최근 이 장소에 관심이 급증했어요. ${tagHint}` : '최근 관심이 급증한 실시간 핫플이에요.';
    } else if (engagementTier === '사람 많음') {
        whyHotLine = tagHint ? `지금 현장 반응이 뜨거워요. ${tagHint}` : '지금 많은 분들이 몰리는 곳이에요.';
    } else if (engagementTier === '인기') {
        whyHotLine = tagHint ? `꾸준히 사랑받는 장소예요. ${tagHint}` : '꾸준히 인기 있는 핫플이에요.';
    } else {
        whyHotLine = tagHint ? `실시간으로 올라온 정보예요. ${tagHint}` : '실시간으로 올라온 핫플 정보예요.';
    }
    const cityDongLine = getCityDongLine(post);
    const hotReasonLabel = engagementTier === '사람 많음' ? '인파 많음' : engagementTier;
    const hotReasonIcon = (() => {
        switch (engagementTier) {
            case '급상승':
                return 'trending_up';
            case '사람 많음':
                return 'groups';
            case '인기':
                return 'favorite';
            default:
                return 'bolt';
        }
    })();
    const photoCaptionLine = getPhotoCaptionLine(post);
    const loc = (post.location || '').trim();
    const hasUserCaption = !!(post.note || '').trim()
        || (!!(post.content || '').trim() && (post.content || '').trim() !== (loc ? `${loc}의 모습` : ''));
    const captionForCard = hasUserCaption ? photoCaptionLine : whyHotLine;
    const photoCategoryLabels = getPhotoCategoryLabels(post);
    return {
        post,
        title,
        regionKey,
        weather,
        hasWeather,
        photoCount,
        viewingCount,
        likeCount,
        avatars,
        regionShort,
        hotReasonLabel,
        hotReasonIcon,
        cityDongLine,
        captionForCard,
        photoCategoryLabels,
    };
}

export function getHotFeedSocialLine(cardProps, socialIndex) {
    if (!cardProps) return '';
    const { viewingCount, likeCount, photoCount } = cardProps;
    const socialLines = [
        `지금 약 ${viewingCount}명이 이 피드를 보고 있어요`,
        `좋아요 ${likeCount}개를 받았어요`,
        `${photoCount}명이 지금 사진 찍는 중이에요`,
    ];
    return socialLines[socialIndex % 3];
}

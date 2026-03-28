/**
 * 메인/공통 — 장소명 아래 한 줄 부가 설명 (예: 김천 교동 · 벚꽃 명소)
 */
export function getLocationSubtitle(post, title) {
    if (!post) return '';
    const detailed = (post.detailedLocation || '').trim();
    if (detailed) return detailed;
    const region = (post.region || '').trim();
    const loc = (post.location || '').trim();
    const tagFromReason = post.reasonTags?.[0]
        ? String(post.reasonTags[0]).replace(/#/g, '').replace(/_/g, ' ').trim()
        : '';
    const tagFromTags = Array.isArray(post.tags) && post.tags[0]
        ? String(post.tags[0]).replace(/^#/, '').trim()
        : '';
    const tag = tagFromReason || tagFromTags;
    const cat = post.categoryName || (post.category === 'food' ? '맛집' : post.category === 'scenic' ? '명소' : post.category === 'cafe' ? '카페' : '');
    const area = region || (loc ? loc.split(/\s+/).slice(0, 2).join(' ') : '');
    if (area && tag) return `${area} · ${tag}`;
    if (area && cat) return `${area} · ${cat}`;
    const note = (post.note || post.content || '').trim().replace(/\s+/g, ' ');
    if (note) return note.length > 44 ? `${note.slice(0, 42)}…` : note;
    return '';
}

/** 메인·더보기 공통 — 지금 N명이 보고 있어요 (좋아요·댓글 기반) */
export function computeHotFeedViewingCount(post) {
    const likeCount = Number(post?.likes ?? post?.likeCount ?? 0) || 0;
    const commentCount = Array.isArray(post?.comments) ? post.comments.length : 0;
    return Math.max(2, Math.min(99, (likeCount + commentCount * 2) % 35 + 6));
}

/** 프로필 썸네일 (소셜 줄용) */
export function getAvatarUrls(post) {
    const urls = [];
    const commenters = Array.isArray(post.comments) ? post.comments : [];
    commenters.forEach((c) => {
        const avatar = c.avatar || c.user?.avatar;
        if (avatar && !urls.includes(avatar)) urls.push(avatar);
    });
    const uploaderAvatar = post.user?.avatar || post.avatar;
    if (uploaderAvatar && !urls.includes(uploaderAvatar)) urls.unshift(uploaderAvatar);
    return urls.slice(0, 3);
}

/**
 * 핫플 카드 1줄: 주소 형태 문자열 (예: 김천 연화지)
 */
export function getHotFeedAddressLine(post) {
    if (!post) return '';
    const loc = (post.location || '').trim();
    if (loc) return loc;
    return (post.placeName || post.detailedLocation || '').trim() || '핫플레이스';
}

/**
 * 그 아래 줄 왼쪽: 도시·동 등 행정단위 (detailedLocation 또는 region+토큰 추정)
 */
export function getCityDongLine(post) {
    if (!post) return '';
    const d = (post.detailedLocation || '').trim();
    if (d) {
        const base = d.split('·')[0].split('|')[0].trim();
        if (base) return base;
    }
    const region = (post.region || '').trim();
    const loc = (post.location || '').trim();
    const tokens = loc.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3) {
        return `${tokens[0]} ${tokens[1]}`;
    }
    if (tokens.length === 2) {
        return `${tokens[0]} ${tokens[1]}`;
    }
    return region || '';
}

/**
 * 사진 카테고리 한글 (명소·카페·맛집 등) — 더보기 피드 2번째 줄용
 */
export function getPhotoCategoryLabel(post) {
    if (!post) return '명소';
    const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
    const note = `${post.note || ''} ${post.content || ''}`.toLowerCase();
    const blob = `${tags} ${note} ${(post.location || '').toLowerCase()}`;
    if (blob.includes('카페') || blob.includes('cafe') || post.category === 'cafe') return '카페';
    if (post.category === 'food' || blob.includes('맛집')) return '맛집';
    if (post.category === 'scenic' || post.category === 'landmark' || blob.includes('명소')) return '명소';
    if (post.categoryName) return String(post.categoryName);
    return '명소';
}

/**
 * 더보기 피드 2번째 줄: 시·군·구 + 동(가능 시) · 사진 카테고리
 * 예: 김천시 교동 · 명소
 */
export function getDongCategoryLine(post) {
    if (!post) return '';
    const cat = getPhotoCategoryLabel(post);
    const cityDong = getCityDongLine(post);
    if (cityDong && cat) return `${cityDong} · ${cat}`;
    return cat || cityDong || '';
}

/**
 * 더보기 피드 3번째 줄: 사진/장소 설명 (약 2줄 분량)
 */
export function getPhotoCaptionLine(post) {
    if (!post) return '';
    const loc = (post.location || '').trim();
    const autoTail = loc ? `${loc}의 모습` : '';
    let raw = (post.note || post.content || '').trim().replace(/\s+/g, ' ');
    if (autoTail && (raw === autoTail || raw === `${loc}의 모습`)) {
        raw = (post.note || '').trim();
    }
    if (!raw) return '실시간으로 공유된 장소예요.';
    return raw.length > 72 ? `${raw.slice(0, 70)}…` : raw;
}

/** 이미지 우하단 분위기: 혼잡도 추정 (다른 화면 호환용) */
export function getHotAtmosphere(post) {
    const likes = Number(post.likes ?? post.likeCount ?? 0) || 0;
    const comments = Array.isArray(post.comments) ? post.comments.length : 0;
    const score = likes + comments * 3;
    return score >= 18 ? 'crowded' : 'relaxed';
}

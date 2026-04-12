/**
 * post.location이 문자열 또는 { name, label, title } 형태일 때 카드/피드용 한 줄 문자열
 */
export function getPostLocationText(post) {
    if (!post) return '';
    const loc = post.location;
    if (loc == null || loc === '') return '';
    if (typeof loc === 'string') return loc.trim();
    if (typeof loc === 'object') {
        return String(loc.name ?? loc.label ?? loc.title ?? loc.address ?? '').trim();
    }
    return String(loc).trim();
}

/**
 * 메인/공통 — 장소명 아래 한 줄 부가 설명 (예: 김천 교동 · 벚꽃 명소)
 */
export function getLocationSubtitle(post, title) {
    if (!post) return '';
    const detailed = (post.detailedLocation || '').trim();
    if (detailed) return detailed;
    const region = (post.region || '').trim();
    const loc = getPostLocationText(post);
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
    const loc = getPostLocationText(post);
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
    const loc = getPostLocationText(post);
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
    const blob = `${tags} ${note} ${getPostLocationText(post).toLowerCase()}`;
    if (blob.includes('카페') || blob.includes('cafe') || post.category === 'cafe') return '카페';
    if (post.category === 'food' || blob.includes('맛집')) return '맛집';
    if (post.category === 'scenic' || post.category === 'landmark' || blob.includes('명소')) return '명소';
    const cn = post.categoryName && String(post.categoryName).trim();
    if (cn) return cn;
    return '명소';
}

/** 메인·핫플 카드 — 위치 우측에 나열할 사진·장소 카테고리 칩 (중복 제거, 최대 max개) */
export function getPhotoCategoryLabels(post, max = 4) {
    if (!post) return ['명소'];
    const primary = getPhotoCategoryLabel(post);
    const out = new Set([primary]);
    const tagStrs = Array.isArray(post.tags) ? post.tags : [];
    const pushFromTag = (raw) => {
        const s = String(raw || '').replace(/^#/, '').trim();
        if (!s || s.length > 14) return;
        const low = s.toLowerCase();
        if (/카페|cafe/.test(low)) out.add('카페');
        else if (/맛집|음식|식당|food/.test(low)) out.add('맛집');
        else if (/명소|해변|바다|산|등산|야경|전시|박물관|호텔|숙소|펜션/.test(low)) {
            if (/해변|바다/.test(low)) out.add('해변');
            else if (/산|등산/.test(low)) out.add('등산');
            else if (/야경/.test(low)) out.add('야경');
            else if (/호텔|숙소|펜션/.test(low)) out.add('숙소');
            else out.add('명소');
        }
    };
    tagStrs.forEach(pushFromTag);
    const reason = [...(Array.isArray(post.reasonTags) ? post.reasonTags : []), ...(Array.isArray(post.aiHotTags) ? post.aiHotTags : [])];
    reason.forEach((t) => pushFromTag(String(t).replace(/#/g, '')));
    return Array.from(out).slice(0, max);
}

/** 이미지 좌상단 핫플 뱃지 (급상승 / 사람 많음 / 인기 / 실시간) */
export function getHotCategoryLabel(post) {
    const likes = Number(post?.likes ?? post?.likeCount ?? 0) || 0;
    const commentCount = Array.isArray(post?.comments) ? post.comments.length : 0;
    const tagStr = [...(Array.isArray(post?.reasonTags) ? post.reasonTags : []), ...(Array.isArray(post?.aiHotTags) ? post.aiHotTags : [])]
        .map((t) => String(t || ''))
        .join(' ');
    if (post?.surgeIndicator === '급상승' || likes > 45) return '급상승';
    if (tagStr.includes('웨이팅') || tagStr.includes('줄') || commentCount > 10 || likes > 28) return '사람 많음';
    if (post?.surgeIndicator === '인기' || likes > 18) return '인기';
    return post?.surgeIndicator || '실시간';
}

/** 실시간 핫플 좌상단 뱃지용 — 카테고리 문구에 맞는 Material Symbol 이름 */
export function getHotFeedBadgeIconName(label) {
    const s = String(label || '').toLowerCase();
    if (s.includes('맛집') || s.includes('음식') || s.includes('식당')) return 'restaurant';
    if (s.includes('카페') || s.includes('cafe')) return 'local_cafe';
    if (s.includes('디저트') || s.includes('베이커')) return 'cake';
    if (s.includes('숙소') || s.includes('호텔') || s.includes('펜션')) return 'hotel';
    if (s.includes('야경') || s.includes('야간')) return 'nightlight';
    if (s.includes('해변') || s.includes('바다') || s.includes('해수욕')) return 'beach_access';
    if (s.includes('산') || s.includes('등산') || s.includes('트레킹')) return 'hiking';
    if (s.includes('전시') || s.includes('박물관') || s.includes('미술')) return 'museum';
    return 'photo_camera';
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
    const loc = getPostLocationText(post);
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

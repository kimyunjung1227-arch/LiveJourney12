/**
 * 메인/핫플 더보기 — 장소명 아래 한 줄 부가 설명 (예: 김천 교동 · 벚꽃 명소)
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

/** 이미지 우하단 분위기: 혼잡도 추정 */
export function getHotAtmosphere(post) {
    const likes = Number(post.likes ?? post.likeCount ?? 0) || 0;
    const comments = Array.isArray(post.comments) ? post.comments.length : 0;
    const score = likes + comments * 3;
    return score >= 18 ? 'crowded' : 'relaxed';
}

// posts 테이블 row → HomeScreen/PostCard가 기대하는 모델로 매핑.

const KEYWORD_TO_LJ = [
  { kw: ['개화', '꽃', '자연', '단풍', '식물'], id: 'nature' },
  { kw: ['날씨', '체감', '비', '눈', '바람'], id: 'weather' },
  { kw: ['이벤트', '축제', '공연', '전시'], id: 'event' },
  { kw: ['혼잡', '대기', '줄', '인파'], id: 'crowd' },
  { kw: ['노을', '야경', '일몰', '밤'], id: 'sunset' },
  { kw: ['영업', '운영', '매장', '오픈'], id: 'business' },
];

const LJ_LABELS = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

/**
 * 기존 posts.category(자유 텍스트)를 lj_category id로 매핑 시도.
 * 매칭 실패 시 null.
 */
export function mapCategoryToLj(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (Object.keys(LJ_LABELS).includes(s)) return s;
  for (const entry of KEYWORD_TO_LJ) {
    if (entry.kw.some((k) => s.includes(k))) return entry.id;
  }
  return null;
}

/**
 * 표시용 카테고리 라벨. lj 매칭되면 lj 라벨, 아니면 원본 텍스트.
 */
export function displayCategoryLabel(raw) {
  const ljId = mapCategoryToLj(raw);
  if (ljId) return LJ_LABELS[ljId];
  return raw || '';
}

function pickFirstImage(images) {
  if (!images) return null;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      return first.url || first.src || first.public_url || first.publicUrl || null;
    }
  }
  return null;
}

/**
 * posts row → HomeScreen/PostCard 모델.
 * 누락 필드는 합리적 기본값(0, false, '익명' 등).
 */
export function normalizePostRow(row) {
  if (!row) return row;
  const photoUrl = pickFirstImage(row.images);
  const exifTakenAt = row.captured_at || row.created_at;
  const expiresAt = exifTakenAt
    ? new Date(new Date(exifTakenAt).getTime() + 48 * 60 * 60 * 1000).toISOString()
    : null;
  const ljCategory = mapCategoryToLj(row.category_name || row.category);

  return {
    id: row.id,
    author_id: row.user_id,
    photo_url: photoUrl,
    category: ljCategory || row.category || row.category_name || null,
    category_raw: row.category_name || row.category || '',
    place_id: null,
    place_name: row.place_name || row.location || row.region || '',
    body: row.content || '',
    exif_taken_at: exifTakenAt,
    expires_at: expiresAt,
    is_on_site: !!row.is_in_app_camera,
    helped_count: 0,
    like_count: row.likes_count ?? 0,
    comment_count: row.comments_count ?? 0,
    save_count: 0,
    created_at: row.created_at,
    author: {
      id: row.user_id,
      nickname: row.author_username || '익명',
      avatar_url: row.author_avatar_url || null,
      helped_count: 0,
    },
  };
}

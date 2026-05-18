// posts 테이블 row → HomeScreen/PostCard가 기대하는 모델로 매핑.

const KEYWORD_TO_LJ = [
  { kw: ['개화', '꽃', '자연', '단풍', '식물', '추천장소', 'bloom', 'flower', 'nature', 'recommend'], id: 'nature' },
  { kw: ['날씨', '체감', '비', '눈', '바람', '맑음', '흐림', 'weather', 'rain', 'snow', 'sunny', 'cloudy'], id: 'weather' },
  { kw: ['이벤트', '축제', '공연', '전시', 'event', 'festival', 'show', 'exhibition'], id: 'event' },
  { kw: ['혼잡', '대기', '줄', '인파', 'crowd', 'queue', 'wait', 'busy'], id: 'crowd' },
  { kw: ['노을', '야경', '일몰', '밤', 'sunset', 'night', 'dusk', 'nightview'], id: 'sunset' },
  { kw: ['영업', '운영', '매장', '오픈', '식당', '카페', 'business', 'shop', 'store', 'open', 'restaurant', 'cafe'], id: 'business' },
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

function extractUrl(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.url || item.src || item.public_url || item.publicUrl || null;
  }
  return null;
}

/** images jsonb (string/array/객체 혼재 허용) → URL 문자열 배열 */
function pickAllImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) {
    return images.map(extractUrl).filter(Boolean);
  }
  // 단일 객체나 문자열이 그대로 들어온 경우 대응
  const single = extractUrl(images);
  return single ? [single] : [];
}

/**
 * posts row → HomeScreen/PostCard 모델.
 * 누락 필드는 합리적 기본값(0, false, '익명' 등).
 */
/**
 * place_id: places 테이블이 없으므로 place_name(또는 location)을 정규화 + URL 인코딩.
 * 같은 장소를 가리키는 게시물끼리 같은 placeId를 갖도록 trim + lower.
 */
export function makePlaceId(name) {
  if (!name) return null;
  const trimmed = String(name).trim().toLowerCase();
  if (!trimmed) return null;
  return encodeURIComponent(trimmed);
}

export function decodePlaceId(placeId) {
  if (!placeId) return '';
  try {
    return decodeURIComponent(placeId);
  } catch (_) {
    return placeId;
  }
}

export function normalizePostRow(row) {
  if (!row) return row;
  const photos = pickAllImages(row.images);
  const exifTakenAt = row.captured_at || row.created_at;
  const expiresAt = exifTakenAt
    ? new Date(new Date(exifTakenAt).getTime() + 48 * 60 * 60 * 1000).toISOString()
    : null;
  const ljCategory = mapCategoryToLj(row.category_name || row.category);
  const placeName = row.place_name || row.location || row.region || '';

  return {
    id: row.id,
    author_id: row.user_id,
    photo_url: photos[0] || null,
    photos,
    category: ljCategory || row.category || row.category_name || null,
    category_raw: row.category_name || row.category || '',
    place_id: makePlaceId(placeName),
    place_name: placeName,
    region: row.region || '',
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

/**
 * 게시물의 베스트컷 점수: likes + saves*1.5 + (going은 미지원이라 제외)
 */
export function bestCutScore(post) {
  if (!post) return 0;
  return (post.like_count ?? 0) + (post.save_count ?? 0) * 1.5;
}

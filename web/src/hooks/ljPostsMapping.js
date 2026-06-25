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
 * place_id: places 테이블이 없으므로 place_name(또는 location)을 정규화한 키.
 * - trim + toLowerCase 만 적용. URL 인코딩은 하지 않는다.
 *   React Router가 navigate 시 자동 인코딩, useParams에서 자동 디코딩하므로
 *   여기서 한 번 더 인코딩하면 useParams의 결과와 비교 시 어긋난다.
 */
export function makePlaceId(name) {
  if (!name) return null;
  const trimmed = String(name).trim().toLowerCase();
  return trimmed || null;
}

/**
 * URL에서 받은 placeId를 표시용 이름으로 변환. 보통 useParams가 이미 디코드 해
 * 주지만, 과거에 인코딩된 placeId를 가진 외부 링크 호환을 위해 % 문자가 보이면
 * 한 번 더 디코드 시도.
 */
export function decodePlaceId(placeId) {
  if (!placeId) return '';
  if (/%[0-9A-Fa-f]{2}/.test(placeId)) {
    try {
      return decodeURIComponent(placeId);
    } catch (_) {
      /* ignore */
    }
  }
  return placeId;
}

/**
 * EXIF 카메라 촬영 시간을 가능한 소스에서 우선 추출.
 * 1) exif_data.tags.DateTimeOriginal — exifr가 갤러리 사진에서 추출한 원본 촬영 시간
 * 2) exif_data.tags.CreateDate / ModifyDate
 * 3) exif_data.photoDate / taken_at — 업로드 훅이 정규화해 둔 값
 * 4) captured_at 컬럼
 * 5) created_at 컬럼 (최후 폴백)
 */
function pickExifTakenAt(row) {
  if (!row) return null;
  const exif = row.exif_data && typeof row.exif_data === 'object' ? row.exif_data : null;
  if (exif) {
    const tags = exif.tags && typeof exif.tags === 'object' ? exif.tags : null;
    const fromTags =
      tags?.DateTimeOriginal || tags?.CreateDate || tags?.ModifyDate || null;
    if (fromTags) return fromTags;
    const flat = exif.photoDate || exif.taken_at || null;
    if (flat) return flat;
  }
  return row.captured_at || row.created_at || null;
}

export function normalizePostRow(row) {
  if (!row) return row;
  const photos = pickAllImages(row.images);
  const exifTakenAt = pickExifTakenAt(row);
  const expiresAt = exifTakenAt
    ? new Date(new Date(exifTakenAt).getTime() + 48 * 60 * 60 * 1000).toISOString()
    : null;
  const ljCategory = mapCategoryToLj(row.category_name || row.category);
  const placeName = row.place_name || row.location || row.region || '';

  const weather = row.weather && typeof row.weather === 'object' ? row.weather : null;

  const title =
    row.exif_data && typeof row.exif_data === 'object' && typeof row.exif_data.title === 'string'
      ? row.exif_data.title
      : null;

  return {
    id: row.id,
    author_id: row.user_id,
    photo_url: photos[0] || null,
    photos,
    title,
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
    weather,
    weatherSnapshot: weather,
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

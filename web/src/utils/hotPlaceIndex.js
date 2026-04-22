import { getDisplayImageUrl } from '../api/upload';
import { normalizePlaceIdentityKey, pickPreferredPlaceDisplayLabel } from './placeKeyNormalize';

// 거리 계산 (km)
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getPostTimeMs = (post) => {
  const raw = post?.timestamp || post?.createdAt || post?.time;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const getPostCoords = (post) => {
  const c = post?.coordinates;
  if (c && (c.lat != null || c.latitude != null) && (c.lng != null || c.longitude != null)) {
    return { lat: Number(c.lat ?? c.latitude), lng: Number(c.lng ?? c.longitude) };
  }
  const loc = post?.location;
  if (loc && typeof loc === 'object') {
    const lat = loc.lat ?? loc.latitude;
    const lng = loc.lng ?? loc.lon ?? loc.longitude;
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
};

const getPlaceKeyRaw = (post) =>
  String(post?.placeName || post?.detailedLocation || post?.location || '알 수 없는 장소').trim();

const getPlaceImage = (post) =>
  getDisplayImageUrl(
    post?.images?.[0] || post?.thumbnail || post?.image || post?.imageUrl || post?.videos?.[0] || '',
    { allowBlob: true },
  );

// 장소 타입 추론 (카페/맛집/포토존/액티비티/기타)
const inferPlaceKind = (post) => {
  if (!post) return '기타';
  const parts = [
    post.placeName,
    post.detailedLocation,
    post.location,
    Array.isArray(post.tags) ? post.tags.join(' ') : '',
    post.categoryName,
    post.category
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (parts.includes('카페')) return '카페';
  if (parts.includes('맛집') || parts.includes('restaurant') || parts.includes('식당') || parts.includes('food')) return '맛집';
  if (
    parts.includes('포토존') ||
    parts.includes('전망대') ||
    parts.includes('뷰포인트') ||
    parts.includes('전망') ||
    (post.category === 'scenic') ||
    (typeof post.categoryName === 'string' && post.categoryName.includes('야경'))
  ) {
    return '포토존';
  }
  if (parts.includes('액티비티') || parts.includes('활동') || parts.includes('체험') || parts.includes('activity')) {
    return '액티비티';
  }
  return '기타';
};

const decayWeight = (ageMinutes, decayMinutes = 20) => {
  if (ageMinutes <= 0) return 1;
  return Math.exp(-ageMinutes / decayMinutes);
};

const isRealtimeVerified = (post) => {
  const exif = post?.exifData?.gpsCoordinates;
  const coords = getPostCoords(post);
  if (!exif || !coords) return false;
  const distKm = getDistanceKm(coords.lat, coords.lng, exif.lat, exif.lng);
  return distKm <= 0.05; // 50m
};

const isLiveCapture = (post) =>
  post?.captureSource === 'camera' ||
  post?.isLiveCapture === true ||
  post?.isInAppCamera === true;

const normalizeByMax = (value, max) => (max > 0 ? value / max : 0);

export const computeHotPlaces = (posts, searchEvents, options = {}) => {
  const now = Date.now();
  const {
    radiusMeters = 300,
    densityWindowMinutes = 10,
    activityWindowMinutes = 60,
    interestWindowMinutes = 15,
    weights = { d: 0.4, a: 0.4, i: 0.2 }
  } = options;

  const radiusKm = radiusMeters / 1000;

  // 동일 장소(띄어쓰기 표기만 다른 경우 포함) 기준 그룹핑
  /** @type {Map<string, { items: { post: unknown, coords: unknown }[], labels: Set<string> }>} */
  const placeByNorm = new Map();
  (posts || []).forEach((post) => {
    const coords = getPostCoords(post);
    if (!coords) return;
    const raw = getPlaceKeyRaw(post);
    const norm = normalizePlaceIdentityKey(raw);
    if (!norm) return;
    let entry = placeByNorm.get(norm);
    if (!entry) {
      entry = { items: [], labels: new Set() };
      placeByNorm.set(norm, entry);
    }
    entry.items.push({ post, coords });
    entry.labels.add(raw);
  });

  const placeGroups = new Map();
  placeByNorm.forEach((entry, norm) => {
    const key = pickPreferredPlaceDisplayLabel([...entry.labels]) || norm;
    placeGroups.set(key, entry.items);
  });

  // 검색 이벤트 그룹핑
  const interestMap = new Map();
  (searchEvents || []).forEach((e) => {
    if (!e?.term || !e?.ts) return;
    const ageMin = (now - e.ts) / (1000 * 60);
    if (ageMin > interestWindowMinutes) return;
    const term = String(e.term).toLowerCase();
    interestMap.set(term, (interestMap.get(term) || 0) + decayWeight(ageMin, 10));
  });

  const results = [];
  let maxD = 0;
  let maxA = 0;
  let maxI = 0;

  placeGroups.forEach((items, key) => {
    // 중심 좌표(최근 1시간 게시물 평균)
    const recent = items.filter(({ post }) => (now - getPostTimeMs(post)) <= activityWindowMinutes * 60 * 1000);
    const target = recent.length > 0 ? recent : items;
    const center = target.reduce((acc, { coords }) => {
      acc.lat += coords.lat;
      acc.lng += coords.lng;
      return acc;
    }, { lat: 0, lng: 0 });
    center.lat /= target.length;
    center.lng /= target.length;

    // D: 밀도 (최근 10분 내, 반경 내 유저 수/게시물 수)
    const densityUsers = new Set();
    let densityScore = 0;
    items.forEach(({ post, coords }) => {
      const ageMin = (now - getPostTimeMs(post)) / (1000 * 60);
      if (ageMin > densityWindowMinutes) return;
      const distKm = getDistanceKm(center.lat, center.lng, coords.lat, coords.lng);
      if (distKm > radiusKm) return;
      const w = decayWeight(ageMin, 5);
      densityScore += w;
      const uid = post.userId || (typeof post.user === 'string' ? post.user : post.user?.id) || post.user;
      if (uid) densityUsers.add(String(uid));
    });
    const D = densityScore + densityUsers.size * 0.5;

    // A: 활동 (최근 1시간 업로드 가속도)
    let activityScore = 0;
    let last15 = 0;
    const userRecentCount = new Map();
    items.forEach(({ post }) => {
      const ageMin = (now - getPostTimeMs(post)) / (1000 * 60);
      if (ageMin > activityWindowMinutes) return;
      const uid = post.userId || (typeof post.user === 'string' ? post.user : post.user?.id) || post.user;
      const userKey = uid ? String(uid) : null;
      if (userKey) {
        userRecentCount.set(userKey, (userRecentCount.get(userKey) || 0) + 1);
        if (userRecentCount.get(userKey) > 3) return; // 어뷰징 차단
      }
      const base = decayWeight(ageMin, 20);
      const liveBoost = isLiveCapture(post) ? 2 : 1;
      const trustBoost = isRealtimeVerified(post) ? 1.2 : 1;
      activityScore += base * liveBoost * trustBoost;
      if (ageMin <= 15) last15 += 1;
    });
    const A = activityScore + last15 * 0.3;

    // I: 관심도 (최근 15분 검색 모멘텀)
    let I = 0;
    const keyLower = key.toLowerCase();
    interestMap.forEach((score, term) => {
      if (keyLower.includes(term) || term.includes(keyLower)) {
        I += score;
      }
    });

    maxD = Math.max(maxD, D);
    maxA = Math.max(maxA, A);
    maxI = Math.max(maxI, I);

    const samplePost =
      items.find(({ post }) => (post?.content || post?.note))?.post ||
      items[0]?.post;

    const usersSet = new Set(
      items.map(({ post }) => post.userId || post.user?.id || post.user).filter(Boolean)
    );

    results.push({
      key,
      center,
      image: getPlaceImage(samplePost),
      raw: { D, A, I },
      counts: {
        posts: items.length,
        users: usersSet.size
      },
      rising: last15 >= 3,
      verified: items.some(({ post }) => isRealtimeVerified(post)),
      // UI용 추가 정보
      samplePost,
      kind: inferPlaceKind(samplePost),
      viewerCount: usersSet.size
    });
  });

  // 정규화 + H 계산
  const scored = results.map((r) => {
    const d = normalizeByMax(r.raw.D, maxD);
    const a = normalizeByMax(r.raw.A, maxA);
    const i = normalizeByMax(r.raw.I, maxI);
    const H = (weights.d * d) + (weights.a * a) + (weights.i * i);
    return { ...r, score: H, normalized: { d, a, i } };
  });

  return scored.sort((a, b) => b.score - a.score);
};

export const loadSearchEvents = (maxAgeMinutes = 60 * 24) => {
  try {
    const raw = JSON.parse(localStorage.getItem('searchEvents') || '[]');
    const now = Date.now();
    return raw.filter(e => e?.ts && (now - e.ts) <= maxAgeMinutes * 60 * 1000);
  } catch {
    return [];
  }
};


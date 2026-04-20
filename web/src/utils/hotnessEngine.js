/**
 * [라이브저니] 실시간 핫플 — 핫니스 엔진 (Hotness Engine)
 * "얼마나 뜨거운가?" — Hotness = (Time × Density) + Conversion
 * 이 수치가 높을수록 핫플 구역 상단 배치
 */

import { getPostAgeInHours } from './timeUtils';
import { getConversionCountByPost, getConversionCount } from './conversionEvents';
import { filterVerifiedPosts } from './hotspotVerification';

const getUserIdForPost = (post) => {
  const uid = post?.userId ?? post?.user?.id ?? post?.user?.uid ?? post?.user ?? post?.authorId ?? post?.author?.id;
  return uid != null ? String(uid) : '';
};

const getPlaceKey = (post) =>
  String(post?.location || post?.placeName || post?.detailedLocation || post?.region || '').trim();

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
  if (post?.location && typeof post.location === 'object') {
    const lat = post.location.lat ?? post.location.latitude;
    const lng = post.location.lng ?? post.location.lon ?? post.location.longitude;
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
};

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const RADIUS_KM = 0.5;
const DENSITY_WINDOW_MINUTES = 60;

/**
 * 시간 신선도 (Time)
 * 30분 이내 = 1.0, 1시간 = 0.5, 3시간 경과 시 0으로 수렴
 */
export const getTimeFreshness = (post) => {
  const ageHours = getPostAgeInHours(post?.timestamp || post?.createdAt);
  if (ageHours <= 0.5) return 1;
  if (ageHours >= 3) return 0;
  return 1 - (ageHours - 0.5) / 2.5;
};

/**
 * LHI 최신성: 1h 이내 가중치 최대, 3h부터 급격히 감점
 * - 0~1 범위로 정규화
 */
export const getRecencyBurst = (post) => {
  const ageMin = Math.max(0, getPostAgeInHours(post?.timestamp || post?.createdAt) * 60);
  if (ageMin <= 60) return 1;
  if (ageMin >= 180) return 0.08;
  // 60~180분 구간은 급격히 감소
  const t = (ageMin - 60) / 120; // 0~1
  return Math.max(0.08, 1 - t * t * 0.92);
};

const collectTextForSafety = (post) => {
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  const reasons = Array.isArray(post?.reasonTags) ? post.reasonTags : [];
  const ai = Array.isArray(post?.aiHotTags) ? post.aiHotTags : [];
  const parts = [
    post?.note,
    post?.content,
    post?.location,
    post?.placeName,
    post?.detailedLocation,
    post?.region,
    ...tags,
    ...reasons,
    ...ai,
  ]
    .map((x) => (x == null ? '' : String(x)))
    .filter(Boolean);
  return parts.join(' ');
};

const NEGATIVE_PATTERNS = [
  /사람\s*너무\s*많/i,
  /너무\s*많/i,
  /혼잡|북적|붐빔|미어터/i,
  /기다림|웨이팅|대기|줄\s*길/i,
  /꽃\s*다\s*졌|꽃\s*졌|시들/i,
  /실망|별로|비추|추천\s*안/i,
  /폐쇄|공사\s*중|통제/i,
];

const computeSafetyPenalty = (postsInPlace, nowMs) => {
  const windowMs = 2 * 60 * 60 * 1000;
  const recent = (postsInPlace || []).filter((p) => nowMs - getPostTimeMs(p) <= windowMs);
  if (recent.length === 0) return { penalty: 1, warning: '' };
  let neg = 0;
  recent.forEach((p) => {
    const text = collectTextForSafety(p);
    if (!text) return;
    if (NEGATIVE_PATTERNS.some((re) => re.test(text))) neg += 1;
  });
  const ratio = neg / Math.max(1, recent.length);
  if (neg >= 3 || ratio >= 0.45) {
    return { penalty: 0.62, warning: '주의: 현재 혼잡/상태 변화' };
  }
  if (neg >= 2 || ratio >= 0.3) {
    return { penalty: 0.78, warning: '주의: 현장 상태 변동' };
  }
  return { penalty: 1, warning: '' };
};

/**
 * 밀도 (Density): 특정 반경 내 유사 장소 언급/피드 급증 시 가속
 */
const getDensityScore = (post, allPosts) => {
  const coords = getPostCoords(post);
  if (!coords) return 0.3;
  const now = Date.now();
  const windowMs = DENSITY_WINDOW_MINUTES * 60 * 1000;
  let count = 0;
  (allPosts || []).forEach((p) => {
    if (p.id === post.id) return;
    const pt = getPostTimeMs(p);
    if (now - pt > windowMs) return;
    const pc = getPostCoords(p);
    if (!pc) return;
    const dist = getDistanceKm(coords.lat, coords.lng, pc.lat, pc.lng);
    if (dist <= RADIUS_KM) count += 1;
  });
  const base = 0.2 + Math.min(1, count / 10) * 0.8;
  return base;
};

/**
 * 행동 전환 (Conversion): 길찾기/전화 등 클릭 비율 — 매출과 직결
 * 전환 횟수를 정규화하여 0~1 근사
 */
const getConversionScore = (postId, conversionMap, maxConversion) => {
  const n = conversionMap[postId] || 0;
  if (maxConversion <= 0) return n > 0 ? 0.5 : 0;
  return Math.min(1, n / Math.max(1, maxConversion));
};

/**
 * 단일 게시물 핫니스 점수
 * Hotness = (Time × Density) + Conversion
 */
export const computeHotness = (post, allPosts, conversionMap, maxConversion) => {
  const time = getTimeFreshness(post);
  const density = getDensityScore(post, allPosts);
  const conversion = getConversionScore(post.id, conversionMap || {}, maxConversion || 1);
  const hotness = time * density + conversion;
  return {
    hotness,
    time,
    density,
    conversion,
  };
};

/**
 * 검증 통과한 게시물에 대해 핫니스 계산 후 랭킹 정렬
 * @returns {Array<{ post, rank, hotness, timeFreshness, impactLabel }>}
 */
export const rankHotspotPosts = (posts, options = {}) => {
  const { verifyFirst = true, maxItems = 100 } = options;
  let list = Array.isArray(posts) ? [...posts] : [];
  if (verifyFirst) {
    list = filterVerifiedPosts(list, { minScore: 0.35, attachScore: true });
  }
  const postIds = list.map((p) => p.id).filter(Boolean);
  const conversionMap = getConversionCountByPost(postIds);
  const maxConversion = Math.max(1, ...Object.values(conversionMap));

  const withScore = list.map((post) => {
    const { hotness, time, conversion } = computeHotness(post, list, conversionMap, maxConversion);
    const likes = Number(post.likes ?? post.likeCount ?? 0) || 0;
    const commentsCount = Math.max(
      0,
      Number(post.commentCount ?? post.commentsCount ?? (Array.isArray(post.comments) ? post.comments.length : 0)) || 0
    );
    const conversionCount = getConversionCount(post.id);
    return { post, hotness, timeFreshness: time, conversion, likes, commentsCount, conversionCount };
  });

  withScore.sort((a, b) => b.hotness - a.hotness);

  const ranked = withScore.slice(0, maxItems).map((item, index) => {
    const rank = index + 1;
    const impactLabel = getImpactLabel(item, rank);
    return {
      ...item,
      rank,
      impactLabel,
    };
  });

  return ranked;
};

/**
 * LHI(장소 단위) 랭킹
 * LHI = Wr*최신성 + Wd*업로드밀도(서로 다른 유저) + Wt*컴퍼스(신뢰)
 */
export const rankHotspotPlaces = (posts, options = {}) => {
  const { verifyFirst = true, maxItems = 30 } = options;
  const now = Date.now();
  let list = Array.isArray(posts) ? [...posts] : [];
  if (verifyFirst) {
    list = filterVerifiedPosts(list, { minScore: 0.35, attachScore: true });
  }

  const byPlace = new Map();
  list.forEach((p) => {
    const key = getPlaceKey(p);
    if (!key) return;
    const bucket = byPlace.get(key) || [];
    bucket.push(p);
    byPlace.set(key, bucket);
  });

  const WR = 2.2;
  const WD = 2.4;
  const WT = 0.9;

  const items = [...byPlace.entries()].map(([key, postsInPlace]) => {
    const sorted = [...postsInPlace].sort((a, b) => getPostTimeMs(b) - getPostTimeMs(a));
    const representative = sorted[0] || null;
    const latestMs = representative ? getPostTimeMs(representative) : 0;

    // 최신성: 장소 내 "가장 최근 포스트" 기준
    const recency = representative ? getRecencyBurst(representative) : 0;

    // 업로드 밀도: 60분 내 서로 다른 유저 수를 비선형 가속
    const windowMs = 60 * 60 * 1000;
    const users = new Set();
    sorted.forEach((p) => {
      if (now - getPostTimeMs(p) > windowMs) return;
      const uid = getUserIdForPost(p);
      if (uid) users.add(uid);
    });
    const compassCount = users.size;
    const density = Math.min(2.3, (compassCount / 5) ** 2 * 1.6 + (compassCount >= 5 ? 0.7 : 0));

    // 컴퍼스 신뢰: 검증 스코어 평균(0~1)
    let trustSum = 0;
    let trustN = 0;
    sorted.slice(0, 12).forEach((p) => {
      const v = p?._verification?.trustWeight ?? p?._verification?.score;
      if (typeof v === 'number' && Number.isFinite(v)) {
        trustSum += v;
        trustN += 1;
      }
    });
    const trustAvg = trustN > 0 ? trustSum / trustN : 0.6;
    const trustPercent = Math.max(70, Math.min(99, Math.round(trustAvg * 100)));

    const safety = computeSafetyPenalty(sorted, now);
    const scoreRaw = WR * recency + WD * density + WT * trustAvg;
    const score = scoreRaw * safety.penalty;

    return {
      key,
      score,
      scoreRaw,
      recency,
      density,
      trustAvg,
      trustPercent,
      compassCount,
      latestMs,
      representative,
      warning: safety.warning,
    };
  });

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, maxItems).map((x, i) => ({ ...x, rank: i + 1 }));
};

/**
 * 임팩트 라벨: "이 정보 보고 N명 이동 중", "방금 올라옴" 등
 */
function getImpactLabel(item, rank) {
  const { post, timeFreshness, likes, conversionCount } = item;
  if (conversionCount > 0) return `이 정보 보고 ${Math.min(99, conversionCount)}명 이동 중`;
  if (timeFreshness >= 1) return '방금 올라옴';
  if (timeFreshness >= 0.7) return '방금 전';
  if (timeFreshness >= 0.3) return '최근 정보';
  if (likes >= 50) return '많은 사람이 참고했어요';
  if (rank <= 3) return `핫플 ${rank}위`;
  return null;
}

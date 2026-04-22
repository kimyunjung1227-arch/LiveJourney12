/**
 * 신뢰 지수 매트릭스 (Compass Score Matrix)
 * 데이터 무결성(Integrity) + 사용자 기여도(Contribution)를 수학적으로 결합한 구조.
 *
 * 공식: CS = (A×w1) + (V×w2) + (R×w3) - (P×w4)
 * - A: Activity Index (업로드 빈도, GPS 인증, 정보 상세도)
 * - V: Validation Index (타인의 '정확해요' 추천, 추천인 등급 가중치 가능)
 * - R: Retention/Freshness (48시간 이내 업로드 보너스)
 * - P: Penalty (신고·중복·조작 시 감점)
 */

const USER_ACCURACY_MARKS_KEY = 'userAccuracyMarks';
const POST_ACCURACY_COUNT_KEY = 'postAccuracyCount';
const TRUST_PENALTY_KEY = 'trustPenalty';
const TRUST_LAST_ACTIVE_KEY = 'trustLastActive';
const COMPASS_SCORE_CACHE_KEY = 'compassScoreCache';

// 서버 운영 전환: localStorage 제거 → 세션 메모리 캐시
const memory = {
  userAccuracyMarks: {}, // userId -> { [postId]: true }
  postAccuracyCount: {}, // postId -> count
  trustPenalty: {}, // userId -> number
  trustLastActive: {}, // userId -> ts
  compassScoreCache: {}, // userId -> { score, ts }
};

/** 가중치 (검증 점수 w2 강조) */
const WEIGHTS = { w1: 1, w2: 3, w3: 0.5, w4: 2 };

/** 48시간(ms) */
const FRESHNESS_MS = 48 * 60 * 60 * 1000;

/** 감쇠: 비활동 시 월별 차감 비율 (0.02 = 2% per month) */
const DECAY_RATE_PER_MONTH = 0.02;

/** 게시물 작성자 ID 추출 */
const getPostAuthorId = (post) => {
  if (!post) return null;
  const id = post.userId ?? (typeof post.user === 'string' ? post.user : post.user?.id) ?? post.user;
  return id != null ? String(id) : null;
};

/** 게시물이 GPS/위치 인증된 것으로 간주 (좌표 또는 상세 위치 있음) */
const hasLocationAuth = (post) => {
  return !!(post?.coordinates || (post?.latitude != null && post?.longitude != null) || (post?.location && post.location.trim().length > 0));
};

/** 게시물이 48시간 이내인지 */
const isWithin48h = (post) => {
  const t = post?.createdAt || post?.timestamp || post?.created || 0;
  const ts = typeof t === 'string' ? new Date(t).getTime() : Number(t) || 0;
  return ts > 0 && Date.now() - ts < FRESHNESS_MS;
};

/**
 * A (Activity Index): 업로드 빈도, GPS 인증 수, 정보 상세도
 * 캡하여 한 축이 과도하게 지배하지 않도록 함.
 */
const computeActivityIndex = (myPosts) => {
  const uploadCount = myPosts.length;
  const gpsAuthCount = myPosts.filter(hasLocationAuth).length;
  let detailBonus = 0;
  myPosts.forEach((p) => {
    const caption = (p.caption || p.description || p.content || '').trim();
    if (caption.length >= 50) detailBonus += 5;
    if (caption.length >= 100) detailBonus += 10;
  });
  const A = Math.min(uploadCount * 8, 400) + Math.min(gpsAuthCount * 15, 300) + Math.min(detailBonus, 100);
  return Math.round(A);
};

/**
 * V (Validation Index): 타인의 '정확해요' 추천 수
 * (추후: 추천인 등급에 따라 가중치 차등 적용 가능)
 */
const computeValidationIndex = (myPosts, counts) => {
  const total = myPosts.reduce((sum, p) => sum + (Number(counts[p.id]) || 0), 0);
  return Math.round(total * 12);
};

/**
 * R (Retention/Freshness): 48시간 이내 업로드 보너스
 */
const computeFreshnessBonus = (myPosts) => {
  const recent = myPosts.filter(isWithin48h).length;
  return Math.round(recent * 25);
};

/**
 * P (Penalty): 허위 신고·중복·조작 시 감점 (현재는 0, 추후 연동)
 */
const computePenalty = (userId) => {
  const uid = userId ? String(userId) : '';
  return Number(memory.trustPenalty[uid]) || 0;
};

/**
 * Compass Score (CS) 산출: CS = (A×w1) + (V×w2) + (R×w3) - (P×w4)
 * userId 생략 시 현재 로그인 사용자.
 * postsOverride: 해당 사용자 게시물 배열을 넘기면 localStorage 대신 사용 (다른 사용자 프로필용)
 */
export const getCompassScore = (userId = null, postsOverride = null) => {
  try {
    const targetUserId = userId != null ? String(userId) : null;
    if (!targetUserId) return 0;

    let myPosts;
    if (Array.isArray(postsOverride) && postsOverride.length >= 0) {
      myPosts = postsOverride.filter((p) => getPostAuthorId(p) === targetUserId);
    } else {
      myPosts = [];
    }
    const counts = memory.postAccuracyCount || {};

    const A = computeActivityIndex(myPosts);
    const V = computeValidationIndex(myPosts, counts);
    const R = computeFreshnessBonus(myPosts);
    const P = computePenalty(targetUserId);

    let CS = (A * WEIGHTS.w1) + (V * WEIGHTS.w2) + (R * WEIGHTS.w3) - (P * WEIGHTS.w4);
    CS = Math.max(0, Math.round(CS));

    return CS;
  } catch {
    return 0;
  }
};

/**
 * 감쇠 적용: 비활동 시 서서히 감소 (마지막 활동 기준)
 * lastActive는 게시물 최신 작성일 또는 정확해요 수신일로 갱신 가능.
 */
const applyDecay = (rawScore, userId) => {
  try {
    const uid = userId ? String(userId) : '';
    const lastActive = memory.trustLastActive[uid];
    if (!lastActive || rawScore <= 0) return rawScore;
    const months = (Date.now() - new Date(lastActive).getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (months < 1) return rawScore;
    const decay = 1 - Math.min(0.5, months * DECAY_RATE_PER_MONTH);
    return Math.max(0, Math.round(rawScore * decay));
  } catch {
    return rawScore;
  }
};

/**
 * Compass 누적 점수 (내부·뱃지 조건용): 감쇠 적용
 * postsOverride: 해당 사용자 게시물 배열이 있으면 그걸로 계산 (다른 사용자 프로필용)
 */
export const getTrustRawScore = (userId = null, postsOverride = null) => {
  const raw = getCompassScore(userId, postsOverride);
  const targetUserId = userId != null ? String(userId) : null;
  return applyDecay(raw, targetUserId);
};

/**
 * 등급 체계 — Compass 누적(minScore) + GPS·정확해요 게이트
 * 화면에 보이는 점수는 단계마다 0~100(진행률). 상위 등급일수록 같은 활동으로 채워지는 구간이 길어짐(더딤).
 * Lv.1 노마드 → … → Lv.5 앰버서더
 */
export const TRUST_GRADES = [
  { id: 'nomad', name: '노마드', minScore: 0, minGpsAuth: 0, minAccuracy: 0, icon: '🧭', badgeId: '노마드' },
  { id: 'tracker', name: '트래커', minScore: 1200, minGpsAuth: 10, minAccuracy: 25, icon: '📍', badgeId: '트래커' },
  { id: 'guide', name: '가이드', minScore: 4500, minGpsAuth: 25, minAccuracy: 60, icon: '📖', badgeId: '가이드' },
  { id: 'master', name: '마스터', minScore: 16000, minGpsAuth: 50, minAccuracy: 120, icon: '🏆', badgeId: '마스터' },
  { id: 'ambassador', name: '앰버서더', minScore: 52000, minGpsAuth: 100, minAccuracy: 250, icon: '👑', badgeId: '앰버서더' }
];

/**
 * 사용자별 GPS 인증 수, 정확해요 수 조회 (등급 조건 공통 사용)
 * postsOverride: 해당 사용자 게시물 배열이 있으면 그걸로 집계 (다른 사용자 프로필용)
 */
export const getTrustCounts = (userId = null, postsOverride = null) => {
  try {
    const targetUserId = userId != null ? String(userId) : null;
    if (!targetUserId) return { gpsAuthCount: 0, totalAccuracy: 0 };

    let myPosts;
    if (Array.isArray(postsOverride) && postsOverride.length >= 0) {
      myPosts = postsOverride.filter((p) => getPostAuthorId(p) === targetUserId);
    } else {
      myPosts = [];
    }
    const counts = memory.postAccuracyCount || {};

    const gpsAuthCount = myPosts.filter(hasLocationAuth).length;
    const totalAccuracy = myPosts.reduce((sum, p) => sum + (Number(counts[p.id]) || 0), 0);
    return { gpsAuthCount, totalAccuracy };
  } catch {
    return { gpsAuthCount: 0, totalAccuracy: 0 };
  }
};

/**
 * 필수 조건 달성 여부 (모든 등급 동일 기준: 점수 + GPS + 정확해요)
 * postsOverride: 해당 사용자 게시물 배열 (다른 사용자 프로필용)
 */
export const checkGatekeeping = (userId = null, postsOverride = null) => {
  const { gpsAuthCount, totalAccuracy } = getTrustCounts(userId, postsOverride);
  const gates = TRUST_GRADES.slice(1).map((g, idx) => ({
    level: idx + 2,
    name: g.name,
    minScore: g.minScore,
    minGpsAuth: g.minGpsAuth,
    minAccuracy: g.minAccuracy,
    currentGps: gpsAuthCount,
    currentAccuracy: totalAccuracy,
    passedGps: gpsAuthCount >= g.minGpsAuth,
    passedAccuracy: totalAccuracy >= g.minAccuracy
  }));
  return { gates, gpsAuthCount, totalAccuracy };
};

/**
 * 점수에 해당하는 등급 정보 반환 (동일 조건: 점수 + GPS 인증 수 + 정확해요 수)
 * @param {number} score - Compass Score
 * @param {string|null} userId - GPS/정확해요 집계 대상 사용자
 * @param {Array|null} postsOverride - 해당 사용자 게시물 (다른 사용자 프로필용)
 * @returns { { grade, nextGrade, progressToNext, gates, gpsAuthCount, totalAccuracy } }
 */
export const getTrustGrade = (score, userId = null, postsOverride = null) => {
  const num = Number(score) || 0;
  const { gates, gpsAuthCount, totalAccuracy } = checkGatekeeping(userId, postsOverride);
  let current = TRUST_GRADES[0];
  let next = null;

  for (let i = TRUST_GRADES.length - 1; i >= 0; i--) {
    const g = TRUST_GRADES[i];
    const passScore = num >= g.minScore;
    const passGps = gpsAuthCount >= (g.minGpsAuth ?? 0);
    const passAccuracy = totalAccuracy >= (g.minAccuracy ?? 0);
    if (passScore && passGps && passAccuracy) {
      current = g;
      next = i < TRUST_GRADES.length - 1 ? TRUST_GRADES[i + 1] : null;
      break;
    }
  }

  /** 현재 등급 구간 안에서만 0~100% (다음 등급 Compass 하한까지의 진행률) */
  let progressToNext = 100;
  if (next) {
    const range = next.minScore - current.minScore;
    const progress = num - current.minScore;
    progressToNext = range > 0 ? Math.min(100, Math.max(0, Math.round((progress / range) * 100))) : 100;
  }

  return {
    grade: current,
    nextGrade: next,
    progressToNext,
    /** 현재 단계에서 승급까지 남은 "표시 점수"(0~100 척도) */
    pointsRemainingInTier: next ? Math.max(0, 100 - progressToNext) : 0,
    gates,
    gpsAuthCount,
    totalAccuracy
  };
};

/**
 * 신뢰지수 (화면 표시): 현재 등급 단계 안에서의 진행도 0~100만 표시 (단계마다 100점 만점)
 * 누적 Compass는 getTrustRawScore()
 */
export const getTrustScore = (userId = null, postsOverride = null) => {
  const raw = getTrustRawScore(userId, postsOverride);
  const { progressToNext } = getTrustGrade(raw, userId, postsOverride);
  return progressToNext;
};

/**
 * 현재 점수에 해당하는 등급의 뱃지 ID
 */
export const getTrustBadgeIdForScore = (rawScore) => {
  const raw = rawScore != null ? Number(rawScore) : getTrustRawScore();
  const { grade } = getTrustGrade(raw);
  return grade?.badgeId || null;
};

/**
 * CS 산출 상세 (디버그/임팩트 리포트용)
 */
export const getCompassScoreBreakdown = (userId = null) => {
  try {
    const targetUserId = userId != null ? String(userId) : null;
    if (!targetUserId) return { A: 0, V: 0, R: 0, P: 0, CS: 0 };

    const myPosts = [];
    const counts = memory.postAccuracyCount || {};

    const A = computeActivityIndex(myPosts);
    const V = computeValidationIndex(myPosts, counts);
    const R = computeFreshnessBonus(myPosts);
    const P = computePenalty(targetUserId);

    const CS = Math.max(0, (A * WEIGHTS.w1) + (V * WEIGHTS.w2) + (R * WEIGHTS.w3) - (P * WEIGHTS.w4));

    return {
      A,
      V,
      R,
      P,
      CS: Math.round(CS),
      weights: WEIGHTS
    };
  } catch {
    return { A: 0, V: 0, R: 0, P: 0, CS: 0 };
  }
};

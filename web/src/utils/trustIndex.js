/**
 * 라이브 싱크 (Live-Sync, %)
 * "정보의 시차를 없애는 것"에 집중해, 유저의 정보가 현장과 얼마나 동기화되어 있는지(현장 일치도)를 직관적으로 표시합니다.
 *
 * - 단위: %
 * - 시작점: 50% (중립)
 * - 특징: 승급 단계 없이, 모든 활동이 즉시 퍼센트에 반영되는 "살아있는 지수"
 * - 미활동: 시간이 지나면 50%를 향해 서서히 수렴 (현장감 유지)
 *
 * ⚠️ 서버 운영 전환 중이라 데이터가 부분적으로만 존재할 수 있어,
 *    가능한 필드들(Exif/좋아요/최근성 등)로 안전하게 추정합니다.
 */

const USER_ACCURACY_MARKS_KEY = 'userAccuracyMarks';
const POST_ACCURACY_COUNT_KEY = 'postAccuracyCount';
const TRUST_PENALTY_KEY = 'trustPenalty'; // legacy key (세션 메모리)
const TRUST_LAST_ACTIVE_KEY = 'trustLastActive'; // legacy key (세션 메모리)
const COMPASS_SCORE_CACHE_KEY = 'compassScoreCache'; // legacy key (세션 메모리)
// 서버에서 live_sync_pct를 초기화/리셋할 수 있어, 로컬 캐시를 강제로 무효화하기 위해 버전 키를 올린다.
const LIVE_SYNC_PCT_CACHE_KEY = 'lj_liveSyncPctCache_v2';

// 서버 운영 전환: localStorage 제거 → 세션 메모리 캐시
const memory = {
  userAccuracyMarks: {}, // userId -> { [postId]: true }
  postAccuracyCount: {}, // postId -> count
  trustPenalty: {}, // userId -> number
  trustLastActive: {}, // userId -> ts
  compassScoreCache: {}, // userId -> { score, ts }
  // 화면 간 라이브 싱크(%) 일관성을 위한 캐시
  liveSyncCache: {}, // userId -> { pct, ts, sampleCount }
};

const safeReadLiveSyncStore = () => {
  try {
    if (typeof window === 'undefined' || !window?.localStorage) return {};
    const raw = window.localStorage.getItem(LIVE_SYNC_PCT_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const safeWriteLiveSyncStore = (obj) => {
  try {
    if (typeof window === 'undefined' || !window?.localStorage) return;
    window.localStorage.setItem(LIVE_SYNC_PCT_CACHE_KEY, JSON.stringify(obj || {}));
  } catch {
    // ignore
  }
};

/** 라이브 싱크 산정 파라미터 */
const LIVE_SYNC = {
  base: 35,
  // "현장성"은 최신/실시간성에 강하게 반응하도록
  maxUpRealtime: 25,
  maxUpHelpful: 15,
  maxUpQna: 10,
  maxUpRegion: 10,
  maxDownOldPhoto: 20,
  maxDownMismatchReports: 25,
  // 미활동 시 50%로 수렴 속도 (반감기 ~ 14일 체감)
  inactivityHalfLifeDays: 14,
  // Exif/업로드 시차를 "실시간"으로 간주하는 기준(분)
  realtimeWindowMin: 10,
  // 너무 오래된 촬영본(업로드 대비 촬영 시각)이면 페널티(시간)
  oldPhotoThresholdHours: 24,
};

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

const toMs = (v) => {
  const ms = typeof v === 'string' ? new Date(v).getTime() : Number(v) || 0;
  return Number.isFinite(ms) ? ms : 0;
};

const getUploadedAtMs = (post) => toMs(post?.createdAt ?? post?.timestamp ?? post?.created ?? post?.uploadedAt ?? 0);
const getCapturedAtMs = (post) => toMs(post?.photoDate ?? post?.capturedAt ?? post?.captured_at ?? post?.captured ?? 0);

const getLikeCount = (post) => {
  const n = post?.likes ?? post?.likeCount ?? post?.likesCount ?? 0;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

const getRegionKey = (post) => {
  const raw =
    post?.region ||
    (typeof post?.location === 'string' ? post.location.split(' ')[0] : null) ||
    post?.user?.region ||
    '';
  return String(raw || '').trim();
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * (legacy) 아래 Compass Score 계열 API는 내부/뱃지 등에서 쓰일 수 있어 그대로 유지합니다.
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
 * (legacy) 감쇠 적용: 비활동 시 서서히 감소 (마지막 활동 기준)
 */
const applyDecay = (rawScore, userId) => {
  try {
    const uid = userId ? String(userId) : '';
    const lastActive = memory.trustLastActive[uid];
    if (!lastActive || rawScore <= 0) return rawScore;
    const months = (Date.now() - new Date(lastActive).getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (months < 1) return rawScore;
    const decay = 1 - Math.min(0.5, months * 0.02);
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
 * (legacy) 등급 체계 — Compass 누적(minScore) + GPS·정확해요 게이트
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
 * (deprecated) 신뢰지수 (화면 표시): 과거 UI 호환용
 * - 신규 UI는 getLiveSyncPercent()를 사용하세요.
 */
export const getTrustScore = (userId = null, postsOverride = null) => {
  const raw = getTrustRawScore(userId, postsOverride);
  const { progressToNext } = getTrustGrade(raw, userId, postsOverride);
  return progressToNext;
};

/**
 * 라이브 싱크(%) 계산
 * - postsOverride(선택): 해당 userId의 게시물 리스트(프로필/피드 집계용)
 * - 산정에 사용되는 핵심 시그널
 *   1) 실시간 인증: 촬영시간(Exif)과 업로드시간 간격이 짧을수록 상승
 *   2) 도움돼요(좋아요): 누적될수록 상승
 *   3) 지역 싱크: 특정 지역에서 꾸준히 이어서 올릴수록 보너스
 *   4) 과거 사진 업로드: 촬영시간이 지나치게 과거면 하락
 *   5) 미활동: 시간이 지나면 50%로 수렴
 *
 * 현재 코드베이스에서 "지금 어때요? 채택 답변"과 "정보가 달라요 신고"는
 * 데이터가 안정적으로 존재하지 않아, 연결되면 즉시 반영할 수 있게 자리만 남깁니다.
 */
export const getLiveSyncPercent = (userId = null, postsOverride = null) => {
  const uid = userId != null ? String(userId) : null;
  if (!uid) return LIVE_SYNC.base;

  const posts = Array.isArray(postsOverride) ? postsOverride : [];
  const myPosts = posts.filter((p) => getPostAuthorId(p) === uid);
  if (myPosts.length === 0) return LIVE_SYNC.base;

  // lastActive: 가장 최근 업로드 시각
  const lastActiveMs = Math.max(0, ...myPosts.map(getUploadedAtMs));

  // 1) 실시간 인증(Exif 시차)
  const realtimeRatios = myPosts
    .map((p) => {
      const up = getUploadedAtMs(p);
      const cap = getCapturedAtMs(p);
      if (!up || !cap) return null;
      const gapMin = Math.abs(up - cap) / (1000 * 60);
      // gapMin <= realtimeWindowMin 이면 1.0에 가깝게, 커질수록 0으로
      const t = 1 - clamp(gapMin / LIVE_SYNC.realtimeWindowMin, 0, 1);
      return t;
    })
    .filter((v) => typeof v === 'number');
  const realtimeScore =
    realtimeRatios.length === 0
      ? 0
      : LIVE_SYNC.maxUpRealtime * clamp(realtimeRatios.reduce((a, b) => a + b, 0) / realtimeRatios.length, 0, 1);

  // 2) 도움돼요(좋아요) 누적
  const helpfulTotal = myPosts.reduce((sum, p) => sum + getLikeCount(p), 0);
  // 0~200 좋아요에서 체감이 크고, 이후 완만하게
  const helpfulT = clamp(helpfulTotal / 200, 0, 1);
  const helpfulScore = LIVE_SYNC.maxUpHelpful * Math.sqrt(helpfulT);

  // 3) 지역 싱크: 같은 지역에서 "연속"으로 올린 날짜 런 길이 기반
  const byRegionDates = {};
  myPosts.forEach((p) => {
    const r = getRegionKey(p);
    if (!r) return;
    const ms = getUploadedAtMs(p);
    if (!ms) return;
    const d = new Date(ms);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byRegionDates[r]) byRegionDates[r] = new Set();
    byRegionDates[r].add(key);
  });
  const maxRunForRegion = (set) => {
    const arr = Array.from(set || []).sort();
    if (arr.length === 0) return 0;
    let best = 1;
    let run = 1;
    for (let i = 1; i < arr.length; i += 1) {
      const prev = new Date(arr[i - 1]).getTime();
      const cur = new Date(arr[i]).getTime();
      const diffDays = (cur - prev) / (24 * 60 * 60 * 1000);
      if (diffDays === 1) run += 1;
      else run = 1;
      best = Math.max(best, run);
    }
    return best;
  };
  const bestRegionRun = Object.values(byRegionDates).reduce((m, set) => Math.max(m, maxRunForRegion(set)), 0);
  // 1~7일 연속에서 보너스가 크게 느껴지도록
  const regionT = clamp(bestRegionRun / 7, 0, 1);
  const regionScore = LIVE_SYNC.maxUpRegion * regionT;

  // 4) 과거 사진 페널티(Exif 불일치)
  const oldPhotoPenalties = myPosts
    .map((p) => {
      const up = getUploadedAtMs(p);
      const cap = getCapturedAtMs(p);
      if (!up || !cap) return 0;
      const gapH = Math.abs(up - cap) / (1000 * 60 * 60);
      if (gapH <= LIVE_SYNC.oldPhotoThresholdHours) return 0;
      // 24h~7d 사이에서 페널티가 커지고 이후 캡
      const t = clamp((gapH - LIVE_SYNC.oldPhotoThresholdHours) / (24 * 6), 0, 1);
      return LIVE_SYNC.maxDownOldPhoto * t;
    })
    .filter((v) => typeof v === 'number');
  const oldPhotoPenalty = oldPhotoPenalties.length ? Math.max(...oldPhotoPenalties) : 0;

  // 5) "정보가 달라요" 신고 페널티(연동 전: trustPenalty 메모리만 반영)
  const mismatchPenaltyRaw = Number(memory.trustPenalty[uid]) || 0;
  const mismatchPenalty = clamp(mismatchPenaltyRaw, 0, LIVE_SYNC.maxDownMismatchReports);

  // 6) QnA 채택(연동 포인트)
  const qnaScore = 0;

  // base + ups - downs
  let sync = LIVE_SYNC.base + realtimeScore + helpfulScore + regionScore + qnaScore - oldPhotoPenalty - mismatchPenalty;
  sync = clamp(sync, 0, 100);

  // 미활동 수렴: 시간이 지날수록 50%로 가까워짐
  if (lastActiveMs > 0) {
    const days = (Date.now() - lastActiveMs) / (24 * 60 * 60 * 1000);
    if (days > 0.5) {
      const halfLife = Math.max(1, LIVE_SYNC.inactivityHalfLifeDays);
      const factor = Math.pow(0.5, days / halfLife); // 0~1
      sync = lerp(LIVE_SYNC.base, sync, factor);
    }
  }

  return Math.round(sync * 10) / 10; // 0.1% 단위
};

/** UI 편의: 정수 % */
export const getLiveSyncPercentRounded = (userId = null, postsOverride = null) =>
  Math.round(getLiveSyncPercent(userId, postsOverride));

/**
 * 화면 간 "동일 계정" 라이브 싱크 값을 일치시키기 위한 캐시 API
 * - ProfileScreen/UserProfileScreen 등에서 계산한 값을 캐시에 저장해두면
 *   피드/상세/핫플 등 다른 화면에서 postsOverride가 부분 집합이어도 동일한 값으로 표시 가능.
 */
export const setLiveSyncPercentCache = (userId, pct, sampleCount = null, options = {}) => {
  const uid = userId != null ? String(userId) : '';
  if (!uid) return;
  const n = Math.round(Number(pct));
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(0, Math.min(100, n));
  const ts = Date.now();
  const sc = sampleCount != null ? Math.max(0, Number(sampleCount) || 0) : (memory.liveSyncCache?.[uid]?.sampleCount ?? 0);
  const prev = memory.liveSyncCache?.[uid];
  const authoritative = options && typeof options === 'object' ? options.authoritative === true : false;
  // 점수가 갑자기 튀지 않도록 완만하게 누적(스무딩) — 단, 프로필처럼 "게시물 전체"가 들어온 값은 즉시 스냅
  const prevPct = typeof prev?.pct === 'number' ? prev.pct : null;
  const maxStep = 2; // 한 번 갱신에서 최대 2%만 변동
  const nextPct =
    authoritative || prevPct == null
      ? clamped
      : Math.max(0, Math.min(100, prevPct + Math.max(-maxStep, Math.min(maxStep, clamped - prevPct))));
  memory.liveSyncCache[uid] = { pct: nextPct, ts, sampleCount: sc };

  // 프로필 화면에서 계산한 값을 다른 화면에서도 동일하게 쓰기 위해 로컬에도 보관
  const store = safeReadLiveSyncStore();
  store[uid] = { pct: nextPct, ts, sampleCount: sc };
  safeWriteLiveSyncStore(store);
};

export const getLiveSyncPercentRoundedFromCache = (userId = null, postsOverride = null) => {
  const uid = userId != null ? String(userId) : null;
  const sampleCount = Array.isArray(postsOverride) ? postsOverride.length : 0;
  if (uid) {
    const mem = memory.liveSyncCache?.[uid];
    // 캐시가 없거나, 더 큰 샘플(게시물 수)로 들어왔으면 재계산해서 캐시를 갱신
    if (
      (!mem || typeof mem.pct !== 'number') ||
      (sampleCount > Number(mem?.sampleCount || 0) && sampleCount > 0)
    ) {
      const computed = getLiveSyncPercentRounded(uid, postsOverride);
      const ts = Date.now();
      // "더 큰 샘플"로 재계산된 값은 authoritative로 보고 즉시 스냅 (프로필 첫 진입 통일용)
      memory.liveSyncCache[uid] = { pct: computed, ts, sampleCount };
      const store = safeReadLiveSyncStore();
      store[uid] = { pct: computed, ts, sampleCount };
      safeWriteLiveSyncStore(store);
      return computed;
    }
    if (mem && typeof mem.pct === 'number') return mem.pct;

    const store = safeReadLiveSyncStore();
    const saved = store?.[uid];
    if (saved && typeof saved.pct === 'number') {
      // 메모리도 워밍업
      memory.liveSyncCache[uid] = {
        pct: saved.pct,
        ts: saved.ts || Date.now(),
        sampleCount: Number(saved?.sampleCount || 0),
      };
      return saved.pct;
    }
  }
  return getLiveSyncPercentRounded(uid, postsOverride);
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

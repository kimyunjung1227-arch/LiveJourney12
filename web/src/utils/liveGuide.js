/**
 * 라이브가이드(Live Guide) — 살아있는 정보를 꾸준히 제공하는 사람에게 주는 "동적" 인증.
 *
 * 기존 뱃지(profiles.earned_badges)는 한 번 얻으면 영구히 남는 "성취"지만,
 * 라이브가이드는 DB에 저장하지 않고 **활동에서 매번 파생**한다.
 *
 * 규칙
 *  1) 달성(EARN)   : 활동량 + 소셜이 결합된 "라이브 점수"가 기준을 넘고,
 *                    최소 게시물·팔로워 게이트를 모두 통과해야 한다. (한 축만으론 불가)
 *  2) 보장(GUARANTEE): 달성 시점부터 GUARANTEE_DAYS(90일=3개월)는 무조건 유지된다.
 *  3) 유지(MAINTAIN) : 보장 종료 후에는 최근 MAINTAIN_DAYS(90일)에
 *                      MAINTAIN_COUNT(3)건 이상 활동해야 유지된다. 부족하면 해제.
 *
 * 누적 지표(총 게시물·받은 공감·팔로워)는 줄지 않으므로 "달성 여부"는 안정적이고,
 * 실제 배지 노출의 동적성(사라짐/되살아남)은 (2)(3) 보장·유지 단계가 담당한다.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const LIVE_GUIDE = {
  // 달성(하드) — 활동량 + 소셜 복합
  EARN_SCORE: 100, // 통과에 필요한 라이브 점수
  EARN_MIN_POSTS: 6, // 활동량 게이트
  EARN_MIN_FOLLOWERS: 3, // 소셜 게이트

  // 라이브 점수 가중치
  W_POST: 8, // 현장 게시물(개당)
  W_LIKE: 3, // 받은 공감/도움(개당)
  W_COMMENT: 2, // 받은 댓글(개당)
  W_FOLLOWER: 5, // 팔로워(명당)
  W_FRESH: 6, // 48h 현장 글 보너스(개당)

  // 보장 / 유지
  GUARANTEE_DAYS: 90, // 달성 후 최소 보장 (3개월)
  MAINTAIN_DAYS: 90, // 유지 판단 윈도우 (최근 3개월)
  MAINTAIN_COUNT: 3, // 보장 종료 후 유지에 필요한 최근 활동 수
  ACTIVE_COUNT: 7, // '활발' 등급
  TOP_COUNT: 12, // '탑 라이브가이드' 등급

  FRESH_HOURS: 48, // 현장 정보(실시간 펄스)
  FADING_DAYS: 14, // 유지 기한 이 안쪽 + 활동 부족 → "곧 종료" 경고
};

function ts(value) {
  if (value == null) return NaN;
  const t = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(t) ? t : NaN;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// 매핑된 post 객체(camelCase)와 raw row(snake_case) 모두 지원
function postCreated(p) {
  return ts(p?.createdAt ?? p?.created_at);
}
function postCaptured(p) {
  return ts(p?.photoDate ?? p?.captured_at ?? p?.exif_taken_at);
}
function postLikes(p) {
  return Math.max(0, num(p?.likeCount ?? p?.likes ?? p?.like_count ?? p?.helped_count));
}
function postComments(p) {
  return Math.max(0, num(p?.commentCount ?? p?.commentsCount ?? p?.comment_count));
}

/**
 * 활동 + 소셜 신호로부터 라이브가이드 상태를 계산한다. (순수 함수)
 *
 * @param {object} input
 *   { posts: Array<post>, followerCount: number }
 * @param {number} [nowMs]
 */
export function computeLiveGuide(input, nowMs = Date.now()) {
  const data = Array.isArray(input) ? { posts: input } : input || {};
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const followerCount = Math.max(0, num(data.followerCount));

  const maintainMs = LIVE_GUIDE.MAINTAIN_DAYS * DAY;
  const createdAsc = []; // 모든 게시 시각(오름차순 정렬 예정)
  const maintainTimes = []; // 최근 90일 활동 시각
  let likesReceived = 0;
  let commentsReceived = 0;
  let freshCount = 0; // 48h 내 현장 정보 수
  let lastActiveAt = NaN;

  for (const p of posts) {
    likesReceived += postLikes(p);
    commentsReceived += postComments(p);

    const created = postCreated(p);
    const captured = postCaptured(p);
    const act = Number.isFinite(created) ? created : captured;
    if (Number.isFinite(act)) {
      createdAsc.push(act);
      if (!Number.isFinite(lastActiveAt) || act > lastActiveAt) lastActiveAt = act;
      if (nowMs - act <= maintainMs) maintainTimes.push(act);
    }
    const fresh = Number.isFinite(captured) ? captured : created;
    if (Number.isFinite(fresh) && nowMs - fresh <= LIVE_GUIDE.FRESH_HOURS * HOUR) freshCount += 1;
  }

  createdAsc.sort((a, b) => a - b);
  maintainTimes.sort((a, b) => b - a);
  const totalCount = posts.length;
  const maintainCount = maintainTimes.length;

  // ── 라이브 점수 (활동량 + 소셜 + 현장성) ──
  const score = Math.round(
    totalCount * LIVE_GUIDE.W_POST +
      likesReceived * LIVE_GUIDE.W_LIKE +
      commentsReceived * LIVE_GUIDE.W_COMMENT +
      followerCount * LIVE_GUIDE.W_FOLLOWER +
      freshCount * LIVE_GUIDE.W_FRESH
  );

  const passPosts = totalCount >= LIVE_GUIDE.EARN_MIN_POSTS;
  const passFollowers = followerCount >= LIVE_GUIDE.EARN_MIN_FOLLOWERS;
  const passScore = score >= LIVE_GUIDE.EARN_SCORE;
  const everEarned = passPosts && passFollowers && passScore;

  // 보장 시작 시점 ≈ 활동량 게이트(EARN_MIN_POSTS)를 채운 시점
  let achievedAt = null;
  if (everEarned && createdAsc.length > 0) {
    achievedAt = createdAsc[Math.min(LIVE_GUIDE.EARN_MIN_POSTS, createdAsc.length) - 1];
  }

  const guaranteedUntil = achievedAt != null ? achievedAt + LIVE_GUIDE.GUARANTEE_DAYS * DAY : null;
  const withinGrace = guaranteedUntil != null && nowMs <= guaranteedUntil;
  const maintaining = maintainCount >= LIVE_GUIDE.MAINTAIN_COUNT;
  const isGuide = everEarned && (withinGrace || maintaining);

  // 유지 기한 — 보장 기한과 (유지 중이면) 활동 기반 기한 중 더 나중
  let expiresAt = null;
  if (isGuide) {
    const candidates = [];
    if (withinGrace && guaranteedUntil != null) candidates.push(guaranteedUntil);
    if (maintaining) candidates.push(maintainTimes[LIVE_GUIDE.MAINTAIN_COUNT - 1] + maintainMs);
    expiresAt = candidates.length ? Math.max(...candidates) : guaranteedUntil;
  }

  const level = maintainCount >= LIVE_GUIDE.TOP_COUNT ? 3 : maintainCount >= LIVE_GUIDE.ACTIVE_COUNT ? 2 : 1;
  const isLive = freshCount > 0;
  const fadingSoon =
    isGuide && !maintaining && expiresAt != null && expiresAt - nowMs <= LIVE_GUIDE.FADING_DAYS * DAY;

  const nextLevelMin = level === 1 ? LIVE_GUIDE.ACTIVE_COUNT : level === 2 ? LIVE_GUIDE.TOP_COUNT : null;
  const toNext = nextLevelMin ? Math.max(0, nextLevelMin - maintainCount) : 0;

  let status = 'none';
  if (!isGuide) {
    if (everEarned) status = 'lapsed'; // 달성했지만 보장 종료 + 활동 부족
    else if (score > 0) status = 'building'; // 달성 진행 중
    else status = 'none';
  } else if (fadingSoon) status = 'fading';
  else if (level >= 3) status = 'top';
  else status = 'active';

  return {
    isGuide,
    level: isGuide ? level : 0,
    status, // 'top' | 'active' | 'fading' | 'lapsed' | 'building' | 'none'

    // 점수/소셜/활동량
    score,
    totalCount,
    followerCount,
    likesReceived,
    commentsReceived,
    freshCount,
    isLive,

    // 달성 게이트
    passPosts,
    passFollowers,
    passScore,
    everEarned,

    // 보장/유지
    achievedAt,
    guaranteedUntil,
    withinGrace,
    maintaining,
    maintainCount,
    expiresAt,
    nextLevelMin,
    toNext,
    lastActiveAt: Number.isFinite(lastActiveAt) ? lastActiveAt : null,

    // 진행 표시용 부족분
    needPosts: Math.max(0, LIVE_GUIDE.EARN_MIN_POSTS - totalCount),
    needFollowers: Math.max(0, LIVE_GUIDE.EARN_MIN_FOLLOWERS - followerCount),
    needScore: Math.max(0, LIVE_GUIDE.EARN_SCORE - score),
    maintainRemaining: Math.max(0, LIVE_GUIDE.MAINTAIN_COUNT - maintainCount),

    // 기준값 노출
    earnScore: LIVE_GUIDE.EARN_SCORE,
    earnMinPosts: LIVE_GUIDE.EARN_MIN_POSTS,
    earnMinFollowers: LIVE_GUIDE.EARN_MIN_FOLLOWERS,
    maintainNeed: LIVE_GUIDE.MAINTAIN_COUNT,
    guaranteeMonths: Math.round(LIVE_GUIDE.GUARANTEE_DAYS / 30),
    maintainMonths: Math.round(LIVE_GUIDE.MAINTAIN_DAYS / 30),
  };
}

/** 등급별 호칭 */
export function liveGuideLabel(level) {
  return level >= 3 ? '탑 라이브가이드' : '라이브가이드';
}

/** 남은 시간을 사람이 읽기 좋은 한국어로 (개월/일/시간) */
export function formatTimeLeft(target, nowMs = Date.now()) {
  if (!target) return null;
  const ms = target - nowMs;
  if (ms <= 0) return '곧';
  const days = Math.floor(ms / DAY);
  if (days >= 60) return `${Math.round(days / 30)}개월`;
  if (days >= 1) return `${days}일`;
  const hours = Math.max(1, Math.floor((ms % DAY) / HOUR));
  return `${hours}시간`;
}

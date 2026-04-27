/**
 * 커뮤니티 응원(타인 POV) 활동 — 세션 메모리 누적
 * (서버에 동일 집계가 붙으면 getTripSupportStats를 그쪽에서 채우도록 교체)
 */

const store = new Map();
// userId -> { safetySupport, cheer, pathfinderPostIds: Set, acceptedPathfinder, debounce }
const DEBOUNCE_MS = 400;

const ensure = (userId) => {
  const u = String(userId || '').trim();
  if (!u) return null;
  if (!store.has(u)) {
    store.set(u, { safetySupport: 0, cheer: 0, pathfinderPostIds: new Set(), acceptedPathfinder: 0, t: 0 });
  }
  return store.get(u);
};

const scheduleRecheck = (userId) => {
  const u = String(userId || '').trim();
  if (!u) return;
  const row = store.get(u);
  if (row) clearTimeout(row.t);
  if (row) {
    row.t = setTimeout(() => {
      row.t = 0;
      void import('./badgeAwards')
        .then((m) => m.recheckUserBadgesAfterActivity(u))
        .catch(() => {});
    }, DEBOUNCE_MS);
  }
};

export function getTripSupportStats(userId) {
  const row = ensure(userId);
  if (!row) {
    return {
      safetySupport: 0,
      cheerReactions: 0,
      pathfinderPostCount: 0,
      acceptedPathfinder: 0,
      pathfinderProgressCount: 0,
    };
  }
  const pathN = row.pathfinderPostIds instanceof Set ? row.pathfinderPostIds.size : 0;
  const acc = Math.max(0, Number(row.acceptedPathfinder) || 0);
  return {
    safetySupport: Math.max(0, Number(row.safetySupport) || 0),
    cheerReactions: Math.max(0, Number(row.cheer) || 0),
    pathfinderPostCount: pathN,
    acceptedPathfinder: acc,
    pathfinderProgressCount: Math.max(pathN, acc),
  };
}

/** 타인의 '안전·주의' 성격 게시물에 댓글(응원) 1회 */
export function recordTripSafetySupportComment(userId) {
  const row = ensure(userId);
  if (!row) return;
  row.safetySupport = Math.max(0, (row.safetySupport || 0) + 1);
  scheduleRecheck(userId);
}

/**
 * 타인 게시물에 '응원' = 좋아요(하트) 1회 — 내부 키 reaction_type: cheer
 */
export function recordTripCheerReaction(userId) {
  const row = ensure(userId);
  if (!row) return;
  row.cheer = Math.max(0, (row.cheer || 0) + 1);
  scheduleRecheck(userId);
}

/** 실시간 질문 글(타인)에 답 댓글 1게시당 1회(고유 postId) */
export function recordTripPathfinderAnswerOnPost(userId, postId) {
  if (!userId || !postId) return;
  const row = ensure(userId);
  if (!row) return;
  row.pathfinderPostIds.add(String(postId).trim());
  scheduleRecheck(userId);
}

/** 질문 작성자가 답을 채택한 경우 (UI 연결용) */
export function recordTripAcceptedPathfinder(userId) {
  const row = ensure(userId);
  if (!row) return;
  row.acceptedPathfinder = Math.max(0, (row.acceptedPathfinder || 0) + 1);
  scheduleRecheck(userId);
}

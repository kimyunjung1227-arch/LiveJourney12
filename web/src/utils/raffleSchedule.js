/**
 * 래플 기간: 서울(Asia/Seoul) 기준 1일차 00:00 시작, N일차 00:00 종료.
 * ends_at = starts_at + (N - 1) * 24h (같은 시각의 달력 N일차).
 */

/** @returns {Date} 이번 서울 달력일 00:00(KST)의 UTC instant */
export function seoulTodayMidnight() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+09:00`
  );
}

/** 서울 기준으로 `from` 시점 이후(초과) 가장 가까운 0시(UTC instant) */
export function seoulNextMidnightAfter(from = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(from);
  const [y, m, d] = parts.split('-').map(Number);
  let midnight = new Date(
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+09:00`
  );
  const ms = from.getTime();
  while (midnight.getTime() <= ms) {
    midnight = new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
  }
  return midnight;
}

/** @param {Date} startsAt — seoulTodayMidnight() 등 */
export function computeEndsAt(startsAt, durationDays) {
  const n = Math.max(1, Math.floor(Number(durationDays)) || 7);
  return new Date(startsAt.getTime() + (n - 1) * 24 * 60 * 60 * 1000);
}

/**
 * 지금 시작: 시작 시각부터 정확히 N×24시간 후 종료(달력 00시 기준이 아님).
 * @param {Date} startsAt
 */
export function computeEndsAtFromNow(startsAt, durationDays) {
  const n = Math.max(1, Math.floor(Number(durationDays)) || 7);
  return new Date(startsAt.getTime() + n * 24 * 60 * 60 * 1000);
}

/** @param {string|Date} endsAt */
export function formatDaysLeftKorean(endsAt) {
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (Number.isNaN(end.getTime())) return '진행 중';
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return '마감';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `${days}일 남음`;
}

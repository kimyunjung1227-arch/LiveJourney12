/**
 * Date → "방금" / "N분 전" / "N시간 N분 전" / "N일 N시간 전" 표시 문자열.
 * @param {Date} date
 * @param {boolean} detail  true면 시간 단위 안에서도 분/시간 같이 표시
 */
export function formatTimeAgo(date, detail = false) {
  if (!date) return '';
  const ms = Date.now() - (date instanceof Date ? date.getTime() : new Date(date).getTime());
  const seconds = ms / 1000;
  if (seconds < 60) return '방금';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}분 전`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (detail && minutes > 0) return `${hours}시간 ${minutes}분 전`;
    return `${hours}시간 전`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (detail && hours > 0) return `${days}일 ${hours}시간 전`;
  return `${days}일 전`;
}

/** "오후 4:23" 같은 표시 */
export function formatTimeOfDay(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${m}`;
}

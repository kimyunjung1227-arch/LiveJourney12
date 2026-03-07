/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 날짜를 "방금 전", "5분 전" 등의 형식으로 변환
 * @param {Date|string} date - 변환할 날짜
 * @returns {string} - 변환된 시간 문자열
 */
export const getTimeAgo = (date) => {
  if (date == null || date === '') return '방금 전';
  const now = new Date();
  const postDate = new Date(date);
  if (Number.isNaN(postDate.getTime())) return '방금 전';
  const diffMs = now - postDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (Number.isNaN(diffMins) || diffMs < 0) return '방금 전';
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${diffDays}일 전`;
};

/**
 * 시간 문자열을 분 단위 숫자로 변환 (정렬용)
 * @param {string} timeLabel - "방금", "5분 전" 등의 시간 문자열
 * @returns {number} - 분 단위 숫자
 */
export const timeToMinutes = (timeLabel) => {
  if (timeLabel === '방금' || timeLabel === '방금 전') return 0;
  if (timeLabel.includes('분 전')) return parseInt(timeLabel);
  if (timeLabel.includes('시간 전')) return parseInt(timeLabel) * 60;
  if (timeLabel.includes('일 전')) return parseInt(timeLabel) * 24 * 60;
  return 999999;
};





















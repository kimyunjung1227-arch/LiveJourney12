/**
 * 게시물 상세 — 업로드 시 저장된 날씨만 표시(실시간 재조회 없음)
 */
export function getStoredUploadWeather(post) {
  const w = post?.weatherSnapshot || post?.weather || null;
  if (!w || typeof w !== 'object') return null;
  const icon = w.icon;
  const condition = w.condition;
  const temperature = w.temperature ?? w.temp;
  if (temperature == null && condition == null && icon == null) return null;
  return {
    icon: icon || '☀️',
    condition: condition != null ? String(condition) : '',
    temperature: temperature != null ? String(temperature) : '',
    humidity: w.humidity,
    wind: w.wind,
  };
}

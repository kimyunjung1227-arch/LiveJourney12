export const WEATHER_SNAPSHOT_TTL_MS = 48 * 60 * 60 * 1000; // 48시간

const toMs = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * posts.weather(jsonb) 를 "촬영 시점(가능하면 EXIF) 기온 스냅샷"으로 취급.
 * - observedAt/observed_at가 있으면 그 시각을 기준으로 TTL 판단
 * - 없으면 게시물 createdAt/timestamp 기준으로 TTL 판단
 */
export function getValidWeatherSnapshot(post, nowMs = Date.now(), ttlMs = WEATHER_SNAPSHOT_TTL_MS) {
  const w = post?.weatherSnapshot || post?.weather || null;
  if (!w || typeof w !== 'object') return null;

  const baseMs =
    toMs(w.observedAt) ||
    toMs(w.observed_at) ||
    toMs(post?.createdAt) ||
    toMs(post?.timestamp) ||
    0;

  if (!baseMs) return null;
  const age = nowMs - baseMs;
  if (!Number.isFinite(age) || age < 0 || age > ttlMs) return null;
  return w;
}

/**
 * 게시물 상세 등 — 저장된 날씨만 표시(TTL 없음, 실시간 재조회 안 함)
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


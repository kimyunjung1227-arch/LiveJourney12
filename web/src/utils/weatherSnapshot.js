export const WEATHER_SNAPSHOT_TTL_MS = 48 * 60 * 60 * 1000; // 48시간

const toMs = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * posts.weather(jsonb) 를 "업로드 시점 기온 스냅샷"으로 취급.
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


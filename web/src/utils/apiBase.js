/**
 * axios용 API 베이스 (게시물·업로드 등 Node 백엔드 또는 동일 출처)
 * 날씨는 `weather.js`에서 백엔드 `/api/proxy/kma/*` 우선(동일 출처), Supabase Edge는 폴백.
 *
 * GitHub Pages: VITE_API_URL = https://백엔드/api
 * livejourney.co.kr: 비우면 동일 출처 — `getFetchApiUrl` 이 BASE_URL 반영
 */

const DEFAULT_PROD_API_ORIGIN = 'https://livejourney-backend.onrender.com';

function isLiveJourneyWebDomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'livejourney.co.kr' || h === 'www.livejourney.co.kr';
}

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 `getFetchApiUrl` 로 조합 */
export function getBackendOrigin() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const noTrail = raw.replace(/\/+$/, '');
    if (noTrail.endsWith('/api')) return noTrail.slice(0, -4);
    return noTrail;
  }
  if (import.meta.env.DEV) return '';
  if (isLiveJourneyWebDomain()) return '';
  return DEFAULT_PROD_API_ORIGIN;
}

/**
 * 브라우저 fetch용 절대 URL (GitHub Pages 서브경로에서 `/LiveJourney12/api/...` 로 맞춤)
 * @param {string} pathAndQuery `/api/proxy/...?q=...`
 */
export function getFetchApiUrl(pathAndQuery) {
  let path = String(pathAndQuery || '').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  const origin = getBackendOrigin();
  if (origin) {
    return `${origin}${path}`;
  }
  if (typeof window === 'undefined') {
    return path;
  }
  const base = import.meta.env.BASE_URL || '/';
  const root = `${window.location.origin}${base.endsWith('/') ? base : `${base}/`}`;
  const rel = path.replace(/^\//, '');
  try {
    return new URL(rel, root).href;
  } catch {
    return `${window.location.origin}${path}`;
  }
}

/** axios baseURL (항상 /api 로 끝남) */
export function getApiBasePath() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const t = raw.replace(/\/+$/, '');
    return t.endsWith('/api') ? t : `${t}/api`;
  }
  if (import.meta.env.DEV) return '/api';
  if (isLiveJourneyWebDomain()) return '/api';
  return `${DEFAULT_PROD_API_ORIGIN}/api`;
}

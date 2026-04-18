/**
 * axios용 API 베이스 (게시물·업로드 등 Node 백엔드)
 * 날씨는 `weather.js`에서 백엔드 `/api/proxy/kma/*` → Render 등 실제 API 호스트.
 *
 * - 프론트만 올린 도메인(livejourney.co.kr 등)에는 `/api` 라우트가 없음. VITE_API_URL 미설정 시
 *   기본으로 Render 백엔드를 쓴다(백엔드 CORS에 livejourney.co.kr 허용됨).
 * - 정말 같은 도메인에 리버스 프록시로 `/api`를 붙였다면 빌드 시
 *   VITE_API_URL=https://livejourney.co.kr/api 처럼 명시한다.
 * - GitHub Pages: VITE_API_URL = https://백엔드주소/api
 */

const DEFAULT_PROD_API_ORIGIN = 'https://livejourney-backend.onrender.com';

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 `getFetchApiUrl` 이 현재 사이트 기준으로 조합 */
export function getBackendOrigin() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const noTrail = raw.replace(/\/+$/, '');
    if (noTrail.endsWith('/api')) return noTrail.slice(0, -4);
    return noTrail;
  }
  if (import.meta.env.DEV) return '';
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
  return `${DEFAULT_PROD_API_ORIGIN}/api`;
}

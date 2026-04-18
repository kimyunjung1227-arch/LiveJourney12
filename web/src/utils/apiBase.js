/**
 * axios / fetch API 베이스
 *
 * - 이 레포의 `backend/`(Express)는 선택 사항이다. 배포는 Supabase만 써도 된다.
 * - 별도 Node 서버를 쓸 때만 빌드에 `VITE_API_URL=https://그서버/api` 를 넣는다. 없으면 상대 경로 `/api`(같은 도메인) — 프록시를 직접 붙인 경우에만 동작.
 * - 날씨(기상청)는 `weather.js`에서 Supabase Edge `kma-ultra-ncst` 우선(아래 파일 참고). Render 등은 필수 아님.
 */

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 `getFetchApiUrl` 이 현재 사이트 기준으로 조합 */
export function getBackendOrigin() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const noTrail = raw.replace(/\/+$/, '');
    if (noTrail.endsWith('/api')) return noTrail.slice(0, -4);
    return noTrail;
  }
  return '';
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

/** axios baseURL (항상 /api 로 끝남). VITE_API_URL 없으면 같은 출처 `/api` — Node 프록시 없으면 404일 수 있음 */
export function getApiBasePath() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const t = raw.replace(/\/+$/, '');
    return t.endsWith('/api') ? t : `${t}/api`;
  }
  return '/api';
}

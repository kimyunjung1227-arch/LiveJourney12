/**
 * 백엔드 베이스 URL 정규화
 * - 개발: Vite가 /api → localhost:5000 프록시
 * - livejourney.co.kr: 정적 프론트만 있으면 /api 가 없음 → Vercel `vercel.json` 이 /api 를 Render로 넘김 (동일 출처로 요청)
 * - 그 외 프로덕션: VITE_API_URL 또는 현재 origin + /api
 */

function isLiveJourneyVercelHost(hostname) {
  return hostname === 'livejourney.co.kr' || hostname === 'www.livejourney.co.kr';
}

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 같은 출처로 `/api/...` 요청 */
export function getBackendOrigin() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const noTrail = raw.replace(/\/+$/, '');
    if (noTrail.endsWith('/api')) return noTrail.slice(0, -4);
    return noTrail;
  }
  if (import.meta.env.DEV) return '';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (isLiveJourneyVercelHost(window.location.hostname)) {
      return '';
    }
    return window.location.origin;
  }
  return '';
}

/** axios 등 baseURL (항상 /api 로 끝남) */
export function getApiBasePath() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const t = raw.replace(/\/+$/, '');
    return t.endsWith('/api') ? t : `${t}/api`;
  }
  if (import.meta.env.DEV) return '/api';
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (isLiveJourneyVercelHost(window.location.hostname)) {
      return '/api';
    }
    return `${window.location.origin}/api`;
  }
  return '/api';
}

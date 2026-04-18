/**
 * axios용 API 베이스 (게시물·업로드 등 Node 백엔드 또는 동일 출처)
 * 날씨(기상청)는 `weather.js`에서 Supabase Edge Function을 우선 사용 (VITE_SUPABASE_URL).
 */

const DEFAULT_PROD_API_ORIGIN = 'https://livejourney-backend.onrender.com';

/** Vercel 커스텀 도메인 — 브라우저가 livejourney.co.kr 로만 요청하게 해 CORS 회피 */
function isLiveJourneyWebDomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'livejourney.co.kr' || h === 'www.livejourney.co.kr';
}

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 같은 출처 `/api/...` */
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

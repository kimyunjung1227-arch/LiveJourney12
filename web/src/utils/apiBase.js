/**
 * 백엔드 베이스 URL
 * - 개발: Vite 프록시 → /api → localhost:5000
 * - livejourney.co.kr (Vercel): 같은 출처 `/api` → vercel.json 이 Render로 프록시 (CORS 불필요)
 * - GitHub Pages 등: VITE_API_URL 없으면 Render 직접 URL (백엔드 CORS 필요)
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

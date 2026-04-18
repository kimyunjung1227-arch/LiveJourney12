/**
 * 백엔드 베이스 URL
 * - 개발: Vite 프록시 → /api → localhost:5000
 * - 프로덕션: VITE_API_URL 미설정 시 Render 백엔드로 직접 호출
 *   (GitHub Pages·정적 호스팅에는 /api 라우트가 없어 404가 남)
 */

/** render.yaml 의 웹 서비스 URL과 맞춤. 다르면 빌드 시 VITE_API_URL 로 지정 */
const DEFAULT_PROD_API_ORIGIN = 'https://livejourney-backend.onrender.com';

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 같은 출처 `/api/...` (개발 전용) */
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

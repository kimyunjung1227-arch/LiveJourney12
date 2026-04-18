/**
 * 백엔드 베이스 URL 정규화
 * - 개발: VITE_API_URL 미설정 시 상대 경로 → Vite proxy가 localhost:5000으로 전달
 * - 배포: VITE_API_URL 또는 현재 origin + /api
 */

/** fetch용 origin (끝에 /api 없음). 빈 문자열이면 브라우저가 같은 출처로 요청 */
export function getBackendOrigin() {
  const raw = String(import.meta.env.VITE_API_URL || '').trim();
  if (raw) {
    const noTrail = raw.replace(/\/+$/, '');
    if (noTrail.endsWith('/api')) return noTrail.slice(0, -4);
    return noTrail;
  }
  if (import.meta.env.DEV) return '';
  if (typeof window !== 'undefined' && window.location?.origin) {
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
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

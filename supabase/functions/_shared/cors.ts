/**
 * Edge Function 공통 CORS (브라우저 Preflight OPTIONS + 본 요청 응답)
 * 보안이 필요하면 Access-Control-Allow-Origin 을 'https://livejourney.co.kr' 등으로 제한하세요.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

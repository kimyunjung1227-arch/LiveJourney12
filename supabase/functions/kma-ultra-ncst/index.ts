/**
 * 기상청 초단기실황 프록시 (공공데이터포털)
 * Secrets: KMA_API_KEY 또는 DATA_GO_KR_SERVICE_KEY
 * 배포: supabase functions deploy kma-ultra-ncst
 * 시크릿: supabase secrets set KMA_API_KEY=...
 */

const KMA_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
  'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
  'Access-Control-Max-Age': '86400',
};

function normalizeDataGoKrServiceKey(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) return decodeURIComponent(s);
  } catch {
    /* keep */
  }
  return s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: cors });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const serviceKey = normalizeDataGoKrServiceKey(
    Deno.env.get('KMA_API_KEY') || Deno.env.get('DATA_GO_KR_SERVICE_KEY') || ''
  );
  if (!serviceKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'KMA_API_KEY not configured (Edge Function secrets)' }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const base_date = url.searchParams.get('base_date');
  const base_time = url.searchParams.get('base_time');
  const nx = url.searchParams.get('nx');
  const ny = url.searchParams.get('ny');

  if (!base_date || !base_time || nx == null || ny == null) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing base_date, base_time, nx, ny' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const u = new URL(KMA_BASE);
  u.searchParams.set('serviceKey', serviceKey);
  u.searchParams.set('pageNo', '1');
  u.searchParams.set('numOfRows', '20');
  u.searchParams.set('dataType', 'JSON');
  u.searchParams.set('base_date', base_date);
  u.searchParams.set('base_time', base_time);
  u.searchParams.set('nx', nx);
  u.searchParams.set('ny', ny);

  try {
    const upstream = await fetch(u.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LiveJourney-supabase-kma/1.0',
      },
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'KMA returned non-JSON',
          rawPreview: text.slice(0, 200),
        }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

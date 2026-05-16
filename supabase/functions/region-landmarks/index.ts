// Supabase Edge Function: 지역별 대표명소 AI 추천 (Google Gemini)
// API 키: Supabase 대시보드 → Edge Functions → Secrets 에 GEMINI_API_KEY 설정
// 사용: POST { regionName, excludeNames?: string[], count?: number }
// 응답: { landmarks: [{ name, keywords[] }] }

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_LANDMARKS_MODEL') || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

type LandmarkOut = { name: string; keywords: string[] };

const sanitize = (s: unknown, maxLen: number) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);

const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

function buildPrompt(regionName: string, excludeNames: string[], count: number) {
  const exclude = excludeNames.length
    ? excludeNames.slice(0, 30).map((n) => `- ${n}`).join('\n')
    : '- (없음)';

  return (
    `너는 한국 여행지를 잘 아는 큐레이터야. 사용자가 ${regionName} 지역을 둘러볼 때 들러볼 만한 대표적인 명소·랜드마크·관광지·로컬 인기 장소를 ${count}곳 골라줘.\n\n` +
    `[규칙]\n` +
    `- 출력은 반드시 JSON 1개만. 코드펜스/설명/주석 금지.\n` +
    `- 형식: {"landmarks":[{"name":"...","keywords":["...","..."]}]}\n` +
    `- name: 해당 장소의 정식 한국어 명칭 (예: "성산일출봉", "광장시장", "감천문화마을").\n` +
    `- keywords: 그 장소를 부르는 다른 이름/별칭/줄임말/관련 검색어 1~4개. 영어 이름이 있으면 포함.\n` +
    `- 너무 광범위한 행정 구역(예: "강남구", "서울시") 단독으로는 추천 금지. 구체적인 명소·시장·골목·공원·해변·산·문화시설 위주로.\n` +
    `- 음식점/카페 개별 가게 추천 금지. 거리·시장·골목 단위는 가능.\n` +
    `- 너무 마이너하거나 실재하지 않을 수 있는 곳은 제외. 확실히 아는 곳만.\n` +
    `- 같은 장소를 다른 표기로 중복 추천하지 말 것.\n` +
    `- 아래 "이미 알고 있는 명소"는 제외하고 추천:\n${exclude}\n\n` +
    `[지역]\n${regionName}\n\n` +
    `출력: JSON만.`
  );
}

function stripEnvelope(raw: string) {
  const s = String(raw || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function parseLandmarks(raw: string, excludeSet: Set<string>): LandmarkOut[] {
  try {
    const obj = JSON.parse(stripEnvelope(raw));
    const arr = Array.isArray(obj?.landmarks) ? obj.landmarks : [];
    const out: LandmarkOut[] = [];
    for (const it of arr) {
      const name = sanitize(it?.name, 40);
      if (!name) continue;
      const lower = name.replace(/\s+/g, '').toLowerCase();
      if (excludeSet.has(lower)) continue;
      const kws = uniq(Array.isArray(it?.keywords) ? it.keywords.map((k: unknown) => sanitize(k, 30)) : []);
      out.push({ name, keywords: kws.slice(0, 6) });
    }
    return out.slice(0, 20);
  } catch {
    return [];
  }
}

async function callGemini(prompt: string) {
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 900 },
    }),
  });
  if (!resp.ok) {
    return { ok: false as const, status: resp.status, error: await resp.text() };
  }
  const data = (await resp.json()) as any;
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
  const text = parts.map((p: any) => (p?.text != null ? String(p.text) : '')).join(' ').trim();
  return { ok: true as const, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  let body: { regionName?: string; excludeNames?: string[]; count?: number } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const regionName = sanitize(body.regionName, 40);
  if (!regionName) {
    return new Response(JSON.stringify({ error: 'regionName required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const excludeNames = uniq((body.excludeNames || []).map((n) => sanitize(n, 40)));
  const excludeSet = new Set(excludeNames.map((n) => n.replace(/\s+/g, '').toLowerCase()));
  const count = Math.max(4, Math.min(20, Number(body.count) || 12));

  const prompt = buildPrompt(regionName, excludeNames, count);
  const r = await callGemini(prompt);
  if (!r.ok) {
    return new Response(JSON.stringify({ error: 'gemini_failed', detail: r.error }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const landmarks = parseLandmarks(r.text, excludeSet);
  return new Response(JSON.stringify({ landmarks }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
});

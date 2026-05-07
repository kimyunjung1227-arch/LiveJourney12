// Supabase Edge Function: 장소 설명 생성 (Google Gemini)
// API 키: Supabase 대시보드 → Edge Functions → Secrets 에 GEMINI_API_KEY 설정

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_PLACE_MODEL') || 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

type RequestBody = {
  placeKey?: string;
  regionHint?: string;
  tier?: string;
  tags?: string[];
  userCaptions?: string[];
};

const sanitize = (s: unknown, maxLen: number) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);

const sanitizeList = (arr: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => sanitize(x, maxLen))
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, maxItems);

function buildPrompt(input: {
  name: string;
  regionHint: string;
  tier: string;
  tags: string[];
  userCaptions: string[];
}) {
  const tagText = input.tags.length
    ? input.tags
        .map((t) => String(t || '').replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((t) => `#${t}`)
        .join(' ')
    : '';

  // 제보 문장은 "분위기 힌트"로만 제공하되, 출력에는 제보/반응 언급 금지
  const captionHints = input.userCaptions.length
    ? input.userCaptions.slice(0, 6).map((t) => `- ${t}`).join('\n')
    : '- (없음)';

  return (
    `너는 한국 여행/장소 소개를 잘 쓰는 에디터야.\n` +
    `아래 입력을 바탕으로 "${input.name}"에 대한 '장소 소개 문단'을 작성해.\n\n` +
    `[핵심 요구사항]\n` +
    `- 출력은 2~4문장, 줄바꿈 없는 1개 문단.\n` +
    `- 문단 안에서 장소명("${input.name}")을 반복하지 말 것. (제목에 이미 노출됨)\n` +
    `- "제보/반응/트렌드/핫플" 같은 표현은 쓰지 말고, 장소 자체의 성격·특징·대표 포인트를 명확히.\n` +
    `- 가능하면 아래 3가지를 포함:\n` +
    `  1) 어떤 곳인지(공원/수변/전망/먹거리 등)\n` +
    `  2) 무엇으로 유명한지(산책로/포토 스팟/야경/먹거리 등)\n` +
    `  3) 방문하기 좋은 시기·시간대(오전/해질녘/평일/일몰 전후 등)\n` +
    `- 연도/역사/면적/수치 같은 사실은 확실히 아는 경우에만. 모르면 절대 지어내지 말 것.\n` +
    `- 광고 문구/과장/이모지 금지. 존댓말.\n` +
    `- 길이는 220~420자 목표.\n\n` +
    `[입력]\n` +
    `- 장소명: ${input.name}\n` +
    `- 지역 힌트: ${input.regionHint || '(없음)'}\n` +
    `- 참고 태그: ${tagText || '(없음)'}\n` +
    `- 분위기 힌트(참고만):\n${captionHints}\n\n` +
    `출력: 문단만 (따옴표/불릿/접두어 없이).`
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, message: 'GEMINI_API_KEY not configured in Edge Function secrets' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  try {
    let body: RequestBody | null = null;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      // 일부 환경에서 content-type 이 맞지 않거나 body가 문자열로 전달되는 케이스 방어
      try {
        const raw = await req.text();
        body = raw ? (JSON.parse(raw) as RequestBody) : null;
      } catch {
        body = null;
      }
    }
    const name = sanitize(body?.placeKey, 80);
    if (!name) {
      return new Response(JSON.stringify({ success: false, message: 'placeKey required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const regionHint = sanitize(body?.regionHint, 80);
    const tier = sanitize(body?.tier, 40);
    const tags = sanitizeList(body?.tags, 8, 32);
    const userCaptions = sanitizeList(body?.userCaptions, 8, 220);
    const prompt = buildPrompt({ name, regionHint, tier, tags, userCaptions });

    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 320,
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ success: false, message: 'Gemini API error', detail: err.slice(0, 500) }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const data = (await resp.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      ? String(data.candidates[0].content.parts[0].text)
      : '';
    const cleaned = text
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return new Response(
      JSON.stringify({
        success: !!cleaned,
        description: cleaned,
        method: 'supabase-edge-gemini',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: (e as any)?.message || 'Internal error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});


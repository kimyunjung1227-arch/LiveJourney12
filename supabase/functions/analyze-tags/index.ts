// Supabase Edge Function: 이미지 → AI 해시태그 생성 (Google Gemini)
// API 키: Supabase 대시보드 → Edge Functions → Secrets 에 GEMINI_API_KEY 설정
// CORS: 브라우저 preflight(OPTIONS)에 200 + 아래 헤더 필요 (Supabase 권장와 동일)

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

interface RequestBody {
  imageBase64?: string;
  mimeType?: string;
  location?: string;
  exifData?: Record<string, unknown>;
}

function parseTagsFromContent(content: string): string[] {
  const trimmed = content.trim();
  const tags: string[] = [];
  const matches = trimmed.match(/#[^\s#]+/g) || trimmed.split(/[\s,，、]+/).filter(Boolean);
  for (const m of matches) {
    const t = m.replace(/^#+/, '').trim();
    if (t && t.length <= 20) tags.push(t);
  }
  return [...new Set(tags)].slice(0, 12);
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
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: RequestBody = await req.json();
    const { imageBase64, mimeType = 'image/jpeg', location = '', exifData } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'imageBase64 required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const locationText = location ? `촬영/위치: ${location}.` : '';
    const exifText = exifData && typeof exifData === 'object'
      ? ` EXIF 등 메타: ${JSON.stringify(exifData).slice(0, 200)}.`
      : '';

    const prompt =
      '이 사진을 보고 여행/장소 관련 해시태그만 만들어 주세요. 한 줄에 #태그1 #태그2 형태로만 답하고, 다른 설명은 하지 마세요. 태그는 한글 위주로 5~12개, 짧고 구체적으로. ' +
      locationText +
      exifText;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ success: false, message: 'Gemini API error', detail: err }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const content = typeof textPart === 'string' ? textPart : '';
    const tags = parseTagsFromContent(content);

    return new Response(
      JSON.stringify({
        success: tags.length > 0,
        tags,
        caption: content.slice(0, 200) || null,
        method: 'supabase-edge-gemini',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: e?.message || 'Internal error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

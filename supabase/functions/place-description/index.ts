// Supabase Edge Function: 장소 설명 생성 (Google Gemini)
// API 키: Supabase 대시보드 → Edge Functions → Secrets 에 GEMINI_API_KEY 설정

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// 2026 기준: 1.5 계열은 generateContent 미지원/종료 케이스가 있어 최신 flash로 기본값 상향
const GEMINI_MODEL = Deno.env.get('GEMINI_PLACE_MODEL') || 'gemini-2.5-flash';
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

const curatedDescriptions: Array<{
  match: (name: string, regionHint: string) => boolean;
  description: string;
}> = [
  {
    match: (name, regionHint) =>
      name.replace(/\s+/g, ' ').trim().includes('이현공원') &&
      /대구|서구|이현동/.test(regionHint || '대구'),
    description:
      '대구광역시 서구 이현동에 위치한 이현공원은 방치되어 있던 야산을 2015년부터 대대적으로 정비하여 대구 서구의 대표적인 도심 속 힐링 명소로 재탄생시킨 곳입니다. 사계절 내내 아름다운 자연을 즐길 수 있어 산책, 피크닉, 가족 나들이 장소로 많은 시민들의 사랑을 받고 있습니다.',
  },
];

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
    `아래 입력을 바탕으로 "${input.name}"에 대한 '명확한 장소 소개 문단'을 작성해.\n\n` +
    `[핵심 요구사항]\n` +
    `- 출력은 2~3개의 문단(문단 사이 줄바꿈 1번 허용), 총 4~7문장.\n` +
    `- 첫 문장에는 장소명("${input.name}")을 1번만 포함하고, 이후에는 같은 표현 반복을 피하세요.\n` +
    `- "제보/반응/트렌드/핫플" 같은 표현은 쓰지 말고, 장소 자체의 성격·특징·대표 포인트를 명확히.\n` +
    `- 가능하면 아래 3가지를 포함:\n` +
    `  1) 어떤 곳인지(공원/수변/전망/먹거리 등)\n` +
    `  2) 무엇으로 유명한지(산책로/포토 스팟/야경/먹거리 등)\n` +
    `  3) 방문하기 좋은 시기·시간대(오전/해질녘/평일/일몰 전후 등)\n` +
    `- 연도/역사/면적/수치 같은 사실은 확실히 아는 경우에만. 모르면 절대 지어내지 말 것.\n` +
    `- 광고 문구/과장/이모지 금지. 존댓말.\n` +
    `- 길이는 450~900자 목표(최소 380자). 너무 짧으면 설명을 보강해.\n` +
    `- 문장은 반드시 마침표로 끝내고, 문장 중간에서 끊기지 않게 완결형으로 써.\n` +
    `- 참고: 아래는 형식 예시(내용을 그대로 복사하지 말고, 사실을 모르면 지어내지 말 것)\n` +
    `  예시) "<장소명>은/는 <지역>에 위치한 <어떤 곳>으로, <무엇이 유명>합니다. <어떤 방문 포인트>가 있고, <언제 가면 좋은지>를 안내합니다."\n\n` +
    `[입력]\n` +
    `- 장소명: ${input.name}\n` +
    `- 지역 힌트: ${input.regionHint || '(없음)'}\n` +
    `- 참고 태그: ${tagText || '(없음)'}\n` +
    `- 분위기 힌트(참고만):\n${captionHints}\n\n` +
    `출력: 소개 문단만 (따옴표/불릿/접두어 없이).`
  );
}

function buildJsonPrompt(input: {
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
        .slice(0, 8)
        .map((t) => `#${t}`)
        .join(' ')
    : '';

  const captionHints = input.userCaptions.length
    ? input.userCaptions.slice(0, 6).map((t) => `- ${t}`).join('\n')
    : '- (없음)';

  return (
    `너는 한국 여행/장소 소개를 잘 쓰는 에디터야.\n` +
    `아래 입력을 바탕으로 "${input.name}" 소개글을 만들기 위한 JSON을 작성해.\n\n` +
    `[규칙]\n` +
    `- 출력은 반드시 JSON 1개만. (앞뒤 설명/코드펜스/따옴표 밖 텍스트 금지)\n` +
    `- JSON 키는 아래 4개만 사용:\n` +
    `  - "one_liner": 한 문장 요약(60~120자)\n` +
    `  - "highlights": 대표 포인트 2~3개(각 40~90자) 배열\n` +
    `  - "best_time": 방문 추천 타이밍(시간대/요일/계절 등) 1~2문장(60~140자)\n` +
    `  - "tips": 방문 팁 1문장(40~100자)\n` +
    `- 첫 문장(one_liner)에는 장소명("${input.name}")을 1번만 포함하고, 나머지 항목에서는 반복을 피하세요.\n` +
    `- "제보/반응/트렌드/핫플" 같은 표현은 금지. 광고/과장/이모지 금지. 존댓말.\n` +
    `- 연도/역사/면적/수치 같은 사실은 확실히 아는 경우에만. 모르면 절대 지어내지 말 것.\n\n` +
    `[입력]\n` +
    `- 장소명: ${input.name}\n` +
    `- 지역 힌트: ${input.regionHint || '(없음)'}\n` +
    `- 참고 태그: ${tagText || '(없음)'}\n` +
    `- 분위기 힌트(참고만):\n${captionHints}\n`
  );
}

function stripJsonEnvelope(raw: string) {
  const s = String(raw || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1).trim();
  return s;
}

function safeParseJson<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const v = JSON.parse(stripJsonEnvelope(raw)) as T;
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: (e as any)?.message || 'JSON parse error' };
  }
}

function buildDescriptionFromJson(input: {
  name: string;
  regionHint: string;
  one_liner?: unknown;
  highlights?: unknown;
  best_time?: unknown;
  tips?: unknown;
}) {
  const one = sanitize(input.one_liner, 220);
  const hs = sanitizeList(input.highlights, 3, 140);
  const best = sanitize(input.best_time, 220);
  const tips = sanitize(input.tips, 180);

  const p1 = [one, ...hs].filter(Boolean).join(' ');
  const p2 = [best, tips].filter(Boolean).join(' ');
  const out = [p1, p2].filter(Boolean).join('\n\n').trim();
  return out;
}

function buildLocalFallback(input: { name: string; regionHint: string; tags: string[] }) {
  const name = input.name;
  const region = sanitize(input.regionHint, 80);
  const tagWords = (input.tags || [])
    .map((t) => String(t || '').replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const tagHint = tagWords.length ? `${tagWords.join(', ')} 느낌을 함께 즐길 수 있어요.` : '';

  const where = region ? `${region}에 있는 ` : '';
  return (
    `${name}은 ${where}잠깐 들러 걷기 좋은 분위기의 장소로, 주변 풍경을 보며 가볍게 산책하거나 사진을 남기기 좋습니다. ` +
    `동선이 단순해 혼자서도 부담 없이 둘러볼 수 있고, 여유롭게 머물며 분위기를 느끼기에 어울립니다. ` +
    (tagHint ? `${tagHint} ` : '') +
    `방문은 한낮보다는 오전이나 해 질 무렵이 비교적 쾌적하고, 주말·저녁 시간대에는 혼잡할 수 있어 여유 시간을 두고 가는 것을 추천합니다.`
  ).replace(/\s+/g, ' ').trim();
}

async function callGemini(prompt: string, maxOutputTokens: number, temperature = 0.45) {
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens,
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { ok: false as const, status: resp.status, error: err };
  }

  const data = (await resp.json()) as any;
  const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts
    : [];
  const text = parts
    .map((p: any) => (p && p.text != null ? String(p.text) : ''))
    .filter(Boolean)
    .join(' ')
    .trim();
  const cleaned = text
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { ok: true as const, status: resp.status, cleaned };
}

function isQuota429(status: number | undefined, errText: string | undefined) {
  const s = Number(status || 0);
  if (s === 429) return true;
  const t = String(errText || '');
  return /"code"\s*:\s*429|RESOURCE_EXHAUSTED|rate limit|Quota exceeded/i.test(t);
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
    // 일부 런타임/프록시에서 req.json()이 빈 body로 실패하거나,
    // json() 시도 후 stream이 소모되어 text()가 비는 케이스가 있어 단일 경로(text → parse)로 고정한다.
    const rawBody = await req.text();
    const contentType = String(req.headers.get('content-type') || '').toLowerCase();
    let body: RequestBody | null = null;
    if (rawBody && rawBody.trim()) {
      try {
        body = JSON.parse(rawBody) as RequestBody;
      } catch {
        // JSON이 아니라면 placeKey=... 형태를 허용 (최소 호환)
        try {
          const params = new URLSearchParams(rawBody);
          body = {
            placeKey: params.get('placeKey') || undefined,
            regionHint: params.get('regionHint') || undefined,
            tier: params.get('tier') || undefined,
            tags: params.getAll('tags') || undefined,
            userCaptions: params.getAll('userCaptions') || undefined,
          };
        } catch {
          body = null;
        }
      }
    }
    // body가 비어있으면 querystring도 fallback (디버깅/테스트 편의)
    if (!body || (!body.placeKey && !body.regionHint && !body.tier)) {
      const u = new URL(req.url);
      if (u.searchParams.get('placeKey')) {
        body = {
          ...(body || {}),
          placeKey: u.searchParams.get('placeKey') || undefined,
          regionHint: u.searchParams.get('regionHint') || undefined,
          tier: u.searchParams.get('tier') || undefined,
        };
      }
    }
    const name = sanitize(body?.placeKey, 80);
    if (!name) {
      return new Response(JSON.stringify({
        success: false,
        message: 'placeKey required',
        debug: {
          contentType,
          rawBodyLength: rawBody ? rawBody.length : 0,
        },
      }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const regionHint = sanitize(body?.regionHint, 80);
    const tier = sanitize(body?.tier, 40);
    const tags = sanitizeList(body?.tags, 8, 32);
    const userCaptions = sanitizeList(body?.userCaptions, 8, 220);

    // 사용자 요구(예시 문단)처럼 정확한 문장이 필요한 대표 케이스는 우선 고정 문구 제공
    const curated = curatedDescriptions.find((c) => c.match(name, regionHint));
    if (curated) {
      return new Response(
        JSON.stringify({
          success: true,
          description: curated.description,
          method: 'curated',
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const jsonPrompt = buildJsonPrompt({ name, regionHint, tier, tags, userCaptions });
    const first = await callGemini(jsonPrompt, 900, 0.35);
    if (!first.ok) {
      // 쿼터/레이트리밋은 즉시 로컬 폴백 (프론트에서 "설명 없음" 방지)
      if (isQuota429(first.status, (first as any).error)) {
        const fb = buildLocalFallback({ name, regionHint, tags });
        return new Response(
          JSON.stringify({ success: true, description: fb, method: 'fallback-local', reason: 'gemini_429' }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ success: false, message: 'Gemini API error', detail: String(first.error || '').slice(0, 500) }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    type PlaceJson = { one_liner?: string; highlights?: string[]; best_time?: string; tips?: string };
    let parsed = safeParseJson<PlaceJson>(first.cleaned || '');
    if (!parsed.ok) {
      const retry = await callGemini(
        jsonPrompt + `\n[재요청]\n- 반드시 JSON만 출력하세요. (코드블록/설명 금지)\n`,
        900,
        0.2,
      );
      if (!retry.ok && isQuota429(retry.status, (retry as any).error)) {
        const fb = buildLocalFallback({ name, regionHint, tags });
        return new Response(
          JSON.stringify({ success: true, description: fb, method: 'fallback-local', reason: 'gemini_429' }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      if (retry.ok) parsed = safeParseJson<PlaceJson>(retry.cleaned || '');
    }

    let cleaned = '';
    if (parsed.ok) {
      cleaned = buildDescriptionFromJson({ name, regionHint, ...parsed.value });
    } else {
      // JSON이 계속 실패하면 기존 자유서술 프롬프트로 최후 fallback
      const prompt = buildPrompt({ name, regionHint, tier, tags, userCaptions });
      const fallback = await callGemini(prompt, 1800, 0.25);
      if (!fallback.ok && isQuota429(fallback.status, (fallback as any).error)) {
        cleaned = buildLocalFallback({ name, regionHint, tags });
      } else {
        cleaned = fallback.ok ? (fallback.cleaned || '') : '';
      }
    }

    const needsRetry = (s: string) => s.length < 260 || (s && !/[.!?]$/.test(s));
    if (needsRetry(cleaned)) {
      const prompt = buildPrompt({ name, regionHint, tier, tags, userCaptions });
      const second = await callGemini(
        prompt +
          `\n\n[재요청]\n- 너무 짧거나 문장 중간에서 끊겼습니다. 처음부터 완결된 2~3문단 소개문으로 다시 작성하세요.\n- 최소 450자 이상, 마지막은 반드시 마침표로 끝내세요.\n`,
        2400,
        0.2,
      );
      if (!second.ok && isQuota429(second.status, (second as any).error)) {
        cleaned = buildLocalFallback({ name, regionHint, tags });
      } else if (second.ok && second.cleaned && second.cleaned.length > cleaned.length) {
        cleaned = second.cleaned;
      }
    }

    if (!cleaned) {
      cleaned = buildLocalFallback({ name, regionHint, tags });
      return new Response(
        JSON.stringify({ success: true, description: cleaned, method: 'fallback-local', reason: 'empty_result' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

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


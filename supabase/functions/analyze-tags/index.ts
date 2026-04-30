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
/** 502 방지: base64가 너무 크면 메모리/타임아웃 위험 (약 400KB 상한) */
const MAX_BASE64_LENGTH = 550000;
/** Gemini 호출 타임아웃 (ms) - Supabase 기본 60초 전에 종료 */
const GEMINI_TIMEOUT_MS = 50000;

interface RequestBody {
  imageBase64?: string;
  mimeType?: string;
  location?: string;
  exifData?: Record<string, unknown>;
}

const CATEGORY_MAP: Record<string, { name: string; icon: string }> = {
  bloom: { name: '개화정보', icon: '🌸' },
  food: { name: '맛집정보', icon: '🍜' },
  scenic: { name: '추천장소', icon: '🏞️' },
  landmark: { name: '명소', icon: '🏛️' },
  waiting: { name: '웨이팅', icon: '⏱️' },
  general: { name: '일반', icon: '📌' },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_MAP);

/** 촬영 순간 기준 한국 시각(시 0–23). EXIF의 photoDate(ISO) 사용 */
function hourInSeoul(iso: string | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = parseInt(
    d.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }),
    10,
  );
  return Number.isFinite(h) ? h : null;
}

/** 모델이 잘못 낸 시간대 태그 제거 (EXIF 시각과 충돌 시) */
function tagConflictsWithExifHour(tag: string, hour: number): boolean {
  const t = tag;
  if (/일몰|석양|노을|해질|골든아워|저녁노을/.test(t)) {
    if (hour < 18 || hour > 20) return true;
  }
  if (/야경|밤하늘|밤풍경/.test(t)) {
    if (hour >= 6 && hour <= 18) return true;
  }
  if (/블루아워/.test(t)) {
    if (hour >= 7 && hour <= 17) return true;
  }
  if (/일출|미명|동틀/.test(t)) {
    if (hour < 4 || hour > 10) return true;
  }
  if (/새벽/.test(t)) {
    if (hour < 4 || hour > 9) return true;
  }
  if (/한낮|대낮/.test(t)) {
    if (hour < 10 || hour > 16) return true;
  }
  return false;
}

function filterTagsByExifHour(tags: string[], hour: number | null): string[] {
  if (hour === null) return tags;
  return tags.filter((tag) => !tagConflictsWithExifHour(tag, hour));
}

/** 프롬프트용·로그용 짧은 EXIF 요약 (전체 JSON 자르기 대신) */
function buildExifPromptBlock(exifData: Record<string, unknown> | undefined): { text: string; hourSeoul: number | null } {
  if (!exifData || typeof exifData !== 'object') {
    return {
      text:
        '[촬영 시각 정보 없음] 일몰·일출·야경·골든아워·블루아워 같은 구체적 시간대 태그는 넣지 마세요. 이미지만으로 확실할 때만 예외.',
      hourSeoul: null,
    };
  }
  const iso = typeof exifData.photoDate === 'string' ? exifData.photoDate : '';
  const hour = hourInSeoul(iso);
  const raw =
    typeof exifData.dateTimeOriginalRaw === 'string'
      ? exifData.dateTimeOriginalRaw
      : typeof exifData.dateTimeOriginal === 'string'
        ? String(exifData.dateTimeOriginal)
        : '';
  const gps = exifData.gpsCoordinates as { lat?: number; lng?: number } | undefined;
  const gpsLine =
    gps && typeof gps.lat === 'number' && typeof gps.lng === 'number'
      ? ` GPS 대략: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}.`
      : '';

  if (hour === null) {
    return {
      text:
        `[EXIF에 유효한 촬영일시 없음]${gpsLine} 시간대 특화 태그(일몰/일출/야경 등)는 넣지 마세요.`,
      hourSeoul: null,
    };
  }

  let period = '밤/이른 시간';
  if (hour >= 5 && hour < 11) period = '아침·오전';
  else if (hour >= 11 && hour < 14) period = '점심·낮';
  else if (hour >= 14 && hour < 18) period = '오후·낮';
  else if (hour >= 18 && hour < 21) period = '저녁 무렵(일몰 가능 구간)';
  else if (hour >= 21 || hour < 5) period = '밤';

  const isoLine = iso ? ` ISO(UTC 기준 순간): ${iso}.` : '';
  const rawLine = raw ? ` 카메라 기록 원문: ${raw.slice(0, 40)}.` : '';

  const forbid =
    hour >= 9 && hour <= 16
      ? ' 이 시각에는 일몰·석양·노을·골든아워·야경·야간·블루아워·일출·새벽 태그를 절대 쓰지 마세요. 화면이 황금빛으로 보여도 태그에는 넣지 마세요.'
      : hour >= 18 && hour <= 20
        ? ' 일몰·노을·골든아워 계열만 가능. 일출·새벽·한낮·대낮·야경(완전 야간)은 피하세요.'
        : hour >= 21 || hour < 5
          ? ' 야경·밤 계열 가능. 일출·한낮·대낮·점심 햇살 등은 피하세요.'
          : hour >= 5 && hour < 9
            ? ' 아침·일출·새벽 가능. 일몰·야경·한낮은 피하세요.'
            : ' 시간대 태그는 위 구간에 맞게만 사용하세요.';

  return {
    hourSeoul: hour,
    text:
      `[EXIF 촬영 시각 — 최우선]\n` +
      `- 한국 시각 기준 약 ${hour}시대, 분위기: ${period}.${isoLine}${rawLine}${gpsLine}\n` +
      `- 시간대 관련 한글 태그는 위 시각과 반드시 일치해야 합니다.${forbid}\n` +
      `- 이미지 밝기와 무관하게 EXIF 시각이 우선입니다.`,
  };
}

function parseTagsFromContent(content: string): string[] {
  const trimmed = content.trim();
  const tags: string[] = [];
  const matches = trimmed.match(/#[^\s#]+/g) || trimmed.split(/[\s,，、]+/).filter(Boolean);
  for (const m of matches) {
    const t = m.replace(/^#+/, '').trim();
    if (t && t.length <= 20) tags.push(t);
  }
  return [...new Set(tags)].slice(0, 14);
}

function parseCategoryFromContent(content: string): { category: string; categoryName: string; categoryIcon: string } {
  const fallback = { category: 'scenic', categoryName: CATEGORY_MAP.scenic.name, categoryIcon: CATEGORY_MAP.scenic.icon };
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let category = '';
  let categoryName = '';
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('CATEGORY:') || upper.startsWith('카테고리:')) {
      const val = line.replace(/^(?:CATEGORY|카테고리):\s*/i, '').trim().toLowerCase().split(/\s/)[0];
      if (CATEGORY_KEYS.includes(val)) category = val;
      break;
    }
  }
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('NAME:') || upper.startsWith('이름:')) {
      categoryName = line.replace(/^(?:NAME|이름):\s*/i, '').trim().slice(0, 20);
      break;
    }
  }
  if (!category || !CATEGORY_MAP[category]) return fallback;
  const mapped = CATEGORY_MAP[category];
  return {
    category,
    categoryName: categoryName || mapped.name,
    categoryIcon: mapped.icon,
  };
}

function parseCategoriesFromContent(content: string): Array<{ category: string; categoryName: string; categoryIcon: string }> {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('CATEGORIES:')) {
      const raw = line.replace(/^CATEGORIES:\s*/i, '').trim();
      const parts = raw.split(/[,，\s]+/).map((s) => s.toLowerCase().trim()).filter(Boolean);
      const out: Array<{ category: string; categoryName: string; categoryIcon: string }> = [];
      const seen = new Set<string>();
      for (const p of parts) {
        if (!CATEGORY_KEYS.includes(p) || seen.has(p)) continue;
        seen.add(p);
        const m = CATEGORY_MAP[p];
        out.push({ category: p, categoryName: m.name, categoryIcon: m.icon });
      }
      if (out.length) return out;
    }
  }
  const single = parseCategoryFromContent(content);
  return [{ category: single.category, categoryName: single.categoryName, categoryIcon: single.categoryIcon }];
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
    const base64Clean = imageBase64.replace(/\s/g, '');
    if (base64Clean.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'image too large',
          detail: `base64 length ${base64Clean.length} exceeds ${MAX_BASE64_LENGTH}. Resize image on client.`,
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const locationText = location ? `촬영/위치(사용자 입력): ${location}\n` : '';
    const exifBlock = buildExifPromptBlock(exifData && typeof exifData === 'object' ? exifData : undefined);

    const prompt =
      '역할: 여행 SNS용 해시태그·카테고리 작가. 아래 형식 외 문장·설명 금지.\n\n' +
      exifBlock.text +
      '\n\n' +
      locationText +
      '[태그 우선순위]\n' +
      '1) TAGS에서 맨 앞 4~7개는 사진에 **실제로 보이는 구체적 피사체**만: 예) 벚꽃, 벚꽃터널, 매화, 유채꽃, 코스모스, 카페간판, 한강, 유람선, 벽화마을 등. 추측·유행어만 쌓지 마세요.\n' +
      '2) 꽃이 명확하면 종/상황을 태그에 반드시 포함 (예: 벚꽃, 벚꽃축제, 개화).\n' +
      '3) 그 다음에 장소·분위기·활동 태그.\n' +
      '4) 시간대 단어(일몰·야경 등)는 EXIF 규칙을 어기면 안 됩니다.\n\n' +
      '[출력 형식]\n' +
      'CATEGORIES: bloom, food, scenic, landmark, waiting, general 중 해당되는 것만 영어 소문자로 쉼표 구분 ' +
      '(꽃·벚꽃이 보이면 bloom, 풍경이면 scenic 등 복수 가능. 웨이팅 대열이면 waiting. 음식·카페 메인이면 food).\n' +
      'TAGS: #태그1 #태그2 ... 한글 위주 **6~12개**, 각 10자 이내. 앞쪽은 구체 피사체 위주.\n';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Clean,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 520,
            temperature: 0.32,
          },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      const isTimeout = errMsg.includes('abort') || errMsg.includes('timeout');
      return new Response(
        JSON.stringify({
          success: false,
          message: isTimeout ? 'Gemini request timeout' : 'Gemini request failed',
          detail: errMsg,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ success: false, message: 'Gemini API error', detail: err.slice(0, 500) }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch (parseErr: unknown) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid Gemini response', detail: errMsg }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const candidates = data?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const textPart = candidates?.[0]?.content?.parts?.[0]?.text;
    const content = typeof textPart === 'string' ? textPart : '';
    const tagsRaw = parseTagsFromContent(content);
    const tags = filterTagsByExifHour(tagsRaw, exifBlock.hourSeoul);
    const categories = parseCategoriesFromContent(content);
    const primary = categories[0] || parseCategoryFromContent(content);
    const hasTags = tags.length > 0;
    const hasCategory = categories.length > 0 && CATEGORY_KEYS.includes(primary.category);

    return new Response(
      JSON.stringify({
        success: hasTags || hasCategory,
        tags,
        categories,
        category: primary.category,
        categoryName: categories.map((c) => c.categoryName).join(', '),
        categoryIcon: primary.categoryIcon,
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

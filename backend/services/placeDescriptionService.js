const axios = require('axios');
const crypto = require('crypto');
const cache = require('../utils/cache');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_AI =
  String(process.env.USE_AI_PLACE_DESCRIPTION || '').trim() !== 'false' && !!GEMINI_API_KEY;

const GEMINI_MODEL = process.env.GEMINI_PLACE_MODEL || 'gemini-1.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const stableKey = (payload) =>
  crypto.createHash('sha1').update(JSON.stringify(payload || {})).digest('hex');

const sanitizeLines = (arr, maxItems = 6, maxLen = 280) =>
  (Array.isArray(arr) ? arr : [])
    .map((s) => String(s || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((s, idx, a) => a.indexOf(s) === idx)
    .slice(0, maxItems)
    .map((s) => (s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s));

/**
 * 장소 설명 생성 (텍스트 only)
 * - 입력(장소명, 지역 힌트, 태그, 제보 문장)을 통합해 1~2문장으로 정리
 * - 근거 없는 연도/수치/사실 단정은 피하도록 프롬프트에 강제
 */
async function generatePlaceDescription({
  placeKey,
  regionHint = '',
  tier = '',
  tags = [],
  userCaptions = [],
}) {
  const name = String(placeKey || '').trim();
  if (!name) {
    return { ok: false, error: 'placeKey required' };
  }

  if (!USE_AI) {
    return { ok: true, description: '' };
  }

  const payload = {
    name,
    regionHint: String(regionHint || '').trim(),
    tier: String(tier || '').trim(),
    tags: sanitizeLines(tags, 8, 40),
    userCaptions: sanitizeLines(userCaptions, 8, 220),
  };
  const key = `ai:placeDesc:${stableKey(payload)}`;
  const cached = cache.get(key);
  if (cached) return { ok: true, description: cached, cached: true };

  const tagText = payload.tags.length ? payload.tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ') : '';
  const reports = payload.userCaptions.length
    ? payload.userCaptions.map((t, i) => `- 제보${i + 1}: ${t}`).join('\n')
    : '- (제보 없음)';

  const prompt = `너는 한국 여행/장소 소개를 잘 쓰는 에디터야.
아래 입력을 바탕으로 "${payload.name}"에 대한 '장소 설명'을 **검색결과 스니펫처럼** 명확한 소개 문단으로 작성해.

요구사항:
- 출력은 **2~4문장** (줄바꿈 없는 1개 문단).
- 문단 안에서 **장소명("${payload.name}")을 반복해서 쓰지 말 것**. (제목에 이미 노출됨)
- "장소 자체"에 대한 설명이 중심이어야 해. (제보/트렌드/반응 같은 표현은 쓰지 말고, 장소 성격·특징·대표 포인트를 써)
- 가능하면 아래 3가지를 포함:
  1) 어떤 곳인지(공원/수변/전망/먹거리 등)
  2) 무엇으로 유명한지(포토 스팟/산책로/야경/먹거리 등)
  3) 방문하기 좋은 시기·시간대(예: 오전/해질녘/평일/일몰 전후)
- 연도/역사/면적/사실관계는 **확실히 아는 경우에만**. 모르면 절대 지어내지 말고 일반적인 표현으로.
- 광고 문구, 과장, 이모지 금지. 존댓말로 자연스럽게.
- 길이는 **220~420자**를 목표로.

입력:
- 장소명: ${payload.name}
- 지역 힌트: ${payload.regionHint || '(없음)'}
- 핫플 티어/상황: ${payload.tier || '(없음)'}
- 관련 태그: ${tagText || '(없음)'}
- 최근 사용자 제보(요약 소재):
${reports}

출력: 설명 문단만 (따옴표/불릿/접두어 없이).`;

  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 320,
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const text =
      response?.data?.candidates?.[0]?.content?.parts?.[0]?.text != null
        ? String(response.data.candidates[0].content.parts[0].text).trim()
        : '';

    const cleaned = text
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned) {
      cache.set(key, cleaned, DEFAULT_TTL_MS);
    }

    return { ok: true, description: cleaned };
  } catch (e) {
    const msg = e?.response?.data ? JSON.stringify(e.response.data).slice(0, 500) : String(e?.message || e || '');
    return { ok: false, error: msg || 'gemini request failed' };
  }
}

module.exports = {
  generatePlaceDescription,
};


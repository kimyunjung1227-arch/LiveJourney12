/**
 * 장소(실시간 핫플) 상세 — "왜 지금 핫플인지"를 사진 대신 정보로 설명하기 위한 집계.
 *
 * 업로드에서 붙는 실시간 태그(utils/realtimeTags.js)를 이 장소의 최근 게시물에서 모아
 *   · 하늘 / 체감 / 옷차림 / 사람  4개 축으로 요약하고
 *   · 그 요약을 한 문단("지금 이곳은")으로 풀어 쓴다.
 *
 * 원칙
 *  - 48h 노출 윈도우. 최신 제보일수록 가중치를 크게 준다(실시간성 최우선).
 *  - 없는 정보는 만들지 않는다. 태그가 없으면 기상청 실측(기온·하늘)에서만 보완하고,
 *    그마저 없으면 해당 칸은 비운다.
 */

import {
  WEATHER_TAGS,
  WEATHER_TAG_SNOW,
  FEEL_TAGS,
  OUTFIT_TAGS,
  SCENE_TAGS,
  SEASON_TAGS,
} from './realtimeTags';

const HOUR_MS = 60 * 60 * 1000;
export const LIVE_WINDOW_MS = 48 * HOUR_MS;

const labelOf = (t) => t.label;
const SKY_LABELS = [...WEATHER_TAGS.map(labelOf), WEATHER_TAG_SNOW.label];
const FEEL_LABELS = FEEL_TAGS.map(labelOf);
const OUTFIT_LABELS = OUTFIT_TAGS.map(labelOf);
const CROWD_LABELS = ['붐빔', '한산'];
const NOTICE_LABELS = SCENE_TAGS.map(labelOf).filter((l) => !CROWD_LABELS.includes(l));
const SEASON_LABELS = Object.values(SEASON_TAGS).flat().map(labelOf);

/** 태그 한 개 → 어느 축인지 */
function axisOf(tag) {
  if (SKY_LABELS.includes(tag)) return 'sky';
  if (FEEL_LABELS.includes(tag)) return 'feel';
  if (OUTFIT_LABELS.includes(tag)) return 'outfit';
  if (CROWD_LABELS.includes(tag)) return 'crowd';
  if (NOTICE_LABELS.includes(tag)) return 'notice';
  if (SEASON_LABELS.includes(tag)) return 'season';
  return null;
}

/** 게시물 시각 — EXIF 촬영 시각 우선(현장성), 없으면 작성 시각 */
export function getPostLiveTimeMs(post) {
  const raw = post?.exif_taken_at || post?.created_at || post?.captured_at || post?.timestamp || null;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** 최신일수록 크게 — 실시간 화면이므로 3시간 이내 제보가 사실상 결론을 낸다 */
function freshnessWeight(ageMs) {
  if (ageMs < 0) return 1;
  if (ageMs <= 3 * HOUR_MS) return 1;
  if (ageMs <= 12 * HOUR_MS) return 0.6;
  if (ageMs <= 24 * HOUR_MS) return 0.35;
  if (ageMs <= LIVE_WINDOW_MS) return 0.15;
  return 0;
}

function addVote(map, tag, weight, timeMs) {
  const prev = map.get(tag) || { weight: 0, latestMs: 0 };
  map.set(tag, {
    weight: prev.weight + weight,
    latestMs: Math.max(prev.latestMs, timeMs),
  });
}

/** 가중치 1위(동률이면 더 최근 제보) */
function topVote(map) {
  let best = null;
  map.forEach((v, tag) => {
    if (!best || v.weight > best.weight || (v.weight === best.weight && v.latestMs > best.latestMs)) {
      best = { tag, ...v };
    }
  });
  return best ? best.tag : '';
}

function sortedKeys(map) {
  return Array.from(map.entries())
    .sort((a, b) => b[1].weight - a[1].weight || b[1].latestMs - a[1].latestMs)
    .map(([tag]) => tag);
}

/**
 * 이 장소의 최근 게시물 → 실시간 상태 집계.
 * @param {Array} posts normalizePostRow 결과 배열(tags/exif_taken_at/created_at 필요)
 * @param {number} nowMs
 */
export function summarizePlaceLiveStatus(posts, nowMs = Date.now()) {
  const votes = {
    sky: new Map(),
    feel: new Map(),
    outfit: new Map(),
    crowd: new Map(),
    notice: new Map(),
    season: new Map(),
  };
  let reportCount = 0;
  let taggedCount = 0;
  let latestMs = 0;

  (Array.isArray(posts) ? posts : []).forEach((p) => {
    const timeMs = getPostLiveTimeMs(p);
    if (!timeMs) return;
    const weight = freshnessWeight(nowMs - timeMs);
    if (weight <= 0) return;

    reportCount += 1;
    if (timeMs > latestMs) latestMs = timeMs;

    const tags = (Array.isArray(p?.tags) ? p.tags : [])
      .map((t) => String(t || '').replace(/^#+/, '').trim())
      .filter(Boolean);
    if (tags.length > 0) taggedCount += 1;
    tags.forEach((tag) => {
      const axis = axisOf(tag);
      if (axis) addVote(votes[axis], tag, weight, timeMs);
    });
  });

  return {
    sky: topVote(votes.sky),
    feel: topVote(votes.feel),
    outfit: topVote(votes.outfit),
    crowd: topVote(votes.crowd),
    notices: sortedKeys(votes.notice).slice(0, 2),
    seasons: sortedKeys(votes.season).slice(0, 2),
    reportCount,
    taggedCount,
    latestMs,
  };
}

/** "17℃" / "17°C" → 17 */
export function parseTemperature(raw) {
  const m = String(raw ?? '').match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** 기온만 있을 때의 체감 보완값(기상청 실측 기반) */
export function feelFromTemperature(c) {
  if (c == null) return '';
  if (c <= 0) return '많이 추워요';
  if (c < 8) return '추워요';
  if (c < 16) return '쌀쌀해요';
  if (c < 23) return '선선해요';
  if (c < 28) return '따뜻해요';
  return '더워요';
}

/** 기온만 있을 때의 옷차림 보완값 */
export function outfitFromTemperature(c) {
  if (c == null) return '';
  if (c >= 25) return '반팔로 충분';
  if (c >= 20) return '긴팔 추천';
  if (c >= 10) return '겉옷 필요';
  if (c >= 4) return '두꺼운 겉옷';
  return '패딩 필요';
}

const FEEL_PHRASE = {
  바람셈: '바람 불어요',
  안개: '안개 꼈어요',
  추움: '추워요',
  더움: '더워요',
  우산필요: '우산 필요',
};
const OUTFIT_PHRASE = {
  반팔: '반팔로 충분',
  긴팔: '긴팔 추천',
  겉옷: '겉옷 필요',
  패딩: '패딩 필요',
};
const CROWD_PHRASE = { 붐빔: '붐벼요', 한산: '한산해요' };
const NOTICE_PHRASE = { 주차꽉참: '주차 만차', 통제중: '통제 중' };

/** 하늘 태그가 없을 때 기상청 하늘 상태를 같은 어휘로 맞춘다 */
function normalizeSkyFromWeather(condition) {
  const c = String(condition || '').trim();
  if (!c || c === '-') return '';
  if (c.includes('진눈깨비') || c.includes('눈')) return '눈';
  if (c.includes('소나기') || c.includes('비')) return '비';
  if (c.includes('흐림') || c.includes('구름많음')) return '흐림';
  if (c.includes('구름')) return '구름조금';
  if (c.includes('맑음')) return '맑음';
  return c;
}

/**
 * 집계 + 실측 날씨 → 화면에 그대로 꽂을 4개 축 값.
 * 각 칸은 { value, from: 'report' | 'weather' | '' }.
 */
export function buildLiveStatusView(status, weather) {
  const s = status || {};
  const tempC = parseTemperature(weather?.temperature);
  const skyFromWeather = normalizeSkyFromWeather(weather?.condition);

  const pick = (reportValue, weatherValue) => {
    if (reportValue) return { value: reportValue, from: 'report' };
    if (weatherValue) return { value: weatherValue, from: 'weather' };
    return { value: '', from: '' };
  };

  return {
    sky: pick(s.sky, skyFromWeather),
    feel: pick(s.feel ? FEEL_PHRASE[s.feel] || s.feel : '', feelFromTemperature(tempC)),
    outfit: pick(s.outfit ? OUTFIT_PHRASE[s.outfit] || s.outfit : '', outfitFromTemperature(tempC)),
    crowd: pick(s.crowd ? CROWD_PHRASE[s.crowd] || s.crowd : '', ''),
    notices: (s.notices || []).map((n) => NOTICE_PHRASE[n] || n),
    seasons: s.seasons || [],
    tempC,
  };
}

const SEASON_SENTENCE = {
  벚꽃만개: '벚꽃이 만개했어요',
  유채절정: '유채꽃이 절정이에요',
  파도높음: '파도가 높아요',
  물놀이가능: '물놀이하기 좋아요',
  단풍절정: '단풍이 절정이에요',
  억새: '억새가 한창이에요',
  눈쌓임: '눈이 쌓여 있어요',
  빙판: '빙판이 있어 조심해야 해요',
};
const SKY_CLAUSE = {
  맑음: '하늘이 맑고',
  구름조금: '구름이 조금 있고',
  흐림: '하늘이 흐리고',
  비: '비가 내리고',
  오락가락: '비가 오락가락하고',
  눈: '눈이 내리고',
};
const SKY_ALONE = {
  맑음: '하늘이 맑아요',
  구름조금: '구름이 조금 있어요',
  흐림: '하늘이 흐려요',
  비: '비가 내려요',
  오락가락: '비가 오락가락해요',
  눈: '눈이 내려요',
};
const CROWD_SENTENCE = {
  붐벼요: '지금은 사람이 많은 편이에요',
  한산해요: '지금은 한산한 편이에요',
};
const NOTICE_SENTENCE = {
  '주차 만차': '주차장은 거의 찼어요',
  '통제 중': '일부 구간은 통제 중이에요',
};
const OUTFIT_SENTENCE = {
  '반팔로 충분': '반팔로도 충분해요',
  '긴팔 추천': '긴팔이 알맞아요',
  '겉옷 필요': '겉옷을 챙기면 좋아요',
  '두꺼운 겉옷': '두꺼운 겉옷을 챙기세요',
  '패딩 필요': '패딩이 필요할 만큼 추워요',
};

/**
 * "지금 이곳은" 한 문단.
 * 제보/실측에서 확인된 사실만 이어 붙인다(최대 3문장). 근거가 없으면 빈 문자열.
 */
export function buildPlaceLiveSentence(view) {
  if (!view) return '';
  const parts = [];

  const season = (view.seasons || []).map((s) => SEASON_SENTENCE[s]).filter(Boolean)[0];
  if (season) parts.push(season);

  const skyValue = view.sky?.value || '';
  const feelWord = view.feel?.value || '';
  if (SKY_CLAUSE[skyValue] && feelWord) parts.push(`${SKY_CLAUSE[skyValue]} 체감은 ${feelWord}`);
  else if (SKY_ALONE[skyValue]) parts.push(SKY_ALONE[skyValue]);
  else if (feelWord) parts.push(`체감은 ${feelWord}`);

  const crowd = CROWD_SENTENCE[view.crowd?.value];
  if (crowd) parts.push(crowd);

  const notice = (view.notices || []).map((n) => NOTICE_SENTENCE[n]).filter(Boolean)[0];
  if (notice) parts.push(notice);

  if (parts.length < 3) {
    const outfit = OUTFIT_SENTENCE[view.outfit?.value];
    if (outfit) parts.push(outfit);
  }

  if (parts.length === 0) return '';
  return `${parts.slice(0, 3).join('. ')}.`;
}

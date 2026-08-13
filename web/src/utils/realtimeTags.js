/**
 * 실시간 태그 정의 — 업로드 정보 화면과 게시물 수정 화면이 함께 쓴다.
 *
 *  1군 하늘(날씨)  — 필수·단일. 검색/필터/집계의 기준축. (눈은 겨울 시즌만 노출)
 *  2군 체감        — 선택·다중. 사진에 안 찍히는 정보(라이브캠 대비 차별점).
 *  3군 옷차림      — 선택·단일. "뭐 입고 가지" 여행 전 검색 1순위.
 *  4군 현장        — 선택·다중.
 *  시즌 태그       — 시기 한정 노출(수집욕·화제성).
 *
 * 저장/표시는 라벨 텍스트만(예: "맑음"). 이모지는 컬러가 과해 미표시(플랫·미니멀 톤).
 * 태그는 posts.tags 배열에 그대로 들어간다.
 */

export const WEATHER_TAGS = [
  { emoji: '☀️', label: '맑음' },
  { emoji: '⛅', label: '구름조금' },
  { emoji: '☁️', label: '흐림' },
  { emoji: '🌧️', label: '비' },
  { emoji: '🌦️', label: '오락가락' },
];
export const WEATHER_TAG_SNOW = { emoji: '🌨️', label: '눈' }; // 겨울 한정
export const FEEL_TAGS = [
  { emoji: '💨', label: '바람셈' },
  { emoji: '🌫️', label: '안개' },
  { emoji: '🥶', label: '추움' },
  { emoji: '🥵', label: '더움' },
  { emoji: '☂️', label: '우산필요' },
];
export const OUTFIT_TAGS = [
  { emoji: '👕', label: '반팔' },
  { emoji: '👔', label: '긴팔' },
  { emoji: '🧥', label: '겉옷' },
  { emoji: '🧣', label: '패딩' },
];
export const SCENE_TAGS = [
  { emoji: '👥', label: '붐빔' },
  { emoji: '😌', label: '한산' },
  { emoji: '🅿️', label: '주차꽉참' },
  { emoji: '🚧', label: '통제중' },
];
export const SEASON_TAGS = {
  spring: [{ emoji: '🌸', label: '벚꽃만개' }, { emoji: '🌼', label: '유채절정' }],
  summer: [{ emoji: '🌊', label: '파도높음' }, { emoji: '🌴', label: '물놀이가능' }],
  autumn: [{ emoji: '🍁', label: '단풍절정' }, { emoji: '🌾', label: '억새' }],
  winter: [{ emoji: '❄️', label: '눈쌓임' }, { emoji: '🧊', label: '빙판' }],
};
export const SEASON_LABEL = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };

/** month: 1~12 → 계절 키 */
export function getSeasonKey(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 태그 객체 → 저장/표시용 문자열(라벨만) */
export const tagStr = (t) => t.label;

/** 비어 있는 태그 선택값 */
export const emptyTagGroups = () => ({
  weather: '',
  feel: [],
  outfit: '',
  scene: [],
  season: [],
  /** 위 5군에 없는 태그(예전 버전·관리자 입력) — 저장 시 그대로 보존한다 */
  extra: [],
});

const labelsOf = (list) => list.map(tagStr);
const ALL_SEASON_LABELS = Object.values(SEASON_TAGS).flatMap(labelsOf);

/**
 * posts.tags 배열 → 군별 선택값.
 * 어느 군에도 없는 태그는 extra 로 남겨 수정 저장 시 잃지 않는다.
 */
export function splitTagsIntoGroups(tags) {
  const groups = emptyTagGroups();
  const weatherLabels = [...labelsOf(WEATHER_TAGS), tagStr(WEATHER_TAG_SNOW)];
  const feelLabels = labelsOf(FEEL_TAGS);
  const outfitLabels = labelsOf(OUTFIT_TAGS);
  const sceneLabels = labelsOf(SCENE_TAGS);

  (Array.isArray(tags) ? tags : []).forEach((raw) => {
    const t = String(raw || '').replace(/^#+/, '').trim();
    if (!t) return;
    if (weatherLabels.includes(t)) {
      if (!groups.weather) groups.weather = t; // 단일 — 첫 값만
    } else if (feelLabels.includes(t)) {
      if (!groups.feel.includes(t)) groups.feel.push(t);
    } else if (outfitLabels.includes(t)) {
      if (!groups.outfit) groups.outfit = t; // 단일
    } else if (sceneLabels.includes(t)) {
      if (!groups.scene.includes(t)) groups.scene.push(t);
    } else if (ALL_SEASON_LABELS.includes(t)) {
      if (!groups.season.includes(t)) groups.season.push(t);
    } else if (!groups.extra.includes(t)) {
      groups.extra.push(t);
    }
  });
  return groups;
}

/** 군별 선택값 → posts.tags 배열 (순서: 하늘 → 체감 → 옷차림 → 현장 → 시즌 → 기타) */
export function flattenTagGroups(groups) {
  const g = groups || emptyTagGroups();
  return [
    g.weather,
    ...(g.feel || []),
    g.outfit,
    ...(g.scene || []),
    ...(g.season || []),
    ...(g.extra || []),
  ].filter(Boolean);
}

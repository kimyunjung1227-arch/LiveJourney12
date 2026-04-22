/**
 * 행동 전환(Conversion) 이벤트 — 핫니스 엔진의 Conversion 지표
 * 피드를 본 후 '길찾기'·'전화하기' 등 행동을 기록
 */

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// 서버 운영 전환: localStorage 제거 → 세션 메모리만 사용
let conversionEventsMemory = [];

export const CONVERSION_TYPES = {
  MAP: 'map',
  CALL: 'call',
  SAVE_PLACE: 'save_place',
};

const loadEvents = () => {
  const now = Date.now();
  conversionEventsMemory = (Array.isArray(conversionEventsMemory) ? conversionEventsMemory : [])
    .filter((e) => e?.postId && e?.ts && now - e.ts < MAX_AGE_MS);
  return conversionEventsMemory;
};

const saveEvents = (events) => {
  conversionEventsMemory = (Array.isArray(events) ? events : []).slice(-500);
};

/**
 * 전환 이벤트 기록 (길찾기/전화/장소 저장 등)
 */
export const recordConversion = (postId, type = CONVERSION_TYPES.MAP) => {
  if (!postId) return;
  const events = loadEvents();
  events.push({ postId: String(postId), type, ts: Date.now() });
  saveEvents(events);
  window.dispatchEvent(new CustomEvent('hotspotConversion', { detail: { postId, type } }));
};

/**
 * 특정 게시물에 대한 전환 횟수 (최근 7일)
 */
export const getConversionCount = (postId) => {
  if (!postId) return 0;
  const events = loadEvents();
  return events.filter((e) => e.postId === String(postId)).length;
};

/**
 * postId → 전환 수 맵 (핫니스 계산용)
 */
export const getConversionCountByPost = (postIds) => {
  const events = loadEvents();
  const map = {};
  (postIds || []).forEach((id) => { map[String(id)] = 0; });
  events.forEach((e) => {
    if (map[e.postId] != null) map[e.postId] += 1;
  });
  return map;
};

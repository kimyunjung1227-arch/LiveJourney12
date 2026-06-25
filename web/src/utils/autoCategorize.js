/**
 * 자동 카테고리 분류 — 사용자가 직접 고르지 않고,
 * 입력한 제목/설명/장소 + 사진의 촬영 시간대를 분석해 어울리는 카테고리로 분류한다.
 *
 * 출력 id 는 홈 피드/필터가 쓰는 lj 카테고리와 동일:
 *   nature(개화·자연) / weather(날씨·체감) / event(이벤트·축제)
 *   crowd(혼잡도·대기) / sunset(노을·야경) / business(영업·운영)
 *
 * (동점 시 배열 앞쪽 = 더 구체적인 실시간 신호 우선)
 */

export const AUTO_CATEGORY_LABELS = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

// 우선순위 순서대로 (동점 시 앞쪽 채택)
const MATCHERS = [
  {
    id: 'event',
    kws: ['축제', '페스티벌', '불꽃', '행사', '공연', '콘서트', '전시', '마켓', '플리마켓', '팝업', '이벤트', '퍼레이드', '버스킹', '대회', '박람회', '개막', 'festival', 'event', 'popup'],
  },
  {
    id: 'crowd',
    kws: ['인파', '혼잡', '대기', '웨이팅', '줄', '번호표', '만석', '만차', '붐비', '북적', '한산', '여유', '대기줄', '매진', '품절', '대기시간', 'queue', 'wait', 'crowd'],
  },
  {
    id: 'sunset',
    kws: ['노을', '일몰', '석양', '해질', '해넘이', '골든아워', '매직아워', '야경', '밤하늘', '일출', '새벽', '블루아워', '윤슬', 'sunset', 'nightview', 'dusk'],
  },
  {
    id: 'nature',
    kws: ['꽃', '벚꽃', '개화', '만개', '매화', '진달래', '철쭉', '튤립', '유채', '수국', '코스모스', '해바라기', '단풍', '낙엽', '억새', '신록', '숲', '공원', '산', '바다', '해변', '계곡', '호수', '폭포', '설경', '은행', '꽃밭', '정원', '자연', '풍경', 'bloom', 'flower', 'nature'],
  },
  {
    id: 'business',
    kws: ['영업', '운영', '오픈', '마감', '폐점', '휴무', '브레이크타임', '재고', '메뉴', '신메뉴', '가격', '주문', '예약', '맛집', '카페', '커피', '식당', '음식', '디저트', '베이커리', '술집', '포차', '매장', '상점', 'cafe', 'restaurant', 'open', 'store'],
  },
  {
    id: 'weather',
    kws: ['날씨', '체감', '기온', '장마', '소나기', '폭설', '맑음', '흐림', '구름', '바람', '강풍', '미세먼지', '황사', '안개', '무더위', '폭염', '한파', '쌀쌀', '포근', '습도', '우산', 'weather', 'rain', 'snow'],
  },
];

function hourOf(capturedAt) {
  const t = capturedAt ? new Date(capturedAt).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  return new Date(t).getHours();
}
const isEveningOrNight = (hour) => hour != null && (hour >= 18 || hour < 6);

/**
 * @param {object} args
 * @param {string} [args.title]
 * @param {string} [args.body]
 * @param {string} [args.placeName]
 * @param {string} [args.region]
 * @param {string|number|Date} [args.capturedAt] 사진 촬영 시각(EXIF) — 시간대 분석
 * @returns {string} 카테고리 id
 */
export function autoCategorize({ title, body, placeName, region, capturedAt } = {}) {
  const text = [title, body, placeName, region].filter(Boolean).join(' ').toLowerCase();

  const scores = {};
  for (const m of MATCHERS) {
    let c = 0;
    for (const kw of m.kws) {
      if (text.includes(kw.toLowerCase())) c += 1;
    }
    scores[m.id] = c;
  }

  // 사진 촬영 시간대 — 저녁/밤이면 노을·야경 신호 가산 (사진 분석 요소)
  const hour = hourOf(capturedAt);
  if (isEveningOrNight(hour)) scores.sunset = (scores.sunset || 0) + 1;

  let best = null;
  let bestScore = 0;
  for (const m of MATCHERS) {
    if (scores[m.id] > bestScore) {
      best = m.id;
      bestScore = scores[m.id];
    }
  }
  if (best && bestScore > 0) return best;

  // 아무 키워드도 없으면 촬영 시간대로 폴백
  if (isEveningOrNight(hour)) return 'sunset';
  return 'nature';
}

export function autoCategoryLabel(id) {
  return AUTO_CATEGORY_LABELS[id] || '';
}

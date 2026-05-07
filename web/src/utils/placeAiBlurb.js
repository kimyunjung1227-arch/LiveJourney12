export function generatePlaceAiBlurb(placeKey, { tags = [], cityDong = '', tier = '' } = {}) {
  const key = String(placeKey || '').trim();
  const region = String(cityDong || '').trim();
  const cleanTags = (Array.isArray(tags) ? tags : [])
    .map((t) => String(t || '').replace(/[#_]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2);

  const kind = (() => {
    if (/해변|바다|해수욕|비치/i.test(key)) return '바다 풍경';
    if (/공원|호수|산책|숲|수목원/i.test(key)) return '산책 스팟';
    if (/(저수지|호|연못|습지)/i.test(key) || /지$/i.test(key)) return '수변 스팟';
    if (/카페|커피|베이커|디저트/i.test(key)) return '카페';
    if (/시장|먹거리|맛집|식당|포차|골목/i.test(key)) return '먹거리';
    if (/전시|박물관|미술관|공연|축제/i.test(key)) return '문화 스팟';
    if (/야경|전망|뷰|전망대/i.test(key)) return '뷰 포인트';
    return '핫플';
  })();

  const tagHint = cleanTags.length ? cleanTags.join(' · ') : '';
  // 요청: "제보/사용자 의견 기반" 문구 제거 — 장소 자체 설명만 생성
  // (tier는 향후 확장용으로만 유지)
  const _tierHint = String(tier || '').trim(); // eslint-disable-line no-unused-vars

  if (!key) return '';
  const tailTags = tagHint
    ? tagHint
        .split('·')
        .map((s) => String(s || '').trim().replace(/\s+/g, ''))
        .filter(Boolean)
        .slice(0, 2)
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .join(' ')
    : '';
  const regionHint = region ? `${region}` : '';
  const keyHint = key.replace(/\s+/g, ' ').trim();

  const famousFor = (() => {
    if (/해변|바다|해수욕|비치/i.test(keyHint)) return '해변 풍경과 노을 포인트로 유명해요';
    if (/공원|호수|산책|숲|수목원/i.test(keyHint)) return '산책·피크닉 동선과 포토 스팟이 강점이에요';
    if (/(저수지|호|연못|습지)/i.test(keyHint) || /지$/i.test(keyHint)) return '잔잔한 물가 뷰와 수변 산책로가 포인트예요';
    if (/카페|커피|베이커|디저트/i.test(keyHint)) return '디저트/카페 라인업과 분위기 좋은 좌석이 포인트예요';
    if (/시장|먹거리|맛집|식당|포차|골목/i.test(keyHint)) return '먹거리 라인업과 골목 탐방으로 유명해요';
    if (/전시|박물관|미술관|공연|축제/i.test(keyHint)) return '전시/공연 콘텐츠가 많아 일정에 넣기 좋아요';
    if (/야경|전망|뷰|전망대/i.test(keyHint)) return '야경·전망 구도가 좋아 사진이 잘 나와요';
    if (/성수|홍대|연남|한남|강남|해운대|전주|제주/i.test(keyHint)) return '주변에 볼거리/카페/맛집이 몰려 ‘한 번에 묶어서’ 즐기기 좋아요';
    return `${kind}로 가볍게 들르기 좋은 곳이에요`;
  })();

  const bestTime = (() => {
    if (/야경|전망|뷰|전망대/i.test(keyHint)) return '일몰 전후~야간(매직아워)';
    if (/시장|먹거리|맛집|식당|포차|골목/i.test(keyHint)) return '늦은 오후/이른 저녁(피크 회피)';
    if (/공원|호수|산책|숲|수목원/i.test(keyHint)) return '오전/해질녘';
    if (/해변|바다|해수욕|비치/i.test(keyHint)) return '맑은 날 일몰 시간대';
    if (/전시|박물관|미술관|공연|축제/i.test(keyHint)) return '평일/오픈 직후';
    if (/(저수지|호|연못|습지)/i.test(keyHint) || /지$/i.test(keyHint)) return '바람이 적은 오전/해질녘';
    return '여유 있게 둘러보기 좋은 평일 낮';
  })();

  // 핫플 카드용: 장소마다 템플릿을 바꿔 문장 구조가 반복되지 않도록 한다.
  const hash = Array.from(keyHint).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const t = hash % 8;
  const tagBit = tailTags ? ` ${tailTags}` : '';
  const regionBit = regionHint ? `${regionHint} ` : '';

  const templates = [
    () => `${regionBit}${keyHint}는 ${famousFor}. ${bestTime}에 가면 만족도가 높아요.${tagBit}`,
    () => `${regionBit}${keyHint} 한 줄 정리: ${kind}. 포인트는 ${famousFor}. 추천 시간대는 ${bestTime}.${tagBit}`,
    () => `${regionBit}${keyHint} 포인트부터 보면, ${famousFor}. 방문은 ${bestTime} 쪽이 좋아요.${tagBit}`,
    () => `${regionBit}사진/산책 코스 찾는다면 ${keyHint}. ${bestTime}가 특히 잘 맞아요. (${famousFor})${tagBit}`,
    () => `${regionBit}${keyHint}: ${famousFor}. ${bestTime}에 가면 동선이 더 편해요.${tagBit}`,
    () => `${regionBit}${kind} 느낌으로 가볍게 들르기 좋아요. ${keyHint}는 ${famousFor}. 베스트 타이밍은 ${bestTime}.${tagBit}`,
    () => `${regionBit}${keyHint}는 ${kind} 쪽으로 분류돼요. ${famousFor}. 방문 추천은 ${bestTime}.${tagBit}`,
    () => `${regionBit}${keyHint} 핵심만: ${famousFor}. ${bestTime} 추천.${tagBit}`,
  ];

  return templates[t]();
}


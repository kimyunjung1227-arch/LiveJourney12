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
    if (/카페|커피|베이커|디저트/i.test(key)) return '카페';
    if (/시장|먹거리|맛집|식당|포차|골목/i.test(key)) return '먹거리';
    if (/전시|박물관|미술관|공연|축제/i.test(key)) return '문화 스팟';
    if (/야경|전망|뷰|전망대/i.test(key)) return '뷰 포인트';
    return '핫플';
  })();

  const tagHint = cleanTags.length ? cleanTags.join(' · ') : '';
  const tierHint = String(tier || '').trim();
  const whyHot =
    tierHint.includes('급상승') ? '급상승 중' :
    tierHint.includes('인파') || tierHint.includes('사람') ? '인파 집중' :
    tierHint.includes('인기') ? '인기 지속' :
    '최근 반응';
  const whyLine =
    tierHint.includes('급상승') ? '지금 제보·반응이 빠르게 늘고 있는 곳이에요.' :
    tierHint.includes('인파') || tierHint.includes('사람') ? '지금 사람 흐름이 몰리면서 현장 분위기가 뜨거워요.' :
    tierHint.includes('인기') ? '최근에도 꾸준히 찾는 사람이 많아 안정적으로 인기예요.' :
    '최근 제보가 이어지며 주목도가 올라간 곳이에요.';

  if (!key) return '';
  const tailTags = tagHint ? `#${tagHint.replace(/\s+/g, '')}` : '';
  const regionHint = region ? `${region}` : '';
  const keyHint = key.replace(/\s+/g, ' ').trim();

  const famousFor = (() => {
    if (/해변|바다|해수욕|비치/i.test(keyHint)) return '해변 풍경과 노을 포인트로 유명해요';
    if (/공원|호수|산책|숲|수목원/i.test(keyHint)) return '산책·피크닉 동선과 포토 스팟이 강점이에요';
    if (/카페|커피|베이커|디저트/i.test(keyHint)) return '디저트/카페 라인업과 분위기 좋은 좌석이 포인트예요';
    if (/시장|먹거리|맛집|식당|포차|골목/i.test(keyHint)) return '먹거리 라인업과 골목 탐방으로 유명해요';
    if (/전시|박물관|미술관|공연|축제/i.test(keyHint)) return '전시/공연 콘텐츠가 많아 일정에 넣기 좋아요';
    if (/야경|전망|뷰|전망대/i.test(keyHint)) return '야경·전망 구도가 좋아 사진이 잘 나와요';
    if (/성수|홍대|연남|한남|강남|해운대|전주|제주/i.test(keyHint)) return '주변에 볼거리/카페/맛집이 몰려 ‘한 번에 묶어서’ 즐기기 좋아요';
    return `${kind} 성격의 대표 포인트가 있는 곳이에요`;
  })();

  const bestTime = (() => {
    if (/야경|전망|뷰|전망대/i.test(keyHint)) return '일몰 전후~야간(매직아워)에 특히 좋아요';
    if (/시장|먹거리|맛집|식당|포차|골목/i.test(keyHint)) return '점심·저녁 피크를 피해 늦은 오후/이른 저녁이 비교적 쾌적해요';
    if (/공원|호수|산책|숲|수목원/i.test(keyHint)) return '햇빛이 강한 한낮보다 오전/해질녘이 걷기 좋아요';
    if (/해변|바다|해수욕|비치/i.test(keyHint)) return '날씨가 맑은 날, 일몰 시간대가 만족도가 높아요';
    if (/전시|박물관|미술관|공연|축제/i.test(keyHint)) return '주말은 붐빌 수 있어 평일/오픈 직후가 좋아요';
    return '주말·저녁은 혼잡할 수 있어 여유 시간을 두고 가는 걸 추천해요';
  })();

  // 핫플답게: 장소마다 템플릿을 바꿔 문장 구조가 반복되지 않도록 한다.
  const hash = Array.from(keyHint).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const t = hash % 5;
  const tagBit = tailTags ? ` · ${tailTags}` : '';
  const regionBit = regionHint ? `${regionHint} ` : '';

  const templates = [
    () => `${regionBit}${whyLine}${tagBit} ${keyHint} 포인트는 ${famousFor}. 방문 타이밍은 ${bestTime}.`,
    () => `${regionBit}${keyHint} · ${famousFor}. 지금은 ${whyHot} 흐름이라 체감이 더 강하게 올라와요${tailTags ? `(${tailTags})` : ''}. ${bestTime} 추천.`,
    () => `${regionBit}왜 핫플이냐면: ${whyHot}${tailTags ? `(${tailTags})` : ''}. ${keyHint} 포인트는 ${famousFor}. ${bestTime}.`,
    () => `${regionBit}${keyHint} 핵심은 ${famousFor}. 지금은 ${whyHot}로 묶이면서 반응이 올라왔고, ${bestTime}가 만족도 높아요${tailTags ? ` · ${tailTags}` : ''}.`,
    () => `${regionBit}${whyLine}${tailTags ? ` (${tailTags})` : ''} ${keyHint} 포인트는 ${famousFor}. 방문은 ${bestTime} 쪽이 좋아요.`,
  ];

  return templates[t]();
}


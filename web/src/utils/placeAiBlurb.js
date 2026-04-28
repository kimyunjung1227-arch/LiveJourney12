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
    tierHint.includes('급상승') ? '지금 반응이 빠르게 늘고 있어요.' :
    tierHint.includes('인파') || tierHint.includes('사람') ? '지금 현장 반응이 몰리는 분위기예요.' :
    tierHint.includes('인기') ? '꾸준히 찾는 사람이 많은 곳이에요.' :
    '최근 공유가 이어지는 곳이에요.';

  if (!key) return '';
  const tailTags = tagHint ? ` · ${tagHint}` : '';
  // 카드에서 장소명을 이미 노출하므로, 여기서는 "설명"만 반환합니다.
  // 요청: "진짜 해당 장소에 대한 설명"처럼 보이게 — 지역/장소 성격/체감 포인트를 더 구체화
  const regionHint = region ? `${region} · ` : '';
  const keyHint = key.replace(/\s+/g, ' ').trim();
  const vibe = (() => {
    if (/역|역앞|역세권|출구/i.test(keyHint)) return '동선이 쉬워서 잠깐 들르기 좋아요';
    if (/공원|호수|산책|숲|수목원/i.test(keyHint)) return '걷기 좋은 구간이 많아서 사진 찍기 좋아요';
    if (/카페|베이커|디저트/i.test(keyHint)) return '좌석/대기 흐름이 자주 바뀌니 피크 타임은 참고하세요';
    if (/시장|먹거리|골목/i.test(keyHint)) return '줄/품절 이슈가 자주 올라오니 최신 제보를 먼저 확인해요';
    if (/전망|뷰|전망대|야경/i.test(keyHint)) return '빛/시간대에 따라 분위기가 크게 달라요';
    return '현장 정보가 빠르게 갱신되는 곳이에요';
  })();
  // “장소명 + 카테고리 + 지금 포인트” 형태로 자연스럽게
  return `${regionHint}${whyHot}${tailTags}. ${keyHint}는 ${kind} 성격이라 ${vibe}.`;
}


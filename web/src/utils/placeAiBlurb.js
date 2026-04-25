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
  // "왜 핫플인지"를 먼저, 지역/태그/장소 성격은 뒤에 짧게.
  const regionHint = region ? `${region} · ` : '';
  return `${regionHint}${whyHot}${tailTags}. ${whyLine} (${kind})`;
}


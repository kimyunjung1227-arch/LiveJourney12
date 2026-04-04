/**
 * 지역 표기 통일 (예: 구미시 → 구미, 동일 지역 화면·필터에서 중복 노출 방지)
 */
const TO_CANONICAL = {
  구미시: '구미',
};

export function normalizeRegionName(name) {
  if (!name) return '';
  const t = String(name).trim();
  if (TO_CANONICAL[t]) return TO_CANONICAL[t];
  return t;
}

/** 게시물이 해당 지역(정규화 이름)에 속하는지 — 위치·region·상세명에 구미/구미시 모두 허용 */
export function postMatchesCanonicalRegion(post, canonicalName) {
  const c = normalizeRegionName(canonicalName);
  if (!c) return false;
  const blob = [post?.location, post?.region, post?.detailedLocation, post?.placeName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const needle = c.toLowerCase();
  if (blob.includes(needle)) return true;
  if (needle.length >= 2 && blob.includes(`${needle}시`)) return true;
  return false;
}

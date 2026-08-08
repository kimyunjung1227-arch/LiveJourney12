/**
 * 주소/지역 문자열 → 게시물에 노출할 지역 라벨. 항상 "시·도 + 시/군/구" 형태로 맞춘다.
 *   "서울 성동구 성수동1가"        → "서울 성동구"
 *   "경상북도 구미시 원평동"        → "경북 구미시"
 *   "구미 봉곡동" (사용자 직접 입력) → "경북 구미시"
 *   "구미시"                        → "경북 구미시"
 *   "비아보스코"(가게 이름)         → ""  (지역이 아니면 노출하지 않음)
 *
 * 사용자가 사진을 보기 전에 "어디 소식인지" 바로 알 수 있게 하는 게 목적이라
 * 시·도는 짧은 표기(서울·경북)로, 그 뒤 시/군/구는 정식 표기로 붙인다.
 */

import {
  toProvinceShort,
  districtInProvince,
  resolveDistrict,
} from './koreanDistricts';

/**
 * "성동구" / "구미시" / "고성군" 처럼 시·군·구 토큰인지.
 * 표에 없는 신설·개편 지역도 놓치지 않으려는 폴백이라, 구는 두 글자도 허용하고
 * 시·군은 가게 이름 오인을 막기 위해 세 글자 이상만 인정한다.
 */
function looksLikeDistrictToken(token) {
  const s = String(token || '').trim();
  if (/구$/.test(s)) return s.length >= 2;
  return /[시군]$/.test(s) && s.length > 2;
}

/**
 * 주소/지역 문자열에서 "시·도 + 시/군/구" 라벨을 뽑는다. 지역으로 못 읽으면 ''.
 */
export function extractRegionLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const tokens = text.split(/\s+/);

  const head = toProvinceShort(tokens[0]);
  if (head) {
    // "서울 강남" 처럼 접미사를 뺀 표기도 정식 표기로 복원 (→ "서울 강남구")
    const district = districtInProvince(head, tokens[1]);
    if (district) return `${head} ${district}`;
    // 표에 없는 토큰이라도 시/군/구 꼴이면 그대로 (신설 지역 대비)
    if (looksLikeDistrictToken(tokens[1])) return `${head} ${tokens[1]}`;
    return head; // 세종처럼 하위 행정구역이 없거나 정보가 부족한 경우
  }

  // 시·도 없이 시작하는 경우 — 표에서 상위 시·도를 찾아 붙인다 ("구미 봉곡동" → "경북 구미시")
  const hit = resolveDistrict(tokens[0]);
  if (hit) return `${hit.province} ${hit.district}`;

  // 동명이지(중구·고성 등)이거나 표에 없는 지역. 가게 이름을 지역으로 오인하지 않게
  // 시/군/구로 끝나는 세 글자 이상만 인정한다.
  return /[시군구]$/.test(tokens[0]) && tokens[0].length > 2 ? tokens[0] : '';
}

/**
 * 게시물 → 지역 라벨. region → location → 상세위치 → 장소명 순으로 시도.
 * (장소명은 가게 이름일 수 있어 파싱에 실패하면 자연히 ''로 떨어진다)
 */
export function postRegionLabel(post) {
  if (!post) return '';
  return (
    extractRegionLabel(post.region) ||
    extractRegionLabel(post.location) ||
    extractRegionLabel(post.detailed_location) ||
    extractRegionLabel(post.place_name) ||
    ''
  );
}

export default postRegionLabel;

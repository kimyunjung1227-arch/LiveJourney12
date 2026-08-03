/**
 * 주소/지역 문자열 → 게시물에 노출할 지역 라벨 ("시·도 + 시/군/구").
 *   "서울 성동구 성수동1가"        → "서울 성동구"
 *   "경상북도 구미시 원평동"        → "경북 구미시"
 *   "서울특별시 영등포구 의사당대로 88" → "서울 영등포구"
 *   "비아보스코"(가게 이름)         → ""  (지역이 아니면 노출하지 않음)
 *
 * 사용자가 사진을 보기 전에 "어디 소식인지" 바로 알 수 있게 하는 게 목적이라
 * 시·도는 짧은 표기(서울·경북)로, 그 뒤 시/군/구는 그대로 붙인다.
 */

// 시·도 전체 표기 → 짧은 표기
const LONG_TO_SHORT = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원도: '강원',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전라북도: '전북',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주도: '제주',
  제주특별자치도: '제주',
};

// 이미 짧은 표기로 들어오는 시·도 (카카오 주소 API는 "서울", "경북" 형태로 준다)
const SHORT_NAMES = new Set([
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]);

/** 시·도 토큰 → 짧은 표기. 시·도가 아니면 '' */
function toProvinceShort(token) {
  const s = String(token || '').trim();
  if (!s) return '';
  if (LONG_TO_SHORT[s]) return LONG_TO_SHORT[s];
  if (SHORT_NAMES.has(s)) return s;
  return '';
}

/**
 * "성동구" / "구미시" / "고성군" 처럼 시·군·구 토큰인지.
 * 구는 "중구"·"동구"처럼 두 글자도 실제 자치구라 허용하고, 시·군은 세 글자 이상만.
 */
function isDistrictToken(token) {
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
  if (!head) {
    // 시·도 없이 시/군/구로 시작하는 경우 (예: "구미시 원평동")
    // 앞에 시·도가 없으면 가게 이름을 지역으로 오인할 수 있어 세 글자 이상만 인정
    return /[시군구]$/.test(tokens[0]) && tokens[0].length > 2 ? tokens[0] : '';
  }

  // 광역시의 구, 도의 시/군 (예: "서울 성동구", "경북 구미시")
  if (isDistrictToken(tokens[1])) return `${head} ${tokens[1]}`;
  return head; // 세종처럼 하위 행정구역이 없거나 정보가 부족한 경우
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

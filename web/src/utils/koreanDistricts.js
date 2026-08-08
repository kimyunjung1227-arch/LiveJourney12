/**
 * 전국 시·군·구 → 상위 시·도 표.
 *
 * 사용자가 "구미 봉곡동"처럼 시·도를 빼고 적어도 "경북 구미시"로 복원하기 위한 표다.
 * 지역 라벨(postRegionLabel)과 업로드 시 region 컬럼 계산(extractRegionFromAddress)이
 * 같은 표를 쓰게 해서, 화면에 보이는 지역과 사진이 묶이는 지역이 어긋나지 않게 한다.
 */

// 시·도 전체 표기 → 짧은 표기
export const PROVINCE_LONG_TO_SHORT = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  세종시: '세종',
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
export const PROVINCE_SHORT = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const PROVINCE_SHORT_SET = new Set(PROVINCE_SHORT);

// 시·도별 기초자치단체(구/군/시). 일반구(분당구·수지구 등)는 상위 시로 묶어 보여주므로 제외.
export const PROVINCE_DISTRICTS = {
  서울: [
    '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구',
    '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구',
    '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구',
  ],
  부산: [
    '중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구',
    '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군',
  ],
  대구: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  인천: [
    '중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구',
    '강화군', '옹진군',
  ],
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
  세종: [],
  경기: [
    '수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시', '동두천시',
    '안산시', '고양시', '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시',
    '의왕시', '하남시', '용인시', '파주시', '이천시', '안성시', '김포시', '화성시',
    '광주시', '양주시', '포천시', '여주시', '연천군', '가평군', '양평군',
  ],
  강원: [
    '춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군',
    '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군',
    '고성군', '양양군',
  ],
  충북: [
    '청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군',
    '괴산군', '음성군', '단양군',
  ],
  충남: [
    '천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시',
    '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군',
  ],
  전북: [
    '전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군',
    '무주군', '장수군', '임실군', '순창군', '고창군', '부안군',
  ],
  전남: [
    '목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군',
    '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군',
    '함평군', '영광군', '장성군', '완도군', '진도군', '신안군',
  ],
  경북: [
    '포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시',
    '문경시', '경산시', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군',
    '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군',
  ],
  경남: [
    '창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시',
    '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군',
    '거창군', '합천군',
  ],
  제주: ['제주시', '서귀포시'],
};

/** "구미시" → "구미", "강남구" → "강남". 접미사가 없으면 그대로. */
export function bareDistrictName(token) {
  const s = String(token || '').trim();
  if (!s) return '';
  return s.replace(/[시군구]$/, '') || s;
}

// bare 이름 → { province, district }. 여러 시·도에 같은 이름이 있으면(중구·동구·고성 등) null.
const BARE_INDEX = (() => {
  const index = new Map();
  Object.entries(PROVINCE_DISTRICTS).forEach(([province, districts]) => {
    districts.forEach((district) => {
      const bare = bareDistrictName(district);
      if (!bare) return;
      if (index.has(bare)) index.set(bare, null); // 동명이지 — 시·도 없이는 특정 불가
      else index.set(bare, { province, district });
    });
  });
  return index;
})();

// 시·도별 bare 이름 → 정식 표기 (예: 서울 + "강남" → "강남구")
const BY_PROVINCE = (() => {
  const map = new Map();
  Object.entries(PROVINCE_DISTRICTS).forEach(([province, districts]) => {
    const inner = new Map();
    districts.forEach((d) => inner.set(bareDistrictName(d), d));
    map.set(province, inner);
  });
  return map;
})();

/** 토큰이 시·도면 짧은 표기를 돌려준다. 아니면 '' */
export function toProvinceShort(token) {
  const s = String(token || '').trim();
  if (!s) return '';
  if (PROVINCE_LONG_TO_SHORT[s]) return PROVINCE_LONG_TO_SHORT[s];
  if (PROVINCE_SHORT_SET.has(s)) return s;
  return '';
}

/** 시·도가 정해진 상태에서 토큰 → 정식 시·군·구 표기. 아니면 '' */
export function districtInProvince(province, token) {
  const inner = BY_PROVINCE.get(province);
  if (!inner) return '';
  return inner.get(bareDistrictName(token)) || '';
}

/**
 * 시·도 없이 들어온 토큰("구미", "구미시", "강남구") → { province, district }.
 * 동명이지(중구·고성 등)라 특정할 수 없으면 null.
 */
export function resolveDistrict(token) {
  const bare = bareDistrictName(token);
  if (!bare) return null;
  return BARE_INDEX.get(bare) || null;
}

export default PROVINCE_DISTRICTS;

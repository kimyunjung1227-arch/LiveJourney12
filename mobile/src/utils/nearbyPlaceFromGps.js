/**
 * GPS 좌표 기준 Kakao Local 카테고리 검색으로 가장 가까운 장소명(POI)을 찾는다.
 * (Expo reverseGeocode는 시·군·구·동 수준이라 "영천 완산동"만 나오는 경우가 많음)
 */

// 의미 있는 장소(명소·문화시설·교통·식음) 우선 — 주차장(PK6)은 제외해 '서울 남산타워'식 명확한 POI 노출
const NEARBY_CATEGORY_PRIORITY = [
  ['AT4'], // 관광명소 (남산타워·경복궁·해운대 등) — 최우선
  ['CT1'], // 문화시설 (박물관·미술관)
  ['SW8'], // 지하철역
  ['CE7', 'FD6'], // 카페·음식점은 마지막 폴백
];
const NEARBY_SEARCH_RADII_METERS = [200, 600, 1500, 4000];

function getKakaoRestKey() {
  try {
    const fromEnv =
      typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_KAKAO_REST_API_KEY
        ? String(process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY).trim()
        : '';
    if (fromEnv) return fromEnv;
  } catch {
    /* ignore */
  }
  // MapScreen.jsx Kakao Local 검색과 동일 출처 — 배포 시 extra/env 사용 권장
  return 'cc3234f026f2f64c40c0edcff5b96306';
}

/**
 * @param {number} lng
 * @param {number} lat
 * @returns {Promise<string>} 장소명 또는 빈 문자열
 */
async function searchCategoryAtRadius(key, categoryCodes, lng, lat, radius) {
  const batches = await Promise.all(
    categoryCodes.map(async (category_group_code) => {
      const url =
        `https://dapi.kakao.com/v2/local/search/category.json?` +
        new URLSearchParams({
          category_group_code,
          x: String(lng),
          y: String(lat),
          radius: String(radius),
          size: '15',
          sort: 'distance',
        }).toString();
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.documents) ? data.documents : [];
    })
  );
  return batches
    .flat()
    .map((doc) => ({
      name: String(doc?.place_name || '').trim(),
      dist: parseInt(String(doc?.distance ?? '999999'), 10) || 999999,
    }))
    .filter((x) => x.name)
    .sort((a, b) => a.dist - b.dist);
}

export async function fetchNearbyPlaceNameFromGps(lng, lat) {
  const key = getKakaoRestKey();
  if (!key || !Number.isFinite(lng) || !Number.isFinite(lat)) return '';

  try {
    // 우선순위 카테고리부터 반경을 키워가며 검색 — 명소가 잡히면 즉시 반환
    for (const categoryCodes of NEARBY_CATEGORY_PRIORITY) {
      for (const radius of NEARBY_SEARCH_RADII_METERS) {
        const scored = await searchCategoryAtRadius(key, categoryCodes, lng, lat, radius);
        if (scored.length > 0) return scored[0].name;
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

/** 행정구역 이름에서 '특별시·광역시·특별자치시·특별자치도' 접미사 제거 → '서울', '제주' 형태 */
export function shortCityFromReverseGeocode(address) {
  if (!address) return '';
  const raw = String(address.city || address.region || '').trim();
  if (!raw) return '';
  return raw
    .replace('특별시', '')
    .replace('광역시', '')
    .replace('특별자치시', '')
    .replace('특별자치도', '')
    .replace(/도$/, '')
    .trim();
}

/** POI + 도시명을 합쳐 '서울 남산타워' 형태로 만든다 (도시명 중복 시 POI만 반환) */
export function formatCityPoiLabel(shortCity, poiName) {
  const city = String(shortCity || '').trim();
  const poi = String(poiName || '').trim();
  if (!poi) return city;
  if (!city) return poi;
  if (poi.includes(city)) return poi;
  return `${city} ${poi}`;
}

/** Expo 역지오코딩으로 행정구역 한 줄 (기존 동작, POI 실패 시 폴백) */
export function formatRegionLineFromReverseGeocode(address) {
  if (!address) return '';
  const parts = [];
  if (address.city) parts.push(address.city);
  if (address.district) parts.push(address.district);
  let line = parts
    .slice(0, 2)
    .join(' ')
    .replace('특별시', '')
    .replace('광역시', '')
    .replace('특별자치시', '')
    .replace('특별자치도', '')
    .trim();
  if (!line) {
    line = address.city || address.district || '';
  }
  return line;
}

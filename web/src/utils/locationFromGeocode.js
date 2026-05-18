/**
 * Kakao Maps coord2Address 첫 결과 + (선택) REST 카테고리 검색으로
 * 업로드 입력란에 넣을 짧은 위치 문자열을 만든다.
 * - GPS 근처 장소명(공원·관광지 등)을 도로명/행정동(○○시 ○○동)보다 우선한다.
 * - 행정구역의 "경북/경상북도" 등 광역 단위는 제거하고 시·군·구 이하를 우선한다.
 * - REST 키(VITE_KAKAO_REST_API_KEY)가 없으면 POI 단계는 건너뛴다.
 */

const PROVINCE_TOKEN = new Set([
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '제주',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남',
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '제주특별자치도',
  '경기도', '강원특별자치도', '강원도', '충청북도', '충청남도', '전북특별자치도', '전라북도',
  '전라남도', '경상북도', '경상남도',
]);

function isProvinceToken(tok) {
  if (!tok) return false;
  const t = String(tok).trim();
  if (PROVINCE_TOKEN.has(t)) return true;
  return /(특별시|광역시|특별자치도|특별자치시|도)$/.test(t);
}

function stripAdministrativeSuffix(s) {
  return String(s || '')
    .replace(/특별시|광역시|특별자치시|특별자치도/g, '')
    .trim();
}

/** 공원·관광 등 사용자에게 의미 있는 장소명을 먼저 (카페·음식점은 보조) */
const NEARBY_CATEGORY_CODES = ['PK6', 'AT4', 'CT1', 'CE7', 'FD6', 'SW8'];

/** 좁은 공원·넓은 생태공원 모두 커버하도록 단계 확대 */
const NEARBY_SEARCH_RADII_METERS = [350, 900, 2000, 4500];

export async function fetchNearbyPlaceName(lng, lat) {
  const key =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_KAKAO_REST_API_KEY
      ? String(import.meta.env.VITE_KAKAO_REST_API_KEY).trim()
      : '';
  if (!key || !Number.isFinite(lng) || !Number.isFinite(lat)) return '';

  try {
    for (const radius of NEARBY_SEARCH_RADII_METERS) {
      const batches = await Promise.all(
        NEARBY_CATEGORY_CODES.map(async (category_group_code) => {
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

      const scored = batches
        .flat()
        .map((doc) => ({
          name: String(doc?.place_name || '').trim(),
          dist: parseInt(String(doc?.distance ?? '999999'), 10) || 999999,
        }))
        .filter((x) => x.name);

      if (scored.length === 0) continue;

      scored.sort((a, b) => a.dist - b.dist);
      return scored[0].name;
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * @param {object} firstResult coord2Address 콜백의 result[0]
 * @param {number} lng
 * @param {number} lat
 */
export async function resolveDisplayLocationFromKakaoCoordResult(firstResult, lng, lat) {
  if (!firstResult || typeof firstResult !== 'object') return '';

  const road = firstResult.road_address;
  const addr = firstResult.address;

  const poi = await fetchNearbyPlaceName(lng, lat);
  if (poi) return poi;

  if (road?.building_name && String(road.building_name).trim()) {
    return String(road.building_name).trim();
  }

  const r2 = addr?.region_2depth_name ? String(addr.region_2depth_name).trim() : '';
  const r3 = addr?.region_3depth_name ? String(addr.region_3depth_name).trim() : '';
  const adminLine = stripAdministrativeSuffix([r2, r3].filter(Boolean).join(' '));
  if (adminLine) return adminLine;

  const full = String(road?.address_name || addr?.address_name || '').trim();
  if (!full) return '';

  const parts = full.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < parts.length && isProvinceToken(parts[i])) {
    i += 1;
  }
  const joined = parts.slice(i).join(' ');
  return stripAdministrativeSuffix(joined) || adminLine || full;
}

/**
 * 좌표 → 사람이 읽는 장소명을 한 번에 만든다.
 * 1) 카카오 REST category.json으로 근처 POI(공원·관광지 등) 우선
 * 2) 없으면 coord2address.json으로 행정구역 (시·군·구 + 동) 폴백
 * 3) 둘 다 실패하면 빈 문자열 반환 (호출자가 좌표 표시로 폴백)
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>}
 */
export async function reverseGeocodeToPlace(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  // 1) POI 우선 — fetchNearbyPlaceName(lng, lat) 시그니처에 주의
  try {
    const poi = await fetchNearbyPlaceName(lng, lat);
    if (poi) return poi;
  } catch (_) {
    /* ignore */
  }

  // 2) 행정주소 폴백
  const key =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_KAKAO_REST_API_KEY
      ? String(import.meta.env.VITE_KAKAO_REST_API_KEY).trim()
      : '';
  if (!key) return '';
  try {
    const url =
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?` +
      new URLSearchParams({ x: String(lng), y: String(lat) }).toString();
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return '';
    const data = await res.json();
    const first = Array.isArray(data?.documents) ? data.documents[0] : null;
    if (!first) return '';
    return resolveDisplayLocationFromKakaoCoordResult(first, lng, lat);
  } catch (_) {
    return '';
  }
}

/**
 * Kakao Maps coord2Address 첫 결과 + (선택) REST 카테고리 검색으로
 * 업로드 입력란에 넣을 짧은 위치 문자열을 만든다.
 * - 행정구역의 "경북/경상북도" 등 광역 단위는 제거하고 시·군·구 이하를 우선한다.
 * - REST 키가 있으면 근처 관광·상권 POI 이름(예: 영일대)을 우선한다.
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

async function fetchNearbyPlaceName(lng, lat) {
  const key =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_KAKAO_REST_API_KEY
      ? String(import.meta.env.VITE_KAKAO_REST_API_KEY).trim()
      : '';
  if (!key || !Number.isFinite(lng) || !Number.isFinite(lat)) return '';

  const codes = ['AT4', 'CE7', 'FD6', 'PK6', 'SW8', 'CT1'];
  try {
    for (const category_group_code of codes) {
      const url =
        `https://dapi.kakao.com/v2/local/search/category.json?` +
        new URLSearchParams({
          category_group_code,
          x: String(lng),
          y: String(lat),
          radius: '220',
          size: '3',
          sort: 'distance',
        }).toString();
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!res.ok) continue;
      const data = await res.json();
      const docs = Array.isArray(data?.documents) ? data.documents : [];
      for (const doc of docs) {
        const name = String(doc?.place_name || '').trim();
        if (name) return name;
      }
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

  if (road?.building_name && String(road.building_name).trim()) {
    return String(road.building_name).trim();
  }

  const poi = await fetchNearbyPlaceName(lng, lat);
  if (poi) return poi;

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

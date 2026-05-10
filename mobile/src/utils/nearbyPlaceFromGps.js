/**
 * GPS 좌표 기준 Kakao Local 카테고리 검색으로 가장 가까운 장소명(POI)을 찾는다.
 * (Expo reverseGeocode는 시·군·구·동 수준이라 "영천 완산동"만 나오는 경우가 많음)
 */

const NEARBY_CATEGORY_CODES = ['PK6', 'AT4', 'CT1', 'CE7', 'FD6', 'SW8'];
const NEARBY_SEARCH_RADII_METERS = [350, 900, 2000, 4500];

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
export async function fetchNearbyPlaceNameFromGps(lng, lat) {
  const key = getKakaoRestKey();
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

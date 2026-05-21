/**
 * GPS 좌표 → 사람이 읽는 장소명.
 *
 * 정책(2026-05 두 번째 개정):
 * - 건물명 또는 POI(가장 가까운 장소) 만 사용한다.
 * - 행정주소(시·군·구·동) 폴백은 사용하지 않는다.
 * - 결과를 못 찾으면 빈 문자열을 반환 (호출자가 "위치 정보 없음" UI 처리).
 *
 * 우선순위:
 *   1) coord2Address → road.building_name (좌표가 명확히 건물 안을 가리킬 때)
 *   2) Places.categorySearch — 좌표 반경 50m 내 POI 중 가장 가까운 것
 *      (관광명소·문화시설·카페·음식점·숙박·지하철역·대형마트 등 주요 카테고리 병렬 호출)
 *   3) 반경 100m로 확장하여 한 번 더 시도
 *   4) 그래도 없으면 ''
 */

const PLACE_CATEGORY_CODES = [
  'AT4', // 관광명소
  'CT1', // 문화시설
  'CE7', // 카페
  'FD6', // 음식점
  'AD5', // 숙박
  'SW8', // 지하철역
  'MT1', // 대형마트
  'BK9', // 은행
  'HP8', // 병원
  'PO3', // 공공기관
];

const NEAR_RADIUS_M = 50;
const WIDER_RADIUS_M = 120;

/**
 * 카카오 JS SDK가 services 라이브러리와 함께 준비될 때까지 대기.
 * index.html / main.jsx에 sdk.js?...&libraries=services 가 이미 주입돼 있어 보통은 즉시 resolve.
 */
function waitForKakaoServices(timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no-window'));
    const isReady = () =>
      !!(window.kakao && window.kakao.maps && window.kakao.maps.services);

    const tryLoad = () => {
      if (isReady()) return resolve(window.kakao);
      if (window.kakao?.maps?.load) {
        try {
          window.kakao.maps.load(() => {
            isReady() ? resolve(window.kakao) : reject(new Error('services-missing'));
          });
          return true;
        } catch (_) {
          /* fall through */
        }
      }
      return false;
    };

    if (tryLoad()) return;

    const start = Date.now();
    const id = setInterval(() => {
      if (isReady()) {
        clearInterval(id);
        return resolve(window.kakao);
      }
      if (tryLoad()) {
        clearInterval(id);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(id);
        reject(new Error('sdk-timeout'));
      }
    }, 200);
  });
}

/** 좌표 → coord2Address 첫 결과 (raw). 건물명 추출용. */
function fetchCoord2Address(lat, lng) {
  return new Promise((resolve) => {
    waitForKakaoServices()
      .then((kakao) => {
        const Status = kakao.maps.services.Status;
        const geocoder = new kakao.maps.services.Geocoder();
        try {
          geocoder.coord2Address(lng, lat, (data, status) => {
            if (status !== Status.OK || !Array.isArray(data) || data.length === 0) {
              return resolve(null);
            }
            resolve(data[0]);
          });
        } catch (_) {
          resolve(null);
        }
      })
      .catch(() => resolve(null));
  });
}

/** 단일 카테고리에 대해 좌표 반경 내 가장 가까운 장소 1건 반환. */
function searchNearestInCategory(lat, lng, categoryCode, radius) {
  return new Promise((resolve) => {
    waitForKakaoServices()
      .then((kakao) => {
        const Status = kakao.maps.services.Status;
        const places = new kakao.maps.services.Places();
        try {
          places.categorySearch(
            categoryCode,
            (data, status) => {
              if (status !== Status.OK || !Array.isArray(data) || data.length === 0) {
                return resolve(null);
              }
              // data는 distance asc 정렬됨 (sort: DISTANCE)
              const nearest = data[0];
              const dist = parseFloat(nearest.distance);
              if (!Number.isFinite(dist) || dist > radius) return resolve(null);
              resolve({
                name: String(nearest.place_name || '').trim(),
                distance: dist,
                category: categoryCode,
                roadAddress: nearest.road_address_name || nearest.address_name || '',
              });
            },
            {
              location: new kakao.maps.LatLng(lat, lng),
              radius,
              sort: kakao.maps.services.SortBy.DISTANCE,
              size: 5,
            },
          );
        } catch (_) {
          resolve(null);
        }
      })
      .catch(() => resolve(null));
  });
}

/** 여러 카테고리 병렬 검색 후 가장 가까운 장소 1건. */
async function findNearestPoi(lat, lng, radius) {
  const calls = PLACE_CATEGORY_CODES.map((code) => searchNearestInCategory(lat, lng, code, radius));
  const results = await Promise.all(calls);
  const valid = results.filter((r) => r && r.name);
  if (valid.length === 0) return null;
  valid.sort((a, b) => a.distance - b.distance);
  return valid[0];
}

/**
 * 좌표 → 사람이 읽는 장소명(건물명 또는 가장 가까운 POI).
 * 행정주소는 반환하지 않는다.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>}
 */
export async function reverseGeocodeToPlace(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  // 1) coord2Address의 건물명
  try {
    const raw = await fetchCoord2Address(lat, lng);
    const building = raw?.road_address?.building_name;
    if (building && String(building).trim()) {
      return String(building).trim();
    }
  } catch (_) {
    /* ignore */
  }

  // 2) 50m 내 가장 가까운 POI
  try {
    const near = await findNearestPoi(lat, lng, NEAR_RADIUS_M);
    if (near?.name) return near.name;
  } catch (_) {
    /* ignore */
  }

  // 3) 120m로 한 번 더 확장
  try {
    const wider = await findNearestPoi(lat, lng, WIDER_RADIUS_M);
    if (wider?.name) return wider.name;
  } catch (_) {
    /* ignore */
  }

  return '';
}

/**
 * 호환성 유지용 export — 다른 곳에서 import 하던 함수.
 * 더 이상 행정주소를 반환하지 않으므로, 호출자가 사용하는 firstResult가 있다면
 * 거기서 building_name만 뽑아 반환.
 */
// eslint-disable-next-line no-unused-vars
export async function resolveDisplayLocationFromKakaoCoordResult(firstResult, _lng, _lat) {
  if (!firstResult || typeof firstResult !== 'object') return '';
  const building = firstResult.road_address?.building_name;
  if (building && String(building).trim()) return String(building).trim();
  return '';
}

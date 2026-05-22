/**
 * GPS 좌표 → 사람이 읽는 장소명.
 *
 * 정책(2026-05 세 번째 개정):
 * - "근처 POI"는 가져오지 않는다 — 좌표가 가리키는 *현재 위치 자체*만 사용한다.
 * - 도로명 주소를 1순위, 지번 주소를 2순위로 사용한다.
 * - 호환을 위해 건물명이 명확하면 그 안에 함께 노출 가능하지만, POI(카테고리 검색)는 더 이상 호출하지 않는다.
 * - 결과를 못 찾으면 빈 문자열을 반환 (호출자가 좌표 라벨로 폴백).
 */

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

/**
 * coord2Address 한 줄 결과(row) → 사람이 읽는 정확한 현재 위치 라벨.
 * 우선순위:
 *  1) 좌표가 가리키는 건물명 (예: "여의도 IFC몰")
 *  2) 지번 주소 (예: "여의도동 23")
 *  3) ''
 *
 * 도로명 주소는 사용하지 않는다.
 * 근처 POI도 호출하지 않는다 — 좌표 자체의 정보만 사용.
 */
function pickPreciseAddressFromCoordRow(row) {
  if (!row || typeof row !== 'object') return '';
  const road = row.road_address;
  const lot = row.address;

  const building = road?.building_name ? String(road.building_name).trim() : '';
  if (building) return building;

  const lotAddr = lot?.address_name ? String(lot.address_name).trim() : '';
  if (lotAddr) return lotAddr;
  return '';
}

/**
 * 좌표 → "현재 위치 그대로"의 주소 라벨.
 * - 도로명 주소를 1순위, 지번 주소를 2순위로 반환.
 * - 근처 POI/카테고리 검색은 하지 않는다 (사용자가 실제로 있지 않은 곳을 가져오지 않기 위해).
 */
export async function reverseGeocodeToPlace(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  try {
    const row = await fetchCoord2Address(lat, lng);
    const label = pickPreciseAddressFromCoordRow(row);
    if (label) return label;
  } catch (_) {
    /* ignore */
  }
  return '';
}

/**
 * 호출자가 이미 coord2Address row를 들고 있을 때 라벨만 뽑는 호환 API.
 */
// eslint-disable-next-line no-unused-vars
export async function resolveDisplayLocationFromKakaoCoordResult(firstResult, _lng, _lat) {
  return pickPreciseAddressFromCoordRow(firstResult);
}

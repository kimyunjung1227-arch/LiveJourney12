/**
 * Kakao Maps coord2Address 결과로 업로드 입력란에 넣을 위치 문자열을 만든다.
 *
 * 정책(2026-05 변경):
 * - GPS 좌표가 가리키는 "실제 주소"만 사용한다. 근처 POI(공원·관광지 등)는 GPS 오차
 *   (수 m~수십 m)가 있을 때 잘못된 장소로 자동 매칭되어 정보 오류를 만들 수 있으므로
 *   사용하지 않는다.
 * - 우선순위: 도로명 건물명 → 시·군·구 + 읍·면·동 → 전체 주소(광역 단위 제거).
 * - 행정구역의 "경북/경상북도" 등 광역 단위는 제거하고 시·군·구 이하를 우선한다.
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

/**
 * @param {object} firstResult coord2Address 콜백의 result[0]
 * @param {number} _lng (시그니처 호환용; 더 이상 사용하지 않음)
 * @param {number} _lat
 *
 * POI(공원·관광지 등) 근처 검색은 GPS 오차로 잘못된 장소를 매칭할 수 있어 제거됨.
 * 실제 GPS 좌표가 가리키는 주소만 사용한다.
 */
// eslint-disable-next-line no-unused-vars
export async function resolveDisplayLocationFromKakaoCoordResult(firstResult, _lng, _lat) {
  if (!firstResult || typeof firstResult !== 'object') return '';

  const road = firstResult.road_address;
  const addr = firstResult.address;

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
 * 카카오 JS SDK가 services 라이브러리와 함께 준비될 때까지 대기.
 * index.html에 sdk.js?...&libraries=services 가 이미 주입돼 있어 보통은 즉시 resolve.
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

/** JS SDK Geocoder로 행정주소 (시/군/구 + 동 또는 건물명). */
async function findAddressViaSdk(lat, lng) {
  let kakao;
  try {
    kakao = await waitForKakaoServices();
  } catch (_) {
    return '';
  }
  const Status = kakao.maps.services.Status;
  const geocoder = new kakao.maps.services.Geocoder();
  return await new Promise((resolve) => {
    try {
      geocoder.coord2Address(lng, lat, (data, status) => {
        if (status !== Status.OK || !Array.isArray(data) || data.length === 0) {
          return resolve('');
        }
        try {
          resolve(resolveDisplayLocationFromKakaoCoordResult(data[0], lng, lat) || '');
        } catch (_) {
          resolve('');
        }
      });
    } catch (_) {
      resolve('');
    }
  });
}

/**
 * 좌표 → 사람이 읽는 장소명. GPS가 가리키는 실제 주소만 사용한다.
 * 1) JS SDK Geocoder.coord2Address (건물명 또는 시·군·구 + 동)
 * 2) (백업) REST API — 키 있으면.
 *
 * POI(근처 공원·관광지) 매칭은 GPS 오차로 다른 장소가 표시되는 문제 때문에 사용하지 않는다.
 *
 * @returns {Promise<string>}
 */
export async function reverseGeocodeToPlace(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  // 1) JS SDK 행정주소
  try {
    const addr = await findAddressViaSdk(lat, lng);
    if (addr) return addr;
  } catch (_) {
    /* ignore */
  }

  // 2) (백업) REST API — 키 있을 때만
  const restKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_KAKAO_REST_API_KEY
      ? String(import.meta.env.VITE_KAKAO_REST_API_KEY).trim()
      : '';
  if (!restKey) return '';
  try {
    const url =
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?` +
      new URLSearchParams({ x: String(lng), y: String(lat) }).toString();
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` } });
    if (!res.ok) return '';
    const data = await res.json();
    const first = Array.isArray(data?.documents) ? data.documents[0] : null;
    if (!first) return '';
    return resolveDisplayLocationFromKakaoCoordResult(first, lng, lat);
  } catch (_) {
    return '';
  }
}

/**
 * GPS 좌표 → 사람이 읽는 장소명.
 *
 * 정책(2026-06 개정):
 * - 좌표 바로 위의 "지점명(가게/시설명)"을 1순위로 사용한다.
 *   (예: 구미 '비아보스코' 카페에서 찍으면 도로명 주소가 아니라 "비아보스코"로 표시)
 *   → findNearestPoiName 으로 가까운 POI를 찾고, 일정 반경(기본 40m) 이내일 때만 채택.
 * - POI를 못 찾으면 건물명 → 도로명 주소 → 지번 주소 순으로 폴백한다.
 * - 모두 없으면 빈 문자열을 반환 (호출자가 좌표 라벨로 폴백).
 */
import { findNearestPoiName } from './kakaoPlacesGeocode';
import { extractRegionLabel } from './postRegionLabel';
import { toProvinceShort } from './koreanDistricts';

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
 *  2) 도로명 주소 (예: "서울 영등포구 의사당대로 88")
 *  3) 지번 주소 (예: "여의도동 23")
 *  4) ''
 *
 * 근처 POI는 호출하지 않는다 — 좌표 자체의 정보만 사용.
 */
function pickPreciseAddressFromCoordRow(row) {
  if (!row || typeof row !== 'object') return '';
  const road = row.road_address;
  const lot = row.address;

  const building = road?.building_name ? String(road.building_name).trim() : '';
  if (building) return building;

  const roadAddr = road?.address_name ? String(road.address_name).trim() : '';
  if (roadAddr) return roadAddr;

  const lotAddr = lot?.address_name ? String(lot.address_name).trim() : '';
  if (lotAddr) return lotAddr;
  return '';
}

/**
 * coord2Address row → 지역 라벨 (예: "서울 강남구", "경북 구미시").
 * road_address 가 있으면 road 의 region, 아니면 address(지번) 의 region 사용.
 * 동/읍/면(3depth)은 붙이지 않는다 — 같은 시·군·구 사진이 동 단위로 쪼개져 묶이면 안 되므로.
 */
function pickRegionFromCoordRow(row) {
  if (!row || typeof row !== 'object') return '';
  const src = row.road_address || row.address || null;
  if (!src) return '';
  const r1 = String(src.region_1depth_name || '').trim(); // 시/도
  const r2 = String(src.region_2depth_name || '').trim(); // 시/군/구
  const head = toProvinceShort(r1) || r1;
  if (!head) return '';
  // 카카오는 일반구를 "성남시 분당구"처럼 한 필드에 담아준다 — 상위 시 기준으로 묶는다.
  const district = r2.split(/\s+/)[0] || '';
  if (!district) return head;
  return `${head} ${district}`;
}

/**
 * 좌표 → "현재 위치 그대로"의 주소 라벨.
 * - 도로명 주소를 1순위, 지번 주소를 2순위로 반환.
 * - 근처 POI/카테고리 검색은 하지 않는다 (사용자가 실제로 있지 않은 곳을 가져오지 않기 위해).
 */
export async function reverseGeocodeToPlace(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  try {
    // 1) 좌표 위의 지점명(가게/시설) 우선
    const poi = await findNearestPoiName(lat, lng);
    if (poi) return poi;
    // 2) 건물명 → 도로명 → 지번
    const row = await fetchCoord2Address(lat, lng);
    const label = pickPreciseAddressFromCoordRow(row);
    if (label) return label;
  } catch (_) {
    /* ignore */
  }
  return '';
}

/**
 * 좌표 → 상세 정보 ({name, region}).
 *  - name: 건물명 / 도로명 / 지번 중 우선순위 1개 (없으면 '')
 *  - region: "시 구 동" 형태의 도시 라벨 (예: "서울 강남구 역삼동")
 */
export async function reverseGeocodeToPlaceDetail(lat, lng) {
  const empty = { name: '', region: '' };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return empty;
  try {
    // 지점명 조회와 주소 조회를 동시에 — 지역 라벨은 주소(coord2Address)에서만 얻을 수 있다.
    const [poi, row] = await Promise.all([
      findNearestPoiName(lat, lng),
      fetchCoord2Address(lat, lng),
    ]);
    const region = pickRegionFromCoordRow(row) || '';
    // 1) 지점명(가게/시설) 우선 → 2) 건물명/도로명/지번 폴백
    const name = poi || pickPreciseAddressFromCoordRow(row) || '';
    return { name, region };
  } catch (_) {
    return empty;
  }
}

/**
 * 호출자가 이미 coord2Address row를 들고 있을 때 라벨만 뽑는 호환 API.
 */
// eslint-disable-next-line no-unused-vars
export async function resolveDisplayLocationFromKakaoCoordResult(firstResult, _lng, _lat) {
  return pickPreciseAddressFromCoordRow(firstResult);
}

/**
 * 카카오 Places 검색 결과(r) 또는 임의 주소 문자열에서 지역 라벨을 뽑는다.
 * 언제나 "시·도 + 시/군/구" 한 형태로만 나온다.
 *  - "서울 강남구 테헤란로 123"  → "서울 강남구"
 *  - "경기도 성남시 분당구 …"    → "경기 성남시"
 *  - "구미 봉곡동" (직접 입력)   → "경북 구미시"   ← 시·도를 빼고 적어도 표준형으로 복원
 *
 * 이 값이 posts.region 에 그대로 들어가고 지역별 사진 묶음의 기준이 되므로,
 * 동/읍/면까지 내려가지 않고 시·군·구 단위에서 멈춘다.
 */
export function extractRegionFromAddress(addr) {
  return extractRegionLabel(addr);
}

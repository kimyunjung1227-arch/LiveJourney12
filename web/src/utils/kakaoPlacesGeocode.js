/**
 * 카카오 키워드 검색으로 장소 좌표 1건 조회 (업로드·지도 보조용)
 * @returns {Promise<{ lat: number, lng: number, placeName?: string } | null>}
 */
function getKakaoAppKey() {
  try {
    return String(import.meta?.env?.VITE_KAKAO_MAP_API_KEY || '').trim();
  } catch {
    return '';
  }
}

function loadKakaoSdkOnce(appKey) {
  return new Promise((resolve, reject) => {
    const key = String(appKey || '').trim();
    if (!key) {
      reject(new Error('VITE_KAKAO_MAP_API_KEY가 비어있습니다. web/.env에 설정해 주세요.'));
      return;
    }

    if (window.kakao?.maps) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-kakao-maps-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Kakao Maps SDK 스크립트 로드에 실패했습니다.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.kakaoMapsSdk = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kakao Maps SDK 스크립트 로드에 실패했습니다.'));
    document.head.appendChild(script);
  });
}

export async function ensureKakaoMapsServicesReady() {
  if (window.kakao?.maps?.services) return;
  const key = getKakaoAppKey();
  await loadKakaoSdkOnce(key);
  await new Promise((resolve, reject) => {
    try {
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao Maps SDK가 초기화되지 않았습니다.'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    } catch (e) {
      reject(e);
    }
  });
}

// 좌표 바로 위에 있는 "지점(가게/시설)"을 찾기 위한 카테고리 그룹 코드.
// 사진을 찍을 만한 장소 위주: 음식점·카페·관광명소·문화시설·숙박·대형마트·편의점·병원
// + 공공기관(PO3). 도서관·주민센터·우체국 같은 곳은 카카오에서 PO3 로 분류돼 있어
//   이게 없으면 "OO도서관" 대신 도로명 주소가 나온다.
const NEAR_POI_CATEGORY_CODES = ['FD6', 'CE7', 'AT4', 'CT1', 'AD5', 'MT1', 'CS2', 'HP8', 'PO3'];

function categoryNearest(places, code, latlng, radius) {
  return new Promise((resolve) => {
    try {
      places.categorySearch(
        code,
        (data, status) => {
          if (
            status === window.kakao.maps.services.Status.OK &&
            Array.isArray(data) &&
            data.length > 0
          ) {
            const r = data[0]; // sort:'distance' → 0번이 가장 가까움
            const dist = Number(r.distance);
            resolve({
              name: String(r.place_name || '').trim(),
              dist: Number.isFinite(dist) ? dist : Infinity,
            });
          } else {
            resolve(null);
          }
        },
        { location: latlng, radius, sort: 'distance', size: 5 },
      );
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * 좌표가 가리키는 "현재 지점"의 장소명(가게/시설 이름)을 찾는다.
 * - 촬영 장소가 될 만한 카테고리들을 거리순으로 동시 조회해 가장 가까운 1건을 고른다.
 * - acceptWithin(m) 이내에 후보가 없으면 '' (호출자가 도로명 주소로 폴백).
 *   예: 구미 '비아보스코' 카페 위에서 찍으면 도로명 주소 대신 "비아보스코"를 반환.
 * - 반경 기본값: 사용자가 "지금 서 있는 장소명"을 더 잘 받도록 다소 넉넉하게 잡는다
 *   (도시 GPS 오차 ~10~30m 감안). 너무 넓히면 옆 가게를 잡으므로 65m 선에서 절충.
 */
export async function findNearestPoiName(lat, lng, opts = {}) {
  const poi = await findNearestPoi(lat, lng, opts);
  return poi?.name || '';
}

/**
 * findNearestPoiName 과 같은 조회를 하되 거리까지 함께 돌려준다.
 * "핀이 가리키는 바로 그 지점인지"를 호출자가 거리로 판단할 수 있게 하기 위함.
 * @returns {Promise<{ name: string, dist: number } | null>}
 */
export async function findNearestPoi(lat, lng, { radius = 150, acceptWithin = 65 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    await ensureKakaoMapsServicesReady();
    if (!window.kakao?.maps?.services) return null;
    const latlng = new window.kakao.maps.LatLng(lat, lng);
    const places = new window.kakao.maps.services.Places();
    const results = await Promise.all(
      NEAR_POI_CATEGORY_CODES.map((code) => categoryNearest(places, code, latlng, radius)),
    );
    const valid = results
      .filter(Boolean)
      .filter((r) => r.name && r.dist <= acceptWithin)
      .sort((a, b) => a.dist - b.dist);
    return valid.length ? valid[0] : null;
  } catch (_) {
    return null;
  }
}

// 지도에서 위치를 고를 때 보여줄 "이 근처 장소" 후보 카테고리.
// 사진을 찍을 만한 곳 + 길찾기 기준이 되는 역/문화시설까지 조금 넓게 잡는다.
const NEARBY_PICK_CATEGORY_CODES = [
  'FD6', // 음식점
  'CE7', // 카페
  'AT4', // 관광명소
  'CT1', // 문화시설
  'AD5', // 숙박
  'MT1', // 대형마트
  'CS2', // 편의점
  'SW8', // 지하철역
  'PO3', // 공공기관 — 도서관·주민센터·우체국 등
  'SC4', // 학교 — 캠퍼스·운동장에서 찍는 경우가 많다
  'HP8', // 병원
  'PK6', // 주차장 — 넓은 부지(공원·전망대) 근처에서 유일한 기준점인 경우가 있다
];

function categoryNearbyList(places, code, latlng, radius, size) {
  return new Promise((resolve) => {
    try {
      places.categorySearch(
        code,
        (data, status) => {
          if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data)) {
            resolve([]);
            return;
          }
          resolve(data);
        },
        { location: latlng, radius, sort: 'distance', size },
      );
    } catch (_) {
      resolve([]);
    }
  });
}

/**
 * 좌표 주변의 장소 후보를 거리순으로 반환. (지도에서 위치 고를 때 "이 근처 장소" 목록용)
 * @param {number} lat
 * @param {number} lng
 * @param {{ radius?: number, limit?: number }} [opts]
 * @returns {Promise<Array<object>>} 카카오 Places 결과 + distance(m) 오름차순
 */
export async function searchNearbyPlacesKakao(lat, lng, { radius = 250, limit = 10 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  try {
    await ensureKakaoMapsServicesReady();
    if (!window.kakao?.maps?.services) return [];
    const latlng = new window.kakao.maps.LatLng(lat, lng);
    const places = new window.kakao.maps.services.Places();
    const lists = await Promise.all(
      NEARBY_PICK_CATEGORY_CODES.map((code) =>
        categoryNearbyList(places, code, latlng, radius, 5),
      ),
    );
    const seen = new Set();
    return lists
      .flat()
      .filter((r) => {
        const key = r?.id || `${r?.x}|${r?.y}|${r?.place_name}`;
        if (!r?.place_name || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({ ...r, distance: Number(r.distance) }))
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity))
      .slice(0, limit);
  } catch (_) {
    return [];
  }
}

/**
 * 키워드로 카카오 장소 목록 검색 (Promise 버전).
 * SDK 미로드/실패 시 빈 배열을 돌려주므로 호출부에서 별도 방어가 필요 없다.
 *
 * lat/lng 를 주면 그 지점 반경 안에서 가까운 순으로 찾는다.
 * ("도서관" 처럼 전국에 흔한 이름을 쳤을 때 엉뚱한 도시 결과가 먼저 나오지 않게)
 * 반경 안에 결과가 없으면 전국 검색으로 자동 폴백한다.
 *
 * @param {string} query
 * @param {number} size 최대 결과 수
 * @param {{ lat?: number, lng?: number, radius?: number }} [opts]
 * @returns {Promise<Array<object>>} 카카오 Places 결과 원본 (place_name, x, y, address_name, distance …)
 */
export async function searchPlacesKakao(query, size = 8, opts = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    await ensureKakaoMapsServicesReady();
    if (!window.kakao?.maps?.services) return [];
    const places = new window.kakao.maps.services.Places();
    const run = (options) =>
      new Promise((resolve) => {
        try {
          places.keywordSearch(
            q,
            (data, status) => {
              if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data)) {
                resolve([]);
                return;
              }
              resolve(data.slice(0, size));
            },
            options,
          );
        } catch (_) {
          resolve([]);
        }
      });

    const baseOptions = { size: Math.min(15, Math.max(size, 5)) };
    const lat = Number(opts?.lat);
    const lng = Number(opts?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const near = await run({
        ...baseOptions,
        location: new window.kakao.maps.LatLng(lat, lng),
        radius: Math.min(20000, Math.max(500, Number(opts?.radius) || 20000)),
        sort: 'distance',
      });
      if (near.length > 0) return near;
    }
    return await run(baseOptions);
  } catch (_) {
    return [];
  }
}

export function searchPlaceWithKakaoFirst(query) {
  return new Promise((resolve) => {
    const q = String(query || '').trim();
    if (!q) {
      resolve(null);
      return;
    }
    (async () => {
      try {
        await ensureKakaoMapsServicesReady();
        if (!window.kakao?.maps?.services) {
          resolve(null);
          return;
        }
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(q, (data, status) => {
          if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
            const first = data[0];
            resolve({
              lat: parseFloat(first.y),
              lng: parseFloat(first.x),
              placeName: first.place_name,
              address: first.address_name,
            });
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    })();
  });
}

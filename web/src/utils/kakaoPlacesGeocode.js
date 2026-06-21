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
// 사진을 찍을 만한 장소 위주: 음식점·카페·관광명소·문화시설·숙박·대형마트·편의점·병원.
const NEAR_POI_CATEGORY_CODES = ['FD6', 'CE7', 'AT4', 'CT1', 'AD5', 'MT1', 'CS2', 'HP8'];

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
 */
export async function findNearestPoiName(lat, lng, { radius = 80, acceptWithin = 40 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  try {
    await ensureKakaoMapsServicesReady();
    if (!window.kakao?.maps?.services) return '';
    const latlng = new window.kakao.maps.LatLng(lat, lng);
    const places = new window.kakao.maps.services.Places();
    const results = await Promise.all(
      NEAR_POI_CATEGORY_CODES.map((code) => categoryNearest(places, code, latlng, radius)),
    );
    const valid = results
      .filter(Boolean)
      .filter((r) => r.name && r.dist <= acceptWithin)
      .sort((a, b) => a.dist - b.dist);
    return valid.length ? valid[0].name : '';
  } catch (_) {
    return '';
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

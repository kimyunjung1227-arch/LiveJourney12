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

async function ensureKakaoMapsServicesReady() {
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

/**
 * 카카오 키워드 검색으로 장소 좌표 1건 조회 (업로드·지도 보조용)
 * @returns {Promise<{ lat: number, lng: number, placeName?: string } | null>}
 */
export function searchPlaceWithKakaoFirst(query) {
  return new Promise((resolve) => {
    const q = String(query || '').trim();
    if (!q) {
      resolve(null);
      return;
    }
    if (!window.kakao?.maps?.services) {
      resolve(null);
      return;
    }
    try {
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
  });
}

// 주요 지역의 중심 좌표
export const locationCoordinates = {
  '서울': { lat: 37.5665, lng: 126.9780 },
  '서울특별시': { lat: 37.5665, lng: 126.9780 },
  '부산': { lat: 35.1796, lng: 129.0756 },
  '부산광역시': { lat: 35.1796, lng: 129.0756 },
  '대구': { lat: 35.8714, lng: 128.6014 },
  '대구광역시': { lat: 35.8714, lng: 128.6014 },
  '인천': { lat: 37.4563, lng: 126.7052 },
  '인천광역시': { lat: 37.4563, lng: 126.7052 },
  '광주': { lat: 35.1595, lng: 126.8526 },
  '광주광역시': { lat: 35.1595, lng: 126.8526 },
  '대전': { lat: 36.3504, lng: 127.3845 },
  '대전광역시': { lat: 36.3504, lng: 127.3845 },
  '울산': { lat: 35.5384, lng: 129.3114 },
  '울산광역시': { lat: 35.5384, lng: 129.3114 },
  '세종': { lat: 36.4800, lng: 127.2890 },
  '세종특별자치시': { lat: 36.4800, lng: 127.2890 },
  '경기': { lat: 37.4138, lng: 127.5183 },
  '강원': { lat: 37.8228, lng: 128.1555 },
  '충북': { lat: 36.8000, lng: 127.7000 },
  '충남': { lat: 36.5000, lng: 126.8000 },
  '전북': { lat: 35.7175, lng: 127.1530 },
  '전남': { lat: 34.8679, lng: 126.9910 },
  '경북': { lat: 36.4919, lng: 128.8889 },
  '경남': { lat: 35.4606, lng: 128.2132 },
  '제주': { lat: 33.4996, lng: 126.5312 },
  '제주도': { lat: 33.4996, lng: 126.5312 },
  '제주특별자치도': { lat: 33.4996, lng: 126.5312 },
  // 주요 도시
  '강릉': { lat: 37.7519, lng: 128.8761 },
  '속초': { lat: 38.2070, lng: 128.5918 },
  '춘천': { lat: 37.8813, lng: 127.7300 },
  '원주': { lat: 37.3422, lng: 127.9202 },
  '청주': { lat: 36.6424, lng: 127.4890 },
  '충주': { lat: 36.9910, lng: 127.9260 },
  '천안': { lat: 36.8151, lng: 127.1139 },
  '아산': { lat: 36.7898, lng: 127.0016 },
  '전주': { lat: 35.8242, lng: 127.1480 },
  '군산': { lat: 35.9676, lng: 126.7369 },
  '익산': { lat: 35.9483, lng: 126.9577 },
  '목포': { lat: 34.8118, lng: 126.3922 },
  '여수': { lat: 34.7604, lng: 127.6622 },
  '순천': { lat: 34.9506, lng: 127.4872 },
  '포항': { lat: 36.0190, lng: 129.3435 },
  '경주': { lat: 35.8562, lng: 129.2247 },
  '안동': { lat: 36.5684, lng: 128.7294 },
  '구미': { lat: 36.1136, lng: 128.3445 },
  '창원': { lat: 35.2280, lng: 128.6811 },
  '진주': { lat: 35.1800, lng: 128.1076 },
  '통영': { lat: 34.8544, lng: 128.4331 },
  '거제': { lat: 34.8808, lng: 128.6214 },
  '김해': { lat: 35.2286, lng: 128.8894 },
  '양산': { lat: 35.3350, lng: 129.0372 },
  '서귀포': { lat: 33.2541, lng: 126.5601 },
  // 일본 주요 도시
  '도쿄': { lat: 35.6895, lng: 139.6917 },
  '오사카': { lat: 34.6937, lng: 135.5023 },
  '교토': { lat: 35.0116, lng: 135.7681 },
  '삿포로': { lat: 43.0618, lng: 141.3545 },
  '후쿠오카': { lat: 33.5902, lng: 130.4017 },
  '나고야': { lat: 35.1815, lng: 136.9066 },
  '요코하마': { lat: 35.4437, lng: 139.6380 },
  '오키나와': { lat: 26.2124, lng: 127.6809 },
  '나하': { lat: 26.2124, lng: 127.6809 }
};

/**
 * 지역명으로 좌표 가져오기 (사전 매칭만). 매칭 실패 시 null — 잘못된 기본 좌표(서울)로 핀을 찍지 않음.
 * @param {string} locationName - 지역명 (예: '서울', '부산 해운대')
 * @returns {{ lat: number, lng: number } | null}
 */
export const getCoordinatesByLocation = (locationName) => {
  if (!locationName || !String(locationName).trim()) {
    return null;
  }

  const trimmed = String(locationName).trim();

  // 정확한 매치
  if (locationCoordinates[trimmed]) {
    return locationCoordinates[trimmed];
  }

  // 부분 매치: 긴 키(구체적 지명) 우선
  const entries = Object.entries(locationCoordinates).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of entries) {
    if (trimmed.includes(key)) return value;
  }

  return null;
};

/**
 * 좌표로 지역명 검색 (역변환)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {string} 가장 가까운 지역명
 */
export const getLocationByCoordinates = (lat, lng) => {
  let closestLocation = '서울';
  let minDistance = Infinity;

  for (const [location, coords] of Object.entries(locationCoordinates)) {
    const distance = Math.sqrt(
      Math.pow(coords.lat - lat, 2) + Math.pow(coords.lng - lng, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
    }
  }

  return closestLocation;
};


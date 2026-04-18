// 지역별 좌표 정보
// Kakao Map API와 연동하여 사용

export const regionCoordinates = {
  '서울': { lat: 37.5665, lng: 126.9780, nx: 60, ny: 127 },
  '부산': { lat: 35.1796, lng: 129.0756, nx: 98, ny: 76 },
  '대구': { lat: 35.8714, lng: 128.6014, nx: 89, ny: 90 },
  '인천': { lat: 37.4563, lng: 126.7052, nx: 55, ny: 124 },
  '광주': { lat: 35.1595, lng: 126.8526, nx: 58, ny: 74 },
  '대전': { lat: 36.3504, lng: 127.3845, nx: 67, ny: 100 },
  '울산': { lat: 35.5384, lng: 129.3114, nx: 102, ny: 84 },
  '세종': { lat: 36.4800, lng: 127.2890, nx: 66, ny: 103 },
  '경기': { lat: 37.4138, lng: 127.5183, nx: 60, ny: 120 },
  '강원': { lat: 37.8228, lng: 128.1555, nx: 73, ny: 134 },
  '충북': { lat: 36.8000, lng: 127.7000, nx: 69, ny: 107 },
  '충남': { lat: 36.5184, lng: 126.8000, nx: 68, ny: 100 },
  '전북': { lat: 35.7175, lng: 127.1530, nx: 63, ny: 89 },
  '전남': { lat: 34.8679, lng: 126.9910, nx: 51, ny: 67 },
  '경북': { lat: 36.4919, lng: 128.8889, nx: 89, ny: 91 },
  '경남': { lat: 35.4606, lng: 128.2132, nx: 91, ny: 77 },
  '제주': { lat: 33.4890, lng: 126.4983, nx: 52, ny: 38 },
  // 추가 주요 도시
  '춘천': { lat: 37.8813, lng: 127.7300, nx: 73, ny: 134 },
  '강릉': { lat: 37.7519, lng: 128.8761, nx: 92, ny: 131 },
  '속초': { lat: 38.2070, lng: 128.5919, nx: 87, ny: 141 },
  '원주': { lat: 37.3422, lng: 127.9202, nx: 76, ny: 122 },
  '수원': { lat: 37.2636, lng: 127.0286, nx: 60, ny: 121 },
  '성남': { lat: 37.4201, lng: 127.1262, nx: 63, ny: 124 },
  '용인': { lat: 37.2410, lng: 127.1776, nx: 64, ny: 119 },
  '안양': { lat: 37.3943, lng: 126.9568, nx: 58, ny: 123 },
  '고양': { lat: 37.6584, lng: 126.8320, nx: 57, ny: 128 },
  '청주': { lat: 36.6424, lng: 127.4890, nx: 69, ny: 106 },
  '천안': { lat: 36.8151, lng: 127.1139, nx: 63, ny: 110 },
  '전주': { lat: 35.8242, lng: 127.1480, nx: 63, ny: 89 },
  '포항': { lat: 36.0190, lng: 129.3435, nx: 102, ny: 94 },
  '경주': { lat: 35.8562, lng: 129.2247, nx: 100, ny: 91 },
  '창원': { lat: 35.2280, lng: 128.6811, nx: 90, ny: 77 },
  '진주': { lat: 35.1800, lng: 128.1076, nx: 90, ny: 75 },
  '여수': { lat: 34.7604, lng: 127.6622, nx: 73, ny: 66 },
  '순천': { lat: 34.9507, lng: 127.4872, nx: 70, ny: 70 },
  '목포': { lat: 34.8118, lng: 126.3922, nx: 50, ny: 67 },
  // 경북권 (기상청 격자)
  '구미': { lat: 36.1195, lng: 128.3446, nx: 81, ny: 96 },
  '칠곡': { lat: 35.992, lng: 128.401, nx: 86, ny: 99 },
};

/** 도 단위 이름 — 시·군과 겹칠 때는 시·군을 우선 */
const PROVINCE_KEYS = new Set(['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']);

// 지역명으로 좌표 가져오기
export const getCoordinates = (regionName) => {
  const fallback = { lat: 37.5665, lng: 126.9780, nx: 60, ny: 127 };
  if (!regionName || typeof regionName !== 'string') {
    return fallback;
  }
  const r = regionName.trim();
  if (regionCoordinates[r]) {
    return regionCoordinates[r];
  }

  const matches = Object.keys(regionCoordinates).filter((key) => r.includes(key) || key.includes(r));
  if (matches.length === 0) {
    return fallback;
  }

  matches.sort((a, b) => {
    const ap = PROVINCE_KEYS.has(a) ? 1 : 0;
    const bp = PROVINCE_KEYS.has(b) ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return b.length - a.length;
  });

  return regionCoordinates[matches[0]];
};

// 별칭 (weather.js에서 사용)
export const getCoordinatesByRegion = getCoordinates;

// 좌표로 가장 가까운 지역 찾기
export const getNearestRegion = (lat, lng) => {
  let nearest = '서울';
  let minDistance = Infinity;
  
  Object.entries(regionCoordinates).forEach(([name, coords]) => {
    const distance = Math.sqrt(
      Math.pow(coords.lat - lat, 2) + Math.pow(coords.lng - lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = name;
    }
  });
  
  return nearest;
};


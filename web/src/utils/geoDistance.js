/**
 * 위·경도 좌표 간 거리 계산(Haversine)
 * 6+ 곳에서 중복되던 동일 공식을 한 곳으로 통합한다.
 *
 * - `haversineKm(lat1, lon1, lat2, lon2)` : 4-인자 (km)
 * - `haversineM(lat1, lon1, lat2, lon2)`  : 4-인자 (m)
 * - `distanceKmBetween(a, b)`             : {lat,lng} 객체 2개 (km)
 * - 별칭: `getDistanceKm` = haversineKm
 */

const EARTH_RADIUS_KM = 6371;
const toRad = (v) => (v * Math.PI) / 180;

export const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (
    !Number.isFinite(lat1) || !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) || !Number.isFinite(lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

export const haversineM = (lat1, lon1, lat2, lon2) =>
  haversineKm(lat1, lon1, lat2, lon2) * 1000;

export const distanceKmBetween = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const lat1 = Number(a.lat ?? a.latitude);
  const lng1 = Number(a.lng ?? a.lon ?? a.longitude);
  const lat2 = Number(b.lat ?? b.latitude);
  const lng2 = Number(b.lng ?? b.lon ?? b.longitude);
  return haversineKm(lat1, lng1, lat2, lng2);
};

export const getDistanceKm = haversineKm;

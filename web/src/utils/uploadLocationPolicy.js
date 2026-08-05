/**
 * 업로드 위치 정책.
 *
 * 1) 갤러리에서 고른 사진은 "사진이 찍힌 위치(EXIF GPS)"를 먼저 쓴다.
 *    EXIF에 위치가 없으면 현재 기기 위치로 몰래 채우지 않고(= 엉뚱한 장소로 박히는 것 방지),
 *    사용자가 직접 위치를 입력하도록 요구한다.
 *
 * 2) 촬영 위치와 현재 위치가 멀어도 업로드를 막지 않는다.
 *    "여행 다녀와서 집에서 오늘 분위기 공유하기"는 정상적인 사용이다.
 *    대신 멀리 떨어져 있을 때는 "위치는 사진이 찍힌 곳으로 올라간다"는 사실만 알려준다.
 */

import { haversineKm } from './geoDistance';

/** 이 거리를 넘으면 촬영지 기준으로 올라간다는 안내만 노출 (업로드 제한 없음) */
export const GPS_FAR_KM = 2;

/**
 * 미디어에 기록된 "촬영 좌표"(EXIF GPS)를 읽는다.
 * media.lat/lng 는 기기 GPS로 채워졌을 수 있으므로 절대 쓰지 않는다.
 * @returns {{lat:number, lng:number}|null}
 */
export function readExifCoords(media) {
  const exif = media?.exif;
  if (!exif) return null;
  const lat = Number(exif.GPSLatitude);
  const lng = Number(exif.GPSLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null; // 일부 기기가 넣는 무의미한 0,0
  return { lat, lng };
}

/** 거리 표기 (1km 미만은 m 단위) */
export function formatGapDistance(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/**
 * 업로드 가능 여부 판정.
 *
 * @param {{
 *   medias?: Array<object>,
 *   source?: 'camera'|'gallery'|string,
 *   deviceCoords?: {lat:number, lng:number}|null,
 *   hasResolvedLocation?: boolean,   // 좌표가 이미 잡혀 있거나 사용자가 직접 입력했는지
 * }} params
 * @returns {{
 *   gapKm: number|null,
 *   farFromShot: boolean,            // 촬영지에서 멀리 떨어짐 (안내용, 제한 아님)
 *   needsManualLocation: boolean,    // 위치를 직접 입력해야 업로드 가능
 * }}
 */
export function evaluateUploadLocation({
  medias = [],
  source,
  deviceCoords = null,
  hasResolvedLocation = false,
} = {}) {
  const list = Array.isArray(medias) ? medias : [];
  const shots = list.map(readExifCoords).filter(Boolean);

  const device =
    deviceCoords &&
    Number.isFinite(Number(deviceCoords.lat)) &&
    Number.isFinite(Number(deviceCoords.lng))
      ? { lat: Number(deviceCoords.lat), lng: Number(deviceCoords.lng) }
      : null;

  // 묶음 업로드는 가장 멀리 떨어진 한 장을 기준으로 안내한다.
  let gapKm = null;
  if (device && shots.length > 0) {
    gapKm = Math.max(
      ...shots.map((s) => haversineKm(s.lat, s.lng, device.lat, device.lng)),
    );
    if (!Number.isFinite(gapKm)) gapKm = null;
  }

  const farFromShot = Number.isFinite(gapKm) && gapKm > GPS_FAR_KM;

  // 갤러리 사진인데 EXIF에 위치가 하나도 없고, 아직 위치가 정해지지 않은 상태
  const needsManualLocation =
    source === 'gallery' && shots.length === 0 && !hasResolvedLocation;

  return { gapKm, farFromShot, needsManualLocation };
}

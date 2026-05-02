/**
 * expo-image-picker Asset 의 exif 객체에서 촬영 시각·GPS 추출 (사진·동영상 공통)
 */

function toFinite(n) {
  const x = typeof n === 'number' ? n : parseFloat(String(n));
  return Number.isFinite(x) ? x : null;
}

function parseExifDate(ex) {
  if (!ex || typeof ex !== 'object') return null;
  const raw =
    ex.DateTimeOriginal ||
    ex.DateTimeDigitized ||
    ex.DateTime ||
    ex.CreateDate ||
    ex.datetime ||
    null;
  if (raw == null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const d2 = new Date(s);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

function gpsFromExif(ex) {
  if (!ex || typeof ex !== 'object') return null;
  let lat = toFinite(ex.GPSLatitude ?? ex.latitude);
  let lng = toFinite(ex.GPSLongitude ?? ex.longitude);
  const latRef = String(ex.GPSLatitudeRef || '').toUpperCase();
  const lngRef = String(ex.GPSLongitudeRef || '').toUpperCase();
  if (lat != null && latRef === 'S') lat = -Math.abs(lat);
  if (lng != null && lngRef === 'W') lng = -Math.abs(lng);
  if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng };
  }
  return null;
}

/**
 * @param {import('expo-image-picker').ImagePickerAsset | null | undefined} asset
 * @returns {{ photoDate: string | null, gpsCoordinates: { lat: number, lng: number } | null } | null}
 */
export function metadataFromPickerAsset(asset) {
  if (!asset?.exif || typeof asset.exif !== 'object') return null;
  const ex = asset.exif;
  const photo = parseExifDate(ex);
  const gps = gpsFromExif(ex);
  if (!photo && !gps) return null;
  return {
    photoDate: photo ? photo.toISOString() : null,
    gpsCoordinates: gps,
  };
}

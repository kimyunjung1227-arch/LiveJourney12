import { parse } from 'exifr';
import { extractExifData } from '../../utils/exifExtractor';

/**
 * 갤러리에서 선택한 파일의 EXIF 검증 + 추출.
 * - 라이브저니는 24시간 이내 사진만 허용
 * - EXIF DateTimeOriginal 없으면 거부
 * - 영상 파일은 EXIF 보장이 어려워 일단 EXIF 없음으로 처리
 *
 * @param {File} file
 * @returns {Promise<{
 *   valid: boolean,
 *   reason?: 'no_exif' | 'too_old',
 *   takenAt?: Date,
 *   location?: { lat: number, lng: number },
 *   minutesAgo?: number,
 *   exif?: object  // 추출한 EXIF 전체 (정규화된 키)
 * }>}
 */
export async function validateGalleryFile(file) {
  if (!file) return { valid: false, reason: 'no_exif' };

  // 영상: 사진과 동일하게 "24시간 이내"만 허용한다.
  // 촬영 시각은 ① 컨테이너 메타(MP4/MOV mvhd creation_time, exifr) ② 파일 수정시각 순으로 추정.
  // 메타가 전혀 없으면(추정 불가) 갤러리 선택 자체는 막지 않되 촬영시각=지금으로 통과시킨다.
  if (file.type && file.type.startsWith('video/')) {
    let meta = null;
    try {
      meta = await extractExifData(file, { allowed: true });
    } catch (_) {
      meta = null;
    }

    // 추정 촬영시각: 메타 우선, 없으면 파일 수정시각(카메라롤 저장 시각 근사)
    const metaMs = meta?.photoTimestamp || (meta?.photoDate ? Date.parse(meta.photoDate) : NaN);
    const lastModMs = Number.isFinite(file.lastModified) ? file.lastModified : NaN;
    const bestMs = Number.isFinite(metaMs) ? metaMs : (Number.isFinite(lastModMs) ? lastModMs : NaN);

    // 메타 GPS가 있으면 위치로 사용
    const gLat = meta?.gpsCoordinates?.lat ?? meta?.gpsLatitude;
    const gLng = meta?.gpsCoordinates?.lng ?? meta?.gpsLongitude;
    const location =
      Number.isFinite(Number(gLat)) && Number.isFinite(Number(gLng))
        ? { lat: Number(gLat), lng: Number(gLng) }
        : undefined;

    if (Number.isFinite(bestMs)) {
      const takenAt = new Date(bestMs);
      const diffMs = Date.now() - takenAt.getTime();
      const minutesAgo = Math.max(0, Math.floor(diffMs / 60000));
      // 미래 시각(시계 오차)은 통과, 과거 24시간 초과만 차단
      if (diffMs > 24 * 60 * 60 * 1000) {
        return { valid: false, reason: 'too_old', takenAt, minutesAgo };
      }
      return {
        valid: true,
        isVideo: true,
        takenAt,
        minutesAgo,
        location,
        exif: {
          source: meta?.photoDate ? 'video_container_meta' : 'video_file_mtime',
          DateTimeOriginal: takenAt.toISOString(),
          GPSLatitude: location?.lat ?? null,
          GPSLongitude: location?.lng ?? null,
        },
      };
    }

    // 촬영시각을 전혀 추정할 수 없는 경우 — 선택은 허용, 시각=지금
    const takenAt = new Date();
    return {
      valid: true,
      isVideo: true,
      takenAt,
      minutesAgo: 0,
      location,
      exif: { source: 'video_no_meta', DateTimeOriginal: takenAt.toISOString() },
    };
  }

  // 스펙: "24시간 이내 사진만"
  try {
    // 더 많은 태그 추출: 시간/타임존/GPS/카메라/방향/픽셀
    const exif = await parse(file, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'OffsetTimeOriginal',
        'OffsetTime',
        'latitude',
        'longitude',
        'GPSAltitude',
        'GPSSpeed',
        'GPSImgDirection',
        'GPSDateStamp',
        'GPSTimeStamp',
        'Make',
        'Model',
        'LensModel',
        'Orientation',
        'ExifImageWidth',
        'ExifImageHeight',
        'PixelXDimension',
        'PixelYDimension',
        'FNumber',
        'ExposureTime',
        'ISO',
        'FocalLength',
        'Software',
      ],
      reviveValues: true,
      translateValues: true,
    });

    const rawDate = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;
    if (!rawDate) return { valid: false, reason: 'no_exif' };

    const takenAt = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (!takenAt || Number.isNaN(takenAt.getTime())) {
      return { valid: false, reason: 'no_exif' };
    }

    const diffMs = Date.now() - takenAt.getTime();
    const minutesAgo = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMs > 24 * 60 * 60 * 1000) {
      return { valid: false, reason: 'too_old', takenAt, minutesAgo };
    }

    const lat = typeof exif.latitude === 'number' ? exif.latitude : null;
    const lng = typeof exif.longitude === 'number' ? exif.longitude : null;
    const location =
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : undefined;

    // 정규화된 EXIF 메타 (uploadStore에 그대로 전달 가능)
    const normalizedExif = {
      DateTimeOriginal: exif.DateTimeOriginal
        ? new Date(exif.DateTimeOriginal).toISOString()
        : null,
      CreateDate: exif.CreateDate ? new Date(exif.CreateDate).toISOString() : null,
      ModifyDate: exif.ModifyDate ? new Date(exif.ModifyDate).toISOString() : null,
      OffsetTimeOriginal: exif.OffsetTimeOriginal || exif.OffsetTime || null,
      GPSLatitude: lat,
      GPSLongitude: lng,
      GPSAltitude: exif.GPSAltitude ?? null,
      GPSSpeed: exif.GPSSpeed ?? null,
      GPSImgDirection: exif.GPSImgDirection ?? null,
      Make: exif.Make ?? null,
      Model: exif.Model ?? null,
      LensModel: exif.LensModel ?? null,
      Orientation: exif.Orientation ?? null,
      Width: exif.ExifImageWidth ?? exif.PixelXDimension ?? null,
      Height: exif.ExifImageHeight ?? exif.PixelYDimension ?? null,
      FNumber: exif.FNumber ?? null,
      ExposureTime: exif.ExposureTime ?? null,
      ISO: exif.ISO ?? null,
      FocalLength: exif.FocalLength ?? null,
      Software: exif.Software ?? null,
      source: 'gallery_exif',
    };

    return { valid: true, takenAt, minutesAgo, location, exif: normalizedExif };
  } catch (_) {
    return { valid: false, reason: 'no_exif' };
  }
}

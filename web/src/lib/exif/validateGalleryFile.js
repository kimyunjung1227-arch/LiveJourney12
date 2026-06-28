import { parse } from 'exifr';

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

  // 영상은 EXIF 메타가 비표준이라 추출이 어렵다.
  // 거부하면 "영상 촬영물이 업로드 안 되는" 문제가 생기므로,
  // 촬영 시각은 지금(업로드 시점), 위치는 현재 GPS로 채워 통과시킨다.
  if (file.type && file.type.startsWith('video/')) {
    const takenAt = new Date();
    return {
      valid: true,
      isVideo: true,
      takenAt,
      minutesAgo: 0,
      exif: { source: 'video_no_exif', DateTimeOriginal: takenAt.toISOString() },
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

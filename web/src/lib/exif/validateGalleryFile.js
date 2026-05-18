import { parse } from 'exifr';

/**
 * 갤러리에서 선택한 파일의 EXIF 검증.
 * - 라이브저니는 1시간 이내 사진만 허용
 * - EXIF DateTimeOriginal 없으면 거부
 * - 영상 파일은 EXIF 보장이 어려워 일단 EXIF 없음으로 처리 (필요 시 추후 확장)
 *
 * @param {File} file
 * @returns {Promise<{
 *   valid: boolean,
 *   reason?: 'no_exif' | 'too_old',
 *   takenAt?: Date,
 *   location?: { lat: number, lng: number },
 *   minutesAgo?: number
 * }>}
 */
export async function validateGalleryFile(file) {
  if (!file) return { valid: false, reason: 'no_exif' };

  // 영상은 EXIF 추출 비표준 — 일단 거부 처리 (스펙: "1시간 이내 사진만")
  if (file.type && file.type.startsWith('video/')) {
    return { valid: false, reason: 'no_exif' };
  }

  try {
    const exif = await parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'],
    });

    const raw = exif?.DateTimeOriginal || exif?.CreateDate;
    if (!raw) return { valid: false, reason: 'no_exif' };

    const takenAt = raw instanceof Date ? raw : new Date(raw);
    if (!takenAt || Number.isNaN(takenAt.getTime())) {
      return { valid: false, reason: 'no_exif' };
    }

    const diffMs = Date.now() - takenAt.getTime();
    const minutesAgo = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMs > 60 * 60 * 1000) {
      return { valid: false, reason: 'too_old', takenAt, minutesAgo };
    }

    const location =
      typeof exif.latitude === 'number' && typeof exif.longitude === 'number'
        ? { lat: exif.latitude, lng: exif.longitude }
        : undefined;

    return { valid: true, takenAt, minutesAgo, location };
  } catch (_) {
    return { valid: false, reason: 'no_exif' };
  }
}

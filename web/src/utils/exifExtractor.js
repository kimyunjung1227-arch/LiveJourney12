import exifr from 'exifr';
import { logger } from './logger';

/**
 * 안드로이드 WebView·크롬 등에서 갤러리 파일의 `type`이 빈 문자열이거나
 * `application/octet-stream`으로 오는 경우가 많아, 확장자로 보완한다.
 * @param {File|Blob} file
 */
function isLikelyRasterImageFile(file) {
  if (!file) return false;
  const t = String(file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  if (t.startsWith('video/')) return false;
  const name = 'name' in file && typeof file.name === 'string' ? file.name : '';
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(name)) return true;
  if (t === 'application/octet-stream' || t === '' || t === 'binary/octet-stream') {
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(name);
  }
  return false;
}

/** @param {unknown} v */
function toFiniteNumber(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * EXIF 날짜 문자열(YYYY:MM:DD HH:MM:SS 등)을 Date로 — 로컬 벽시계 기준으로 해석
 * @param {unknown} raw
 * @returns {Date|null}
 */
export function parseExifDateToDate(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se)
    );
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** EXIF SubSec* 필드를 밀리초 보정값으로 (0–999) */
function subSecToMilliseconds(raw) {
  if (raw == null || raw === '') return 0;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return 0;
  const n = parseInt(digits.slice(0, 3).padEnd(3, '0'), 10);
  return Number.isFinite(n) ? Math.min(n, 999) : 0;
}

/**
 * DateTimeOriginal + SubSec(있으면)으로 촬영 시각 정리
 * @param {Record<string, unknown>} exifData
 * @returns {Date|null}
 */
function resolveCaptureDate(exifData) {
  if (!exifData) return null;
  const primary =
    exifData.DateTimeOriginal ??
    exifData.CreateDate ??
    exifData.DateTimeDigitized ??
    exifData.DateTime ??
    exifData.GPSDateTime ??
    exifData.MetadataDate ??
    exifData.DateCreated ??
    exifData.ModifyDate ??
    null;

  const base = parseExifDateToDate(primary);
  if (!base) return null;
  const subMs =
    subSecToMilliseconds(exifData.SubSecTimeOriginal) ||
    subSecToMilliseconds(exifData.SubSecTimeDigitized) ||
    subSecToMilliseconds(exifData.SubSecTime) ||
    subSecToMilliseconds(exifData.SubSec);
  if (!subMs) return base;
  const t = base.getTime() + subMs;
  const out = new Date(t);
  return Number.isNaN(out.getTime()) ? base : out;
}

/** EXIF 촬영 시각이 업로드 허용 기준(기본 48시간)을 넘겼는지 */
export const EXIF_RECENT_CAPTURE_MAX_MS = 48 * 60 * 60 * 1000;

/**
 * @param {string|null|undefined} photoDateIso — extractExifData의 photoDate 등 ISO 문자열
 * @param {{ isInAppCamera?: boolean; hasOnlyVideo?: boolean }} [opt]
 */
export function isExifCaptureTooOldForUpload(photoDateIso, opt = {}) {
  const { isInAppCamera = false, hasOnlyVideo = false } = opt;
  if (isInAppCamera || hasOnlyVideo) return false;
  if (!photoDateIso) return false;
  const t = new Date(photoDateIso).getTime();
  if (Number.isNaN(t)) return false;
  const age = Date.now() - t;
  if (!Number.isFinite(age) || age < 0) return false;
  return age > EXIF_RECENT_CAPTURE_MAX_MS;
}

/** 첫 파싱에서 빠진 키를 XMP/IPTC 전체 파싱으로 보강 */
function mergeMissingMetadata(base, extra) {
  if (!base) return extra || null;
  if (!extra || typeof extra !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (v == null || v === '') continue;
    if (out[k] == null || out[k] === '') out[k] = v;
  }
  return out;
}

async function enrichWithXmpIptc(file, existing) {
  try {
    const aux = await exifr.parse(file, {
      xmp: true,
      iptc: true,
      mergeOutput: true,
      reviveValues: true,
      sanitize: true,
      translateKeys: false,
      translateValues: false,
      firstChunk: false,
    });
    return mergeMissingMetadata(existing, aux);
  } catch (e) {
    logger.debug('XMP/IPTC 보조 파싱 실패(무시):', e);
    return existing;
  }
}

/**
 * exifr가 반환한 위도/경도를 십진도 숫자로 통일
 * @param {unknown} lat
 * @param {unknown} lng
 * @returns {{ lat: number, lng: number } | null}
 */
function normalizeGps(lat, lng) {
  const la = toFiniteNumber(lat);
  const ln = toFiniteNumber(lng);
  if (la == null || ln == null) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { lat: la, lng: ln };
}

const EXIF_PICK = [
  'DateTimeOriginal',
  'CreateDate',
  'DateTimeDigitized',
  'DateTime',
  'ModifyDate',
  'GPSDateTime',
  'SubSecTimeOriginal',
  'SubSecTimeDigitized',
  'SubSecTime',
  'OffsetTimeOriginal',
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'Make',
  'Model',
  'Orientation',
  'ImageWidth',
  'ImageHeight',
];

const BASE_PARSE_OPTS = {
  pick: EXIF_PICK,
  translateKeys: false,
  translateValues: false,
  reviveValues: true,
  sanitize: true,
  mergeOutput: true,
};

/**
 * 이미지 파일에서 EXIF 데이터 추출 (날짜, GPS 좌표 등)
 * @param {File} file - 이미지 파일
 * @param {{ allowed?: boolean }} [options]
 * @returns {Promise<Object|null>} EXIF 데이터 객체
 */
export const extractExifData = async (file, options = {}) => {
  const { allowed = true } = options;
  try {
    if (!allowed) {
      return null;
    }
    if (!isLikelyRasterImageFile(file)) {
      logger.debug('EXIF 추출: 이미지로 보이지 않음 (type/name)', file?.type, file?.name);
      return null;
    }

    let exifData = null;
    try {
      exifData = await exifr.parse(file, {
        ...BASE_PARSE_OPTS,
        firstChunk: true,
        /** 일부 JPEG는 메타데이터 블록이 뒤쪽에 있을 수 있어 1차 청크를 넉넉히 */
        firstChunkSize: 1024 * 1024,
      });
    } catch (e) {
      logger.debug('EXIF firstChunk 파싱 실패, 전체 파일로 재시도:', e);
    }

    const hasUseful =
      exifData &&
      (resolveCaptureDate(exifData) ||
        normalizeGps(exifData.GPSLatitude, exifData.GPSLongitude) ||
        exifData.Make ||
        exifData.Model);

    if (!hasUseful) {
      try {
        exifData = await exifr.parse(file, {
          ...BASE_PARSE_OPTS,
          firstChunk: false,
        });
      } catch (e2) {
        logger.warn('EXIF 전체 파싱 실패:', e2);
        exifData = null;
      }
    }

    if (!exifData) {
      logger.debug('EXIF 데이터 없음');
      return null;
    }

    let merged = exifData;
    const dateBefore = resolveCaptureDate(merged);
    const gpsBefore = normalizeGps(merged.GPSLatitude, merged.GPSLongitude);
    if (!dateBefore || !gpsBefore) {
      merged = await enrichWithXmpIptc(file, merged);
    }

    const photoDateObj = resolveCaptureDate(merged);

    let gpsCoordinates = normalizeGps(merged.GPSLatitude, merged.GPSLongitude);

    logger.debug('📸 EXIF 데이터 추출 성공:', {
      hasDate: !!photoDateObj,
      hasGPS: !!gpsCoordinates,
      dateTime: merged.DateTimeOriginal || merged.CreateDate,
      gps: gpsCoordinates,
    });

    const dateTimeOriginalRaw =
      merged.DateTimeOriginal != null
        ? String(merged.DateTimeOriginal)
        : merged.CreateDate != null
          ? String(merged.CreateDate)
          : merged.DateTimeDigitized != null
            ? String(merged.DateTimeDigitized)
            : null;

    return {
      photoDate: photoDateObj ? photoDateObj.toISOString() : null,
      photoTimestamp: photoDateObj ? photoDateObj.getTime() : null,
      dateTimeOriginal: merged.DateTimeOriginal ?? null,
      createDate: merged.CreateDate ?? null,
      dateTimeOriginalRaw,

      gpsCoordinates,
      gpsLatitude: gpsCoordinates ? gpsCoordinates.lat : toFiniteNumber(merged.GPSLatitude),
      gpsLongitude: gpsCoordinates ? gpsCoordinates.lng : toFiniteNumber(merged.GPSLongitude),
      gpsAltitude: toFiniteNumber(merged.GPSAltitude),

      cameraMake: merged.Make || null,
      cameraModel: merged.Model || null,

      imageWidth: merged.ImageWidth || null,
      imageHeight: merged.ImageHeight || null,
      orientation: merged.Orientation || null,

      raw: merged,
    };
  } catch (error) {
    logger.warn('EXIF 데이터 추출 실패:', error);
    return null;
  }
};

/**
 * 여러 이미지 파일에서 EXIF 데이터 일괄 추출
 * @param {File[]} files - 이미지 파일 배열
 * @param {{ allowed?: boolean }} [options]
 * @returns {Promise<Array>} EXIF 데이터 배열
 */
export const extractExifDataFromFiles = async (files, options = {}) => {
  if (!files || files.length === 0) {
    return [];
  }

  try {
    const results = await Promise.all(files.map((file) => extractExifData(file, options)));
    return results.filter((result) => result !== null);
  } catch (error) {
    logger.error('EXIF 일괄 추출 실패:', error);
    return [];
  }
};

/**
 * EXIF 날짜를 사용자 친화적인 형식으로 변환
 * @param {string|Date} date - 날짜 문자열 또는 Date 객체
 * @returns {string|null} 포맷된 날짜 문자열
 */
export const formatExifDate = (date) => {
  if (!date) return null;

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;

    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      return '오늘';
    }
    if (daysDiff === 1) {
      return '어제';
    }
    if (daysDiff < 7) {
      return `${daysDiff}일 전`;
    }
    if (daysDiff < 30) {
      const weeks = Math.floor(daysDiff / 7);
      return `${weeks}주 전`;
    }
    if (daysDiff < 365) {
      const months = Math.floor(daysDiff / 30);
      return `${months}개월 전`;
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
  } catch (error) {
    logger.warn('날짜 포맷 실패:', error);
    return null;
  }
};

/**
 * EXIF GPS 좌표를 주소로 변환 (카카오맵 API 사용)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Promise<string|null>} 주소 문자열
 */
export const convertGpsToAddress = async (lat, lng) => {
  if (!lat || !lng || !window.kakao || !window.kakao.maps) {
    return null;
  }

  try {
    return new Promise((resolve) => {
      const geocoder = new window.kakao.maps.services.Geocoder();

      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          const address = result[0].address;
          const roadAddress = result[0].road_address;

          let locationName = '';

          if (roadAddress) {
            const parts = roadAddress.address_name.split(' ');
            locationName = parts
              .slice(1, 3)
              .join(' ')
              .replace('특별시', '')
              .replace('광역시', '')
              .replace('특별자치시', '')
              .replace('특별자치도', '')
              .trim();
          } else if (address) {
            const parts = address.address_name.split(' ');
            locationName = parts
              .slice(1, 3)
              .join(' ')
              .replace('특별시', '')
              .replace('광역시', '')
              .replace('특별자치시', '')
              .replace('특별자치도', '')
              .trim();
          }

          resolve(locationName || null);
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    logger.warn('GPS 주소 변환 실패:', error);
    return null;
  }
};

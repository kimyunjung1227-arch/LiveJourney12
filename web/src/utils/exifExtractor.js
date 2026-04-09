import exifr from 'exifr';
import { logger } from './logger';

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
    exifData.ModifyDate ??
    null;

  const base = parseExifDateToDate(primary);
  return base;
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
    if (!file || !file.type.startsWith('image/')) {
      logger.debug('EXIF 추출: 이미지 파일이 아님');
      return null;
    }

    let exifData = null;
    try {
      exifData = await exifr.parse(file, {
        ...BASE_PARSE_OPTS,
        firstChunk: true,
        firstChunkSize: 768 * 1024,
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

    const photoDateObj = resolveCaptureDate(exifData);

    let gpsCoordinates = normalizeGps(exifData.GPSLatitude, exifData.GPSLongitude);

    logger.debug('📸 EXIF 데이터 추출 성공:', {
      hasDate: !!photoDateObj,
      hasGPS: !!gpsCoordinates,
      dateTime: exifData.DateTimeOriginal || exifData.CreateDate,
      gps: gpsCoordinates,
    });

    const dateTimeOriginalRaw =
      exifData.DateTimeOriginal != null
        ? String(exifData.DateTimeOriginal)
        : exifData.CreateDate != null
          ? String(exifData.CreateDate)
          : exifData.DateTimeDigitized != null
            ? String(exifData.DateTimeDigitized)
            : null;

    return {
      photoDate: photoDateObj ? photoDateObj.toISOString() : null,
      photoTimestamp: photoDateObj ? photoDateObj.getTime() : null,
      dateTimeOriginal: exifData.DateTimeOriginal ?? null,
      createDate: exifData.CreateDate ?? null,
      dateTimeOriginalRaw,

      gpsCoordinates,
      gpsLatitude: gpsCoordinates ? gpsCoordinates.lat : toFiniteNumber(exifData.GPSLatitude),
      gpsLongitude: gpsCoordinates ? gpsCoordinates.lng : toFiniteNumber(exifData.GPSLongitude),
      gpsAltitude: toFiniteNumber(exifData.GPSAltitude),

      cameraMake: exifData.Make || null,
      cameraModel: exifData.Model || null,

      imageWidth: exifData.ImageWidth || null,
      imageHeight: exifData.ImageHeight || null,
      orientation: exifData.Orientation || null,

      raw: exifData,
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

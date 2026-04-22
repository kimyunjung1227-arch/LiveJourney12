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

/** 핸드폰 브라우저(Safari/Chrome)에서 EXIF 경로를 따로 탐 — 데스크톱과 동일 로직도 유지 */
function isTouchMobileWeb() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarse || /iPhone|iPad|iPod|Android.*Mobile|Mobile.*Safari/i.test(ua);
}

function inferImageMimeFromName(name) {
  const n = String(name || '').toLowerCase();
  if (/\.jpe?g$/i.test(n)) return 'image/jpeg';
  if (/\.png$/i.test(n)) return 'image/png';
  if (/\.webp$/i.test(n)) return 'image/webp';
  if (/\.gif$/i.test(n)) return 'image/gif';
  if (/\.heic$/i.test(n)) return 'image/heic';
  if (/\.heif$/i.test(n)) return 'image/heif';
  if (/\.bmp$/i.test(n)) return 'image/bmp';
  if (/\.tiff?$/i.test(n)) return 'image/tiff';
  return '';
}

/**
 * 모바일에서 type 이 비거나 octet-stream 인 경우가 많아 exifr 가 EXIF 를 못 읽는 문제 완화
 * @param {File|Blob} file
 * @returns {File}
 */
function ensureTypedImageFileForExif(file) {
  if (!file || !(file instanceof Blob)) return file;
  const name = 'name' in file && typeof file.name === 'string' ? file.name : 'image.jpg';
  const t = String(file.type || '').toLowerCase();
  const inferred = inferImageMimeFromName(name);
  const looksWrong =
    !t.startsWith('image/') ||
    t === 'application/octet-stream' ||
    t === '' ||
    t === 'binary/octet-stream';
  const lm =
    'lastModified' in file && typeof file.lastModified === 'number' ? file.lastModified : Date.now();
  if (!looksWrong) {
    return file instanceof File ? file : new File([file], name, { type: t, lastModified: lm });
  }
  const mime = inferred || 'image/jpeg';
  return new File([file], name, { type: mime, lastModified: lm });
}

function rationalToNumber(x) {
  if (x == null) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  if (Array.isArray(x) && x.length >= 2) {
    const a = Number(x[0]);
    const b = Number(x[1]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }
  return toFiniteNumber(x);
}

/**
 * 도/분/초 배열 또는 유리수 배열 → 십진도 (북위·동경 기준 양수, 남위·서경은 ref 로 음수 처리)
 */
function dmsTripleToDecimal(parts, ref, isLatitude) {
  if (!Array.isArray(parts) || parts.length < 3) return null;
  const d = rationalToNumber(parts[0]);
  const m = rationalToNumber(parts[1]);
  const s = rationalToNumber(parts[2]);
  if (![d, m, s].every((x) => x != null && Number.isFinite(x))) return null;
  let dec = Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600;
  const refUp = String(ref || '').toUpperCase();
  const neg = refUp === 'S' || refUp === 'W';
  if (neg) dec = -dec;
  const limit = isLatitude ? 90 : 180;
  if (Math.abs(dec) > limit) return null;
  return dec;
}

function coerceOneGpsCoord(raw, ref, isLatitude) {
  const direct = toFiniteNumber(raw);
  if (direct != null) {
    const limit = isLatitude ? 90 : 180;
    if (Math.abs(direct) <= limit) return direct;
  }
  if (Array.isArray(raw) && raw.length >= 3) {
    return dmsTripleToDecimal(raw, ref, isLatitude);
  }
  return null;
}

/**
 * exifr 출력(십진도·DMS 배열·latitude/longitude 별칭)을 한 번에 처리
 * @param {Record<string, unknown>|null} exif
 * @returns {{ lat: number, lng: number } | null}
 */
function normalizeGpsFromExif(exif) {
  if (!exif || typeof exif !== 'object') return null;
  let lat = exif.GPSLatitude;
  let lng = exif.GPSLongitude;
  const latRef = exif.GPSLatitudeRef;
  const lngRef = exif.GPSLongitudeRef;

  if (lat == null && typeof exif.latitude === 'number') lat = exif.latitude;
  if (lng == null && typeof exif.longitude === 'number') lng = exif.longitude;

  let la = coerceOneGpsCoord(lat, latRef, true);
  let ln = coerceOneGpsCoord(lng, lngRef, false);

  if (la != null && ln != null) {
    return { lat: la, lng: ln };
  }
  return null;
}

/** 날짜·GPS·카메라 정보 중 하나라도 있으면 유의미 */
function hasUsefulExifPayload(data) {
  return !!(
    data &&
    (resolveCaptureDate(data) ||
      normalizeGpsFromExif(data) ||
      data.Make ||
      data.Model)
  );
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
  'GPSLatitudeRef',
  'GPSLongitudeRef',
  'GPSAltitude',
  'Make',
  'Model',
  'Orientation',
  'ImageWidth',
  'ImageHeight',
  'latitude',
  'longitude',
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

    const typedFile = ensureTypedImageFileForExif(file);
    const mobile = isTouchMobileWeb();
    const MAX_FULL_PARSE_BYTES = 45 * 1024 * 1024;
    /** 작은 파일은 한 번에 버퍼를 읽어 파싱하는 편이 모바일 Safari 에서 더 안정적·빠름 */
    /** 고해상도 폰 사진 EXIF 블록이 크거나 뒤쪽에 붙는 경우까지 한 번에 읽기 */
    const MOBILE_SMALL_FULL_PARSE_BYTES = 12 * 1024 * 1024;

    let cachedFullBuffer = null;
    const getFullArrayBuffer = async () => {
      if (cachedFullBuffer) return cachedFullBuffer;
      if (typedFile.size > MAX_FULL_PARSE_BYTES) return null;
      cachedFullBuffer = await typedFile.arrayBuffer();
      return cachedFullBuffer;
    };

    const parseOptsFull = { ...BASE_PARSE_OPTS, firstChunk: false };
    const parseOptsFirstChunk = {
      ...BASE_PARSE_OPTS,
      firstChunk: true,
      firstChunkSize: mobile ? 2 * 1024 * 1024 : 1024 * 1024,
    };

    let exifData = null;

    // 1) 모바일 + 소용량: 전체 파일을 한 번에 파싱 (앞쪽 청크만으로는 못 잡는 메타·HEIC 등)
    if (mobile && typedFile.size > 0 && typedFile.size <= MOBILE_SMALL_FULL_PARSE_BYTES) {
      try {
        const ab = await getFullArrayBuffer();
        if (ab) {
          exifData = await exifr.parse(ab, parseOptsFull);
        }
      } catch (e) {
        logger.debug('EXIF 모바일 소용량 전체 파싱 실패:', e);
      }
    }

    // 2) 앞쪽 청크만으로 빠르게 시도 (대용량 메모리 절약)
    if (!hasUsefulExifPayload(exifData)) {
      try {
        const chunkTry = await exifr.parse(typedFile, parseOptsFirstChunk);
        if (hasUsefulExifPayload(chunkTry)) {
          exifData = chunkTry;
        } else if (!exifData) {
          exifData = chunkTry;
        }
      } catch (e) {
        logger.debug('EXIF firstChunk 파싱 실패:', e);
      }
    }

    // 3) 유효 메타가 없으면 전체 파일 파싱 (상한 내)
    if (!hasUsefulExifPayload(exifData) && typedFile.size <= MAX_FULL_PARSE_BYTES) {
      try {
        const ab = await getFullArrayBuffer();
        if (ab) {
          exifData = await exifr.parse(ab, parseOptsFull);
        }
      } catch (e2) {
        logger.warn('EXIF 전체 파싱 실패:', e2);
        if (!exifData) exifData = null;
      }
    }

    if (!exifData || !hasUsefulExifPayload(exifData)) {
      logger.debug('EXIF 데이터 없음');
      return null;
    }

    let merged = exifData;
    const dateBefore = resolveCaptureDate(merged);
    let gpsBefore = normalizeGpsFromExif(merged);
    const needsXmp = !dateBefore || !gpsBefore;
    if (needsXmp) {
      merged = await enrichWithXmpIptc(typedFile, merged);
    }

    const photoDateObj = resolveCaptureDate(merged);

    let gpsCoordinates = normalizeGpsFromExif(merged);

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
      gpsLatitude: gpsCoordinates
        ? gpsCoordinates.lat
        : coerceOneGpsCoord(merged.GPSLatitude, merged.GPSLatitudeRef, true),
      gpsLongitude: gpsCoordinates
        ? gpsCoordinates.lng
        : coerceOneGpsCoord(merged.GPSLongitude, merged.GPSLongitudeRef, false),
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

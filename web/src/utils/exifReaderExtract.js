/**
 * ExifReader(exifreader)로 JPEG/PNG/HEIC/TIFF/WebP 등에서 메타 추출.
 * 브라우저 번들은 package.json main(dist/exif-reader.js) 사용.
 */
import ExifReader from 'exifreader';
import { logger } from './logger';

/** @param {object|undefined} tag */
function tagToPrimitive(tag) {
  if (!tag || typeof tag !== 'object') return null;
  const d = tag.description;
  if (typeof d === 'string' && d.trim()) return d.trim();
  if (Array.isArray(d) && d.length) return d.map((x) => String(x)).join('').trim() || null;
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  const v = tag.value;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number')) {
    return v;
  }
  return null;
}

function tagToNumber(tag) {
  if (!tag || typeof tag !== 'object') return null;
  if (typeof tag.value === 'number' && Number.isFinite(tag.value)) return tag.value;
  const d = tag.description;
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  return null;
}

/**
 * ExifReader expanded 결과를 exifr 병합용 플랫 객체로 변환
 * @param {File|Blob} file
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function extractMergedTagsFromExifReader(file) {
  if (!file || !(file instanceof Blob)) return null;

  let expanded;
  try {
    expanded = await ExifReader.load(file, { expanded: true, computed: true });
  } catch (e) {
    logger.debug('ExifReader.load(File) 실패, ArrayBuffer 재시도:', e?.message || e);
    try {
      const ab = await file.arrayBuffer();
      expanded = await ExifReader.load(ab, { expanded: true, computed: true });
    } catch (e2) {
      logger.debug('ExifReader.load(ArrayBuffer) 실패:', e2?.message || e2);
      return null;
    }
  }

  const exif = expanded.exif || {};
  const out = {};

  const dateKeys = [
    'DateTimeOriginal',
    'CreateDate',
    'DateTimeDigitized',
    'DateTime',
    'ModifyDate',
    'MetadataDate',
    'GPSDateTime',
  ];
  for (const key of dateKeys) {
    const s = tagToPrimitive(exif[key]);
    if (typeof s === 'string' && s) out[key] = s;
  }

  const make = tagToPrimitive(exif.Make);
  const model = tagToPrimitive(exif.Model);
  if (typeof make === 'string') out.Make = make;
  if (typeof model === 'string') out.Model = model;

  const ow = tagToNumber(exif.ImageWidth ?? exif['Image Width']);
  const oh = tagToNumber(exif.ImageLength ?? exif['Image Length'] ?? exif.ImageHeight);
  if (ow != null) out.ImageWidth = ow;
  if (oh != null) out.ImageHeight = oh;

  const ori = tagToNumber(exif.Orientation);
  if (ori != null) out.Orientation = ori;

  for (const subKey of ['SubSecTimeOriginal', 'SubSecTimeDigitized', 'SubSecTime', 'SubSec']) {
    const sub = tagToPrimitive(exif[subKey]);
    if (typeof sub === 'string' && sub) {
      out[subKey] = sub;
      break;
    }
  }

  const gps = expanded.gps;
  if (gps && Number.isFinite(gps.Latitude) && Number.isFinite(gps.Longitude)) {
    out.latitude = gps.Latitude;
    out.longitude = gps.Longitude;
    if (Number.isFinite(gps.Altitude)) out.GPSAltitude = gps.Altitude;
  }

  return Object.keys(out).length ? out : null;
}

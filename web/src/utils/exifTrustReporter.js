/**
 * EXIF·촬영 시각·위치 일치 등으로 "현장 제보" 신뢰도를 계산하고,
 * 작성자 단위로 누적해 "믿을 수 있는 제보자" 정체성을 부여합니다.
 * (DB 스키마 없이 게시물 JSON 필드만 사용 — posts.exif_data 등)
 */

import { EXIF_RECENT_CAPTURE_MAX_MS } from './exifExtractor';
import { haversineKm as distKm } from './geoDistance';

const getPostCoords = (post) => {
  const c = post?.coordinates;
  if (c && (c.lat != null || c.latitude != null) && (c.lng != null || c.longitude != null)) {
    return { lat: Number(c.lat ?? c.latitude), lng: Number(c.lng ?? c.longitude) };
  }
  const loc = post?.location;
  if (loc && typeof loc === 'object') {
    const lat = loc.lat ?? loc.latitude;
    const lng = loc.lng ?? loc.lon ?? loc.longitude;
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
};

const getCaptureMs = (post) => {
  const raw = post?.photoDate || post?.exifData?.photoDate;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
};

const getUploadMs = (post) => {
  const raw = post?.createdAt || post?.timestamp || post?.created;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
};

const hasExifTimeSignal = (post) =>
  !!(
    post?.exifData?.photoDate ||
    post?.photoDate ||
    post?.exifData?.dateTimeOriginalRaw ||
    post?.exifData?.dateTimeOriginal
  );

/**
 * 단일 게시물의 EXIF·업로드 간격·좌표 일치 기반 신뢰 점수
 * @returns {{ score: number, level: 0|1|2|3, signals: string[], shortLabel: string, detail: string }}
 */
export function getExifTrustForPost(post) {
  if (!post || typeof post !== 'object') {
    return { score: 0, level: 0, signals: [], shortLabel: '', detail: 'EXIF 정보가 없습니다.' };
  }

  const signals = [];
  let score = 0;

  if (post.isInAppCamera === true) {
    score += 12;
    signals.push('앱 내 촬영');
  }

  if (hasExifTimeSignal(post)) {
    score += 22;
    signals.push('촬영 시각(EXIF)');
  }

  const captureMs = getCaptureMs(post);
  const uploadMs = getUploadMs(post);
  if (captureMs != null && uploadMs != null) {
    const delta = uploadMs - captureMs;
    if (delta >= 0 && delta <= EXIF_RECENT_CAPTURE_MAX_MS) {
      score += 28;
      signals.push('촬영 후 48시간 이내 제보');
    } else if (delta > EXIF_RECENT_CAPTURE_MAX_MS) {
      score += 4;
      signals.push('촬영 시각은 있으나 제보 지연');
    }
  }

  const exGps = post?.exifData?.gpsCoordinates;
  const exLat = exGps?.lat != null ? Number(exGps.lat) : null;
  const exLng = exGps?.lng != null ? Number(exGps.lng) : null;
  const pin = post?.exifData?.map_pin;
  const pinLat = pin?.lat != null ? Number(pin.lat) : null;
  const pinLng = pin?.lng != null ? Number(pin.lng) : null;

  if (Number.isFinite(exLat) && Number.isFinite(exLng)) {
    score += 12;
    signals.push('촬영 위치(GPS) 포함');
    const postCoords = getPostCoords(post);
    const refLat = Number.isFinite(pinLat) ? pinLat : postCoords?.lat;
    const refLng = Number.isFinite(pinLng) ? pinLng : postCoords?.lng;
    if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
      const km = distKm(exLat, exLng, refLat, refLng);
      if (km <= 1.5) {
        score += 32;
        signals.push('촬영 GPS와 제보 위치 거의 일치');
      } else if (km <= 12) {
        score += 14;
        signals.push('촬영 GPS와 제보 위치 인근');
      }
    }
  }

  if (post?.verifiedLocation && String(post.verifiedLocation).trim()) {
    score += 8;
    signals.push('주소·장소 검증 표시');
  }

  let level = 0;
  if (score >= 72) level = 3;
  else if (score >= 48) level = 2;
  else if (score >= 22) level = 1;

  const shortLabel =
    level === 0
      ? ''
      : level === 1
        ? 'EXIF 일부'
        : level === 2
          ? '현장 제보'
          : '강한 현장 근거';

  const detail =
    signals.length > 0
      ? signals.join(' · ')
      : level === 0
        ? '사진 메타데이터가 없거나 제거된 제보입니다.'
        : '';

  return { score, level, signals, shortLabel, detail };
}

/**
 * 작성자 게시물 목록으로 "믿을 수 있는 제보자" 정체성 요약
 * @param {object[]} posts
 * @returns {null | { tier: 'trusted' | 'rising', title: string, body: string, strongCount: number, total: number, ratio: number }}
 */
export function getReporterIdentityFromPosts(posts) {
  const list = Array.isArray(posts) ? posts.filter(Boolean) : [];
  const total = list.length;
  if (total < 3) return null;

  let strong = 0;
  for (const p of list) {
    const { level } = getExifTrustForPost(p);
    if (level >= 2) strong += 1;
  }
  const ratio = strong / total;

  if (total >= 8 && strong >= 6 && ratio >= 0.55) {
    return {
      tier: 'trusted',
      title: '믿을 수 있는 제보자',
      body: `최근 ${total}건 중 ${strong}건이 촬영 시각·위치 등 EXIF 근거가 충분한 현장형 제보로 집계됐어요.`,
      strongCount: strong,
      total,
      ratio,
    };
  }

  if (total >= 5 && strong >= 3 && ratio >= 0.4) {
    return {
      tier: 'rising',
      title: '신뢰도 성장 중',
      body: `${total}건의 제보 중 ${strong}건이 EXIF 기반 현장 신호가 뚜렷해요. 꾸준히 쌓이면 "믿을 수 있는 제보자"로 표시될 수 있어요.`,
      strongCount: strong,
      total,
      ratio,
    };
  }

  return null;
}

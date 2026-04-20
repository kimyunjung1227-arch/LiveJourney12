export type PhotoStatus = 'LIVE' | 'VERIFIED' | 'NONE';

const HOURS_48_MS = 48 * 60 * 60 * 1000;
/** EXIF 등으로 알 수 있는 촬영 시각이 이 안이면 「현장 LIVE」(추천 엔진의 live 구간과 동일) */
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

function parseDateMaybe(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 게시물에 저장된 exifData.photoDate(ISO) — 업로드 시 extractExifData 기준 */
function getExifBackedCaptureDate(post: any): Date | null {
  if (!post?.exifData || typeof post.exifData !== 'object') return null;
  const ex = post.exifData as Record<string, unknown>;
  return parseDateMaybe(ex.photoDate);
}

export function getPhotoStatusFromPost(post: any, nowMs = Date.now()): PhotoStatus {
  if (!post) return 'NONE';
  const exifCap = getExifBackedCaptureDate(post);
  if (exifCap) {
    const liveDiff = nowMs - exifCap.getTime();
    if (Number.isFinite(liveDiff) && liveDiff >= 0 && liveDiff <= LIVE_WINDOW_MS) {
      return 'LIVE';
    }
  }

  const captured =
    parseDateMaybe(post.photoDate)
    || parseDateMaybe(post.exifData?.photoDate)
    || parseDateMaybe(post.timestamp)
    || parseDateMaybe(post.createdAt)
    || null;

  if (!captured) return 'NONE';

  const diff = nowMs - captured.getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'NONE';
  // ✅ 태그는 시간에 따라 자동으로 변해야 한다.
  // - 촬영~현재 3시간 이내: 현장 LIVE
  // - 3~48시간: 최근 인증
  // - 48시간 이후: 태그 없음
  if (diff <= LIVE_WINDOW_MS) return 'LIVE';
  return diff <= HOURS_48_MS ? 'VERIFIED' : 'NONE';
}


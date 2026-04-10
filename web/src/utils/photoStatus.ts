export type PhotoStatus = 'LIVE' | 'VERIFIED' | 'NONE';

const HOURS_48_MS = 48 * 60 * 60 * 1000;

function parseDateMaybe(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getPhotoStatusFromPost(post: any, nowMs = Date.now()): PhotoStatus {
  if (!post) return 'NONE';
  if (post.isInAppCamera === true) return 'LIVE';

  const captured =
    parseDateMaybe(post.photoDate)
    || parseDateMaybe(post.exifData?.photoDate)
    || parseDateMaybe(post.timestamp)
    || parseDateMaybe(post.createdAt)
    || null;

  if (!captured) return 'NONE';

  const diff = nowMs - captured.getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'NONE';
  return diff <= HOURS_48_MS ? 'VERIFIED' : 'NONE';
}


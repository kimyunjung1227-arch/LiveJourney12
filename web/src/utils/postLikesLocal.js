const LIKES_BY_POST_KEY = 'postLikes_v1'; // { [postId]: number }
const LIKES_BY_USER_KEY = 'postLikesByUser_v1'; // { [userId]: { [postId]: true } }

const safeParseJson = (raw, fallback) => {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const readLikesByPost = () => safeParseJson(localStorage.getItem(LIKES_BY_POST_KEY) || 'null', {});
const writeLikesByPost = (obj) => localStorage.setItem(LIKES_BY_POST_KEY, JSON.stringify(obj || {}));
const readLikesByUser = () => safeParseJson(localStorage.getItem(LIKES_BY_USER_KEY) || 'null', {});
const writeLikesByUser = (obj) => localStorage.setItem(LIKES_BY_USER_KEY, JSON.stringify(obj || {}));

export function getLikeSnapshot(postId, userId, fallbackCount = 0) {
  const pid = postId != null ? String(postId) : '';
  if (!pid) return { liked: false, count: Math.max(0, Number(fallbackCount) || 0) };

  const likesByPost = readLikesByPost();
  const likesByUser = userId ? readLikesByUser() : {};

  const rawCount = likesByPost?.[pid];
  const count = Number.isFinite(Number(rawCount)) ? Number(rawCount) : Math.max(0, Number(fallbackCount) || 0);
  const liked = !!(userId && likesByUser?.[String(userId)]?.[pid]);
  return { liked, count: Math.max(0, count) };
}

export function toggleLikeLocal(postId, userId, fallbackCount = 0) {
  const pid = postId != null ? String(postId) : '';
  const uid = userId != null ? String(userId) : '';
  if (!pid || !uid) return null;

  const likesByPost = readLikesByPost();
  const likesByUser = readLikesByUser();

  const userMap = likesByUser[uid] && typeof likesByUser[uid] === 'object' ? { ...likesByUser[uid] } : {};
  const likedBefore = !!userMap[pid];

  const current = getLikeSnapshot(pid, uid, fallbackCount);
  const nextLiked = !likedBefore;
  const nextCount = Math.max(0, (Number(current.count) || 0) + (nextLiked ? 1 : -1));

  if (nextLiked) userMap[pid] = true;
  else delete userMap[pid];

  likesByUser[uid] = userMap;
  likesByPost[pid] = nextCount;

  writeLikesByUser(likesByUser);
  writeLikesByPost(likesByPost);

  try {
    window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId: pid, likesCount: nextCount } }));
  } catch {
    // ignore
  }

  return { liked: nextLiked, count: nextCount };
}


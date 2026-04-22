/**
 * 게시물 배열·로컬 캐시에서 userId에 해당하는 표시용 이름·프로필 이미지 추론
 */

// 서버 운영 전환: localStorage 제거 → 세션 메모리 캐시
const cacheMap = {};

export const getPostUserId = (post) => {
  if (!post) return '';
  let uid = post.userId;
  if (!uid && typeof post.user === 'string') uid = post.user;
  if (!uid && post.user && typeof post.user === 'object') {
    uid = post.user.id || post.user.userId || post.user._id;
  }
  if (!uid) uid = post.user;
  return uid != null ? String(uid) : '';
};

/**
 * 같은 userId를 가진 게시물들에서 가장 나은 username / profileImage 추출
 */
export const resolveUserDisplayFromPosts = (userId, posts) => {
  const uid = String(userId);
  const matches = Array.isArray(posts) ? posts.filter((p) => getPostUserId(p) === uid) : [];
  let username = null;
  let profileImage = null;

  for (const p of matches) {
    if (p.userAvatar && !profileImage) profileImage = p.userAvatar;
    if (p.user && typeof p.user === 'object') {
      const u = p.user.username || p.user.name;
      if (u && (!username || username === '사용자')) username = u;
      const img = p.user.profileImage || p.user.avatar || p.user.picture;
      if (img && !profileImage) profileImage = img;
    }
    if (typeof p.user === 'string' && !username) username = p.user;
  }

  return {
    username: username || '사용자',
    profileImage: profileImage || null,
  };
};

export const getCachedFollowProfile = (userId) => {
  if (!userId) return null;
  const v = cacheMap[String(userId)];
  if (!v || typeof v !== 'object') return null;
  return {
    username: v.username || null,
    profileImage: v.profileImage ?? null,
  };
};

export const setCachedFollowProfile = (userId, { username, profileImage } = {}) => {
  if (!userId) return;
  cacheMap[String(userId)] = {
    username: username != null ? username : cacheMap[String(userId)]?.username,
    profileImage: profileImage !== undefined ? profileImage : cacheMap[String(userId)]?.profileImage,
  };
};

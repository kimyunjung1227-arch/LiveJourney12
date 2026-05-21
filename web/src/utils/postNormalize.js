// 서버에서 받은 게시물 객체를 피드에서 일관되게 다루기 위한 정규화.
// 과거 mockData.js의 getCombinedPosts에서 이전됨 (mock 데이터 제거 후 정리).

const normalizePostForFeed = (p) => {
  if (!p || typeof p !== 'object') return null;
  const imgs = Array.isArray(p.images) && p.images.length > 0 ? [...p.images] : [];
  const thumb = typeof p.thumbnail === 'string' && p.thumbnail.trim() ? p.thumbnail.trim() : '';
  if (imgs.length === 0 && thumb) return { ...p, images: [thumb] };
  return { ...p, images: imgs };
};

export const normalizePostsForFeed = (serverPosts = []) => {
  if (!Array.isArray(serverPosts)) return [];
  return serverPosts.map(normalizePostForFeed).filter(Boolean);
};

// Supabase에서 받은 게시물만 사용 (localStorage 병합 없음)

const normalizePostForFeed = (p) => {
  if (!p || typeof p !== 'object') return null;
  const imgs = Array.isArray(p.images) && p.images.length > 0 ? [...p.images] : [];
  const thumb = typeof p.thumbnail === 'string' && p.thumbnail.trim() ? p.thumbnail.trim() : '';
  if (imgs.length === 0 && thumb) return { ...p, images: [thumb] };
  return { ...p, images: imgs };
};

export const getCombinedPosts = (serverPosts = []) => {
  if (!Array.isArray(serverPosts)) return [];
  return serverPosts.map(normalizePostForFeed).filter(Boolean);
};

/** @param {string} uri */
export const isVideoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(uri.trim());
};

/**
 * 게시물에서 카드/캐러셀용 미디어 슬롯 (이미지·동영상 순서 유지, 동영상은 posterUri에 직전 정지 이미지·썸네일)
 * @param {object} post — images/videos/thumbnail/image 등은 문자열 URL 기준
 * @returns {{ type: 'image'|'video', uri: string, posterUri?: string }[]}
 */
export const buildMediaItemsFromPost = (post) => {
  if (!post) return [];
  const items = [];
  const seen = new Set();
  let lastImageUri = null;

  const markSeen = (prefix, uri) => {
    const k = `${prefix}:${uri}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };

  const pushImage = (uri) => {
    if (!uri || isVideoUri(uri) || !markSeen('i', uri)) return;
    lastImageUri = uri;
    items.push({ type: 'image', uri });
  };

  const pushVideo = (uri) => {
    if (!uri || !isVideoUri(uri) || !markSeen('v', uri)) return;
    const thumb = post.thumbnail && !isVideoUri(post.thumbnail) ? post.thumbnail : null;
    const posterUri = lastImageUri || thumb || undefined;
    items.push({ type: 'video', uri, posterUri });
  };

  for (const u of post.images || []) {
    if (!u) continue;
    if (isVideoUri(u)) pushVideo(u);
    else pushImage(u);
  }
  for (const u of post.videos || []) {
    if (u) pushVideo(u);
  }

  const fallback = post.image || post.thumbnail || post.imageUrl;
  if (fallback) {
    if (isVideoUri(fallback)) pushVideo(fallback);
    else pushImage(fallback);
  }

  return items;
};

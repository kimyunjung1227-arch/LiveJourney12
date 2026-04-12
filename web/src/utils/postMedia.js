/** @param {string} uri */
export const isVideoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(uri.trim());
};

/** 이미지·썸네일 필드가 문자열 URL 또는 { url } 객체일 때 표시용 문자열로 통일 */
export const toMediaStr = (v) => (typeof v === 'string' ? v : (v?.url ?? v?.src ?? v?.href ?? ''));

/** API 게시물 객체를 buildMediaItemsFromPost용으로 정규화 */
export const normalizePostForMedia = (post) => {
  if (!post) return null;
  const rawImgs = Array.isArray(post.images) ? post.images : post.images ? [post.images] : [];
  const rawVids = Array.isArray(post.videos) ? post.videos : post.videos ? [post.videos] : [];
  return {
    images: rawImgs.map(toMediaStr).filter(Boolean),
    videos: rawVids.map(toMediaStr).filter(Boolean),
    thumbnail: post.thumbnail ? toMediaStr(post.thumbnail) : undefined,
    image: post.image ? toMediaStr(post.image) : undefined,
    imageUrl: post.imageUrl ? toMediaStr(post.imageUrl) : undefined,
  };
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

/** 지도 핀·그리드 썸네일: 정지 이미지 우선, 동영상만 있으면 poster·업로드 썸네일 */
export const getMapThumbnailUri = (post) => {
  const n = normalizePostForMedia(post);
  if (!n) return '';
  const items = buildMediaItemsFromPost(n);
  const img = items.find((m) => m.type === 'image');
  if (img) return img.uri;
  const vidWithPoster = items.find((m) => m.type === 'video' && m.posterUri);
  if (vidWithPoster?.posterUri) return vidWithPoster.posterUri;
  const t = n.thumbnail;
  if (t && !isVideoUri(t)) return t;
  return '';
};

/** 동영상만 있는 게시물의 첫 동영상 URL (핀 썸네일용 비디오 태그) */
export const getFirstVideoUriFromPost = (post) => {
  const n = normalizePostForMedia(post);
  if (!n) return '';
  const items = buildMediaItemsFromPost(n);
  const v = items.find((m) => m.type === 'video');
  return v?.uri ? String(v.uri) : '';
};

/**
 * 피드 그리드용 커버: 이미지·동영상 poster 우선(정지), 없을 때만 video 태그용 src
 * @param {(url: string) => string} displayUrl — 보통 getDisplayImageUrl
 */
export const getGridCoverDisplay = (post, displayUrl) => {
  const n = normalizePostForMedia(post);
  if (!n) return { mode: 'empty' };
  const thumb = getMapThumbnailUri(post);
  if (thumb) return { mode: 'img', src: displayUrl(thumb) };
  const items = buildMediaItemsFromPost(n);
  const v = items.find((m) => m.type === 'video');
  if (!v) return { mode: 'empty' };
  if (v.posterUri) return { mode: 'img', src: displayUrl(v.posterUri) };
  return { mode: 'video', src: displayUrl(v.uri) };
};

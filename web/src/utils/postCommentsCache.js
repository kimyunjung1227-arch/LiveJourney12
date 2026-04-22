/**
 * (서버 운영 전환) localStorage 제거
 * - 서버 댓글이 있으면 서버를 우선하고, 세션 메모리 캐시에만 있는 항목을 id 기준으로 병합합니다.
 */
const cache = {};

export const getCommentsCacheForPost = (postId) => {
  if (!postId) return [];
  const list = cache[String(postId)];
  return Array.isArray(list) ? list : [];
};

export const setCommentsCacheForPost = (postId, comments) => {
  if (!postId || !Array.isArray(comments)) return;
  cache[String(postId)] = comments;
};

export const mergeCommentsWithCache = (postId, serverComments) => {
  const server = Array.isArray(serverComments) ? serverComments : [];
  const cached = getCommentsCacheForPost(postId);
  if (!cached.length) return server;

  const seen = new Set(
    server
      .map((c) => (c && c.id != null ? String(c.id) : null))
      .filter(Boolean)
  );

  const merged = [...server];
  cached.forEach((c) => {
    if (!c || c.id == null) return;
    const id = String(c.id);
    if (seen.has(id)) return;
    seen.add(id);
    merged.push(c);
  });

  return merged.sort((a, b) => {
    const ta = new Date(a?.timestamp || a?.createdAt || 0).getTime();
    const tb = new Date(b?.timestamp || b?.createdAt || 0).getTime();
    return ta - tb;
  });
};


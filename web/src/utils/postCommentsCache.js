/**
 * Supabase 댓글 저장 실패·지연 시에도 새로고침 후 복원되도록 로컬 캐시 병합
 */
const CACHE_KEY = 'postCommentsCacheV1';

const readAll = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeAll = (obj) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
};

export const getCommentsCacheForPost = (postId) => {
  if (!postId) return [];
  const all = readAll();
  const list = all[String(postId)];
  return Array.isArray(list) ? list : [];
};

export const setCommentsCacheForPost = (postId, comments) => {
  if (!postId || !Array.isArray(comments)) return;
  const all = readAll();
  all[String(postId)] = comments;
  writeAll(all);
};

/** 서버 목록 + 캐시에만 있는 댓글 병합(서버 우선, id 기준 중복 제거) */
export const mergeCommentsWithCache = (postId, serverComments) => {
  const server = Array.isArray(serverComments) ? serverComments : [];
  const cached = getCommentsCacheForPost(postId);
  if (cached.length === 0) return server;
  const seen = new Set(server.map((c) => (c && c.id != null ? String(c.id) : null)).filter(Boolean));
  const merged = [...server];
  cached.forEach((c) => {
    if (!c || c.id == null) return;
    const id = String(c.id);
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(c);
    }
  });
  return merged.sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || 0).getTime();
    const tb = new Date(b.timestamp || b.createdAt || 0).getTime();
    return ta - tb;
  });
};

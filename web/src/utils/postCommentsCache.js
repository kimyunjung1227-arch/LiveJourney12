/**
 * 댓글 입력 직후 새로고침/리로드에도 복원되도록 게시물별 로컬 캐시를 유지합니다.
 * - 서버(Supabase/API) 댓글이 있으면 서버를 우선하고, 캐시에만 있는 항목을 id 기준으로 병합합니다.
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


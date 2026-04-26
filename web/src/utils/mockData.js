// Supabase 목록 + 동일 기기에서 저장한 uploadedPosts(localStorage) 병합
// - 메인 피드는 fetchPostsSupabase만 부르기 때문에, 로컬에만 있는 글도 합쳐야 업로드 직후 보인다.

const normalizePostForFeed = (p) => {
  if (!p || typeof p !== 'object') return null;
  const imgs = Array.isArray(p.images) && p.images.length > 0 ? [...p.images] : [];
  const thumb = typeof p.thumbnail === 'string' && p.thumbnail.trim() ? p.thumbnail.trim() : '';
  if (imgs.length === 0 && thumb) imgs.push(thumb);
  return { ...p, images: imgs };
};

export const getCombinedPosts = (serverPosts = []) => {
  let rawLocal = [];
  try {
    rawLocal = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
  } catch {
    rawLocal = [];
  }

  const server = (Array.isArray(serverPosts) ? serverPosts : []).map(normalizePostForFeed).filter(Boolean);
  const local = (Array.isArray(rawLocal) ? rawLocal : []).map(normalizePostForFeed).filter(Boolean);

  const serverIds = new Set(server.map((p) => String(p.id || '')));
  const merged = [...server];
  for (const p of local) {
    const id = String(p.id || '');
    if (id && serverIds.has(id)) continue;
    merged.push(p);
  }

  merged.sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || 0).getTime();
    const tb = new Date(b.timestamp || b.createdAt || 0).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  return merged;
};


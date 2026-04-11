/**
 * 동일 id가 Supabase 행·localStorage 행에 둘 다 있을 때
 * 먼저 넣은 쪽만 쓰면 isInAppCamera·exifData 등이 사라져 배지가 틀어집니다.
 * 로컬을 먼저 두고 서버로 덮되, LIVE/EXIF 관련 필드는 OR·보강합니다.
 */

export function mergeTwoPostCopies(prev, next) {
  if (!prev) return next ? { ...next } : null;
  if (!next) return { ...prev };
  const merged = { ...prev, ...next };
  merged.isInAppCamera =
    Boolean(prev.isInAppCamera) ||
    Boolean(next.isInAppCamera) ||
    Boolean(prev.is_in_app_camera) ||
    Boolean(next.is_in_app_camera);
  merged.exifData = prev.exifData ?? next.exifData ?? merged.exifData ?? null;
  merged.photoDate = merged.photoDate || prev.photoDate || next.photoDate || null;
  merged.verifiedLocation =
    merged.verifiedLocation || prev.verifiedLocation || next.verifiedLocation || null;
  merged.weatherSnapshot = merged.weatherSnapshot || prev.weatherSnapshot || next.weatherSnapshot;
  merged.weather = merged.weather || prev.weather || next.weather;
  return merged;
}

/**
 * @param {unknown[]} supabasePosts
 * @param {unknown[]} localPosts
 */
export function combinePostsSupabaseAndLocal(supabasePosts, localPosts) {
  const list = [
    ...(Array.isArray(localPosts) ? localPosts : []),
    ...(Array.isArray(supabasePosts) ? supabasePosts : []),
  ];
  const byId = new Map();
  for (const p of list) {
    if (!p || p.id == null) continue;
    const id = String(p.id);
    const existing = byId.get(id);
    if (!existing) byId.set(id, { ...p });
    else byId.set(id, mergeTwoPostCopies(existing, p));
  }
  return Array.from(byId.values());
}

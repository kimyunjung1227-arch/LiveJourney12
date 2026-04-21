import { togglePostLikeSupabase } from '../api/socialSupabase';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/**
 * Supabase(UUID) 게시물 좋아요 토글. 서버 단일 진실.
 * - 호출부가 `likedBefore`를 전달 (자신의 현재 UI state)
 * - 반환: { success, isLiked, likesCount } 또는 { success: false, reason }
 */
export async function toggleLikeForPost({ postId, userId, likedBefore = false }) {
  const pid = postId != null ? String(postId).trim() : '';
  const uid = userId != null ? String(userId).trim() : '';
  if (!pid || !uid) return { success: false, reason: 'invalid_ids' };
  if (!isValidUuid(pid) || !isValidUuid(uid)) return { success: false, reason: 'non_uuid' };

  const res = await togglePostLikeSupabase(uid, pid, { likedBeforeClick: likedBefore });
  if (!res?.success) {
    return { success: false, reason: res?.error || 'server_failed' };
  }
  return {
    success: true,
    isLiked: !!res.isLiked,
    likesCount: typeof res.likesCount === 'number' ? res.likesCount : null,
  };
}

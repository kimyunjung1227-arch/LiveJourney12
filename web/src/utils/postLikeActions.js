import { togglePostLikeSupabase } from '../api/socialSupabase';
import { applyPostLikesCountFromServer, fetchPostLikesCountSupabaseWithRetry } from '../api/postsSupabase';
import { isPostLikedForUser, setLikedPostLocalCache } from './socialInteractions';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/**
 * 좋아요 토글(단일 진실):
 * - Supabase(UUID) 게시물 + UUID 사용자: post_likes에 저장하고 결과를 로컬 캐시에 반영
 * - 그 외(로컬 게시물): 기존 로컬 토글 로직을 사용해야 하므로 여기서는 실패로 반환
 */
export async function toggleLikeForPost({ postId, userId, baseLikesCount = 0 }) {
  const pid = postId != null ? String(postId).trim() : '';
  const uid = userId != null ? String(userId).trim() : '';
  if (!pid || !uid) return { success: false };

  const isUuidMode = isValidUuid(pid) && isValidUuid(uid);
  if (!isUuidMode) return { success: false, reason: 'non_uuid' };

  const likedBefore = isPostLikedForUser(pid, uid);
  const res = await togglePostLikeSupabase(uid, pid, null, { likedBeforeClick: likedBefore, baseLikesCount });
  if (!res || !res.success) {
    return { success: false, reason: res?.error || 'server_failed', error: res?.error || null };
  }

  // 캐시(좋아요 상태) 반영
  if (typeof res.isLiked === 'boolean') {
    setLikedPostLocalCache(pid, res.isLiked);
  }

  // UI 카운트 동기화 이벤트
  if (typeof res.likesCount === 'number') {
    try {
      window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId: pid, likesCount: res.likesCount } }));
    } catch {
      // ignore
    }
    return { success: true, isLiked: !!res.isLiked, likesCount: res.likesCount };
  }

  // likesCount를 못 받았더라도(일시적인 트리거 반영 지연/응답 누락),
  // 서버의 posts.likes_count를 재시도 조회해서 최종 숫자를 맞춘다.
  const fromServer = await fetchPostLikesCountSupabaseWithRetry(pid, { attempts: 5, delayMs: 250 });
  if (typeof fromServer === 'number') {
    applyPostLikesCountFromServer(pid, fromServer);
    return { success: true, isLiked: !!res.isLiked, likesCount: fromServer };
  }

  return { success: true, isLiked: !!res.isLiked, likesCount: null };
}


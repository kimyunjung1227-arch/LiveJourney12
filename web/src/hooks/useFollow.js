import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * 팔로우 토글 훅 (낙관적 업데이트).
 *
 * @param {{ targetUserId: string|null, initialFollowing: boolean }} opts
 */
export function useFollow({ targetUserId, initialFollowing = false } = {}) {
  const { user } = useAuth();
  const meId = user?.id || null;

  const [isFollowing, setIsFollowing] = useState(!!initialFollowing);
  const [pending, setPending] = useState(false);

  // 팔로우 상태는 프로필/게시물이 비동기로 로드된 뒤에야 확정되므로,
  // initialFollowing 값이 실제로 바뀌면(예: false → true) 동기화한다.
  // 사용자가 직접 토글 중(pending)일 때는 낙관적 값을 덮어쓰지 않는다.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    if (!pendingRef.current) setIsFollowing(!!initialFollowing);
  }, [initialFollowing]);

  const toggleFollow = useCallback(async () => {
    if (!meId || !targetUserId || meId === targetUserId || pending) return;

    setPending(true);
    const next = !isFollowing;
    setIsFollowing(next); // 낙관적 업데이트

    try {
      if (next) {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: meId, following_id: targetUserId });
        if (error && !String(error?.message || '').includes('duplicate')) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', meId)
          .eq('following_id', targetUserId);
        if (error) throw error;
      }
    } catch (e) {
      logger.warn('toggleFollow 실패', e?.message || e);
      setIsFollowing(!next); // 롤백
    } finally {
      setPending(false);
    }
  }, [meId, targetUserId, isFollowing, pending]);

  return { isFollowing, pending, toggleFollow, canFollow: !!meId && meId !== targetUserId };
}

import { useCallback, useState } from 'react';
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

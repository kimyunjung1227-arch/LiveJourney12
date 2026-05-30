import { useEffect, useMemo, useState } from 'react';
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { analyzeBadgeActivity } from '../components/profile/badgeData';

/**
 * 실제 활동 기반 뱃지 획득 계산 훅.
 * - 내 게시물(받은 좋아요·카테고리·지역)과 베스트컷 여부로 보유 뱃지를 산출한다.
 * - 미리보기/목업이 아니라 활동이 쌓이면 자동으로 부여된다.
 *
 * @param {object|null} user 프로필 user 객체 (id, is_best_cut_artist 등)
 * @returns {{ earnedKeys: string[], stats: object, loading: boolean }}
 */
export function useEarnedBadges(user) {
  const userId = user?.id || null;
  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await getMergedMyPostsForStats(userId);
        if (!cancelled) setPosts(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const { earnedKeys, stats } = useMemo(
    () => analyzeBadgeActivity(user, posts || []),
    [user, posts]
  );

  return { earnedKeys, stats, loading };
}

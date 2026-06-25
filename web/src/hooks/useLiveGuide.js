import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { computeLiveGuide } from '../utils/liveGuide';

/**
 * 팔로워 수 조회 (follows.following_id = userId 카운트).
 * profileFollowerCount 가 넘어오면 그 값을 우선 쓰고, 없으면 직접 센다.
 */
async function fetchFollowerCount(userId, fallback) {
  if (Number.isFinite(fallback)) return fallback;
  try {
    const { count } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', userId);
    return Number.isFinite(count) ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * 한 사용자의 활동 + 소셜을 읽어 라이브가이드 상태를 계산하는 훅.
 * 저장된 값이 아니라 활동에서 매번 파생하므로, 활동이 끊기면
 * 보장 기간(3개월) 이후 자동으로 등급이 내려가거나 사라진다.
 *
 * @param {string|null} userId
 * @param {{ followerCount?: number }} [opts] 프로필에서 이미 가진 팔로워 수(있으면 재조회 생략)
 */
export function useLiveGuide(userId, opts = {}) {
  const followerHint = Number.isFinite(opts?.followerCount) ? opts.followerCount : NaN;
  const [state, setState] = useState(() => computeLiveGuide({}));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setState(computeLiveGuide({}));
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [posts, followerCount] = await Promise.all([
        getMergedMyPostsForStats(userId).catch(() => []),
        fetchFollowerCount(userId, followerHint),
      ]);
      if (cancelled) return;
      setState(computeLiveGuide({ posts: Array.isArray(posts) ? posts : [], followerCount }));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, followerHint]);

  return { ...state, loading };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

/**
 * 영예 중심 프로필 데이터 훅.
 *
 * - get_profile RPC 로 메인 프로필을 가져오고
 * - profiles.earned_badges 를 직접 조회해서 user 객체에 병합
 *
 * @param {string|null} userId 조회할 사용자 UUID (없으면 비활성)
 * @returns {{ data: object|null, loading: boolean, refresh: () => void }}
 */
export function useProfile(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [profileResp, badgesResp] = await Promise.all([
          supabase.rpc('get_profile', { p_user_id: userId }),
          supabase.from('profiles').select('earned_badges').eq('id', userId).maybeSingle(),
        ]);
        if (cancelled) return;

        if (profileResp.error) {
          logger.warn('get_profile 실패', profileResp.error?.message || profileResp.error);
          setData(null);
          return;
        }

        const result = profileResp.data || null;
        const earnedBadges = Array.isArray(badgesResp?.data?.earned_badges)
          ? badgesResp.data.earned_badges
          : [];

        if (result && result.user) {
          setData({
            ...result,
            user: { ...result.user, earned_badges: earnedBadges },
          });
        } else {
          setData(result);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  return { data, loading, refresh };
}

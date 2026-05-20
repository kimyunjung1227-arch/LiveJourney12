import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

/**
 * 영예 중심 프로필 데이터 훅.
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
        const { data: result, error } = await supabase.rpc('get_profile', {
          p_user_id: userId,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_profile 실패', error?.message || error);
          setData(null);
        } else {
          setData(result || null);
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

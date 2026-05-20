import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * 영예 중심 알림 훅. get_notifications RPC를 호출하고
 * markAllRead / followBack 낙관적 업데이트를 제공한다.
 */
export function useNotifications({ limit = 30 } = {}) {
  const { user } = useAuth();
  const meId = user?.id || null;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!meId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('get_notifications', {
        p_limit: limit,
        p_offset: 0,
      });
      if (error) {
        logger.warn('get_notifications 실패', error?.message || error);
        setNotifications([]);
      } else if (Array.isArray(data)) {
        setNotifications(data);
      } else {
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, [meId, limit]);

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) logger.warn('mark_all_notifications_read 실패', error?.message || error);
  }, []);

  const followBack = useCallback(
    async (userId) => {
      if (!meId || !userId || meId === userId) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.actor?.id === userId && n.type === 'follow'
            ? { ...n, i_follow_back: true }
            : n,
        ),
      );
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: meId, following_id: userId });
      if (error && !String(error?.message || '').includes('duplicate')) {
        logger.warn('followBack 실패', error?.message || error);
      }
    },
    [meId],
  );

  return { notifications, loading, markAllRead, followBack, refetch: fetchNotifications };
}

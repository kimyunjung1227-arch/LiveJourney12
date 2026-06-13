import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

/**
 * 영예 중심 알림 훅. get_notifications RPC를 호출하고
 * flushReadOnExit(화면 이탈 시 모두 읽음) / followBack 낙관적 업데이트를 제공한다.
 */
export function useNotifications({ limit = 30 } = {}) {
  const { user } = useAuth();
  const meId = user?.id || null;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  // 화면을 떠날 때(언마운트) 한 번에 읽음 처리하기 위해 안 읽은 알림 유무를 ref로 추적
  const hasUnreadRef = useRef(false);

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

  // 안 읽은 알림 유무를 최신 상태로 ref에 반영 (언마운트 시점에 사용)
  useEffect(() => {
    hasUnreadRef.current = (notifications || []).some((n) => !n.is_read);
  }, [notifications]);

  // 화면을 떠날 때 호출: 서버에만 모두 읽음 처리(언마운트 중이므로 setState는 하지 않음).
  // 진입 즉시가 아니라 떠날 때 처리하므로, 머무는 동안에는 새 알림이 강조 표시로 남는다.
  const flushReadOnExit = useCallback(async () => {
    if (!hasUnreadRef.current) return;
    hasUnreadRef.current = false;
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

  return { notifications, loading, flushReadOnExit, followBack, refetch: fetchNotifications };
}

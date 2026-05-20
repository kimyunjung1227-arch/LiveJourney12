import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

const DEFAULTS = {
  notify_honor: true,
  notify_question: true,
  notify_activity: true,
};

/**
 * user_settings 행을 불러오고 토글 시 낙관적으로 저장한다.
 * 행이 없으면 기본값으로 upsert.
 */
export function useSettings() {
  const { user } = useAuth();
  const meId = user?.id || null;
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meId) {
      setSettings(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('user_id, notify_honor, notify_question, notify_activity')
          .eq('user_id', meId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          logger.warn('user_settings 조회 실패', error?.message || error);
        }
        if (data) {
          setSettings(data);
        } else {
          // 기본값 upsert
          const seed = { user_id: meId, ...DEFAULTS };
          const { error: insErr } = await supabase
            .from('user_settings')
            .upsert(seed, { onConflict: 'user_id' });
          if (insErr) logger.warn('user_settings 기본값 생성 실패', insErr?.message || insErr);
          if (!cancelled) setSettings(seed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meId]);

  const updateSetting = useCallback(
    async (key, value) => {
      if (!meId) return;
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
      const { error } = await supabase
        .from('user_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('user_id', meId);
      if (error) {
        logger.warn('updateSetting 실패', error?.message || error);
        setSettings((prev) => (prev ? { ...prev, [key]: !value } : prev));
      }
    },
    [meId],
  );

  return { settings, loading, updateSetting };
}

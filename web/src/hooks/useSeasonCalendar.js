import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

export function useSeasonCalendar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.rpc('get_season_calendar');
        if (cancelled) return;
        if (error) {
          logger.warn('get_season_calendar 실패', error?.message || error);
          setData(null);
        } else {
          setData(result || { peak: [], soon: [], upcoming: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

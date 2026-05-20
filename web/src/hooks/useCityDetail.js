import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

export function useCityDetail(cityName, category) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cityName) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_city_detail', {
          p_city: cityName,
          p_category: category || null,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_city_detail 실패', error?.message || error);
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
  }, [cityName, category]);

  return { data, loading };
}

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

export function useCategoryDetail(category, city) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_category_detail', {
          p_category: category,
          p_city: city || null,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_category_detail 실패', error?.message || error);
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
  }, [category, city]);

  return { data, loading };
}

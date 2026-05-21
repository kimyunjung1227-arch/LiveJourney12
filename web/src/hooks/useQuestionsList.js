import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

export function useQuestionsList(category) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_questions_list', {
          p_category: category || null,
          p_limit: 30,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_questions_list 실패', error?.message || error);
          setData({ my_city: null, my_region: [], other_region: [] });
        } else {
          setData(result || { my_city: null, my_region: [], other_region: [] });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  return { data, loading };
}

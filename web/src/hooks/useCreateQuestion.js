import { useCallback, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

export function useCreateQuestion() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const createQuestion = useCallback(async ({ body, place, category }) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: placeId, error: placeErr } = await supabase.rpc('find_or_create_place', {
        p_kakao_id: place.kakao_id || '',
        p_name: place.name,
        p_city: place.city || '',
        p_district: place.district || '',
        p_lat: place.lat ?? null,
        p_lng: place.lng ?? null,
      });
      if (placeErr || !placeId) {
        logger.warn('find_or_create_place 실패', placeErr?.message || placeErr);
        setError('장소 저장에 실패했어요');
        return null;
      }

      const { data, error: qErr } = await supabase.rpc('create_question', {
        p_body: body,
        p_place_id: placeId,
        p_category: category || null,
      });
      if (qErr || !data?.question_id) {
        logger.warn('create_question 실패', qErr?.message || qErr);
        setError('질문 등록에 실패했어요');
        return null;
      }
      return data.question_id;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { createQuestion, submitting, error };
}

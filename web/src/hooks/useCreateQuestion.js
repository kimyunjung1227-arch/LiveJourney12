import { useCallback, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

export function useCreateQuestion() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const createQuestion = useCallback(async ({ body, category }) => {
    setSubmitting(true);
    setError(null);
    try {
      // 장소 없이 제목+내용만으로 질문 생성 (place_id = null)
      const { data, error: qErr } = await supabase.rpc('create_question', {
        p_body: body,
        p_place_id: null,
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

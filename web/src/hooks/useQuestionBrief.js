import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

/**
 * 답변 작성 흐름의 배너에 쓸 질문 간단 조회.
 */
export function useQuestionBrief(questionId) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!questionId) {
      setQuestion(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_question_brief', {
          p_question_id: questionId,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_question_brief 실패', error?.message || error);
          setQuestion(null);
        } else {
          setQuestion(data || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  return { question, loading };
}

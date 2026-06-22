import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconDots,
  IconMapPin,
  IconPhoto,
  IconCrown,
  IconShieldCheck,
  IconHeart,
  IconHeartFilled,
  IconCamera,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { parseQuestionBody } from '../utils/questionText';

// ────────────────────────────────────────────────
// 디자인 토큰
// ────────────────────────────────────────────────
const KEY = '#4DB8E8';
const KEY_LIGHT = '#E8F4FB';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#E8E8E8';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

const CATEGORY_LABEL = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '방금';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

// ────────────────────────────────────────────────
// 데이터 훅
// ────────────────────────────────────────────────
function useQuestionDetail(questionId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!questionId) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const { data: result, error } = await supabase.rpc('get_question_detail', {
        p_question_id: questionId,
      });
      if (error) {
        logger.warn('get_question_detail 실패', error?.message || error);
        setData(null);
      } else {
        setData(result || null);
      }
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const toggleHelpful = useCallback(async (answerId) => {
    // 낙관적 UI 업데이트
    setData((prev) => {
      if (!prev) return prev;
      const answers = (prev.answers || []).map((a) => {
        if (a.answer_id !== answerId) return a;
        const next = !a.i_marked_helpful;
        return {
          ...a,
          i_marked_helpful: next,
          helpful_count: Math.max(0, (a.helpful_count || 0) + (next ? 1 : -1)),
        };
      });
      return { ...prev, answers };
    });

    const { error } = await supabase.rpc('toggle_answer_helpful', {
      p_answer_id: answerId,
    });
    if (error) {
      logger.warn('toggle_answer_helpful 실패', error?.message || error);
      // 실패 시 재조회로 복구
      fetchData();
    }
  }, [fetchData]);

  const setBest = useCallback(async (answerId) => {
    const { error } = await supabase.rpc('set_best_answer', {
      p_question_id: questionId,
      p_answer_id: answerId,
    });
    if (error) {
      logger.warn('set_best_answer 실패', error?.message || error);
    }
    fetchData();
  }, [questionId, fetchData]);

  return { data, loading, toggleHelpful, setBest, refresh: fetchData };
}

// ────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────
function QuestionBody({ question, editing, draft, onDraftChange, onSave, onCancel }) {
  const initial = String(question?.author?.name || '?').trim().charAt(0).toUpperCase() || '·';
  const catLabel = CATEGORY_LABEL[question?.category];
  return (
    <div>
      <div className="flex items-start gap-2.5" style={{ marginBottom: 14 }}>
        <div
          className="rounded-full overflow-hidden text-white font-semibold flex items-center justify-center flex-shrink-0"
          style={{
            width: 38,
            height: 38,
            fontSize: 15,
            background: question?.author?.avatar_color || KEY,
          }}
        >
          {question?.author?.avatar_url ? (
            <img
              src={getDisplayImageUrl(question.author.avatar_url)}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5" style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>
              {question?.author?.name || '익명'}
            </span>
            <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>·</span>
            <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>
              {timeAgo(question?.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {question?.place?.name && (
              <>
                <IconMapPin size={12} color={TEXT_SECONDARY} />
                <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
                  {question.place.name}
                </span>
              </>
            )}
            {catLabel && (
              <span
                style={{
                  background: KEY_LIGHT,
                  color: KEY_DARK,
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 5,
                  fontWeight: 700,
                  marginLeft: 2,
                }}
              >
                {catLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={3}
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              border: `1px solid ${BORDER_LIGHT}`,
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 15,
              lineHeight: 1.6,
              color: TEXT_PRIMARY,
              outline: 'none',
            }}
          />
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={onSave}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: KEY,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${BORDER_LIGHT}`,
                background: '#fff',
                color: TEXT_SECONDARY,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        (() => {
          const { title, content } = parseQuestionBody(question?.body);
          return (
            <div style={{ marginBottom: 16 }}>
              <p
                className="m-0"
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  color: TEXT_PRIMARY,
                }}
              >
                {title}
              </p>
              {content && (
                <p
                  className="m-0"
                  style={{
                    fontSize: 15,
                    fontWeight: 400,
                    lineHeight: 1.6,
                    color: TEXT_SECONDARY,
                    marginTop: 8,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {content}
                </p>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

function QuestionMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (fn) => {
    setOpen(false);
    fn?.();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="더보기"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <IconDots size={20} color={TEXT_SECONDARY} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            minWidth: 120,
            background: '#fff',
            border: `1px solid ${BORDER_LIGHT}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 6,
            zIndex: 20,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(onEdit)}
            className="w-full flex items-center gap-2"
            style={{
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              color: TEXT_PRIMARY,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <IconEdit size={15} stroke={1.8} />
            수정
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(onDelete)}
            className="w-full flex items-center gap-2"
            style={{
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              color: '#D85050',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <IconTrash size={15} stroke={1.8} />
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

function AnswerAuthor({ answer }) {
  const initial = String(answer?.author?.name || '?').trim().charAt(0).toUpperCase() || '·';
  return (
    <div className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
      <div
        className="rounded-full overflow-hidden text-white font-semibold flex items-center justify-center flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          fontSize: 12,
          background: answer?.author?.avatar_color || KEY,
        }}
      >
        {answer?.author?.avatar_url ? (
          <img
            src={getDisplayImageUrl(answer.author.avatar_url)}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
            {answer?.author?.name || '익명'}
          </span>
          {answer?.is_author_on_site && (
            <div
              className="flex items-center gap-0.5"
              style={{
                background: KEY_LIGHT,
                padding: '2px 6px',
                borderRadius: 5,
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  background: KEY,
                  borderRadius: 999,
                }}
              />
              <span style={{ fontSize: 9, color: KEY_DARK, fontWeight: 700 }}>
                지금 현장
              </span>
            </div>
          )}
        </div>
        <p className="m-0" style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 2 }}>
          도움 {answer?.author?.helped_count || 0}명
        </p>
      </div>
    </div>
  );
}

function AnswerCard({ answer, questionAuthorName, isMyQuestion, onToggleHelpful, onSetBest }) {
  const navigate = useNavigate();
  const photoUrl = answer?.post?.photo_url ? getDisplayImageUrl(answer.post.photo_url) : '';

  if (answer.is_best) {
    return (
      <div
        className="overflow-hidden"
        style={{
          borderRadius: 14,
          marginBottom: 14,
          border: '2px solid transparent',
          background:
            'linear-gradient(white, white) padding-box, linear-gradient(135deg, #4DB8E8, #1A6EA8) border-box',
        }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: '7px 14px',
            background: GRADIENT,
          }}
        >
          <IconCrown size={13} color="white" />
          <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>
            베스트 답변
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
            · {questionAuthorName}님이 선정
          </span>
        </div>

        <div className="relative" style={{ height: 200, background: SURFACE }}>
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          <div
            className="absolute flex items-center gap-1.5"
            style={{
              top: 10,
              left: 10,
              background: 'rgba(0,0,0,0.7)',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            <IconShieldCheck size={11} color={KEY} />
            <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
              {timeAgo(answer.post.exif_taken_at)}
            </span>
          </div>
        </div>

        <div style={{ padding: '12px 14px' }}>
          <AnswerAuthor answer={answer} />
          {answer.post.body && (
            <p
              className="m-0"
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: TEXT_PRIMARY,
                marginBottom: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {answer.post.body}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onToggleHelpful(answer.answer_id)}
              className="flex items-center gap-1.5"
              style={{
                padding: '7px 12px',
                borderRadius: 9,
                background: GRADIENT,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <IconHeartFilled size={13} color="white" />
              <span style={{ fontSize: 11, color: 'white', fontWeight: 700 }}>
                도움됐어요 {answer.helpful_count || 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/post/${encodeURIComponent(answer.post.id)}`)}
              style={{
                padding: '7px 12px',
                borderRadius: 9,
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontWeight: 500,
                background: 'white',
                border: `1px solid ${BORDER_LIGHT}`,
                cursor: 'pointer',
              }}
            >
              게시물 보기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 일반 답변
  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: 14,
        marginBottom: 14,
        border: `1px solid ${BORDER_LIGHT}`,
      }}
    >
      <div className="relative" style={{ height: 180, background: SURFACE }}>
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <div
          className="absolute flex items-center gap-1.5"
          style={{
            top: 10,
            left: 10,
            background: 'rgba(0,0,0,0.7)',
            padding: '4px 10px',
            borderRadius: 6,
          }}
        >
          <IconShieldCheck size={11} color={KEY} />
          <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
            {timeAgo(answer.post.exif_taken_at)}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <AnswerAuthor answer={answer} />
        {answer.post.body && (
          <p
            className="m-0"
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: TEXT_PRIMARY,
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {answer.post.body}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onToggleHelpful(answer.answer_id)}
            className="flex items-center gap-1.5"
            style={
              answer.i_marked_helpful
                ? {
                    padding: '7px 12px',
                    borderRadius: 9,
                    background: KEY_LIGHT,
                    border: 'none',
                    cursor: 'pointer',
                  }
                : {
                    padding: '7px 12px',
                    borderRadius: 9,
                    background: 'white',
                    border: `1px solid ${BORDER_LIGHT}`,
                    cursor: 'pointer',
                  }
            }
          >
            {answer.i_marked_helpful ? (
              <IconHeartFilled size={13} color={KEY} />
            ) : (
              <IconHeart size={13} color={TEXT_SECONDARY} />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: answer.i_marked_helpful ? KEY_DARK : TEXT_SECONDARY,
              }}
            >
              {answer.helpful_count > 0
                ? `도움됐어요 ${answer.helpful_count}`
                : '도움됐어요'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/post/${encodeURIComponent(answer.post.id)}`)}
            style={{
              padding: '7px 12px',
              borderRadius: 9,
              fontSize: 11,
              color: TEXT_SECONDARY,
              fontWeight: 500,
              background: 'white',
              border: `1px solid ${BORDER_LIGHT}`,
              cursor: 'pointer',
            }}
          >
            게시물 보기
          </button>

          {isMyQuestion && (
            <button
              type="button"
              onClick={() => onSetBest(answer.answer_id)}
              className="flex items-center gap-1"
              style={{
                padding: '7px 12px',
                borderRadius: 9,
                fontSize: 11,
                fontWeight: 600,
                color: KEY_DARK,
                background: 'white',
                border: `1px solid ${KEY}`,
                cursor: 'pointer',
              }}
            >
              <IconCrown size={12} color={KEY} />
              베스트로 선정
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyAnswers() {
  return (
    <div className="text-center" style={{ padding: '40px 0' }}>
      <div
        className="flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: SURFACE,
          margin: '0 auto 16px',
        }}
      >
        <IconCamera size={28} color={TEXT_TERTIARY} />
      </div>
      <p className="m-0" style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 6 }}>
        아직 답변이 없어요
      </p>
      <p className="m-0" style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
        이 장소에 계신가요?
        <br />첫 답변을 남겨 도움을 주세요.
      </p>
    </div>
  );
}

function AnswerButton({ onAnswer }) {
  return (
    <div
      className="sticky bg-white"
      style={{
        bottom: 0,
        padding: '12px 18px',
        borderTop: '1px solid #F0F0F0',
      }}
    >
      <button
        type="button"
        onClick={onAnswer}
        className="w-full flex items-center justify-center gap-2"
        style={{
          background: KEY,
          color: 'white',
          padding: '14px 0',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <IconCamera size={18} />
        사진으로 답변하기
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────
// QuestionDetailScreen
// ────────────────────────────────────────────────
const QuestionDetailScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, toggleHelpful, setBest, refresh } = useQuestionDetail(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const isMine = !!data?.question?.is_my_question;

  const startEdit = () => {
    setDraft(data?.question?.body || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    const body = draft.trim();
    if (!body || body === data?.question?.body) {
      setEditing(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('questions')
        .update({ body })
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      setEditing(false);
      refresh();
    } catch (e) {
      logger.warn('질문 수정 실패', e?.message || e);
      alert('질문 수정에 실패했어요. 다시 시도해주세요.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('이 질문을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
      navigate(-1);
    } catch (e) {
      logger.warn('질문 삭제 실패', e?.message || e);
      alert('질문 삭제에 실패했어요. 다시 시도해주세요.');
    }
  };

  if (loading) {
    return (
      <div
        style={{ background: '#ffffff', minHeight: '100vh' }}
        className="p-[18px] text-center"
      >
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>로딩 중...</span>
      </div>
    );
  }

  if (!data || !data.question) {
    return (
      <div
        style={{ background: '#ffffff', minHeight: '100vh' }}
        className="p-[18px] text-center"
      >
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          질문 정보를 불러오지 못했어요
        </span>
      </div>
    );
  }

  const { question } = data;
  const answers = Array.isArray(data.answers) ? data.answers : [];
  const hasAnswers = answers.length > 0;
  const placeName = question?.place?.name || '근처';

  const handleAnswer = () => {
    navigate(`/camera?answerTo=${encodeURIComponent(question.id)}`);
  };

  return (
    <div
      style={{
        background: '#ffffff',
        minHeight: '100vh',
        color: TEXT_PRIMARY,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 — 질문 제목을 가운데 정렬 */}
      <div
        className="relative flex items-center justify-between"
        style={{ padding: '16px 18px', borderBottom: '1px solid #F0F0F0' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color={TEXT_PRIMARY} />
        </button>
        <span
          className="absolute left-1/2 -translate-x-1/2"
          style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}
        >
          질문
        </span>
        {isMine ? (
          <QuestionMenu onEdit={startEdit} onDelete={handleDelete} />
        ) : (
          <span style={{ width: 20 }} />
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 p-[18px]" style={{ overflowY: 'auto' }}>
        <QuestionBody
          question={question}
          editing={editing}
          draft={draft}
          onDraftChange={setDraft}
          onSave={saveEdit}
          onCancel={() => setEditing(false)}
        />
        {hasAnswers ? (
          <>
            <div className="flex items-center gap-1.5" style={{ marginBottom: 14 }}>
              <IconPhoto size={16} color={KEY} />
              <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
                답변 {answers.length}장
              </p>
            </div>
            {answers.map((answer) => (
              <AnswerCard
                key={answer.answer_id}
                answer={answer}
                questionAuthorName={question?.author?.name || '질문자'}
                isMyQuestion={!!question?.is_my_question}
                onToggleHelpful={toggleHelpful}
                onSetBest={setBest}
              />
            ))}
          </>
        ) : (
          <EmptyAnswers />
        )}
      </div>

      <AnswerButton onAnswer={handleAnswer} />
    </div>
  );
};

export default QuestionDetailScreen;

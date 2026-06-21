import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconHelpCircle,
  IconX,
} from '@tabler/icons-react';
import { useCreateQuestion } from '../hooks/useCreateQuestion';
import { useAuth } from '../contexts/AuthContext';
import { buildQuestionBody } from '../utils/questionText';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';

const DRAFT_KEY = 'ask-question-draft';

function readDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(d) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const AskQuestionScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createQuestion, submitting, error } = useCreateQuestion();

  const initialDraft = readDraft();

  const [title, setTitle] = useState(initialDraft?.title || '');
  const [content, setContent] = useState(initialDraft?.content || '');

  // title/content 바뀔 때마다 draft 저장
  useEffect(() => {
    if (title || content) {
      saveDraft({ title, content });
    }
  }, [title, content]);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user) {
      navigate('/start', { state: { redirect: '/question/new' } });
      return;
    }
    const id = await createQuestion({
      body: buildQuestionBody(title, content),
      category: null,
    });
    if (id) {
      clearDraft();
      navigate(`/question/${encodeURIComponent(id)}`, { replace: true });
    }
  };

  const handleClose = () => {
    clearDraft();
    navigate(-1);
  };

  return (
    <div
      style={{ background: '#ffffff', minHeight: '100vh', color: TEXT_PRIMARY }}
      className="flex flex-col"
    >
      {/* 헤더 */}
      <div
        className="flex items-center gap-3"
        style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F0F0' }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
        >
          <IconX size={22} color={TEXT_PRIMARY} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>질문하기</span>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 18 }}>
        {/* 제목 (필수) — 먼저 입력 */}
        <div className="flex items-center gap-1" style={{ marginBottom: 8 }}>
          <p className="m-0" style={{ fontSize: 12, fontWeight: 600 }}>제목</p>
          <span style={{ fontSize: 11, color: KEY, fontWeight: 600 }}>필수</span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 60))}
          placeholder="예: 제주도 날씨 어때요?"
          className="w-full outline-none"
          style={{
            background: SURFACE,
            borderRadius: 11,
            padding: '13px 14px',
            fontSize: 15,
            fontWeight: 600,
            border: '1px solid transparent',
            color: TEXT_PRIMARY,
            boxSizing: 'border-box',
          }}
        />
        <div className="flex justify-end" style={{ marginTop: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>{title.length} / 60</span>
        </div>

        {/* 내용 (선택) — 제목 아래 */}
        <div className="flex items-center gap-1" style={{ marginBottom: 8 }}>
          <p className="m-0" style={{ fontSize: 12, fontWeight: 600 }}>내용</p>
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>선택</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, 300))}
          placeholder="궁금한 점을 더 자세히 적어주세요 (예: 오후에 우도 가려는데 바람 많이 부나요?)"
          className="w-full outline-none resize-none"
          style={{
            background: SURFACE,
            borderRadius: 11,
            padding: '14px 14px',
            fontSize: 14,
            lineHeight: 1.55,
            minHeight: 110,
            border: '1px solid transparent',
            color: TEXT_PRIMARY,
          }}
        />
        <div className="flex justify-end" style={{ marginTop: 6 }}>
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>{content.length} / 300</span>
        </div>

        {error && (
          <p
            className="m-0"
            style={{ fontSize: 11, color: '#D14343', marginTop: 14 }}
          >
            {error}
          </p>
        )}
      </div>

      {/* 고정 하단 */}
      <div style={{ padding: '12px 18px 14px', borderTop: '1px solid #F0F0F0' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2"
          style={{
            background: canSubmit ? KEY : '#A8D6EC',
            color: 'white',
            padding: '13px 16px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          <IconHelpCircle size={18} />
          {submitting ? '올리는 중...' : '질문 올리기'}
        </button>
      </div>
    </div>
  );
};

export default AskQuestionScreen;

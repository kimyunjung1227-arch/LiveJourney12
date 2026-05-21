import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconBolt,
  IconHelpCircle,
  IconMapPin,
  IconX,
} from '@tabler/icons-react';
import CategoryChips from '../components/question/CategoryChips';
import { useCreateQuestion } from '../hooks/useCreateQuestion';
import { useAuth } from '../contexts/AuthContext';

const KEY = '#4DB8E8';
const KEY_LIGHT = '#E8F4FB';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
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
  const location = useLocation();
  const { user } = useAuth();
  const { createQuestion, submitting, error } = useCreateQuestion();

  const initialDraft = readDraft();
  const incomingPlace = location.state?.selectedPlace || null;

  const [body, setBody] = useState(initialDraft?.body || '');
  const [place, setPlace] = useState(incomingPlace || initialDraft?.place || null);
  const [category, setCategory] = useState(initialDraft?.category || 'all');

  // 장소가 새로 들어오면 한 번만 반영 (history.replace로 state 비움)
  useEffect(() => {
    if (incomingPlace) {
      setPlace(incomingPlace);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingPlace]);

  // body/place/category 바뀔 때마다 draft 저장 (장소 검색 화면 다녀와도 유지)
  useEffect(() => {
    if (body || place || category !== 'all') {
      saveDraft({ body, place, category });
    }
  }, [body, place, category]);

  const canSubmit = body.trim().length > 0 && place !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user) {
      navigate('/start', { state: { redirect: '/question/new' } });
      return;
    }
    const id = await createQuestion({
      body: body.trim(),
      place,
      category: category === 'all' ? null : category,
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
        {/* 자동 매칭 안내 */}
        <div
          className="flex items-start gap-2"
          style={{
            background: KEY_LIGHT,
            borderRadius: 11,
            padding: '12px 14px',
            marginBottom: 20,
          }}
        >
          <IconBolt size={17} color={KEY} className="flex-shrink-0" style={{ marginTop: 1 }} />
          <p className="m-0" style={{ fontSize: 11, color: KEY_DARK, lineHeight: 1.55 }}>
            장소 근처에 계신 분들께 알림이 가요. 사진으로 빠른 답변을 받을 수 있어요.
          </p>
        </div>

        {/* 본문 입력 */}
        <p
          className="m-0"
          style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}
        >
          무엇이 궁금한가요?
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 200))}
          placeholder="여의도 벚꽃 지금 어떤가요? 윤중로 가려는데..."
          className="w-full outline-none resize-none"
          style={{
            background: SURFACE,
            borderRadius: 11,
            padding: '14px 14px',
            fontSize: 14,
            lineHeight: 1.55,
            minHeight: 90,
            border: '1px solid transparent',
            color: TEXT_PRIMARY,
          }}
        />
        <div className="flex justify-end" style={{ marginTop: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>{body.length} / 200</span>
        </div>

        {/* 장소 (필수) */}
        <div className="flex items-center gap-1" style={{ marginBottom: 8 }}>
          <p className="m-0" style={{ fontSize: 12, fontWeight: 600 }}>장소</p>
          <span style={{ fontSize: 11, color: KEY, fontWeight: 600 }}>필수</span>
        </div>
        {place ? (
          <div
            className="flex items-center gap-2.5"
            style={{
              background: KEY_LIGHT,
              border: `1.5px solid ${KEY}`,
              borderRadius: 11,
              padding: '12px 14px',
              marginBottom: 20,
            }}
          >
            <IconMapPin size={18} color={KEY} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p
                className="m-0 truncate"
                style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}
              >
                {place.name}
              </p>
              <p
                className="m-0 truncate"
                style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 1 }}
              >
                {[place.city, place.district].filter(Boolean).join(' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlace(null)}
              aria-label="장소 제거"
              style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
            >
              <IconX size={16} color={TEXT_SECONDARY} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/question/new/place')}
            className="flex items-center gap-2.5 w-full text-left"
            style={{
              background: SURFACE,
              borderRadius: 11,
              padding: '12px 14px',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 20,
            }}
          >
            <IconMapPin size={18} color={TEXT_TERTIARY} />
            <span style={{ fontSize: 13, color: TEXT_TERTIARY }}>장소를 선택하세요</span>
          </button>
        )}

        {/* 카테고리 (선택) */}
        <div className="flex items-center gap-1" style={{ marginBottom: 8 }}>
          <p className="m-0" style={{ fontSize: 12, fontWeight: 600 }}>카테고리</p>
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>선택</span>
        </div>
        <CategoryChips selected={category} onChange={setCategory} />

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

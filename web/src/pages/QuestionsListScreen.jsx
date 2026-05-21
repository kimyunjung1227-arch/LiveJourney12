import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconClock,
  IconHelpCircle,
  IconMapPin,
  IconPencilPlus,
  IconPhoto,
} from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import BottomNavigation from '../components/BottomNavigation';

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

const PAGE_SIZE = 30;

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'waiting', label: '답변 대기' },
  { id: 'answered', label: '답변 완료' },
];

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
function useQuestionsList(filter) {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const nextOffset = reset ? 0 : offsetRef.current;
        const { data, error } = await supabase.rpc('get_questions_list', {
          p_filter: filter,
          p_limit: PAGE_SIZE,
          p_offset: nextOffset,
        });
        if (error) {
          logger.warn('get_questions_list 실패', error?.message || error);
          if (reset) {
            setItems([]);
            setCounts(null);
          }
          setHasMore(false);
          return;
        }
        const arr = Array.isArray(data?.items) ? data.items : [];
        offsetRef.current = nextOffset + arr.length;
        setItems((prev) => (reset ? arr : [...prev, ...arr]));
        if (data?.counts) setCounts(data.counts);
        setHasMore(arr.length >= PAGE_SIZE);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    offsetRef.current = 0;
    setHasMore(true);
    void loadPage({ reset: true });
  }, [filter, loadPage]);

  return { items, counts, loading, hasMore, loadMore: () => loadPage({ reset: false }) };
}

// ────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────
function Header() {
  const navigate = useNavigate();
  return (
    <div
      className="flex items-center gap-2 px-4 sticky top-0 z-20 bg-white"
      style={{ paddingTop: 14, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로가기"
        style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
      >
        <IconArrowLeft size={22} color={TEXT_PRIMARY} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="m-0" style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}>
          실시간 질문
        </p>
        <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 1 }}>
          지금 답이 필요한 질문들
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/chat/write')}
        aria-label="질문 작성"
        className="flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: KEY,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <IconPencilPlus size={18} color="white" />
      </button>
    </div>
  );
}

function CountSummary({ counts }) {
  if (!counts) return null;
  return (
    <div
      className="flex items-center"
      style={{
        margin: '14px 18px 0',
        padding: '14px 16px',
        borderRadius: 12,
        background: KEY_LIGHT,
      }}
    >
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 18, fontWeight: 700, color: KEY_DARK }}>
          {counts.total || 0}
        </p>
        <span style={{ fontSize: 10, color: '#4A7DA8' }}>전체</span>
      </div>
      <div style={{ width: 1, height: 28, background: 'rgba(77, 184, 232, 0.3)' }} />
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 18, fontWeight: 700, color: KEY_DARK }}>
          {counts.waiting || 0}
        </p>
        <span style={{ fontSize: 10, color: '#4A7DA8' }}>답변 대기</span>
      </div>
      <div style={{ width: 1, height: 28, background: 'rgba(77, 184, 232, 0.3)' }} />
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 18, fontWeight: 700, color: KEY_DARK }}>
          {counts.answered || 0}
        </p>
        <span style={{ fontSize: 10, color: '#4A7DA8' }}>답변 완료</span>
      </div>
    </div>
  );
}

function FilterChips({ value, onChange }) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
      style={{
        margin: '16px 0 14px',
        padding: '0 18px',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {FILTERS.map((f) => {
        const active = f.id === value;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className="flex-shrink-0"
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: active ? KEY : 'white',
              color: active ? 'white' : TEXT_PRIMARY,
              border: active ? `1px solid ${KEY}` : `1px solid ${BORDER_LIGHT}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function QuestionCard({ question }) {
  const navigate = useNavigate();
  const initial = String(question?.author?.name || '?').trim().charAt(0).toUpperCase() || '·';
  const catLabel = CATEGORY_LABEL[question?.category];
  const answered = !!question?.is_answered;
  const answerCount = question?.answer_count || 0;

  return (
    <button
      type="button"
      onClick={() => navigate(`/question/${encodeURIComponent(question.id)}`)}
      className="text-left w-full"
      style={{
        background: 'white',
        borderRadius: 12,
        padding: '14px 16px',
        border: `1px solid ${BORDER_LIGHT}`,
        cursor: 'pointer',
      }}
    >
      <div className="flex items-start gap-2.5" style={{ marginBottom: 10 }}>
        <div
          className="rounded-full text-white font-semibold flex items-center justify-center flex-shrink-0"
          style={{
            width: 30,
            height: 30,
            fontSize: 12,
            background: question?.author?.avatar_color || KEY,
          }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>
              {question?.author?.name || '익명'}
            </span>
            <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>·</span>
            <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>
              {timeAgo(question?.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 2 }}>
            {question?.place?.name && (
              <span className="inline-flex items-center gap-0.5" style={{ fontSize: 10, color: TEXT_SECONDARY }}>
                <IconMapPin size={10} color={TEXT_SECONDARY} />
                {question.place.name}
              </span>
            )}
            {catLabel && (
              <span
                style={{
                  background: KEY_LIGHT,
                  color: KEY_DARK,
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 5,
                  fontWeight: 700,
                }}
              >
                {catLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <p
        className="m-0"
        style={{
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.55,
          color: TEXT_PRIMARY,
          marginBottom: 12,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {question?.body}
      </p>

      <div className="flex items-center justify-between">
        {answered ? (
          <div
            className="flex items-center gap-1 px-2 py-0.5"
            style={{ background: KEY_LIGHT, borderRadius: 7 }}
          >
            <IconPhoto size={11} color={KEY} />
            <span style={{ fontSize: 10, fontWeight: 700, color: KEY_DARK }}>
              {answerCount}장 답변
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-2 py-0.5"
            style={{ background: SURFACE, borderRadius: 7 }}
          >
            <IconClock size={11} color={TEXT_SECONDARY} />
            <span style={{ fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY }}>
              답변 기다림
            </span>
          </div>
        )}
        <span style={{ fontSize: 10, color: KEY, fontWeight: 600 }}>
          답변하러 가기 →
        </span>
      </div>
    </button>
  );
}

function EmptyState({ filter }) {
  const label =
    filter === 'waiting'
      ? '답변 대기 중인 질문이 없어요'
      : filter === 'answered'
        ? '답변이 완료된 질문이 없어요'
        : '아직 올라온 질문이 없어요';
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        margin: '20px 18px',
        padding: '40px 20px',
        borderRadius: 14,
        background: SURFACE,
        border: `1px dashed ${BORDER_LIGHT}`,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          background: 'white',
          marginBottom: 12,
        }}
      >
        <IconHelpCircle size={26} color={TEXT_TERTIARY} />
      </div>
      <p className="m-0" style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 4 }}>
        {label}
      </p>
      <p className="m-0" style={{ fontSize: 11, color: TEXT_TERTIARY }}>
        지금 현장에 있다면, 한 장이 가장 큰 답이에요
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────
// QuestionsListScreen
// ────────────────────────────────────────────────
const QuestionsListScreen = () => {
  const [filter, setFilter] = useState('all');
  const { items, counts, loading, hasMore, loadMore } = useQuestionsList(filter);
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current) return undefined;
    if (ioRef.current) ioRef.current.disconnect();
    ioRef.current = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (loading || !hasMore) return;
        void loadMore();
      },
      { root: null, rootMargin: '240px', threshold: 0 },
    );
    ioRef.current.observe(sentinelRef.current);
    return () => {
      try {
        ioRef.current?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [hasMore, loading, loadMore]);

  const isEmpty = !loading && items.length === 0;

  const filterCount = useMemo(() => {
    if (!counts) return null;
    if (filter === 'waiting') return counts.waiting;
    if (filter === 'answered') return counts.answered;
    return counts.total;
  }, [counts, filter]);

  return (
    <div
      style={{
        background: '#ffffff',
        minHeight: '100vh',
        color: TEXT_PRIMARY,
        paddingBottom: 96,
      }}
    >
      <Header />
      <CountSummary counts={counts} />
      <FilterChips value={filter} onChange={setFilter} />

      <div style={{ padding: '0 18px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-1.5">
            <IconHelpCircle size={16} color={KEY} />
            <p className="m-0" style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>
              {FILTERS.find((f) => f.id === filter)?.label}
            </p>
            {Number.isFinite(filterCount) && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: KEY_DARK,
                  background: KEY_LIGHT,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {filterCount}
              </span>
            )}
          </div>
        </div>

        {isEmpty ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {items.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
            {loading && (
              <div className="text-center" style={{ padding: '14px 0', fontSize: 12, color: TEXT_SECONDARY }}>
                불러오는 중...
              </div>
            )}
            {!hasMore && items.length > 0 && (
              <div className="text-center" style={{ padding: '14px 0', fontSize: 11, color: TEXT_TERTIARY }}>
                마지막 질문이에요
              </div>
            )}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default QuestionsListScreen;

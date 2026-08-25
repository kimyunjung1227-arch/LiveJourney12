import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconSearch,
  IconX,
  IconChevronRight,
  IconCalendarTime,
  IconHelpCircle,
  IconBuildingSkyscraper,
  IconUserStar,
  IconCategory,
  IconMapPin,
  IconPhoto,
  IconClock,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPublishedMagazines } from '../api/curatedMagazinesSupabase';
import { logger } from '../utils/logger';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../utils/recentSearches';
import { getWeatherByRegion } from '../api/weather';
import { useAuth } from '../contexts/AuthContext';
import { useFollow } from '../hooks/useFollow';
import BottomNavigation from '../components/BottomNavigation';
import WeatherIcon from '../components/WeatherIcon';

// 인기 도시 대표 사진은 30분 단위 시간 버킷으로 순환 노출한다.
const HALF_HOUR_MS = 30 * 60 * 1000;

// 30분마다 값이 바뀌는 버킷 인덱스 — 지역별 사진 풀을 순환시키는 데 사용.
function useHalfHourBucket() {
  const [bucket, setBucket] = useState(() => Math.floor(Date.now() / HALF_HOUR_MS));
  useEffect(() => {
    const id = setInterval(() => {
      setBucket(Math.floor(Date.now() / HALF_HOUR_MS));
    }, 60 * 1000); // 매 분 확인 → 버킷이 바뀔 때만 리렌더(같은 값이면 React가 무시)
    return () => clearInterval(id);
  }, []);
  return bucket;
}

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
// 검색화면 각 섹션 카드 공통 배경 — 흰색 + 얇은 경계선으로 통일
const CARD_BG = '#ffffff';

const CATEGORY_META = {
  nature: { Icon: IconFlower, label: '개화·자연' },
  weather: { Icon: IconCloud, label: '날씨·체감' },
  event: { Icon: IconCalendarEvent, label: '이벤트·축제' },
  crowd: { Icon: IconUsers, label: '혼잡도·대기' },
  sunset: { Icon: IconMoon, label: '노을·야경' },
  business: { Icon: IconBuildingStore, label: '영업·운영' },
};

// 행정구역 풀네임("경북 구미시 봉곡동", "구미시 봉곡동")을 인기 도시용 '시' 단위 이름("구미")으로 정규화.
// - 앞의 도(경북/경상북도 등) 접두는 버리고, '시'로 끝나는 토큰을 도시명으로 사용
// - 광역/특별시는 접미사를 떼고(서울특별시→서울), 시가 없으면 군/구 단위로 폴백
const PROVINCE_TOKENS = new Set([
  '경기', '경기도', '강원', '강원도', '강원특별자치도',
  '충북', '충청북도', '충남', '충청남도',
  '전북', '전라북도', '전북특별자치도', '전남', '전라남도',
  '경북', '경상북도', '경남', '경상남도',
  '제주', '제주도', '제주특별자치도',
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
]);

function normalizeCityName(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const tokens = s.split(/\s+/).filter(Boolean);
  // 1) '시'로 끝나는 토큰 → 시 단위 도시명
  for (const t of tokens) {
    if (t.endsWith('시')) {
      const c = t.replace(/(특별자치시|특별시|광역시)$/, '').replace(/시$/, '');
      if (c) return c;
    }
  }
  // 2) '시'가 없으면 도 접두를 건너뛴 첫 토큰을 군/구 단위로
  for (const t of tokens) {
    if (PROVINCE_TOKENS.has(t)) continue;
    const c = t.replace(/(군|구)$/, '');
    if (c) return c;
  }
  return tokens[tokens.length - 1] || s;
}

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
// 훅
// ────────────────────────────────────────────────
function useSearchHub() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.rpc('get_search_hub');
        if (cancelled) return;
        if (error) {
          logger.warn('get_search_hub 실패', error?.message || error);
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
  }, []);

  return { data, loading };
}

// 여행자 탭 데이터 — 추천/인기 두 구역을 한 번에 받는다.
// 로그인 상태가 바뀌면 is_following(팔로우 여부)이 달라지므로 다시 불러온다.
function useTravelerHub() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_traveler_hub', { p_limit: 12 });
        if (cancelled) return;
        if (error) {
          logger.warn('get_traveler_hub 실패', error?.message || error);
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
  }, [user?.id]);

  return { data, loading };
}

function useSearch(query) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = String(query || '').trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_all', { p_query: q });
        if (cancelled) return;
        if (error) {
          logger.warn('search_all 실패', error?.message || error);
          setResults(null);
        } else {
          setResults(data || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading };
}

// 최근 검색어 — 검색은 입력 즉시 실행되므로 제출 시점이 따로 없다.
// 타이핑이 멈추고 잠시(RECORD_DELAY) 지난 뒤에야 "검색을 마쳤다"고 보고 기록한다.
const RECORD_DELAY_MS = 1200;

function useRecentSearches(query) {
  const [items, setItems] = useState(() => getRecentSearches());

  useEffect(() => {
    const q = String(query || '').trim();
    if (!q) return undefined;
    const timer = setTimeout(() => setItems(addRecentSearch(q)), RECORD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const remove = useCallback((term) => setItems(removeRecentSearch(term)), []);
  const clear = useCallback(() => setItems(clearRecentSearches()), []);
  // 엔터로 검색을 확정했을 때는 기다리지 않고 바로 기록
  const record = useCallback((term) => setItems(addRecentSearch(term)), []);

  return { items, remove, clear, record };
}

// ────────────────────────────────────────────────
// 공통 컴포넌트
// ────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-1.5">
        <Icon size={16} color={KEY} />
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          {title}
        </p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="flex items-center gap-0.5"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 11,
            color: TEXT_SECONDARY,
            fontWeight: 500,
          }}
        >
          {action.label}
          <IconChevronRight size={12} color={TEXT_SECONDARY} />
        </button>
      )}
    </div>
  );
}

function SearchHeader({ query, onChange, onClear, onSubmit }) {
  const navigate = useNavigate();
  const isActive = query.length > 0;

  return (
    <div
      className="flex items-center gap-2.5 px-4 pt-3.5 pb-3 sticky top-0 z-20 bg-white"
      style={{ borderBottom: '1px solid #F0F0F0' }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로가기"
        className="flex-shrink-0"
        style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
      >
        <IconArrowLeft size={18} color={TEXT_PRIMARY} />
      </button>

      <div
        className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5"
        style={{
          background: isActive ? KEY_LIGHT : SURFACE,
          border: isActive ? `1.5px solid ${KEY}` : '1.5px solid transparent',
          borderRadius: 11,
          transition: 'all 0.15s',
        }}
      >
        <IconSearch size={17} color={isActive ? KEY : TEXT_SECONDARY} />
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // 엔터로 검색을 확정하면 최근 검색어에 바로 남기고 키보드를 내린다
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit && onSubmit(query);
              e.currentTarget.blur();
            }
          }}
          placeholder="지금 어디 갈까?"
          autoFocus
          className="flex-1 bg-transparent outline-none"
          style={{
            fontSize: 13,
            color: TEXT_PRIMARY,
            fontWeight: 600,
            border: 'none',
            padding: 0,
          }}
        />
        {isActive && (
          <button
            type="button"
            onClick={onClear}
            aria-label="검색어 지우기"
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <IconX size={16} color={TEXT_SECONDARY} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 최근 검색어 — 가로 한 줄, 넘치면 옆으로 스크롤(줄바꿈 없음).
 * 각 검색어는 둥근 알약형 배경 칩이고, 칩 안의 ×로 하나씩 지운다.
 */
function RecentSearches({ items, onPick, onRemove, onClear }) {
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-[22px]">
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div className="flex items-center gap-1.5">
          <IconClock size={14} color={KEY} />
          <p className="m-0" style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>
            최근 검색
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            minHeight: 0,
            cursor: 'pointer',
            fontSize: 11,
            color: TEXT_TERTIARY,
            fontWeight: 500,
          }}
        >
          전체 삭제
        </button>
      </div>

      <div
        onMouseDown={handleDragStart}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}
      >
        {items.map((term) => (
          <div
            key={term}
            className="flex items-center flex-shrink-0"
            style={{
              gap: 5,
              height: 30,
              padding: '0 10px 0 12px',
              // 알약형(양끝 완전한 원) 배경
              borderRadius: 999,
              background: SURFACE,
              border: `1px solid ${BORDER_LIGHT}`,
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                // 드래그로 스크롤한 경우엔 클릭으로 치지 않는다
                if (hasMovedRef.current) {
                  e.preventDefault();
                  return;
                }
                onPick(term);
              }}
              className="whitespace-nowrap"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                minHeight: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                color: TEXT_PRIMARY,
              }}
            >
              {term}
            </button>
            <button
              type="button"
              onClick={() => onRemove(term)}
              aria-label={`${term} 최근 검색에서 삭제`}
              className="flex items-center justify-center flex-shrink-0"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                minWidth: 0,
                minHeight: 0,
                width: 14,
                height: 14,
                cursor: 'pointer',
              }}
            >
              <IconX size={12} color={TEXT_TERTIARY} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// 탐색 허브 섹션
// ────────────────────────────────────────────────
function SeasonalCards({ cards }) {
  const navigate = useNavigate();
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
  const isEmpty = !cards || cards.length === 0;

  const guardedClick = (handler) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler();
  };

  if (isEmpty) {
    return (
      <div className="mb-[22px]">
        <SectionHeader icon={IconCalendarTime} title="매거진" />
        <div
          className="flex items-center justify-center"
          style={{
            height: 130,
            borderRadius: 11,
            background: CARD_BG,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            아직 발행된 매거진이 없어요
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[22px]">
      <SectionHeader icon={IconCalendarTime} title="매거진" />
      <div
        onMouseDown={handleDragStart}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card) => {
          const cover = card.cover_image_url
            ? getDisplayImageUrl(card.cover_image_url)
            : '';
          return (
            <button
              key={card.id}
              type="button"
              onClick={guardedClick(() =>
                navigate(`/live-magazine/${encodeURIComponent(card.id)}`),
              )}
              className="flex-shrink-0"
              style={{
                width: 168,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <div
                className="relative overflow-hidden"
                style={{
                  height: 130,
                  borderRadius: 12,
                  backgroundImage: cover ? `url(${cover})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  background: cover
                    ? undefined
                    : 'linear-gradient(135deg, #87CEEB, #1A6EA8)',
                }}
              >
                {/* 가독성을 위한 어두운 오버레이 */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.55) 100%)',
                  }}
                />
                <div className="absolute bottom-2 left-2 right-2 text-left">
                  <p
                    className="m-0"
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'white',
                      lineHeight: 1.3,
                      textShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {card.title}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({ question, onClick, compact = false }) {
  const avatarSize = compact ? 26 : 28;
  const initial =
    String(question?.author?.name || '?').trim().charAt(0).toUpperCase() || '·';
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full"
      style={{
        background: CARD_BG,
        borderRadius: 11,
        padding: '12px 14px',
        border: `1px solid ${BORDER_LIGHT}`,
        cursor: 'pointer',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="rounded-full overflow-hidden text-white font-semibold flex items-center justify-center flex-shrink-0"
          style={{
            width: avatarSize,
            height: avatarSize,
            fontSize: compact ? 10 : 11,
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
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, color: TEXT_PRIMARY }}>
              {question?.author?.name || '익명'}
            </span>
            <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>·</span>
            <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>
              {timeAgo(question.created_at)}
            </span>
          </div>
          <p
            className="m-0 mb-2"
            style={{
              fontSize: compact ? 12 : 13,
              color: TEXT_PRIMARY,
              lineHeight: 1.5,
            }}
          >
            {question.body}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {question.is_answered ? (
              <div
                className="flex items-center gap-1 px-2 py-0.5"
                style={{ background: 'white', borderRadius: 7 }}
              >
                <IconPhoto size={compact ? 10 : 11} color={KEY} />
                <span
                  style={{
                    fontSize: compact ? 9 : 10,
                    fontWeight: 600,
                    color: KEY_DARK,
                  }}
                >
                  {question.answer_count}장 답변
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1 px-2 py-0.5"
                style={{ background: KEY_LIGHT, borderRadius: 7 }}
              >
                <IconClock size={compact ? 10 : 11} color={KEY} />
                <span
                  style={{
                    fontSize: compact ? 9 : 10,
                    fontWeight: 600,
                    color: KEY_DARK,
                  }}
                >
                  답변 기다림
                </span>
              </div>
            )}
            {question.place && (
              <span
                className="inline-flex items-center gap-0.5 truncate"
                style={{ fontSize: 10, color: TEXT_SECONDARY }}
              >
                <IconMapPin size={10} color={TEXT_SECONDARY} />
                {question.place.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function QuestionsSection({ questions, showAllAction = true }) {
  const navigate = useNavigate();
  const isEmpty = !questions || questions.length === 0;
  return (
    <div className="mb-[22px]">
      <SectionHeader
        icon={IconHelpCircle}
        title="실시간 Q&A"
        action={
          showAllAction
            ? { label: '전체 보기', onClick: () => navigate('/questions') }
            : undefined
        }
      />
      {isEmpty ? (
        <button
          type="button"
          onClick={() => navigate('/questions')}
          className="flex items-center justify-between w-full text-left"
          style={{
            padding: '14px 16px',
            borderRadius: 11,
            background: CARD_BG,
            border: `1px dashed ${BORDER_LIGHT}`,
            cursor: 'pointer',
          }}
        >
          <div className="flex flex-col">
            <span style={{ fontSize: 12, color: TEXT_PRIMARY, fontWeight: 600 }}>
              아직 올라온 질문이 없어요
            </span>
            <span style={{ fontSize: 10, color: TEXT_SECONDARY, marginTop: 2 }}>
              질문 전체보기로 이동
            </span>
          </div>
          <IconChevronRight size={14} color={TEXT_SECONDARY} />
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.slice(0, 2).map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onClick={() => navigate(`/question/${encodeURIComponent(q.id)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// 여행자 탭
//  · 한 행 = 프로필 사진 + 이름 + 올린 게시물 수, 우측에 팔로우 버튼
// ────────────────────────────────────────────────
function TravelerRow({ traveler }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFollowing, pending, toggleFollow } = useFollow({
    targetUserId: traveler?.id,
    initialFollowing: !!traveler?.is_following,
  });

  const isMe = !!user?.id && user.id === traveler?.id;
  const initial = String(traveler?.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatar = traveler?.avatar_url ? getDisplayImageUrl(traveler.avatar_url) : '';
  const postCount = Number(traveler?.post_count) || 0;
  const liveCount = Number(traveler?.live_count) || 0;
  const followerCount = Number(traveler?.follower_count) || 0;

  const handleFollow = async (e) => {
    e.stopPropagation();
    // 비로그인 상태에서 팔로우를 누르면 로그인 화면으로 유도
    if (!user?.id) {
      navigate('/start');
      return;
    }
    await toggleFollow();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/user/${encodeURIComponent(traveler.id)}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/user/${encodeURIComponent(traveler.id)}`);
      }}
      className="flex items-center gap-3 w-full text-left"
      style={{
        background: CARD_BG,
        borderRadius: 10,
        padding: 10,
        border: `1px solid ${BORDER_LIGHT}`,
        cursor: 'pointer',
      }}
    >
      <div
        className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-bold"
        style={{ width: 44, height: 44, fontSize: 17, background: traveler?.avatar_color || KEY }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          initial
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="m-0 mb-0.5 truncate"
          style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}
        >
          {traveler?.name || '여행자'}
        </p>
        <div className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
          <span style={{ color: TEXT_SECONDARY }}>게시물 {postCount}</span>
          {followerCount > 0 && (
            <>
              <span style={{ color: TEXT_TERTIARY }}>·</span>
              <span style={{ color: TEXT_SECONDARY }}>팔로워 {followerCount}</span>
            </>
          )}
          {liveCount > 0 && (
            <>
              <span style={{ color: TEXT_TERTIARY }}>·</span>
              <span style={{ color: KEY_DARK, fontWeight: 600 }}>지금 {liveCount}장</span>
            </>
          )}
        </div>
      </div>

      {!isMe && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={pending}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            // 전역 button{min-height:44px}를 덮어 44px 행에 맞는 작은 알약 버튼 유지
            minHeight: 30,
            height: 30,
            padding: '0 12px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: pending ? 'not-allowed' : 'pointer',
            border: isFollowing ? `1px solid ${BORDER_LIGHT}` : 'none',
            background: isFollowing ? '#fff' : KEY,
            color: isFollowing ? TEXT_SECONDARY : '#fff',
          }}
        >
          {isFollowing ? '팔로잉' : '팔로우'}
        </button>
      )}
    </div>
  );
}

function TravelerSection({ icon, title, hint, travelers }) {
  const list = Array.isArray(travelers) ? travelers : [];
  if (list.length === 0) return null;
  return (
    <div className="mb-[22px]">
      <SectionHeader icon={icon} title={title} />
      {hint && (
        <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: -6, marginBottom: 10 }}>
          {hint}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {list.map((t, idx) => (
          <TravelerRow key={t.id || idx} traveler={t} />
        ))}
      </div>
    </div>
  );
}

function TravelersHub() {
  const { data, loading } = useTravelerHub();
  const recommended = Array.isArray(data?.recommended) ? data.recommended : [];
  const popular = Array.isArray(data?.popular) ? data.popular : [];

  if (loading) {
    return (
      <div className="p-[18px] text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        여행자를 모으는 중...
      </div>
    );
  }

  if (recommended.length === 0 && popular.length === 0) {
    return (
      <div className="p-[18px] text-center" style={{ padding: '60px 18px' }}>
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          아직 소개할 여행자가 없어요
        </p>
        <p className="m-0" style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 6, lineHeight: 1.6 }}>
          지금을 올리는 사람이 생기면
          <br />
          여기에서 바로 만날 수 있어요
        </p>
      </div>
    );
  }

  return (
    <div className="p-[18px]">
      <TravelerSection
        icon={IconUserStar}
        title="추천 여행자"
        hint="지금 활발하게 올리고 있는 여행자예요"
        travelers={recommended}
      />
      <TravelerSection
        icon={IconUsers}
        title="인기 여행자"
        hint="많은 사람이 팔로우하는 여행자예요"
        travelers={popular}
      />
    </div>
  );
}

// 도시 카드 우상단 날씨 배지 — 여행자가 지역 날씨를 즉시 인지하도록.
function CityWeatherBadge({ region }) {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getWeatherByRegion(region);
        if (!cancelled && res?.success && res.weather?.temperature && res.weather.temperature !== '-') {
          setWeather(res.weather);
        }
      } catch (_) {
        /* 날씨 실패는 조용히 무시 — 카드 사진/이름은 그대로 노출 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region]);

  if (!weather) return null;
  return (
    <div
      className="absolute top-2 right-2 flex items-center gap-1"
      style={{
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(6px)',
        borderRadius: 999,
        padding: '3px 8px',
      }}
    >
      <WeatherIcon icon={weather.icon} condition={weather.condition} size={14} />
      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
        {weather.temperature}
      </span>
    </div>
  );
}

function CityGrid({ cities }) {
  const navigate = useNavigate();
  const bucket = useHalfHourBucket();
  // 같은 시(예: "경북 구미시 봉곡동" + "구미시 봉곡동")를 '구미' 하나로 합치고
  // 라이브 수 합산 + 대표 사진 풀(썸네일 배열)도 중복 없이 병합
  const mergedCities = useMemo(() => {
    const map = new Map();
    (cities || []).forEach((c) => {
      const name = normalizeCityName(c.city);
      if (!name) return;
      const incoming =
        Array.isArray(c.thumbnails) && c.thumbnails.length
          ? c.thumbnails
          : c.thumbnail_url
          ? [c.thumbnail_url]
          : [];
      const prev = map.get(name);
      if (prev) {
        prev.live_count += c.live_count || 0;
        incoming.forEach((t) => {
          if (t && !prev.thumbnails.includes(t)) prev.thumbnails.push(t);
        });
      } else {
        map.set(name, {
          city: name,
          live_count: c.live_count || 0,
          thumbnails: incoming.filter(Boolean),
        });
      }
    });
    return (
      Array.from(map.values())
        // 사용자가 올린 실제 사진이 있는 도시만 노출 (그라데이션 배경 카드 없음)
        .filter((c) => c.thumbnails.length > 0)
        .sort((a, b) => b.live_count - a.live_count)
    );
  }, [cities]);

  if (mergedCities.length === 0) return null;
  return (
    <div className="mb-[22px]">
      <SectionHeader icon={IconBuildingSkyscraper} title="인기 도시" />
      <div className="grid grid-cols-2 gap-2">
        {mergedCities.slice(0, 4).map((city, idx) => {
          // 30분마다 지역 사진 풀을 순환(카드별로 시작 위치를 달리해 다양하게).
          const pool = city.thumbnails;
          const picked = pool[(bucket + idx) % pool.length];
          const photo = getDisplayImageUrl(picked);
          return (
            <button
              key={city.city}
              type="button"
              onClick={() => navigate(`/region/${encodeURIComponent(city.city)}`)}
              className="relative overflow-hidden text-left"
              style={{
                aspectRatio: '100 / 114',
                borderRadius: 10,
                border: 'none',
                padding: 0,
                backgroundImage: `url(${photo})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                cursor: 'pointer',
              }}
            >
              {/* 가독성을 위한 어두운 오버레이 */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.6) 100%)',
                }}
              />
              {/* 날씨 — 즉시 인지 */}
              <CityWeatherBadge region={city.city} />
              <div className="absolute bottom-2 left-2.5">
                <p
                  className="m-0 mb-0.5"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'white',
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {city.city}
                </p>
                <span
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.95)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                >
                  {city.live_count || 0}장 라이브
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryGrid({ categories }) {
  const navigate = useNavigate();
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
  const order = ['nature', 'weather', 'event', 'crowd', 'sunset', 'business'];
  const countById = new Map();
  (categories || []).forEach((c) => countById.set(c.category, c.live_count || 0));

  const guardedClick = (handler) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler();
  };

  return (
    <div>
      <SectionHeader icon={IconCategory} title="카테고리" />
      <div
        onMouseDown={handleDragStart}
        className="flex gap-2 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {order.map((catId) => {
          const meta = CATEGORY_META[catId];
          const Icon = meta.Icon;
          const count = countById.get(catId) || 0;
          return (
            <button
              key={catId}
              type="button"
              onClick={guardedClick(() => navigate(`/hashtag/${encodeURIComponent(catId)}`))}
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{
                background: CARD_BG,
                borderRadius: 999,
                border: `1px solid ${BORDER_LIGHT}`,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              <Icon size={16} color={KEY} />
              <span
                style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: 'nowrap' }}
              >
                {meta.label}
              </span>
              <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchHub({ recent, onPickRecent }) {
  const { data, loading } = useSearchHub();
  const [magazines, setMagazines] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchPublishedMagazines({ limit: 20 });
      if (!cancelled) setMagazines(Array.isArray(list) ? list : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 최근 검색은 로컬 기록이라 허브 로딩/실패와 무관하게 항상 먼저 보여준다
  const recentRow = (
    <RecentSearches
      items={recent.items}
      onPick={onPickRecent}
      onRemove={recent.remove}
      onClear={recent.clear}
    />
  );

  if (loading) {
    return (
      <div className="p-[18px]">
        {recentRow}
        <p className="m-0 text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
          로딩 중...
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-[18px]">
        {recentRow}
        <p className="m-0 text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오지 못했어요
        </p>
      </div>
    );
  }

  return (
    <div className="p-[18px]">
      {recentRow}
      <CityGrid cities={data.cities || []} />
      {/* 질문 구역 임시 숨김 — 사용자가 어느 정도 모인 뒤 다시 노출 */}
      {/* <QuestionsSection questions={data.questions || []} showAllAction /> */}
      {/* 여행자는 상단 "여행자" 탭으로 분리됨 */}
      {/* 매거진 구역 임시 숨김 */}
      {/* <SeasonalCards cards={magazines} /> */}
      <CategoryGrid categories={data.categories || []} />
    </div>
  );
}

// ────────────────────────────────────────────────
// 검색 결과 섹션
// ────────────────────────────────────────────────
function PlaceResultRow({ place }) {
  const navigate = useNavigate();
  const url = place.thumbnail_url ? getDisplayImageUrl(place.thumbnail_url) : '';
  return (
    <button
      type="button"
      onClick={() => navigate(`/place/${encodeURIComponent(place.id || place.name)}`)}
      className="flex items-center gap-3 text-left w-full"
      style={{
        background: CARD_BG,
        borderRadius: 10,
        padding: 10,
        border: `1px solid ${BORDER_LIGHT}`,
        cursor: 'pointer',
      }}
    >
      <div
        className="flex-shrink-0 overflow-hidden"
        style={{ width: 44, height: 44, borderRadius: 9, background: BORDER_LIGHT }}
      >
        {url && (
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="m-0 mb-0.5 truncate"
          style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}
        >
          {place.name}
        </p>
        <div className="flex items-center gap-1.5 truncate" style={{ fontSize: 10 }}>
          {place.city && (
            <>
              <span style={{ color: TEXT_SECONDARY }}>
                {place.city}
                {place.district ? ` ${place.district}` : ''}
              </span>
              <span style={{ color: TEXT_TERTIARY }}>·</span>
            </>
          )}
          <span style={{ color: KEY_DARK, fontWeight: 600 }}>
            {place.live_count || 0}장 라이브
          </span>
        </div>
      </div>
      <IconChevronRight size={16} color={TEXT_TERTIARY} className="flex-shrink-0" />
    </button>
  );
}

function UserResultRow({ user }) {
  const navigate = useNavigate();
  const initial = String(user?.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatar = user?.avatar_url ? getDisplayImageUrl(user.avatar_url) : '';
  return (
    <button
      type="button"
      onClick={() => navigate(`/user/${encodeURIComponent(user.id)}`)}
      className="flex items-center gap-3 text-left w-full"
      style={{
        background: CARD_BG,
        borderRadius: 10,
        padding: 10,
        border: `1px solid ${BORDER_LIGHT}`,
        cursor: 'pointer',
      }}
    >
      <div
        className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-bold"
        style={{ width: 44, height: 44, fontSize: 17, background: user?.avatar_color || KEY }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="m-0 mb-0.5 truncate"
          style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}
        >
          {user.name}
        </p>
        {user.bio ? (
          <p className="m-0 truncate" style={{ fontSize: 10, color: TEXT_SECONDARY }}>
            {user.bio}
          </p>
        ) : (
          <div className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
            <span style={{ color: KEY_DARK, fontWeight: 600 }}>
              팔로워 {user.follower_count || 0}
            </span>
            <span style={{ color: TEXT_TERTIARY }}>·</span>
            <span style={{ color: TEXT_SECONDARY }}>게시물 {user.post_count || 0}</span>
          </div>
        )}
      </div>
      <IconChevronRight size={16} color={TEXT_TERTIARY} className="flex-shrink-0" />
    </button>
  );
}

function PhotoGridResults({ photos, total, query }) {
  const navigate = useNavigate();
  const visible = photos.slice(0, 6);
  const extra = Math.max(0, (total || 0) - 6);
  const showOverlayOnLast = visible.length === 6 && extra > 0;

  return (
    <div className="grid grid-cols-3 gap-1">
      {visible.map((photo, idx) => {
        const isLast = idx === 5;
        const overlay = isLast && showOverlayOnLast;
        const url = photo.thumbnail_url ? getDisplayImageUrl(photo.thumbnail_url) : '';
        return (
          <button
            key={photo.post_id}
            type="button"
            onClick={() => {
              if (overlay) {
                navigate(`/search/photos?q=${encodeURIComponent(query)}`);
              } else {
                navigate(`/post/${encodeURIComponent(photo.post_id)}`);
              }
            }}
            className="relative overflow-hidden aspect-square"
            style={{
              borderRadius: 7,
              background: SURFACE,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {url && (
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
            <div
              className="absolute top-1 left-1 px-1.5 py-0.5"
              style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 3 }}
            >
              <span style={{ fontSize: 8, color: 'white', fontWeight: 600 }}>
                {timeAgo(photo.exif_taken_at)}
              </span>
            </div>
            {overlay && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>+{extra}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SearchResults({ query, results, loading }) {
  const navigate = useNavigate();

  if (loading && !results) {
    return (
      <div className="p-[18px] text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        검색 중...
      </div>
    );
  }
  if (!results) return null;

  const places = Array.isArray(results.places) ? results.places : [];
  const photos = Array.isArray(results.photos) ? results.photos : [];
  const totalPhotos = Number(results.photos_total) || 0;
  // eslint-disable-next-line no-unused-vars -- 질문 구역 임시 숨김 동안만 미사용
  const questions = Array.isArray(results.questions) ? results.questions : [];
  const users = Array.isArray(results.users) ? results.users : [];

  // 질문 구역은 임시 숨김이라 결과 유무 판정에서도 제외한다
  const noResults =
    places.length === 0 && photos.length === 0 && users.length === 0;

  if (noResults) {
    return (
      <div className="p-[18px] text-center">
        <p className="mt-12" style={{ fontSize: 14, color: TEXT_SECONDARY }}>
          &apos;{query}&apos;에 대한 결과를 찾지 못했어요
        </p>
      </div>
    );
  }

  return (
    <div className="p-[18px]">
      {users.length > 0 && (
        <div className="mb-[22px]">
          <SectionHeader icon={IconUserStar} title={`여행자 ${users.length}`} />
          <div className="flex flex-col gap-2">
            {users.slice(0, 5).map((u) => (
              <UserResultRow key={u.id} user={u} />
            ))}
          </div>
        </div>
      )}

      {places.length > 0 && (
        <div className="mb-[22px]">
          <SectionHeader
            icon={IconMapPin}
            title={`장소 ${places.length}`}
            action={
              places.length > 3
                ? {
                    label: '전체',
                    onClick: () =>
                      navigate(`/search/places?q=${encodeURIComponent(query)}`),
                  }
                : undefined
            }
          />
          <div className="flex flex-col gap-2">
            {places.slice(0, 3).map((p) => (
              <PlaceResultRow key={p.id || p.name} place={p} />
            ))}
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mb-[22px]">
          <SectionHeader
            icon={IconPhoto}
            title={`사진 ${totalPhotos}장`}
            action={
              totalPhotos > 6
                ? {
                    label: '전체',
                    onClick: () =>
                      navigate(`/search/photos?q=${encodeURIComponent(query)}`),
                  }
                : undefined
            }
          />
          <PhotoGridResults photos={photos} total={totalPhotos} query={query} />
        </div>
      )}

      {/* 질문 구역 임시 숨김 — 사용자가 어느 정도 모인 뒤 다시 노출
      {questions.length > 0 && (
        <div>
          <SectionHeader icon={IconHelpCircle} title={`질문 ${questions.length}`} />
          <div className="flex flex-col gap-2">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                onClick={() => navigate(`/question/${encodeURIComponent(q.id)}`)}
                compact
              />
            ))}
          </div>
        </div>
      )} */}
    </div>
  );
}

// ────────────────────────────────────────────────
// SearchScreen
// ────────────────────────────────────────────────
// 검색어가 없을 때 노출되는 탐색 탭 — 지역 / 여행자
const HUB_TABS = [
  { id: 'region', label: '지역', Icon: IconMapPin },
  { id: 'traveler', label: '여행자', Icon: IconUserStar },
];

function HubTabs({ tab, onChange }) {
  return (
    <div
      className="flex items-stretch bg-white"
      style={{ borderBottom: `1px solid ${BORDER_LIGHT}` }}
    >
      {HUB_TABS.map((t) => {
        const active = tab === t.id;
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5"
            style={{
              padding: '11px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? `2px solid ${KEY}` : '2px solid transparent',
              marginBottom: -1,
              color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            <Icon size={15} color={active ? KEY : TEXT_SECONDARY} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [hubTab, setHubTab] = useState('region');
  const { results, loading } = useSearch(query);
  const recent = useRecentSearches(query);
  const isSearching = query.trim().length > 0;

  return (
    <div
      style={{
        background: '#ffffff',
        minHeight: '100vh',
        color: TEXT_PRIMARY,
        paddingBottom: 80,
      }}
    >
      <SearchHeader
        query={query}
        onChange={setQuery}
        onClear={() => setQuery('')}
        onSubmit={recent.record}
      />
      {isSearching ? (
        <SearchResults query={query} results={results} loading={loading} />
      ) : (
        <>
          <HubTabs tab={hubTab} onChange={setHubTab} />
          {hubTab === 'traveler' ? (
            <TravelersHub />
          ) : (
            <SearchHub recent={recent} onPickRecent={setQuery} />
          )}
        </>
      )}
      <BottomNavigation />
    </div>
  );
};

export default SearchScreen;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconSearch,
  IconX,
  IconChevronRight,
  IconCalendarTime,
  IconHelpCircle,
  IconMap2,
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
import { logger } from '../utils/logger';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
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

const CATEGORY_META = {
  nature: { Icon: IconFlower, label: '개화·자연' },
  weather: { Icon: IconCloud, label: '날씨·체감' },
  event: { Icon: IconCalendarEvent, label: '이벤트·축제' },
  crowd: { Icon: IconUsers, label: '혼잡도·대기' },
  sunset: { Icon: IconMoon, label: '노을·야경' },
  business: { Icon: IconBuildingStore, label: '영업·운영' },
};

const CITY_GRADIENTS = {
  서울: ['#FFB6C1', '#FF8FAB'],
  부산: ['#87CEEB', '#4DB8E8'],
  제주: ['#FFD89B', '#FFA07A'],
  강릉: ['#B0E0E6', '#87CEEB'],
  경주: ['#FF9FB8', '#E07A99'],
  전주: ['#FFE0B0', '#FFC78B'],
  대구: ['#FFC1B6', '#FF8F73'],
  인천: ['#A0D8EF', '#4DB8E8'],
  구미: ['#C8E6C9', '#7CB97F'],
  여수: ['#B3E5FC', '#4DB8E8'],
};
const DEFAULT_CITY_GRADIENT = ['#87CEEB', '#4DB8E8'];

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

function SearchHeader({ query, onChange, onClear }) {
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
        <IconArrowLeft size={22} color={TEXT_PRIMARY} />
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
            height: 110,
            borderRadius: 11,
            background: SURFACE,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            아직 등록된 시즌이 없어요
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-[22px]">
      <SectionHeader
        icon={IconCalendarTime}
        title="매거진"
        action={{ label: '매거진 전체보기', onClick: () => navigate('/season') }}
      />
      <div
        onMouseDown={handleDragStart}
        className="flex gap-2 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={guardedClick(() => navigate(`/season/${encodeURIComponent(card.id)}`))}
            className="flex-shrink-0"
            style={{
              width: 130,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                height: 110,
                borderRadius: 11,
                background: `linear-gradient(135deg, ${
                  card.cover_color_start || '#87CEEB'
                }, ${card.cover_color_end || '#4DB8E8'})`,
              }}
            >
              <div
                className="absolute top-2 left-2 px-2 py-0.5"
                style={{ background: 'rgba(0,0,0,0.65)', borderRadius: 5 }}
              >
                <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>
                  {card.period_label}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 right-2 text-left">
                <p className="m-0 mb-0.5" style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                  {card.title}
                </p>
                <div className="flex items-center gap-1">
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      background: KEY,
                      borderRadius: '50%',
                      boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.4)',
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)' }}>
                    {card.is_upcoming ? '곧 시작' : `실시간 ${card.live_count || 0}장`}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
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
        background: SURFACE,
        borderRadius: 11,
        padding: '12px 14px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="rounded-full text-white font-semibold flex items-center justify-center flex-shrink-0"
          style={{
            width: avatarSize,
            height: avatarSize,
            fontSize: compact ? 10 : 11,
            background: question?.author?.avatar_color || KEY,
          }}
        >
          {initial}
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
            background: SURFACE,
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

function CityGrid({ cities }) {
  const navigate = useNavigate();
  if (!cities || cities.length === 0) return null;
  return (
    <div className="mb-[22px]">
      <SectionHeader icon={IconMap2} title="인기 도시" />
      <div className="grid grid-cols-2 gap-2">
        {cities.slice(0, 4).map((city) => {
          const [start, end] = CITY_GRADIENTS[city.city] || DEFAULT_CITY_GRADIENT;
          return (
            <button
              key={city.city}
              type="button"
              onClick={() => navigate(`/region/${encodeURIComponent(city.city)}`)}
              className="relative text-left"
              style={{
                aspectRatio: '2 / 1',
                borderRadius: 10,
                border: 'none',
                padding: 0,
                background: `linear-gradient(135deg, ${start}, ${end})`,
                cursor: 'pointer',
              }}
            >
              <div className="absolute bottom-2 left-2.5">
                <p className="m-0 mb-0.5" style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                  {city.city}
                </p>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)' }}>
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
  const order = ['nature', 'weather', 'event', 'crowd', 'sunset', 'business'];
  const countById = new Map();
  (categories || []).forEach((c) => countById.set(c.category, c.live_count || 0));

  return (
    <div>
      <SectionHeader icon={IconCategory} title="카테고리" />
      <div className="grid grid-cols-3 gap-2">
        {order.map((catId) => {
          const meta = CATEGORY_META[catId];
          const Icon = meta.Icon;
          const count = countById.get(catId) || 0;
          return (
            <button
              key={catId}
              type="button"
              onClick={() => navigate(`/hashtag/${encodeURIComponent(catId)}`)}
              className="text-center"
              style={{
                background: SURFACE,
                borderRadius: 10,
                border: 'none',
                padding: '14px 8px',
                cursor: 'pointer',
              }}
            >
              <Icon size={22} color={TEXT_PRIMARY} style={{ marginBottom: 6 }} />
              <p
                className="m-0 mb-0.5"
                style={{ fontSize: 11, fontWeight: 600, color: TEXT_PRIMARY }}
              >
                {meta.label}
              </p>
              <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>{count}장</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchHub() {
  const { data, loading } = useSearchHub();

  if (loading) {
    return (
      <div className="p-[18px] text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        로딩 중...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-[18px] text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        불러오지 못했어요
      </div>
    );
  }

  return (
    <div className="p-[18px]">
      <SeasonalCards cards={data.seasonal || []} />
      <QuestionsSection questions={data.questions || []} showAllAction />
      <CityGrid cities={data.cities || []} />
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
        background: SURFACE,
        borderRadius: 10,
        padding: 10,
        border: 'none',
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
  const questions = Array.isArray(results.questions) ? results.questions : [];

  const noResults = places.length === 0 && photos.length === 0 && questions.length === 0;

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
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// SearchScreen
// ────────────────────────────────────────────────
const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const { results, loading } = useSearch(query);
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
      <SearchHeader query={query} onChange={setQuery} onClear={() => setQuery('')} />
      {isSearching ? (
        <SearchResults query={query} results={results} loading={loading} />
      ) : (
        <SearchHub />
      )}
      <BottomNavigation />
    </div>
  );
};

export default SearchScreen;

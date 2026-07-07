import React, { useEffect, useMemo, useState } from 'react';
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
import { getRegionDefaultImage } from '../utils/regionDefaultImages';
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

// 인기 여행자 — 순위/장식 없이 사용자 프로필(아바타+이름)만 담백하게 노출.
// 섹션 자체가 '인기 여행자'이므로 별도 순위 표기 없이도 인기 있는 여행자로 인식된다.
function TravelerCard({ traveler }) {
  const navigate = useNavigate();
  const initial =
    String(traveler?.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatar = traveler?.avatar_url ? getDisplayImageUrl(traveler.avatar_url) : '';

  return (
    <button
      type="button"
      onClick={() => navigate(`/user/${encodeURIComponent(traveler.id)}`)}
      className="flex flex-col items-center flex-shrink-0"
      style={{
        width: 72,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <div
        className="rounded-full overflow-hidden flex items-center justify-center text-white font-bold"
        style={{
          width: 60,
          height: 60,
          fontSize: 22,
          marginBottom: 7,
          background: traveler?.avatar_color || KEY,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          initial
        )}
      </div>
      <span
        className="truncate w-full text-center"
        style={{ fontSize: 11.5, fontWeight: 600, color: TEXT_PRIMARY }}
      >
        {traveler?.name || '여행자'}
      </span>
    </button>
  );
}

function TravelersSection({ travelers }) {
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
  const list = Array.isArray(travelers) ? travelers : [];
  if (list.length === 0) return null;

  return (
    <div className="mb-[22px]">
      <SectionHeader icon={IconUserStar} title="인기 여행자" />
      <div
        onMouseDown={handleDragStart}
        className="flex gap-3 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClickCapture={(e) => {
          if (hasMovedRef.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {list.map((t, idx) => (
          <TravelerCard key={t.id || idx} traveler={t} />
        ))}
      </div>
    </div>
  );
}

function CityGrid({ cities }) {
  const navigate = useNavigate();
  // 같은 시(예: "경북 구미시 봉곡동" + "구미시 봉곡동")를 '구미' 하나로 합치고 라이브 수 합산
  const mergedCities = useMemo(() => {
    const map = new Map();
    (cities || []).forEach((c) => {
      const name = normalizeCityName(c.city);
      if (!name) return;
      const prev = map.get(name);
      if (prev) prev.live_count += c.live_count || 0;
      else map.set(name, { city: name, live_count: c.live_count || 0 });
    });
    return Array.from(map.values()).sort((a, b) => b.live_count - a.live_count);
  }, [cities]);

  if (mergedCities.length === 0) return null;
  return (
    <div className="mb-[22px]">
      <SectionHeader icon={IconBuildingSkyscraper} title="인기 도시" />
      <div className="grid grid-cols-2 gap-2">
        {mergedCities.slice(0, 4).map((city) => {
          const [start, end] = CITY_GRADIENTS[city.city] || DEFAULT_CITY_GRADIENT;
          const photo = getRegionDefaultImage(city.city);
          return (
            <button
              key={city.city}
              type="button"
              onClick={() => navigate(`/region/${encodeURIComponent(city.city)}`)}
              className="relative overflow-hidden text-left"
              style={{
                aspectRatio: '100 / 101',
                borderRadius: 10,
                border: 'none',
                padding: 0,
                backgroundImage: photo ? `url(${photo})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                background: photo
                  ? undefined
                  : `linear-gradient(135deg, ${start}, ${end})`,
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

function SearchHub() {
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
      <CityGrid cities={data.cities || []} />
      <QuestionsSection questions={data.questions || []} showAllAction />
      <TravelersSection travelers={data.travelers || []} />
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
  const questions = Array.isArray(results.questions) ? results.questions : [];
  const users = Array.isArray(results.users) ? results.users : [];

  const noResults =
    places.length === 0 &&
    photos.length === 0 &&
    questions.length === 0 &&
    users.length === 0;

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

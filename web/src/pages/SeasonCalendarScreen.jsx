import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCalendarTime,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconSparkles,
  IconHistory,
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

const MONTH_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatToday(iso) {
  if (!iso) {
    const d = new Date();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatRange(start, end) {
  if (!start && !end) return '';
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const fmt = (d) => (d ? `${d.getMonth() + 1}/${d.getDate()}` : '');
  if (s && e) return `${fmt(s)} ~ ${fmt(e)}`;
  return fmt(s) || fmt(e);
}

// ────────────────────────────────────────────────
// 데이터 훅
// ────────────────────────────────────────────────
function useSeasonCalendar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.rpc('get_season_calendar');
        if (cancelled) return;
        if (error) {
          logger.warn('get_season_calendar 실패', error?.message || error);
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
          시즌 캘린더
        </p>
        <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 1 }}>
          올해 지금 한창인 것들
        </p>
      </div>
    </div>
  );
}

function TodayBox({ todayIso, totalLive, totalActive, totalUpcoming }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        margin: '14px 18px 22px',
        padding: '14px 16px',
        borderRadius: 12,
        background: KEY_LIGHT,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'white',
        }}
      >
        <IconCalendarTime size={22} color={KEY} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          {formatToday(todayIso)} 오늘
        </p>
        <p className="m-0" style={{ fontSize: 11, color: KEY_DARK, marginTop: 2 }}>
          진행 중 {totalActive || 0} · 다가오는 시즌 {totalUpcoming || 0} · 실시간 {totalLive || 0}장
        </p>
      </div>
    </div>
  );
}

function MonthTimeline() {
  const now = new Date();
  const month = now.getMonth();
  return (
    <div
      className="flex items-center justify-between"
      style={{ margin: '0 18px 18px', padding: '10px 12px', borderRadius: 10, background: SURFACE }}
    >
      {MONTH_KO.slice(Math.max(0, month - 1), Math.min(12, month + 3)).map((label, idx) => {
        const realIdx = Math.max(0, month - 1) + idx;
        const isCurrent = realIdx === month;
        return (
          <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? KEY_DARK : TEXT_SECONDARY,
              }}
            >
              {label}
            </span>
            <div
              style={{
                marginTop: 4,
                width: isCurrent ? 22 : 12,
                height: 4,
                borderRadius: 999,
                background: isCurrent ? KEY : BORDER_LIGHT,
                transition: 'all 0.2s',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count, accent }) {
  return (
    <div className="flex items-center gap-1.5" style={{ margin: '0 18px 12px' }}>
      <Icon size={16} color={accent || KEY} />
      <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
        {title}
      </p>
      {Number.isFinite(count) && (
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
          {count}
        </span>
      )}
    </div>
  );
}

function SeasonCardLarge({ season }) {
  const navigate = useNavigate();
  const start = season.cover_color_start || '#87CEEB';
  const end = season.cover_color_end || '#4DB8E8';

  return (
    <button
      type="button"
      onClick={() => navigate(`/season/${encodeURIComponent(season.id)}`)}
      className="relative overflow-hidden text-left w-full"
      style={{
        height: 160,
        borderRadius: 14,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: `linear-gradient(135deg, ${start}, ${end})`,
      }}
    >
      <div
        className="absolute"
        style={{
          top: 12,
          left: 12,
          padding: '4px 10px',
          borderRadius: 7,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconCalendarTime size={11} color="white" />
        <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>
          {season.period_label || formatRange(season.starts_at, season.ends_at)}
        </span>
      </div>

      {Number.isFinite(season.days_delta) && season.days_delta >= 0 && (
        <div
          className="absolute"
          style={{
            top: 12,
            right: 12,
            padding: '4px 10px',
            borderRadius: 7,
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: KEY_DARK }}>
            {season.days_delta === 0 ? '오늘 마감' : `D-${season.days_delta}`}
          </span>
        </div>
      )}

      <div
        className="absolute"
        style={{
          left: 14,
          right: 14,
          bottom: 14,
        }}
      >
        <p
          className="m-0"
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: 'white',
            marginBottom: 6,
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          {season.title}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div
              style={{
                width: 5,
                height: 5,
                background: KEY,
                borderRadius: '50%',
                boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.4)',
              }}
            />
            <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
              실시간 {season.live_count || 0}장
            </span>
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
            추천 {season.place_count || 0}곳
          </span>
        </div>
      </div>
    </button>
  );
}

function SeasonCardSmall({ season }) {
  const navigate = useNavigate();
  const start = season.cover_color_start || '#87CEEB';
  const end = season.cover_color_end || '#4DB8E8';
  return (
    <button
      type="button"
      onClick={() => navigate(`/season/${encodeURIComponent(season.id)}`)}
      className="flex items-center gap-3 text-left w-full"
      style={{
        padding: 10,
        borderRadius: 12,
        background: 'white',
        border: `1px solid ${BORDER_LIGHT}`,
        cursor: 'pointer',
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 56,
          height: 56,
          borderRadius: 11,
          background: `linear-gradient(135deg, ${start}, ${end})`,
        }}
      >
        <IconSparkles size={20} color="white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="m-0 truncate" style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 2 }}>
          {season.title}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>
            {season.period_label || formatRange(season.starts_at, season.ends_at)}
          </span>
          {Number.isFinite(season.days_delta) && season.days_delta > 0 && (
            <>
              <span style={{ fontSize: 9, color: TEXT_TERTIARY }}>·</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: KEY_DARK }}>
                D-{season.days_delta}
              </span>
            </>
          )}
        </div>
      </div>
      <IconChevronRight size={16} color={TEXT_TERTIARY} className="flex-shrink-0" />
    </button>
  );
}

function EndedRow({ season }) {
  const navigate = useNavigate();
  const start = season.cover_color_start || '#87CEEB';
  const end = season.cover_color_end || '#4DB8E8';
  return (
    <button
      type="button"
      onClick={() => navigate(`/season/${encodeURIComponent(season.id)}`)}
      className="flex items-center gap-3 text-left w-full"
      style={{
        padding: 10,
        borderRadius: 11,
        background: SURFACE,
        border: 'none',
        cursor: 'pointer',
        opacity: 0.85,
      }}
    >
      <div
        className="flex-shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
          background: `linear-gradient(135deg, ${start}, ${end})`,
          opacity: 0.7,
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="m-0 truncate" style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 1 }}>
          {season.title}
        </p>
        <span style={{ fontSize: 10, color: TEXT_SECONDARY }}>
          {season.period_label || formatRange(season.starts_at, season.ends_at)}
        </span>
      </div>
      <IconChevronRight size={14} color={TEXT_TERTIARY} className="flex-shrink-0" />
    </button>
  );
}

function EmptyState({ label }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        margin: '0 18px',
        padding: '28px 16px',
        borderRadius: 11,
        background: SURFACE,
        border: `1px dashed ${BORDER_LIGHT}`,
      }}
    >
      <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
    </div>
  );
}

// ────────────────────────────────────────────────
// SeasonCalendarScreen
// ────────────────────────────────────────────────
const SeasonCalendarScreen = () => {
  const { data, loading } = useSeasonCalendar();

  const active = useMemo(() => (Array.isArray(data?.active) ? data.active : []), [data]);
  const upcoming = useMemo(() => (Array.isArray(data?.upcoming) ? data.upcoming : []), [data]);
  const ended = useMemo(() => (Array.isArray(data?.ended) ? data.ended : []), [data]);

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

      {loading ? (
        <div className="p-[18px] text-center" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
          로딩 중...
        </div>
      ) : (
        <>
          <TodayBox
            todayIso={data?.today}
            totalLive={data?.total_live || 0}
            totalActive={data?.total_active || 0}
            totalUpcoming={data?.total_upcoming || 0}
          />

          <MonthTimeline />

          {/* 진행 중 */}
          <SectionHeader icon={IconSparkles} title="지금 한창" count={active.length} />
          {active.length === 0 ? (
            <EmptyState label="진행 중인 시즌이 없어요" />
          ) : (
            <div className="flex flex-col gap-2.5" style={{ margin: '0 18px' }}>
              {active.map((s) => (
                <SeasonCardLarge key={s.id} season={s} />
              ))}
            </div>
          )}

          {/* 곧 시작 */}
          {upcoming.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <SectionHeader icon={IconClock} title="곧 시작" count={upcoming.length} />
              <div className="flex flex-col gap-2" style={{ margin: '0 18px' }}>
                {upcoming.map((s) => (
                  <SeasonCardSmall key={s.id} season={s} />
                ))}
              </div>
            </div>
          )}

          {/* 지난 시즌 */}
          {ended.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <SectionHeader icon={IconHistory} title="지난 시즌" count={ended.length} accent={TEXT_SECONDARY} />
              <div className="flex flex-col gap-1.5" style={{ margin: '0 18px' }}>
                {ended.map((s) => (
                  <EndedRow key={s.id} season={s} />
                ))}
              </div>
            </div>
          )}

          {/* 안내 박스 */}
          <div
            className="flex items-start gap-2.5"
            style={{
              margin: '28px 18px 0',
              padding: '12px 14px',
              borderRadius: 11,
              background: SURFACE,
            }}
          >
            <IconMapPin size={14} color={TEXT_SECONDARY} className="flex-shrink-0" style={{ marginTop: 2 }} />
            <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
              시즌은 작년 데이터를 기준으로 큐레이션됩니다. 카드에 들어가면 추천 장소와 실시간 사진을 볼 수 있어요.
            </p>
          </div>
        </>
      )}

      <BottomNavigation />
    </div>
  );
};

export default SeasonCalendarScreen;

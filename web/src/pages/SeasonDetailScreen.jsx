import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconShare3,
  IconCalendarTime,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconPhoto,
  IconSparkles,
} from '@tabler/icons-react';
import { supabase } from '../utils/supabaseClient';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';

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

function formatMD(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ────────────────────────────────────────────────
// 데이터 훅
// ────────────────────────────────────────────────
function useSeasonDetail(seasonId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: result, error } = await supabase.rpc('get_season_detail', {
          p_season_id: seasonId,
        });
        if (cancelled) return;
        if (error) {
          logger.warn('get_season_detail 실패', error?.message || error);
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
  }, [seasonId]);

  return { data, loading };
}

// ────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────
function StatusChip({ season }) {
  if (!season?.status) return null;
  const { status, d_day, days_left, peak_ends_at, ends_at, starts_at } = season;

  let label = '';
  let bg = 'rgba(0,0,0,0.45)';

  if (status === 'peak') {
    bg = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';
    if (Number.isFinite(days_left)) {
      label = days_left === 0 ? '오늘 절정 마지막' : `절정 ~${formatMD(peak_ends_at || ends_at)} · D-${days_left}`;
    } else {
      label = season.peak_label || '진행 중';
    }
  } else if (status === 'soon') {
    bg = 'rgba(0,0,0,0.6)';
    label = `${formatMD(starts_at)} 시작 · D-${d_day ?? '?'}`;
  } else if (status === 'upcoming') {
    bg = 'rgba(0,0,0,0.5)';
    label = `${season.period_label || formatMD(starts_at)} 예정`;
  } else if (status === 'past') {
    bg = 'rgba(31,31,31,0.7)';
    label = '지난 시즌';
  }

  return (
    <div
      className="inline-flex items-center gap-1.5"
      style={{
        padding: '5px 11px',
        borderRadius: 7,
        background: bg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        marginBottom: 10,
      }}
    >
      <IconCalendarTime size={11} color="white" />
      <span style={{ fontSize: 10, color: 'white', fontWeight: 700, letterSpacing: 0.1 }}>
        {label}
      </span>
    </div>
  );
}

function SeasonHero({ season }) {
  const navigate = useNavigate();
  const start = season?.cover_color_start || '#87CEEB';
  const end = season?.cover_color_end || '#4DB8E8';

  return (
    <div
      className="relative"
      style={{
        height: 220,
        background: `linear-gradient(135deg, ${start}, ${end})`,
      }}
    >
      <div
        className="absolute left-3.5 right-3.5 flex items-center justify-between"
        style={{ top: 14 }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.32)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <IconArrowLeft size={20} color="white" />
        </button>
        <button
          type="button"
          onClick={async () => {
            const url = typeof window !== 'undefined' ? window.location.href : '';
            const shareData = {
              title: `${season?.title || '매거진'} | 라이브저니`,
              text: season?.curation_body || season?.period_label || '',
              url,
            };
            try {
              if (navigator.share) {
                await navigator.share(shareData);
                return;
              }
              if (navigator.clipboard && url) {
                await navigator.clipboard.writeText(url);
                // eslint-disable-next-line no-alert
                window.alert('매거진 링크를 복사했어요');
                return;
              }
              // eslint-disable-next-line no-alert
              window.prompt('이 링크를 복사해서 공유하세요', url);
            } catch (e) {
              logger.warn('매거진 공유 실패', e?.message || e);
            }
          }}
          aria-label="공유하기"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.32)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <IconShare3 size={18} color="white" />
        </button>
      </div>

      <div className="absolute left-4 right-4" style={{ bottom: 18 }}>
        <StatusChip season={season} />
        <h1
          className="m-0"
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.2,
            textShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          {season?.title}
        </h1>
        <p
          className="m-0"
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.92)',
            marginTop: 6,
            fontWeight: 500,
          }}
        >
          {season?.period_label}
        </p>
      </div>
    </div>
  );
}

function SeasonStatsBox({ season }) {
  const isPeak = season?.status === 'peak';
  const isSoon = season?.status === 'soon';
  const isUpcoming = season?.status === 'upcoming';

  let timeLabel = '-';
  let timeSub = '시기';
  if (isPeak && Number.isFinite(season?.days_left)) {
    timeLabel = season.days_left === 0 ? '오늘' : `${season.days_left}일`;
    timeSub = '절정 마감까지';
  } else if (isSoon && Number.isFinite(season?.d_day)) {
    timeLabel = `D-${season.d_day}`;
    timeSub = '시작까지';
  } else if (isUpcoming && Number.isFinite(season?.d_day)) {
    timeLabel = `D-${season.d_day}`;
    timeSub = '시작까지';
  } else if (season?.peak_ends_at) {
    timeLabel = `~${formatMD(season.peak_ends_at)}`;
    timeSub = '절정 마감';
  } else if (season?.ends_at) {
    timeLabel = `~${formatMD(season.ends_at)}`;
    timeSub = '시즌 마감';
  }

  return (
    <div
      className="flex items-center"
      style={{
        padding: '16px 18px',
        background: KEY_LIGHT,
      }}
    >
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 17, fontWeight: 700, color: KEY_DARK, marginBottom: 2 }}>
          {season?.live_count || 0}장
        </p>
        <p className="m-0" style={{ fontSize: 10, color: '#4A7DA8' }}>
          실시간 라이브
        </p>
      </div>
      <div style={{ width: 1, height: 28, background: 'rgba(77, 184, 232, 0.3)' }} />
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 17, fontWeight: 700, color: KEY_DARK, marginBottom: 2 }}>
          {season?.place_count || 0}곳
        </p>
        <p className="m-0" style={{ fontSize: 10, color: '#4A7DA8' }}>
          추천 장소
        </p>
      </div>
      <div style={{ width: 1, height: 28, background: 'rgba(77, 184, 232, 0.3)' }} />
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 17, fontWeight: 700, color: KEY_DARK, marginBottom: 2 }}>
          {timeLabel}
        </p>
        <p className="m-0" style={{ fontSize: 10, color: '#4A7DA8' }}>
          {timeSub}
        </p>
      </div>
    </div>
  );
}

function CurationBox({ body }) {
  if (!body) return null;
  return (
    <div
      style={{
        background: SURFACE,
        borderRadius: 12,
        padding: 14,
        marginBottom: 22,
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
        <div
          className="flex items-center justify-center"
          style={{ width: 20, height: 20, borderRadius: 999, background: KEY }}
        >
          <IconSparkles size={11} color="white" />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: KEY_DARK }}>
          라이브저니 큐레이션
        </span>
      </div>
      <p
        className="m-0"
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: TEXT_PRIMARY,
          whiteSpace: 'pre-wrap',
        }}
      >
        {body}
      </p>
    </div>
  );
}

function PreparingBox({ status }) {
  if (status !== 'soon' && status !== 'upcoming') return null;
  const label =
    status === 'soon'
      ? '곧 시작해요. 시작일에 라이브 사진이 채워질 거예요.'
      : '아직 시작 전 시즌이에요. 시기가 가까워지면 정보가 채워집니다.';
  return (
    <div
      className="flex items-start gap-2"
      style={{
        background: '#FFF9E6',
        border: '1px solid #FCE6A8',
        borderRadius: 11,
        padding: '12px 14px',
        marginBottom: 22,
      }}
    >
      <IconClock size={15} color="#B45309" className="flex-shrink-0" style={{ marginTop: 2 }} />
      <p className="m-0" style={{ fontSize: 12, color: '#7A4E0B', lineHeight: 1.55 }}>
        {label}
      </p>
    </div>
  );
}

function RecommendedPlaces({ places, totalCount }) {
  const navigate = useNavigate();
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
        <IconMapPin size={16} color={KEY} />
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          추천 장소
        </p>
      </div>

      {!places || places.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{
            padding: '24px 16px',
            borderRadius: 11,
            background: SURFACE,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            아직 등록된 장소가 없어요
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {places.slice(0, 5).map((place, idx) => {
            const thumb = place.thumbnail_url ? getDisplayImageUrl(place.thumbnail_url) : '';
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => navigate(`/place/${encodeURIComponent(place.id)}`)}
                className="flex items-center gap-3 text-left w-full"
                style={{
                  background: SURFACE,
                  borderRadius: 10,
                  padding: 10,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div className="relative flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <div
                    className="overflow-hidden"
                    style={{ width: 48, height: 48, borderRadius: 9, background: BORDER_LIGHT }}
                  >
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      top: -4,
                      left: -4,
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      background: TEXT_PRIMARY,
                      border: '2px solid white',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>
                      {idx + 1}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="m-0 truncate"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                      marginBottom: 2,
                    }}
                  >
                    {place.name}
                  </p>
                  <div className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
                    {place.city && (
                      <span style={{ color: TEXT_SECONDARY }}>
                        {place.city}
                        {place.district ? ` ${place.district}` : ''}
                      </span>
                    )}
                    {place.live_count > 0 && (
                      <>
                        <span style={{ color: TEXT_TERTIARY }}>·</span>
                        <span style={{ color: KEY_DARK, fontWeight: 600 }}>
                          {place.live_count}장 라이브
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <IconChevronRight size={16} color={TEXT_TERTIARY} className="flex-shrink-0" />
              </button>
            );
          })}

          {totalCount > 5 && (
            <p
              className="m-0 text-center"
              style={{ fontSize: 11, color: TEXT_SECONDARY, paddingTop: 6 }}
            >
              + {totalCount - 5}곳 더 보기
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SeasonPhotoGrid({ photos, total, status }) {
  const navigate = useNavigate();
  const hasPhotos = Array.isArray(photos) && photos.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-1.5">
          <IconPhoto size={16} color={KEY} />
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            실시간 사진
          </p>
        </div>
        {hasPhotos && (
          <div className="flex items-center gap-1">
            <div
              style={{
                width: 5,
                height: 5,
                background: KEY,
                borderRadius: 999,
                boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.3)',
              }}
            />
            <span style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600 }}>
              방금 업데이트
            </span>
          </div>
        )}
      </div>

      {!hasPhotos ? (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{
            padding: '40px 16px',
            borderRadius: 11,
            background: SURFACE,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <p className="m-0" style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 4 }}>
            아직 실시간 사진이 없어요
          </p>
          <p className="m-0" style={{ fontSize: 11, color: TEXT_TERTIARY }}>
            {status === 'soon' || status === 'upcoming'
              ? '시즌이 시작되면 여기 모여요'
              : '지금 현장에 계신 분이 올리면 가장 먼저 보여드릴게요'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {photos.slice(0, 30).map((photo, idx) => {
            const url = photo.thumbnail_url ? getDisplayImageUrl(photo.thumbnail_url) : '';
            const isLast = idx === 29 && (total || photos.length) > 30;
            return (
              <button
                key={photo.post_id || idx}
                type="button"
                onClick={() => navigate(`/photo/${encodeURIComponent(photo.post_id)}`)}
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
                  className="absolute"
                  style={{
                    top: 4,
                    left: 4,
                    background: 'rgba(0,0,0,0.7)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ fontSize: 8, color: 'white', fontWeight: 600 }}>
                    {timeAgo(photo.exif_taken_at)}
                  </span>
                </div>
                {isLast && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                  >
                    <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>
                      +{total - 30}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// SeasonDetailScreen
// ────────────────────────────────────────────────
const SeasonDetailScreen = () => {
  const { id } = useParams();
  const { data, loading } = useSeasonDetail(id);

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

  if (!data || !data.season) {
    return (
      <div
        style={{ background: '#ffffff', minHeight: '100vh' }}
        className="p-[18px] text-center"
      >
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          시즌 정보를 불러오지 못했어요
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: TEXT_PRIMARY }}>
      <SeasonHero season={data.season} />
      <SeasonStatsBox season={data.season} />
      <div className="p-[18px]">
        <PreparingBox status={data.season?.status} />
        <CurationBox body={data.season.curation_body} />
        <RecommendedPlaces
          places={data.places || []}
          totalCount={data.season.place_count || (data.places ? data.places.length : 0)}
        />
        <SeasonPhotoGrid
          photos={data.photos || []}
          total={data.photos_total || 0}
          status={data.season?.status}
        />
      </div>
    </div>
  );
};

export default SeasonDetailScreen;

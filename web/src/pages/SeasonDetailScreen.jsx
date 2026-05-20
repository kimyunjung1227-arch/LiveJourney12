import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconBookmark,
  IconCalendarTime,
  IconEdit,
  IconMapPin,
  IconChevronRight,
  IconPhoto,
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

function formatPeakLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `~${d.getMonth() + 1}/${d.getDate()}`;
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
function SeasonHero({ season }) {
  const navigate = useNavigate();
  const start = season?.cover_color_start || '#87CEEB';
  const end = season?.cover_color_end || '#4DB8E8';

  return (
    <div
      className="relative"
      style={{
        height: 200,
        background: `linear-gradient(135deg, ${start}, ${end})`,
      }}
    >
      <div className="absolute left-3.5 right-3.5 flex items-center justify-between" style={{ top: 14 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.3)',
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
          aria-label="북마크"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <IconBookmark size={18} color="white" />
        </button>
      </div>

      <div className="absolute left-4 right-4" style={{ bottom: 16 }}>
        <div
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '4px 10px',
            borderRadius: 7,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            marginBottom: 8,
          }}
        >
          <IconCalendarTime size={11} color="white" />
          <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>
            {season.period_label}
            {season.peak_label ? ` · ${season.peak_label}` : ''}
          </span>
        </div>
        <h1 className="m-0" style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>
          {season.title}
        </h1>
      </div>
    </div>
  );
}

function SeasonStatsBox({ season }) {
  const peakLabel = formatPeakLabel(season?.peak_ends_at) || formatPeakLabel(season?.ends_at);
  return (
    <div
      className="flex items-center gap-3.5"
      style={{
        padding: '16px 18px',
        background: KEY_LIGHT,
      }}
    >
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 16, fontWeight: 700, color: KEY_DARK, marginBottom: 2 }}>
          {season?.live_count || 0}장
        </p>
        <p className="m-0" style={{ fontSize: 10, color: '#4A7DA8' }}>
          실시간 라이브
        </p>
      </div>
      <div style={{ width: 1, height: 28, background: 'rgba(77, 184, 232, 0.3)' }} />
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 16, fontWeight: 700, color: KEY_DARK, marginBottom: 2 }}>
          {season?.place_count || 0}곳
        </p>
        <p className="m-0" style={{ fontSize: 10, color: '#4A7DA8' }}>
          추천 장소
        </p>
      </div>
      <div style={{ width: 1, height: 28, background: 'rgba(77, 184, 232, 0.3)' }} />
      <div className="flex-1 text-center">
        <p className="m-0" style={{ fontSize: 16, fontWeight: 700, color: KEY_DARK, marginBottom: 2 }}>
          {peakLabel || '-'}
        </p>
        <p className="m-0" style={{ fontSize: 10, color: '#4A7DA8' }}>
          절정 마감
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
          <IconEdit size={11} color="white" />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: KEY_DARK }}>
          라이브저니 큐레이션
        </span>
      </div>
      <p className="m-0" style={{ fontSize: 13, lineHeight: 1.7, color: TEXT_PRIMARY, whiteSpace: 'pre-wrap' }}>
        {body}
      </p>
    </div>
  );
}

function RecommendedPlaces({ places, totalCount }) {
  const navigate = useNavigate();
  if (!places || places.length === 0) {
    return (
      <div style={{ marginBottom: 22 }}>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
          <IconMapPin size={16} color={KEY} />
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            추천 장소
          </p>
        </div>
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
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
        <IconMapPin size={16} color={KEY} />
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          추천 장소
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {places.slice(0, 3).map((place, idx) => {
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
                <p className="m-0 truncate" style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 2 }}>
                  {place.name}
                </p>
                <div className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
                  {place.city && (
                    <span style={{ color: TEXT_SECONDARY }}>
                      {place.city}
                      {place.district ? ` ${place.district}` : ''}
                    </span>
                  )}
                  <span style={{ color: TEXT_TERTIARY }}>·</span>
                  <span style={{ color: KEY_DARK, fontWeight: 600 }}>
                    {place.live_count || 0}장 라이브
                  </span>
                </div>
              </div>
              <IconChevronRight size={16} color={TEXT_TERTIARY} className="flex-shrink-0" />
            </button>
          );
        })}

        {totalCount > 3 && (
          <button
            type="button"
            className="w-full"
            style={{
              padding: '10px 0',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 500,
              color: TEXT_SECONDARY,
              background: 'white',
              border: `1px solid ${BORDER_LIGHT}`,
              cursor: 'pointer',
            }}
          >
            추천 장소 {totalCount}곳 모두 보기
          </button>
        )}
      </div>
    </div>
  );
}

function SeasonPhotoGrid({ photos, total }) {
  const navigate = useNavigate();
  if (!photos || photos.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-1.5">
            <IconPhoto size={16} color={KEY} />
            <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
              실시간 사진
            </p>
          </div>
        </div>
        <div
          className="flex items-center justify-center"
          style={{
            padding: '32px 16px',
            borderRadius: 11,
            background: SURFACE,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            아직 실시간 사진이 없어요
          </span>
        </div>
      </div>
    );
  }

  const visible = photos.slice(0, 6);
  const extra = Math.max(0, (total || photos.length) - 6);
  const showOverlayOnLast = visible.length === 6 && extra > 0;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-1.5">
          <IconPhoto size={16} color={KEY} />
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            실시간 사진
          </p>
        </div>
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
      </div>

      <div className="grid grid-cols-3 gap-1">
        {visible.map((photo, idx) => {
          const isLast = idx === 5;
          const overlay = isLast && showOverlayOnLast;
          const url = photo.thumbnail_url ? getDisplayImageUrl(photo.thumbnail_url) : '';
          return (
            <button
              key={photo.post_id}
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
              {overlay && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)' }}
                >
                  <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>
                    +{extra}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
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
        <CurationBox body={data.season.curation_body} />
        <RecommendedPlaces
          places={data.places || []}
          totalCount={data.season.place_count || (data.places ? data.places.length : 0)}
        />
        <SeasonPhotoGrid
          photos={data.photos || []}
          total={data.photos_total || 0}
        />
      </div>
    </div>
  );
};

export default SeasonDetailScreen;

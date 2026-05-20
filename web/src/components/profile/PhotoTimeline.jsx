import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClock, IconShieldCheck, IconCamera } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
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
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return '';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const now = new Date();
  if (y === now.getFullYear()) return `${m}/${day}`;
  return `${String(y).slice(-2)}.${m}/${day}`;
}

/**
 * 전체 활동 / 지역별 두 모드.
 * 전체: 지금 라이브 + 지난 여행 두 섹션
 * 지역별: 도시 그룹별 사진
 */
export default function PhotoTimeline({ mode, livePosts, archivePosts, byCity }) {
  if (mode === 'city') {
    return <ByCityView byCity={byCity} />;
  }
  return <AllView livePosts={livePosts} archivePosts={archivePosts} />;
}

function AllView({ livePosts, archivePosts }) {
  const liveList = Array.isArray(livePosts) ? livePosts : [];
  const archiveList = Array.isArray(archivePosts) ? archivePosts : [];

  if (liveList.length === 0 && archiveList.length === 0) {
    return <Empty />;
  }

  return (
    <div>
      {liveList.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionHeader
            type="live"
            label={`지금 라이브 · ${liveList.length}`}
          />
          <PhotoGrid photos={liveList} variant="live" />
        </section>
      )}
      {archiveList.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <SectionHeader type="archive" label="지난 여행" />
          <PhotoGrid photos={archiveList} variant="archive" />
        </section>
      )}
    </div>
  );
}

function ByCityView({ byCity }) {
  const list = Array.isArray(byCity) ? byCity : [];
  if (list.length === 0) return <Empty />;
  return (
    <div>
      {list.map((group) => (
        <section key={group.city} style={{ marginBottom: 24 }}>
          <div
            className="flex items-baseline justify-between"
            style={{ marginBottom: 12 }}
          >
            <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
              {group.city}
            </p>
            <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>
              {group.live_count}장
            </span>
          </div>
          <PhotoGrid
            photos={(group.photos || []).map((p) => ({
              ...p,
              isLive: !!p.is_live,
            }))}
            variant="mixed"
          />
        </section>
      ))}
    </div>
  );
}

function SectionHeader({ type, label }) {
  const isLive = type === 'live';
  return (
    <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
      {isLive ? (
        <div
          style={{
            width: 6,
            height: 6,
            background: KEY,
            borderRadius: 999,
            boxShadow: '0 0 0 3px rgba(77, 184, 232, 0.25)',
          }}
        />
      ) : (
        <IconClock size={13} color={TEXT_SECONDARY} stroke={1.8} />
      )}
      <p
        className="m-0"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: isLive ? KEY_DARK : TEXT_SECONDARY,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function PhotoGrid({ photos, variant }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((photo) => {
        const url = photo.thumbnail_url ? getDisplayImageUrl(photo.thumbnail_url) : '';
        const isLive =
          variant === 'live' || (variant === 'mixed' && photo.isLive);
        return (
          <button
            key={photo.post_id}
            type="button"
            onClick={() => navigate(`/post/${encodeURIComponent(photo.post_id)}`)}
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
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                style={{
                  filter: isLive ? 'none' : 'saturate(0.75) brightness(0.96)',
                }}
              />
            )}
            {isLive ? (
              <div
                className="absolute flex items-center gap-1"
                style={{
                  top: 4,
                  left: 4,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <IconShieldCheck size={9} color={KEY} stroke={2.4} />
                <span style={{ fontSize: 8.5, color: 'white', fontWeight: 600 }}>
                  {timeAgo(photo.exif_taken_at) || '방금'}
                </span>
              </div>
            ) : (
              <div
                className="absolute"
                style={{
                  top: 4,
                  left: 4,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <span style={{ fontSize: 9, color: 'white', fontWeight: 600 }}>
                  {formatDate(photo.exif_taken_at)}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center" style={{ padding: '32px 16px' }}>
      <div
        className="flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: SURFACE,
          margin: '0 auto 14px',
        }}
      >
        <IconCamera size={24} color={TEXT_TERTIARY} stroke={1.6} />
      </div>
      <p className="m-0" style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 6 }}>
        아직 사진이 없어요
      </p>
      <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
        지금 거기 있는 한 장이 누군가에게 도움이 돼요
      </p>
    </div>
  );
}

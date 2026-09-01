import React, { useState } from 'react';
import { LJ, formatExifTime } from './tokens';

const COLLAPSED_COUNT = 3;
const EXPANDED_MAX = 24;

/**
 * 최근 사진 — 상세 화면에서 사진 비중을 줄이고 정보를 앞세우기 위해
 * 기본은 3장짜리 한 줄(마지막 칸에 +N)만 두고, 누르면 그 자리에서 펼친다.
 */
function Thumb({ post, overlayCount, onClick }) {
  const src = post.photo_url || post.cover_url || '';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={overlayCount ? `사진 ${overlayCount}장 더 보기` : '게시물 보기'}
      style={{
        position: 'relative',
        padding: 0,
        border: 'none',
        background: LJ.bgSurface,
        borderRadius: 8,
        overflow: 'hidden',
        aspectRatio: '1 / 1',
        cursor: 'pointer',
        minHeight: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : null}

      {overlayCount ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          +{overlayCount}
        </span>
      ) : (
        post.exif_taken_at && (
          <span
            style={{
              position: 'absolute',
              left: 5,
              bottom: 5,
              padding: '3px 6px',
              borderRadius: 5,
              background: 'rgba(0,0,0,0.62)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {formatExifTime(post.exif_taken_at)}
          </span>
        )
      )}
    </button>
  );
}

export function PlaceRecentPhotos({ posts = [], onPhotoClick }) {
  const [expanded, setExpanded] = useState(false);
  const list = (Array.isArray(posts) ? posts : []).filter((p) => p?.photo_url || p?.cover_url);
  if (list.length === 0) return null;

  const shown = expanded ? list.slice(0, EXPANDED_MAX) : list.slice(0, COLLAPSED_COUNT);
  const hiddenCount = list.length - COLLAPSED_COUNT;

  return (
    <section style={{ padding: '22px 18px 0', fontFamily: LJ.fontStack }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>최근 사진</h2>
        <span style={{ fontSize: 11, color: LJ.textTertiary, fontWeight: 500 }}>{list.length}장</span>
      </div>

      <div
        style={{
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}
      >
        {shown.map((p, i) => {
          const isLastCollapsed = !expanded && i === COLLAPSED_COUNT - 1 && hiddenCount > 0;
          return (
            <Thumb
              key={p.id}
              post={p}
              overlayCount={isLastCollapsed ? hiddenCount : 0}
              onClick={() => (isLastCollapsed ? setExpanded(true) : onPhotoClick?.(p.id))}
            />
          );
        })}
      </div>

      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '9px 0',
            background: '#fff',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 8,
            color: LJ.textSecondary,
            fontFamily: LJ.fontStack,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          접기
        </button>
      )}
    </section>
  );
}

export default PlaceRecentPhotos;

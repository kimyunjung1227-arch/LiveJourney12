import React from 'react';
import { IconShieldCheck } from '@tabler/icons-react';
import { LJ, formatExifTime } from './tokens';

/**
 * 장소 페이지 사진 그리드 (2열 정사각형).
 * - 좌상단 EXIF 시간 뱃지
 * - 클릭 → 게시물 상세
 */
export function PlacePhotoGrid({ posts = [], selectedCategory = 'all', onPhotoClick }) {
  const filtered =
    selectedCategory === 'all'
      ? posts
      : posts.filter((p) => p.category === selectedCategory);

  if (filtered.length === 0) {
    return (
      <div
        style={{
          padding: '40px 18px',
          textAlign: 'center',
          color: LJ.textSecondary,
          fontFamily: LJ.fontStack,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        이 카테고리에 사진이 없어요.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 18px' }}>
      <div
        style={{
          fontSize: 11,
          color: LJ.textSecondary,
          fontWeight: 600,
          padding: '12px 0 8px',
        }}
      >
        최근 6시간 사진
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPhotoClick?.(p.id)}
            aria-label="게시물 상세"
            style={{
              position: 'relative',
              padding: 0,
              border: 'none',
              background: LJ.bgSurface,
              borderRadius: 8,
              overflow: 'hidden',
              aspectRatio: '1 / 1',
              cursor: 'pointer',
            }}
          >
            <img
              src={p.photo_url}
              alt={p.place_name}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {p.exif_taken_at && (
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '3px 6px',
                  background: 'rgba(0,0,0,0.7)',
                  borderRadius: 5,
                  backdropFilter: 'blur(6px)',
                }}
              >
                <IconShieldCheck size={10} stroke={2} color={LJ.key} />
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 600 }}>
                  {formatExifTime(p.exif_taken_at)}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default PlacePhotoGrid;

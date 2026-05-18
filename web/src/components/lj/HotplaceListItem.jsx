import React from 'react';
import { LJ } from './tokens';

/**
 * 핫플 4~20위 리스트 아이템 (단순화 버전).
 * - 첫 썸네일 키컬러 테두리·"베스트" 뱃지 제거
 * - 모든 썸네일 EXIF 시간 뱃지 제거
 * - 통계 줄에서 성장률 ↑% 제거
 */
export function HotplaceListItem({
  rank,
  place,
  postsCount,
  bestCutPost,
  recentPosts = [],
  onClick,
}) {
  const photos = [bestCutPost, ...recentPosts].filter(Boolean).slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: '12px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: LJ.fontStack,
      }}
    >
      {/* 상단: 순위 + 장소명 + 통계 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 22,
            fontSize: 14,
            fontWeight: 700,
            color: LJ.textPrimary,
          }}
        >
          {rank}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>
            {place?.place_name || '이름 없음'}
          </div>
          <div style={{ fontSize: 10, color: LJ.textSecondary, marginTop: 2 }}>
            {place?.region ? `${place.region} · ` : ''}
            {postsCount}장
          </div>
        </div>
      </div>

      {/* 들여쓰기 사진 3장 — 테두리·뱃지 없이 단순 썸네일 */}
      {photos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 8,
            marginLeft: 30,
          }}
        >
          {photos.map((p, i) => (
            <div
              key={p.id || i}
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                overflow: 'hidden',
                background: LJ.bgSurface,
              }}
            >
              <img
                src={p.photo_url}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default HotplaceListItem;

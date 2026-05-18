import React from 'react';
import { IconCrown, IconShieldCheck } from '@tabler/icons-react';
import { LJ, formatExifTime } from './tokens';

/**
 * 핫플 4~20위 리스트 아이템.
 * 상단: 순위 + 장소명 + 통계
 * 하단(들여쓰기): 사진 3장 가로 — 첫 장 베스트 컷(키컬러 테두리 + 베스트 뱃지)
 */
export function HotplaceListItem({
  rank,
  place,
  postsCount,
  growthRate,
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
            {growthRate > 0 && (
              <span style={{ color: LJ.key, fontWeight: 600, marginLeft: 4 }}>
                ↑ {growthRate}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 들여쓰기 사진 3장 */}
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
                position: 'relative',
                width: 64,
                height: 64,
                borderRadius: 8,
                overflow: 'hidden',
                background: LJ.bgSurface,
                border: i === 0 ? `1.5px solid ${LJ.key}` : `1px solid ${LJ.borderLight}`,
              }}
            >
              <img
                src={p.photo_url}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {i === 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: 3,
                    padding: '2px 5px',
                    borderRadius: 4,
                    background: LJ.gradientBestCut,
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <IconCrown size={8} stroke={2} />
                  베스트
                </div>
              ) : (
                p.exif_taken_at && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <IconShieldCheck size={8} stroke={2} color={LJ.key} />
                    {formatExifTime(p.exif_taken_at)}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

export default HotplaceListItem;

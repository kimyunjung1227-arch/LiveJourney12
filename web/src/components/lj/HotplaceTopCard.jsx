import React, { useEffect, useState } from 'react';
import { IconFlame, IconTrendingUp } from '@tabler/icons-react';
import { LJ } from './tokens';
import { fetchPlaceDescription } from '../../api/placeDescription';
import { cleanForTwoLines } from './textHelpers';

const HEIGHT_BY_SIZE = { large: 220, medium: 180, small: 160 };

/**
 * 핫플 1~3위 강조 카드 (작성자 오버레이 없음 / 우하단 미리보기 썸네일).
 */
export function HotplaceTopCard({
  rank,
  rankLabel,
  rankIconName,
  place,
  bestCutPost,
  recentPosts = [],
  size = 'medium',
  onClick,
}) {
  const photoHeight = HEIGHT_BY_SIZE[size] || HEIGHT_BY_SIZE.medium;
  const RankIcon =
    rankIconName === 'trending' ? IconTrendingUp : rankIconName === 'flame' ? IconFlame : null;

  // 우하단 미리보기 — 최대 2장
  const previewPhotos = recentPosts.slice(0, 2);

  // Gemini 기반 장소 설명
  const [desc, setDesc] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!place?.place_name) return;
    fetchPlaceDescription({
      placeKey: place.place_name,
      regionHint: place.region || '',
    })
      .then((text) => {
        if (!cancelled && text) setDesc(cleanForTwoLines(text, 110));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [place?.place_name, place?.region]);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: LJ.fontStack,
        overflow: 'hidden',
      }}
    >
      {/* 사진 영역 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: photoHeight,
          background: LJ.bgSurface,
          overflow: 'hidden',
          borderRadius: 8,
        }}
      >
        {bestCutPost?.photo_url && (
          <img
            src={bestCutPost.photo_url}
            alt={place?.place_name || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        )}

        {/* 좌상단 순위 뱃지 */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 11px',
            background: 'rgba(0,0,0,0.85)',
            borderRadius: 7,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            backdropFilter: 'blur(8px)',
          }}
        >
          {RankIcon && <RankIcon size={12} stroke={2} color={LJ.key} />}
          {rankLabel || `${rank}위`}
        </div>

        {/* 우하단 미리보기 썸네일 */}
        {previewPhotos.length > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              display: 'flex',
              gap: 4,
            }}
          >
            {previewPhotos.map((p) => (
              <div
                key={p.id}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: LJ.bgSurface,
                  border: '1.5px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
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
      </div>

      {/* 본문 영역 — 장소명 + 설명(최대 5줄, "…" 없이 완결 문장으로 마무리) */}
      <div style={{ padding: '10px 4px 12px' }}>
        <div style={{ fontSize: size === 'large' ? 16 : 14, fontWeight: 700, color: LJ.textPrimary }}>
          {place?.place_name || '이름 없음'}
        </div>
        {desc && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              lineHeight: 1.5,
              color: LJ.textSecondary,
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {desc}
          </p>
        )}
      </div>
    </button>
  );
}

export default HotplaceTopCard;

import React, { useEffect, useState } from 'react';
import { LJ } from './tokens';
import { fetchPlaceDescription } from '../../api/placeDescription';
import { cleanForTwoLines } from './textHelpers';

/**
 * 핫플 4~20위 리스트 아이템.
 * - 순위 + 장소명 + (Gemini 설명, 최대 4줄·"…" 없이 완결 문장으로 마무리)
 * - 들여쓴 사진 3장 (테두리·뱃지 없음)
 * - 지역/장수 표시 제거
 */
export function HotplaceListItem({
  rank,
  place,
  bestCutPost,
  recentPosts = [],
  onClick,
}) {
  const photos = [bestCutPost, ...recentPosts].filter(Boolean).slice(0, 3);

  const [desc, setDesc] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!place?.place_name) return;
    fetchPlaceDescription({
      placeKey: place.place_name,
      regionHint: place.region || '',
    })
      .then((text) => {
        if (!cancelled && text) setDesc(cleanForTwoLines(text, 92));
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
        background: 'transparent',
        border: 'none',
        padding: '12px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: LJ.fontStack,
      }}
    >
      {/* 상단: 순위 + 장소명 + 설명 */}
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
          {desc && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11,
                lineHeight: 1.5,
                color: LJ.textSecondary,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {desc}
            </p>
          )}
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

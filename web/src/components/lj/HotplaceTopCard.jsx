import React from 'react';
import { IconFlame, IconTrendingUp, IconCrown, IconShieldCheck } from '@tabler/icons-react';
import { LJ, formatExifTime } from './tokens';

const HEIGHT_BY_SIZE = { large: 220, medium: 180, small: 160 };

/**
 * 핫플 1~3위 강조 카드.
 * - 키컬러 테두리 + 베스트컷 사진 큰 영역
 * - 좌상단 순위 뱃지(검정 + 키컬러 아이콘)
 * - 우상단 베스트컷 그라데이션 뱃지
 * - 사진 하단 그라데이션 오버레이 + 작성자
 */
export function HotplaceTopCard({
  rank,
  rankLabel,
  rankIconName,
  place,
  bestCutPost,
  postsCount,
  growthRate,
  viewingCount,
  size = 'medium',
  onClick,
}) {
  const photoHeight = HEIGHT_BY_SIZE[size] || HEIGHT_BY_SIZE.medium;
  const RankIcon = rankIconName === 'trending' ? IconTrendingUp : rankIconName === 'flame' ? IconFlame : null;
  const author = bestCutPost?.author || {};

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: '#fff',
        border: `1.5px solid ${LJ.key}`,
        borderRadius: 14,
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: LJ.fontStack,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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

        {/* 우상단 베스트 컷 그라데이션 뱃지 */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            background: LJ.gradientBestCut,
            borderRadius: 7,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          <IconCrown size={11} stroke={2} />
          베스트 컷
        </div>

        {/* 좌상단 EXIF (작게, 순위 뱃지 아래) — 생략 (공간상)
            대신 하단 그라데이션 + 작성자 오버레이 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '24px 12px 10px',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              minWidth: 26,
              borderRadius: '50%',
              background: LJ.key,
              border: '1.5px solid #fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              overflow: 'hidden',
            }}
          >
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              (author.nickname || '?').slice(0, 1)
            )}
          </div>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
            {author.nickname || '익명'}
          </span>
          {bestCutPost?.exif_taken_at && (
            <span
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: 'rgba(255,255,255,0.85)',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <IconShieldCheck size={11} stroke={2} color={LJ.key} />
              {formatExifTime(bestCutPost.exif_taken_at)}
            </span>
          )}
        </div>
      </div>

      {/* 본문 영역 */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: size === 'large' ? 16 : 14, fontWeight: 700, color: LJ.textPrimary }}>
          {place?.place_name || '이름 없음'}
        </div>
        {place?.region && (
          <div style={{ fontSize: 11, color: LJ.textSecondary, marginTop: 2 }}>
            {place.region}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 11, color: LJ.textSecondary }}>
          <span>{postsCount}장</span>
          {growthRate > 0 && (
            <span style={{ color: LJ.key, fontWeight: 600 }}>↑ {growthRate}%</span>
          )}
          {typeof viewingCount === 'number' && viewingCount > 0 && (
            <span>지금 {viewingCount}명 보는 중</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default HotplaceTopCard;

import React from 'react';
import BadgeIcon from './BadgeIcon';

/**
 * 뱃지 칩 — 가로 한 줄 "인증 태그".
 *
 * 디자인 원칙
 * - [미니 아이콘] + [라벨] 한 줄. "이 사람 = 벚꽃 전문"이 즉시 읽히는 크리덴셜 태그.
 * - 테두리 없음. 키컬러 하늘색.
 *     · 탐험가/톡파원(low·mid): 옅은 하늘 배경 + 하늘색 텍스트
 *     · 마스터(high): 솔리드 하늘색 배경 + 흰 텍스트 (최상위·신뢰 강조)
 *     · 미획득: 옅은 회색 톤
 *
 * props: meta(뱃지 메타) / size('sm'|'md'|'lg') / earned / onClick
 */
export default function BadgeChip({ meta, size = 'md', earned = true, onClick }) {
  const dims = SIZES[size] || SIZES.md;
  const tone = getChipTone(meta.tier, earned);
  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={meta.name}
      className="inline-flex items-center"
      style={{
        gap: dims.gap,
        background: tone.bg,
        color: tone.text,
        border: 'none',
        borderRadius: 999,
        padding: `${dims.padV}px ${dims.padH}px ${dims.padV}px ${dims.padL}px`,
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1,
        maxWidth: '100%',
        boxShadow: tone.shadow,
      }}
    >
      <BadgeIcon
        motif={meta.motif}
        level={meta.level}
        size={dims.icon}
        growth={!!meta.chainId}
        earned={earned}
        palette={tone.iconPalette}
        style={{ flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: dims.font,
          fontWeight: 700,
          letterSpacing: -0.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {meta.name}
      </span>
    </Tag>
  );
}

const SIZES = {
  sm: { icon: 18, font: 11, padV: 4, padH: 9, padL: 5, gap: 4 },
  md: { icon: 24, font: 12.5, padV: 5, padH: 12, padL: 6, gap: 6 },
  lg: { icon: 30, font: 14.5, padV: 7, padH: 15, padL: 8, gap: 8 },
};

/* 칩 톤 — 키컬러 하늘색 패밀리. 마스터만 솔리드.
 * 솔리드 아이콘이므로 sub(내부 컷아웃)는 칩 배경색과 동일 → 진짜 구멍처럼 뚫림. */
export function getChipTone(tier, earned = true) {
  if (!earned) {
    return {
      bg: '#F1F3F5',
      text: '#9AA3AB',
      shadow: 'none',
      iconPalette: { key: '#BCC3CA', sub: '#F1F3F5', accent: '#BCC3CA' },
    };
  }
  switch (tier) {
    case 'high': // 마스터 — 솔리드 하늘색 + 흰 텍스트/아이콘
      return {
        bg: '#2BA0DC',
        text: '#FFFFFF',
        shadow: '0 2px 6px rgba(43,160,220,0.32)',
        iconPalette: { key: '#FFFFFF', sub: '#2BA0DC', accent: '#FFE08A' },
      };
    case 'mid': // 톡파원/카테고리 — 옅은 하늘 + 하늘색
      return {
        bg: '#E3F3FB',
        text: '#1577B5',
        shadow: 'none',
        iconPalette: { key: '#2BA0DC', sub: '#E3F3FB', accent: '#2BA0DC' },
      };
    case 'low': // 탐험가 — 더 옅은 하늘
    default:
      return {
        bg: '#EEF6FB',
        text: '#4E83AC',
        shadow: 'none',
        iconPalette: { key: '#5FB6E4', sub: '#EEF6FB', accent: '#5FB6E4' },
      };
  }
}

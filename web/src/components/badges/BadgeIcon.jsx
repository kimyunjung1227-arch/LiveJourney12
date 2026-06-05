import React from 'react';
import { ICONS } from './badgeIcons';
import { ICON_PALETTE, ICON_PALETTE_GRAY, monoIconPalette } from './badgeTheme';

/**
 * 뱃지 아이콘 — 플랫 듀오톤 면 아이콘.
 *
 * 디자인 원칙 (v8)
 * - 컨테이너 없음. 통일 팔레트(하늘 + 앰버·코랄)의 면 아이콘만 렌더.
 * - earned=false → 회색조 팔레트.
 * - mono={{ fg, bg }} 가 주어지면(칩 등 작은 사이즈) 단색으로 렌더 — 컷아웃은 bg 색.
 *
 * props: motif / size / earned / mono / style (level·growth·palette 는 구버전 호환용 무시)
 */
export default function BadgeIcon({ motif, size = 64, earned = true, mono, style }) {
  const Cmp = ICONS[motif] || ICONS.honor;
  const palette = mono
    ? monoIconPalette(mono.fg, mono.bg)
    : earned
    ? ICON_PALETTE
    : ICON_PALETTE_GRAY;

  return <Cmp size={size} palette={palette} style={{ display: 'block', ...style }} />;
}

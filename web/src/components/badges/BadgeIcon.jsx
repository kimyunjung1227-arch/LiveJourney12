import React from 'react';
import { ICONS } from './badgeIcons';

/**
 * 뱃지 아이콘 — Tabler 전문 아이콘 세트 기반.
 *
 * 디자인 원칙
 * - 컨테이너/테두리 없음. 일관된 라인 아이콘을 키컬러(하늘색)로 렌더.
 * - 성장(level 1→2→3)은 키컬러 농도로 표현. 마스터 강조는 칩 톤(솔리드)에서 처리.
 * - palette 가 주어지면(칩 톤) 그 색으로, 아니면 단계 색으로.
 *
 * props: motif / level(1|2|3) / size / earned / growth / palette
 */
export default function BadgeIcon({ motif, level = 1, size = 64, earned = true, growth = true, palette, style }) {
  const lv = Math.max(1, Math.min(3, level | 0));
  const color = (palette && palette.key) || TIERS[growth ? lv : 2];
  const Cmp = ICONS[motif] || ICONS.honor;

  return (
    <Cmp
      size={size}
      color={color}
      stroke={2}
      aria-hidden
      style={{
        display: 'block',
        opacity: earned ? 1 : 0.4,
        filter: earned ? undefined : 'grayscale(1)',
        ...style,
      }}
    />
  );
}

/* 단계별 키컬러(하늘색) 농도 */
const TIERS = {
  1: '#5FB6E4',
  2: '#2BA0DC',
  3: '#1379B7',
};

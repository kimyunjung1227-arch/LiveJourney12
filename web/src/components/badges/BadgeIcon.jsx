import React from 'react';
import { ICONS } from './badgeIcons';
import { lineColorForLevel, LOCK_LINE } from './badgeTheme';

/**
 * 뱃지 아이콘 — 커스텀 라인 아이콘(흰 배경 톤).
 *
 * 디자인 원칙
 * - 컨테이너/테두리 없음. 일관된 라인 아이콘을 등급색으로 렌더.
 * - 성장 단계는 별/왕관 스티커가 아니라 "라인 색 농도"로 표현:
 *     탐험가(연하늘) → 톡파원(브랜드 하늘) → 마스터(딥). (마스터의 반짝이·후광은 메달리온에서)
 * - palette 가 주어지면(칩 톤) 아이콘 색을 그 색으로 덮어쓴다.
 *
 * props: motif / level(1|2|3) / size / earned / growth(미사용·호환용) / palette
 */
export default function BadgeIcon({ motif, level = 1, size = 64, earned = true, palette, style }) {
  const Cmp = ICONS[motif] || ICONS.honor;
  const color = !earned ? LOCK_LINE : (palette && palette.key) || lineColorForLevel(level);
  const stroke = size <= 22 ? 2 : 1.8; // 작은 칩에서 또렷하게

  return (
    <Cmp
      size={size}
      color={color}
      stroke={stroke}
      aria-hidden
      style={{ display: 'block', ...style }}
    />
  );
}

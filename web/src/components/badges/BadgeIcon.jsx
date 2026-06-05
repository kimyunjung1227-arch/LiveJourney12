import React from 'react';
import { ICONS } from './badgeIcons';

/**
 * 뱃지 아이콘 — Tabler 전문 아이콘 + 등급 성장 디테일.
 *
 * 디자인 원칙
 * - 컨테이너/테두리 없음. 일관된 라인 아이콘을 키컬러(하늘색)로 렌더.
 * - 성장형(level 1→2→3)은 단계가 오를수록 디테일이 "누적"된다:
 *     · 선 굵기:  1.7 → 2.0 → 2.4 (굵어짐)
 *     · 색 농도:  라이트 → 브랜드 → 딥 스카이
 *     · 등급 표식: 탐험가(없음) → 톡파원(★) → 마스터(👑 왕관)
 * - 비성장형(카테고리)은 표식 없이 브랜드 톤 고정.
 * - palette 가 주어지면(칩 톤) 아이콘 색만 그 색으로 덮어쓴다.
 *
 * props: motif / level(1|2|3) / size / earned / growth / palette
 */
export default function BadgeIcon({ motif, level = 1, size = 64, earned = true, growth = true, palette, style }) {
  const lv = Math.max(1, Math.min(3, level | 0));
  const tier = TIERS[growth ? lv : 2];
  const color = (palette && palette.key) || tier.color;
  const Cmp = ICONS[motif] || ICONS.honor;

  // 성장형일 때만 등급 표식: 톡파원=별, 마스터=왕관
  const mark = growth ? (lv >= 3 ? 'crown' : lv === 2 ? 'star' : null) : null;
  const ms = Math.max(10, Math.round(size * 0.4)); // 표식 크기

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        ...style,
      }}
    >
      <Cmp
        size={size}
        color={color}
        stroke={tier.stroke}
        aria-hidden
        style={{
          display: 'block',
          opacity: earned ? 1 : 0.4,
          filter: earned ? undefined : 'grayscale(1)',
        }}
      />
      {earned && mark && (
        <span
          style={{
            position: 'absolute',
            top: -ms * 0.16,
            right: -ms * 0.16,
            width: ms,
            height: ms,
            lineHeight: 0,
          }}
        >
          {mark === 'crown' ? <CrownMark size={ms} /> : <StarMark size={ms} />}
        </span>
      )}
    </span>
  );
}

/* 단계별 키컬러(하늘색) 농도 + 선 굵기 */
const TIERS = {
  1: { color: '#5FB6E4', stroke: 1.7 },
  2: { color: '#2BA0DC', stroke: 2.0 },
  3: { color: '#1379B7', stroke: 2.4 },
};

const MARK = '#FFC24D'; // 등급 표식(골드 포인트)
const HALO = '#FFFFFF'; // 어떤 배경에서도 보이도록 흰 외곽

function StarMark({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }} aria-hidden>
      <path
        d="M12 2.4 L14.8 8.9 L21.8 9.5 L16.4 14 L18.1 20.9 L12 17 L5.9 20.9 L7.6 14 L2.2 9.5 L9.2 8.9 Z"
        fill={MARK}
        stroke={HALO}
        strokeWidth="2.4"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}

function CrownMark({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }} aria-hidden>
      <path
        d="M3.6 8.4 L8.4 13.4 L12 5.4 L15.6 13.4 L20.4 8.4 L18.6 19 L5.4 19 Z"
        fill={MARK}
        stroke={HALO}
        strokeWidth="2.4"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}

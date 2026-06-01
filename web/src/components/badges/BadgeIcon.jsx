import React, { useId } from 'react';
import { MOTIFS } from './badgeMotifs';

/**
 * 뱃지 아이콘 — 볼드 플랫(앱아이콘) 스타일.
 *
 * 디자인 원칙
 * - 둥근 사각형(스퀘르클) 단색 배경 + 흰색 볼드 글리프. 깔끔·모던·확장성.
 * - 성장(level 1→2→3)은 "배경 색 깊이 + 별 포인트"로 표현:
 *     · level 1 (탐험가): 라이트 스카이
 *     · level 2 (톡파원): 브랜드 스카이 + 별 2
 *     · level 3 (마스터): 딥 스카이 + 골드 별 3 + 살짝의 광택
 * - 키컬러는 하늘색으로 통일. 카테고리(단일 단계)는 브랜드 톤 고정.
 *
 * props: motif / level(1|2|3) / size / earned / growth(성장형 여부)
 */
export default function BadgeIcon({ motif, level = 1, size = 64, earned = true, growth = true, style }) {
  const raw = useId();
  const uid = `bi${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const lv = Math.max(1, Math.min(3, level | 0));
  const t = TIERS[growth ? lv : 2];
  const draw = MOTIFS[motif] || MOTIFS.honor;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-hidden
      style={{
        display: 'block',
        overflow: 'visible',
        filter: earned ? undefined : 'grayscale(0.92)',
        opacity: earned ? 1 : 0.45,
        ...style,
      }}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.c1} />
          <stop offset="100%" stopColor={t.c2} />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x="8" y="8" width="84" height="84" rx="25" />
        </clipPath>
        <filter id={`${uid}-sh`} x="-25%" y="-20%" width="150%" height="155%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="2.6" floodColor={t.c2} floodOpacity="0.32" />
        </filter>
      </defs>

      {/* 스퀘르클 배경 + 소프트 섀도 */}
      <rect x="8" y="8" width="84" height="84" rx="25" fill={`url(#${uid}-bg)`} filter={`url(#${uid}-sh)`} />

      <g clipPath={`url(#${uid}-clip)`}>
        {/* 상단 광택 */}
        <ellipse cx="44" cy="14" rx="52" ry="26" fill="#FFFFFF" opacity="0.12" />
        {/* 글리프 */}
        <g>{draw('#FFFFFF', t.solid)}</g>
        {/* 성장 별 포인트 */}
        {growth && lv >= 2 && <Stars count={lv} gold={lv >= 3} />}
      </g>
    </svg>
  );
}

/* 단계 팔레트 — 하늘색 채도/명도 램프 */
const TIERS = {
  1: { c1: '#7FCDEF', c2: '#5CB6E6', solid: '#6CC0EA' },
  2: { c1: '#39A9E1', c2: '#1E8FCC', solid: '#2BA0DC' },
  3: { c1: '#1E8FCF', c2: '#0E6B9E', solid: '#157FBE' },
};

const GOLD = '#FFD24D';

function Stars({ count, gold }) {
  const cy = 84;
  const gap = 7;
  const start = 50 - ((count - 1) * gap) / 2;
  const fill = gold ? GOLD : '#FFFFFF';
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    dots.push(<path key={i} d={starPath(start + i * gap, cy, 2.9, 1.25)} fill={fill} />);
  }
  return <g opacity={gold ? 1 : 0.92}>{dots}</g>;
}

function starPath(cx, cy, outer, inner, points = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i + (rotDeg * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

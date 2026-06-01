import React, { useId } from 'react';
import { MOTIFS } from './badgeMotifs';

/**
 * 뱃지 아이콘 — 라이브저니 톤(소프트 플랫 일러스트).
 *
 * 디자인 원칙 (첨부 레퍼런스 기준)
 * - 테두리/컨테이너 없음. 아이콘(모티프)만 크게 노출.
 * - 성장은 프레임이 아니라 "아이콘 자체"로 표현한다:
 *     · level 1: 기본 모티프 (옅은 채도)
 *     · level 2: 채도 ↑ + 보조 장식(반짝이 1)
 *     · level 3: 채도 최대 + 장식(반짝이 군집) + 후광(soft halo), 일부 모티프는 디테일 추가
 * - 키컬러는 하늘색. 카테고리(벚꽃/노을 등)는 고유 색을 유지.
 *
 * props: motif / level(1|2|3) / size / earned / growth(성장형 여부)
 */
export default function BadgeIcon({ motif, level = 1, size = 64, earned = true, growth = true, style }) {
  const raw = useId();
  const uid = `bi${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const lv = Math.max(1, Math.min(3, level | 0));
  const P = PALETTE[growth ? lv : 2];
  const draw = MOTIFS[motif] || MOTIFS.honor;
  const decoLv = growth ? lv : 0;

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
        <radialGradient id={`${uid}-halo`} cx="0.5" cy="0.46" r="0.55">
          <stop offset="0%" stopColor="#FFF4D6" stopOpacity="0.85" />
          <stop offset="42%" stopColor="#CFEBFB" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#CFEBFB" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 후광 (마스터) */}
      {decoLv >= 3 && <circle cx="50" cy="50" r="48" fill={`url(#${uid}-halo)`} />}

      {/* 모티프 */}
      <g>{draw(P, uid, lv)}</g>

      {/* 반짝이 장식 (톡파원 1 / 마스터 군집) */}
      {decoLv >= 2 && <Sparkles lv={lv} />}
    </svg>
  );
}

/* 단계 팔레트 — 하늘색 채도 램프 */
const PALETTE = {
  1: { c1: '#D6EEFA', c2: '#A9D6F0', deep: '#8CC4E7', hi: '#FFFFFF' },
  2: { c1: '#86D0F4', c2: '#36A3DF', deep: '#2A86C6', hi: '#EAF8FF' },
  3: { c1: '#62CBF7', c2: '#1B92D8', deep: '#1380C3', hi: '#EAF8FF' },
};

const SPARK = '#FFD060';

function Sparkles({ lv }) {
  const items = lv >= 3 ? [[78, 26, 9], [65, 15, 4.6], [85, 40, 3.2]] : [[78, 28, 6.6]];
  return (
    <g>
      {items.map(([x, y, r], i) => (
        <g key={i}>
          <path d={star4(x, y, r, r * 0.34)} fill={SPARK} />
          <circle cx={x} cy={y} r={r * 0.2} fill="#FFFFFF" />
        </g>
      ))}
    </g>
  );
}

function star4(cx, cy, outer, inner) {
  let d = '';
  for (let i = 0; i < 8; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

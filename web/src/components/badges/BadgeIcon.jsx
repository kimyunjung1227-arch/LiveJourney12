import React from 'react';
import { MOTIFS } from './badgeMotifs';

/**
 * 뱃지 아이콘 — 테두리 없는 플랫 듀오톤 심볼.
 *
 * 디자인 원칙
 * - 컨테이너/배경 타일/테두리/그림자/광택 없음. 흰 카드 위에 바로 얹히는 깔끔한 아이콘.
 * - 키컬러는 하늘색. 서브는 2개(옅은 하늘 + 따뜻한 앰버 포인트)로 제한.
 * - 성장(level 1→2→3)은 "키컬러 농도"로 표현, 마스터(level 3)만 작은 포인트 표식:
 *     · level 1 (탐험가): 라이트 스카이
 *     · level 2 (톡파원/카테고리): 브랜드 스카이
 *     · level 3 (마스터): 딥 스카이 + 우상단 스파클
 *
 * props: motif / level(1|2|3) / size / earned / growth(성장형 여부)
 */
export default function BadgeIcon({ motif, level = 1, size = 64, earned = true, growth = true, style }) {
  const lv = Math.max(1, Math.min(3, level | 0));
  const t = TIERS[growth ? lv : 2];
  const draw = MOTIFS[motif] || MOTIFS.honor;
  const isMaster = growth && lv >= 3;

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
        filter: earned ? undefined : 'grayscale(0.95)',
        opacity: earned ? 1 : 0.4,
        ...style,
      }}
    >
      {/* 듀오톤 글리프 (배경/테두리 없음) */}
      <g>{draw({ key: t.key, sub: t.sub, accent: ACCENT })}</g>

      {/* 마스터 표식 — 우상단 작은 스파클 */}
      {isMaster && <path d={starPath(80, 22, 7.5, 2.9, 4)} fill={ACCENT} />}
    </svg>
  );
}

/* 단계 팔레트 — 하늘색 명도 램프(키컬러) + 옅은 하늘(서브1) */
const TIERS = {
  1: { key: '#74C4EA', sub: '#CFEAFB' },
  2: { key: '#2BA0DC', sub: '#C2E6F8' },
  3: { key: '#1379B7', sub: '#A6D7F1' },
};

/* 서브2 — 따뜻한 앰버 포인트 (해·별·보석·마스터 표식에만 절제 사용) */
const ACCENT = '#FFC24D';

function starPath(cx, cy, outer, inner, points = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i + (rotDeg * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

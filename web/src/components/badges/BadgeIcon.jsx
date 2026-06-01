import React, { useId } from 'react';
import { MOTIFS } from './badgeMotifs';

/**
 * 성장형 뱃지 문장(crest) 렌더러 — 전 뱃지 공통 SVG 아이콘.
 *
 * 디자인 원칙
 * - 키컬러: 하늘색(스카이블루) 계열 그라데이션 방패.
 * - 권위(prestige): 방패 프레임 + 월계관 + 왕관 + 리본 + 광채로 격을 표현.
 * - 성장(level 1→2→3)에 따라 디테일이 누적된다.
 *     · level 1 (탐험가): 단일 은빛 프레임 + 모티프 + 별 1
 *     · level 2 (톡파원): 이중 프레임 + 월계 가지 + 리본 + 별 2
 *     · level 3 (마스터): 금빛 프레임 + 왕관 + 광채 + 월계관 + 금리본 + 별 3
 *
 * props
 * - motif  : 모티프 키 (지역/카테고리) → badgeMotifs.MOTIFS
 * - level  : 1 | 2 | 3
 * - size   : px (정사각)
 * - earned : false면 무채색 처리
 */
export default function BadgeIcon({ motif, level = 1, size = 60, earned = true, style }) {
  const raw = useId();
  const uid = `bi${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const lv = Math.max(1, Math.min(3, level | 0));
  const gold = lv >= 3;

  const drawMotif = MOTIFS[motif] || MOTIFS.honor;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 104"
      role="img"
      aria-hidden
      style={{
        display: 'block',
        overflow: 'visible',
        filter: earned ? undefined : 'grayscale(0.92)',
        opacity: earned ? 1 : 0.5,
        ...style,
      }}
    >
      <defs>
        {/* 방패 본체 */}
        <linearGradient id={`${uid}-shield`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FD3F4" />
          <stop offset="48%" stopColor="#34A2DC" />
          <stop offset="100%" stopColor="#125E8C" />
        </linearGradient>
        {/* 안쪽 패널 (살짝 밝게 → 입체 림) */}
        <linearGradient id={`${uid}-panel`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#65C2EE" />
          <stop offset="60%" stopColor="#2A8FCB" />
          <stop offset="100%" stopColor="#13638F" />
        </linearGradient>
        {/* 프레임: 레벨별 은/금 */}
        <linearGradient id={`${uid}-frame`} x1="0" y1="0" x2="1" y2="1">
          {gold ? (
            <>
              <stop offset="0%" stopColor="#FFF3CC" />
              <stop offset="42%" stopColor="#F3CA63" />
              <stop offset="100%" stopColor="#BD8A28" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#CFE3F0" />
              <stop offset="100%" stopColor="#9BBED4" />
            </>
          )}
        </linearGradient>
        {/* 금속 광채(왕관/리본/별) */}
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF0BE" />
          <stop offset="50%" stopColor="#F2C75C" />
          <stop offset="100%" stopColor="#C18A29" />
        </linearGradient>
        <linearGradient id={`${uid}-silver`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#D7E7F2" />
          <stop offset="100%" stopColor="#A8C5D8" />
        </linearGradient>
        <radialGradient id={`${uid}-sheen`} cx="0.5" cy="0.28" r="0.75">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 1. 광채 (level 3) */}
      {lv >= 3 && <Sunburst uid={uid} />}

      {/* 2. 월계 가지 (level 2+) — 방패 뒤에서 옆으로 */}
      {lv >= 2 && (
        <>
          <Laurel uid={uid} side="left" gold={gold} full={lv >= 3} />
          <Laurel uid={uid} side="right" gold={gold} full={lv >= 3} />
        </>
      )}

      {/* 3. 방패 프레임 */}
      <path d={SHIELD} fill={`url(#${uid}-frame)`} stroke={gold ? '#9C6E1C' : '#88AABF'} strokeWidth="1.1" />
      {/* level 2+ 이중 프레임 라인 */}
      {lv >= 2 && (
        <path d={SHIELD_MID} fill="none" stroke={gold ? '#FBE6A6' : '#FFFFFF'} strokeWidth="0.9" opacity="0.85" />
      )}

      {/* 4. 안쪽 패널 + 광택 */}
      <path d={PANEL} fill={`url(#${uid}-panel)`} />
      <path d={PANEL} fill={`url(#${uid}-sheen)`} />
      <path d={PANEL} fill="none" stroke="#BFEAFF" strokeWidth="0.8" opacity="0.4" />

      {/* 5. 별 pips (개수 = level) */}
      <Stars uid={uid} count={lv} />

      {/* 6. 모티프 글리프 */}
      <g
        fill="none"
        stroke="#ECFAFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawMotif('#ECFAFF')}
      </g>

      {/* 7. 리본 (level 2+) */}
      {lv >= 2 && <Ribbon uid={uid} gold={gold} />}

      {/* 8. 왕관 (level 3) */}
      {lv >= 3 && <Crown uid={uid} />}
    </svg>
  );
}

/* ── 방패 패스 ─────────────────────────────────────────────── */
const SHIELD =
  'M27 24 L73 24 Q78 24 78 29 V52 Q78 73 50 91 Q22 73 22 52 V29 Q22 24 27 24 Z';
const SHIELD_MID =
  'M29 26.5 L71 26.5 Q75.5 26.5 75.5 31 V52 Q75.5 70.5 50 87.5 Q24.5 70.5 24.5 52 V31 Q24.5 26.5 29 26.5 Z';
const PANEL =
  'M30 28 L70 28 Q74 28 74 32 V52 Q74 69 50 85 Q26 69 26 52 V32 Q26 28 30 28 Z';

/* ── 광채(sunburst) ────────────────────────────────────────── */
function Sunburst({ uid }) {
  const rays = [];
  const cx = 50;
  const cy = 53;
  for (let i = 0; i < 16; i += 1) {
    const a = (Math.PI / 8) * i;
    const w = 0.09;
    const x1 = cx + Math.cos(a - w) * 25;
    const y1 = cy + Math.sin(a - w) * 25;
    const x2 = cx + Math.cos(a + w) * 25;
    const y2 = cy + Math.sin(a + w) * 25;
    const x3 = cx + Math.cos(a) * 50;
    const y3 = cy + Math.sin(a) * 50;
    rays.push(
      <path
        key={i}
        d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
        fill={`url(#${uid}-gold)`}
        opacity={i % 2 === 0 ? 0.4 : 0.18}
      />
    );
  }
  return <g>{rays}</g>;
}

/* ── 월계 가지 ─────────────────────────────────────────────── */
function Laurel({ uid, side, gold, full }) {
  const sign = side === 'left' ? -1 : 1;
  const color = gold ? `url(#${uid}-gold)` : `url(#${uid}-silver)`;
  // 가지 줄기: 방패 옆을 따라 위로 휘는 곡선
  const baseX = 50 + sign * 26;
  const leaves = [];
  const n = full ? 6 : 5;
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const ly = 84 - t * 42; // 아래 → 위
    const lx = baseX + sign * (2 + Math.sin(t * Math.PI) * 5);
    const rot = sign * (35 + t * 40);
    leaves.push(
      <ellipse
        key={i}
        cx={lx}
        cy={ly}
        rx="4.6"
        ry="2.3"
        fill={color}
        stroke={gold ? '#A9781F' : '#9DBED2'}
        strokeWidth="0.5"
        transform={`rotate(${rot} ${lx} ${ly})`}
      />
    );
  }
  return (
    <g opacity="0.96">
      <path
        d={`M${baseX} 85 Q${baseX + sign * 7} 64 ${baseX + sign * 2} 42`}
        fill="none"
        stroke={gold ? '#C79A33' : '#AFC9DA'}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {leaves}
      {full && (
        // 하단에서 두 가지를 묶는 매듭(마스터 전용)
        <circle cx="50" cy="88" r="2.6" fill={color} stroke={gold ? '#A9781F' : '#9DBED2'} strokeWidth="0.5" />
      )}
    </g>
  );
}

/* ── 왕관 ──────────────────────────────────────────────────── */
function Crown({ uid }) {
  return (
    <g>
      <path
        d="M38 21 L36 8 L45 16 L50 5 L55 16 L64 8 L62 21 Z"
        fill={`url(#${uid}-gold)`}
        stroke="#9C6E1C"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="38" y="20" width="24" height="4.4" rx="1.4" fill={`url(#${uid}-gold)`} stroke="#9C6E1C" strokeWidth="0.8" />
      <circle cx="50" cy="9" r="1.7" fill="#FFF3CC" stroke="#9C6E1C" strokeWidth="0.6" />
      <circle cx="36.5" cy="9.5" r="1.3" fill="#FFF3CC" stroke="#9C6E1C" strokeWidth="0.5" />
      <circle cx="63.5" cy="9.5" r="1.3" fill="#FFF3CC" stroke="#9C6E1C" strokeWidth="0.5" />
    </g>
  );
}

/* ── 리본 배너 ─────────────────────────────────────────────── */
function Ribbon({ uid, gold }) {
  const fill = gold ? `url(#${uid}-gold)` : `url(#${uid}-silver)`;
  const edge = gold ? '#A9781F' : '#9DBED2';
  return (
    <g>
      {/* 양쪽 꼬리 */}
      <path d="M30 82 L42 86 L40 93 L26 90 Z" fill={fill} stroke={edge} strokeWidth="0.7" strokeLinejoin="round" opacity="0.95" />
      <path d="M70 82 L58 86 L60 93 L74 90 Z" fill={fill} stroke={edge} strokeWidth="0.7" strokeLinejoin="round" opacity="0.95" />
      {/* 본체 */}
      <path d="M35 83 L65 83 L62 89 L65 95 L35 95 L38 89 Z" fill={fill} stroke={edge} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M40 88.5 H60" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.5" strokeLinecap="round" />
    </g>
  );
}

/* ── 별 pips ───────────────────────────────────────────────── */
function Stars({ uid, count }) {
  const cy = 35;
  const r = 3.2;
  const positions =
    count === 1 ? [50] : count === 2 ? [44, 56] : [42, 50, 58];
  return (
    <g fill={`url(#${uid}-gold)`} stroke="#9C6E1C" strokeWidth="0.5">
      {positions.map((cx, i) => (
        <path key={i} d={starPath(cx, count === 3 && i === 1 ? cy - 1.5 : cy, r, r * 0.44)} />
      ))}
    </g>
  );
}

function starPath(cx, cy, outer, inner, points = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i + (rotDeg * Math.PI) / 180;
    const x = cx + rad * Math.cos(a);
    const y = cy + rad * Math.sin(a);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

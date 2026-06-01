import React, { useId } from 'react';
import { MOTIFS } from './badgeMotifs';

/**
 * 뱃지 아이콘 — 라이브저니 톤(플랫·미니멀·둥근·하늘색)에 맞춘 모던 어치브먼트 뱃지.
 *
 * 디자인 원칙
 * - 형태: 모서리가 둥근 육각형(어치브먼트 뱃지의 보편적 형태) + 얇은 림.
 * - 플랫: 은은한 하늘색 그라데이션, 무거운 그림자/금속질감 없음.
 * - 성장(level 1→2→3)은 장식이 아니라 깊이·링·작은 인디케이터로 절제되게 표현.
 *     · level 1 (탐험가): 라이트 스카이 + 단일 림 + 모티프 + 점 1
 *     · level 2 (톡파원): 브랜드 스카이 + 이중 림 + 점 2
 *     · level 3 (마스터): 딥 스카이 + 골드 포인트 림/별 + 점 3  (키컬러는 하늘색 유지)
 *
 * props: motif / level(1|2|3) / size / earned
 */
export default function BadgeIcon({ motif, level = 1, size = 60, earned = true, style }) {
  const raw = useId();
  const uid = `bi${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const lv = Math.max(1, Math.min(3, level | 0));
  const t = TIERS[lv];

  const drawMotif = MOTIFS[motif] || MOTIFS.honor;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-hidden
      style={{ display: 'block', filter: earned ? undefined : 'grayscale(0.92)', opacity: earned ? 1 : 0.5, ...style }}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.c1} />
          <stop offset="100%" stopColor={t.c2} />
        </linearGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30" />
          <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 림(테두리) */}
      <path d={HEX_RIM} fill={t.rim} />
      {/* 골드 포인트 외곽선 (마스터) */}
      {lv >= 3 && <path d={HEX_RIM} fill="none" stroke={GOLD} strokeWidth="2" />}

      {/* 본체 */}
      <path d={HEX_BODY} fill={`url(#${uid}-body)`} />
      {/* 상단 살짝 광택(플랫 유지) */}
      <path d={HEX_BODY} fill={`url(#${uid}-sheen)`} />
      {/* 이중 림 라인 (톡파원·마스터) */}
      {lv >= 2 && <path d={HEX_INNER} fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.5" />}

      {/* 모티프 */}
      <g
        transform="translate(3 1) scale(0.94)"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {drawMotif('#FFFFFF')}
      </g>

      {/* 마스터 골드 별 (상단) */}
      {lv >= 3 && <path d={starPath(50, 23, 4.2, 1.9)} fill={GOLD} />}

      {/* 성장 점 인디케이터 (개수 = level) */}
      <Pips count={lv} gold={lv >= 3} />
    </svg>
  );
}

/* ── 색상 토큰 (하늘색 키컬러 유지, 마스터만 골드 포인트) ──────────── */
const GOLD = '#F4C04E';
const TIERS = {
  1: { c1: '#7BCDEE', c2: '#46A9DC', rim: '#D9EFFA' },
  2: { c1: '#52BAEA', c2: '#1F86BE', rim: '#E7F4FC' },
  3: { c1: '#3CA5DD', c2: '#115A87', rim: '#FFF1D2' },
};

/* ── 둥근 육각형 패스 ─────────────────────────────────────────── */
function hexPath(cx, cy, R, corner) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2; // pointy-top
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return roundedPoly(pts, corner);
}

function roundedPoly(pts, r) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const a = edgePoint(p1, p0, r);
    const b = edgePoint(p1, p2, r);
    d += `${i === 0 ? 'M' : 'L'}${a[0].toFixed(2)} ${a[1].toFixed(2)} `;
    d += `Q${p1[0].toFixed(2)} ${p1[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)} `;
  }
  return `${d}Z`;
}

function edgePoint(from, to, r) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [from[0] + (dx / len) * r, from[1] + (dy / len) * r];
}

const HEX_RIM = hexPath(50, 51, 39, 10);
const HEX_BODY = hexPath(50, 51, 34.5, 8.5);
const HEX_INNER = hexPath(50, 51, 30, 7.5);

/* ── 성장 점 인디케이터 ───────────────────────────────────────── */
function Pips({ count, gold }) {
  const cy = 80;
  const gap = 6;
  const start = 50 - ((count - 1) * gap) / 2;
  const dots = [];
  for (let i = 0; i < count; i += 1) {
    dots.push(
      <circle
        key={i}
        cx={start + i * gap}
        cy={cy}
        r="2"
        fill={gold ? GOLD : '#FFFFFF'}
        opacity={gold ? 1 : 0.92}
      />
    );
  }
  return <g>{dots}</g>;
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

import React from 'react';
import { IconLockFilled } from '@tabler/icons-react';
import { ICONS } from './badgeIcons';
import {
  ICON_PALETTE,
  ICON_PALETTE_GRAY,
  MEDALLION,
  LOCK_GLYPH,
} from './badgeTheme';

/**
 * 뱃지 메달리온 — 원형 크레스트 (v9).
 *
 * 디자인 원칙: 단순하고 명확하게. 등급이 오를수록 장식이 누적된다.
 *  · 1단계: 깔끔한 원형.
 *  · 2단계: 테두리가 하나 더 생긴다 (이중 테두리).
 *  · 3단계(최종): 이중 테두리 + 하단을 감싸 올라가는 풍성한 월계수 화환 + 하단 매듭(띠).
 * 화환은 원 바깥을 감싸고 매듭만 하단 중앙에 — 게임적 골드/광택 없이 브랜드 하늘 한 계열.
 *
 * props: meta / state('earned'|'progress'|'locked') / pct(미사용·호환) / size
 */
const CX = 50;
const CY = 43;
const RADIUS = 32; // 원 반지름
const KOFF = -95; // 잎 회전 오프셋 — 잎이 위·바깥으로 펼쳐지도록
// 좌측 화환: 하단(94°)에서 좌측 상단(198°)까지 감싸 올라감
const WREATH_ANGLES = [94, 107, 120, 133, 146, 159, 172, 185, 198];

function polar(a, r) {
  const t = (a * Math.PI) / 180;
  return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
}

/** 월계수 가지 1개 (얇은 줄기 + 아몬드형 잎). mirror=true 면 우측 대칭. */
function wreathBranch(angles, sweep, mirror, color, prefix) {
  const R = 37;
  const len = 8.5;
  const w = 2.9;
  const L = len / 2;
  const [x0, y0] = polar(angles[0], R - 2.5);
  const [x1, y1] = polar(angles[angles.length - 1], R - 2.5);
  const stem = (
    <path
      key={`${prefix}-stem`}
      d={`M${x0.toFixed(1)} ${y0.toFixed(1)} A ${R - 2.5} ${R - 2.5} 0 0 ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`}
      stroke={color}
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
    />
  );
  const leaves = angles.map((a, i) => {
    const [px, py] = polar(a, R);
    const rot = mirror ? -(a + KOFF) : a + KOFF;
    return (
      <path
        key={`${prefix}-l${i}`}
        d={`M${-L} 0 Q 0 ${-w} ${L} 0 Q 0 ${w} ${-L} 0 Z`}
        transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${rot.toFixed(1)})`}
        fill={color}
      />
    );
  });
  return [stem, ...leaves];
}

function Wreath({ color }) {
  return (
    <g>
      {wreathBranch(WREATH_ANGLES, 1, false, color, 'L')}
      {wreathBranch(WREATH_ANGLES.map((a) => 180 - a), 0, true, color, 'R')}
    </g>
  );
}

/** 하단 매듭(작은 띠) — 화환 두 가지가 만나는 지점. */
function Knot({ brand, deep }) {
  return (
    <g>
      <rect x="43.5" y="79" width="13" height="6.2" rx="3.1" fill={brand} />
      <rect x="49" y="79" width="2" height="6.2" fill={deep} opacity="0.45" />
    </g>
  );
}

export default function BadgeMedallion({ meta, state = 'locked', size = 76 }) {
  const Cmp = ICONS[meta?.motif] || ICONS.honor;
  const earned = state === 'earned';
  const locked = state === 'locked';

  const level = Math.min(3, Math.max(1, Number(meta?.level) || 1));
  const isChain = !!meta?.chainId; // 성장형만 장식이 누적된다
  const borderDetail = isChain && level >= 2; // 2단계 — 테두리 하나 더
  const crest = isChain && level >= 3; // 3단계 — 월계수 화환 + 매듭

  const ring = earned ? MEDALLION.ringEarned : MEDALLION.ringMuted;
  const disc = locked ? MEDALLION.discLocked : MEDALLION.disc;
  const deco = earned ? MEDALLION.crest : MEDALLION.crestMuted;
  const decoDeep = earned ? MEDALLION.crestDeep : MEDALLION.crestMutedDeep;

  const iconPx = Math.round(size * 0.42);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 프레임 (월계수 화환 → 원 → 이중 테두리 → 매듭 순) */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      >
        {crest && <Wreath color={deco} />}
        <circle cx={CX} cy={CY} r={RADIUS} fill={disc} stroke={ring} strokeWidth="3" />
        {borderDetail && (
          <circle cx={CX} cy={CY} r={RADIUS - 5.5} fill="none" stroke={ring} strokeWidth="1.7" opacity="0.55" />
        )}
        {crest && <Knot brand={deco} deep={decoDeep} />}
      </svg>

      {/* 가운데 아이콘 / 잠금 */}
      <div
        style={{
          position: 'relative',
          marginTop: `-${size * 0.07}px`, // 원 중심(cy43) 정렬
          display: 'inline-flex',
        }}
      >
        {locked ? (
          <IconLockFilled size={Math.round(size * 0.3)} color={LOCK_GLYPH} />
        ) : (
          <Cmp
            size={iconPx}
            palette={earned ? ICON_PALETTE : ICON_PALETTE_GRAY}
            style={{ display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}

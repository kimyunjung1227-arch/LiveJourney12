import React from 'react';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { ICONS } from './badgeIcons';
import { getBadgeTheme, STATE_COLORS } from './badgeTheme';

/**
 * 뱃지 메달리온 — 진행 링 + 파스텔 안쪽 원 + 아이콘 + 상태 오버레이.
 *
 * 상태(state)
 *  - 'earned'  : 달성 → 초록 풀링 + 체크
 *  - 'progress': 진행중 → 부분 호(최상위 단계=골드, 그 외=테마색), 자물쇠 없음
 *  - 'locked'  : 잠금 → 회색 풀링 + 자물쇠
 *
 * props: meta / state / pct(0~1, progress용) / size
 */
export default function BadgeMedallion({ meta, state = 'locked', pct = 0, size = 76 }) {
  const theme = getBadgeTheme(meta);
  const Cmp = ICONS[meta?.motif] || ICONS.honor;
  const earned = state === 'earned';
  const locked = state === 'locked';
  // 성장 체인의 최상위(마스터) 단계만 골드 진행 링, 그 외는 테마색
  const isTop = !!meta?.chainId && (meta?.level || 0) >= 3;

  let ringColor;
  let ringPct;
  if (earned) {
    ringColor = STATE_COLORS.green;
    ringPct = 1;
  } else if (locked) {
    ringColor = STATE_COLORS.lockedRing;
    ringPct = 1;
  } else {
    ringColor = isTop ? STATE_COLORS.gold : theme.icon;
    ringPct = Math.max(0.06, Math.min(1, pct || 0));
  }

  const iconColor = locked ? STATE_COLORS.lockedIcon : theme.icon;
  const innerColor = locked ? STATE_COLORS.lockedInner : theme.inner;

  const stroke = Math.max(4, size * 0.072);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const innerR = r - stroke * 0.85;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }} aria-hidden>
        {/* 트랙 */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={STATE_COLORS.track} strokeWidth={stroke} />
        {/* 진행/풀 링 */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ringPct)}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        {/* 안쪽 파스텔 원 */}
        <circle cx={cx} cy={cx} r={innerR} fill={innerColor} />
      </svg>

      {/* 가운데 아이콘 */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Cmp size={Math.round(size * 0.42)} color={iconColor} stroke={2} aria-hidden style={{ display: 'block' }} />
      </div>

      {/* 상태 오버레이 */}
      {earned && (
        <Corner pos="br" bg={STATE_COLORS.green} size={size}>
          <IconCheck size={Math.round(size * 0.21)} color="#FFFFFF" stroke={3.2} />
        </Corner>
      )}
      {locked && (
        <Corner pos="tr" bg={STATE_COLORS.lockBadge} size={size}>
          <IconLock size={Math.round(size * 0.2)} color="#FFFFFF" stroke={2.6} />
        </Corner>
      )}
    </div>
  );
}

function Corner({ pos, bg, size, children }) {
  const d = Math.round(size * 0.34);
  const style = {
    position: 'absolute',
    width: d,
    height: d,
    borderRadius: '50%',
    background: bg,
    border: '2px solid #FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px rgba(15,23,42,0.12)',
  };
  if (pos === 'br') {
    style.right = -d * 0.12;
    style.bottom = -d * 0.12;
  } else {
    style.right = -d * 0.12;
    style.top = -d * 0.12;
  }
  return <div style={style}>{children}</div>;
}

import React from 'react';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { ICONS } from './badgeIcons';
import { lineColorForLevel, LOCK_LINE, MASTER_SPARK, STATE_COLORS } from './badgeTheme';

/**
 * 뱃지 메달리온 — 흰 배경 + 라인 아이콘 + 상태/등급 표현.
 *
 * 디자인 (v7)
 * - 배경 흰색(컨테이너/링/파스텔 원 없음). 아이콘만 등급색 라인으로.
 * - 등급 = 라인 색 농도: 탐험가(연하늘) → 톡파원(브랜드) → 마스터(딥).
 * - 마스터(최상위 단계 달성)는 골드 반짝이 ✦ + 은은한 후광.
 * - 상태 표식은 코너 배지로만: 달성=초록 체크 / 잠금=회색 자물쇠.
 *
 * props: meta / state('earned'|'progress'|'locked') / pct(미사용·호환) / size
 */
export default function BadgeMedallion({ meta, state = 'locked', size = 76 }) {
  const Cmp = ICONS[meta?.motif] || ICONS.honor;
  const earned = state === 'earned';
  const locked = state === 'locked';
  const level = meta?.level || 2;
  const growth = !!meta?.chainId;
  const isMaster = earned && growth && level >= 3;

  const color = locked ? LOCK_LINE : lineColorForLevel(level);
  const iconSize = Math.round(size * 0.6);
  const stroke = size >= 100 ? 1.6 : 1.8;

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
      {/* 마스터 후광 */}
      {isMaster && (
        <span
          style={{
            position: 'absolute',
            inset: size * 0.06,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 50% 45%, rgba(255,194,77,0.30), rgba(80,170,235,0.12) 55%, transparent 72%)',
          }}
        />
      )}

      <Cmp size={iconSize} color={color} stroke={stroke} style={{ position: 'relative', display: 'block' }} />

      {/* 마스터 반짝이 */}
      {isMaster && (
        <span
          style={{
            position: 'absolute',
            top: size * 0.04,
            right: size * 0.14,
            color: MASTER_SPARK,
            fontSize: Math.max(11, Math.round(size * 0.2)),
            lineHeight: 1,
            textShadow: '0 0 4px rgba(255,194,77,0.55)',
          }}
        >
          ✦
        </span>
      )}

      {/* 상태 코너 표식 */}
      {earned && (
        <Corner pos="br" bg={STATE_COLORS.green} size={size}>
          <IconCheck size={Math.round(size * 0.2)} color="#FFFFFF" stroke={3.2} />
        </Corner>
      )}
      {locked && (
        <Corner pos="tr" bg={STATE_COLORS.lockBadge} size={size}>
          <IconLock size={Math.round(size * 0.19)} color="#FFFFFF" stroke={2.6} />
        </Corner>
      )}
    </div>
  );
}

function Corner({ pos, bg, size, children }) {
  const d = Math.round(size * 0.32);
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
    style.right = -d * 0.1;
    style.bottom = -d * 0.1;
  } else {
    style.right = -d * 0.1;
    style.top = -d * 0.1;
  }
  return <div style={style}>{children}</div>;
}

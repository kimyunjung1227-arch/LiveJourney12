import React from 'react';
import { IconLockFilled } from '@tabler/icons-react';
import { ICONS } from './badgeIcons';
import {
  ICON_PALETTE,
  ICON_PALETTE_GRAY,
  MEDALLION_BG,
  LOCK_GLYPH,
  MASTER_SPARK,
} from './badgeTheme';

/**
 * 뱃지 메달리온 — 파스텔 스쿼클 + 플랫 듀오톤 아이콘 (당근 활동배지 스타일).
 *
 * 디자인 (v8)
 * - 컨테이너 = 둥근 스쿼클. 상태별 배경:
 *     획득=연하늘 파스텔 / 마스터=골드 파스텔 / 진행·잠금=뉴트럴 그레이.
 * - 획득 = 풀컬러 아이콘, 진행 = 회색조 아이콘(모티프는 보임), 잠금 = 자물쇠만.
 * - 마스터(성장형 최상위 달성)는 골드 배경 + ✦ 반짝이.
 * - 코너 배지/링 없음 — 색 대비만으로 상태가 읽히게.
 *
 * props: meta / state('earned'|'progress'|'locked') / pct(미사용·호환) / size
 */
export default function BadgeMedallion({ meta, state = 'locked', size = 76 }) {
  const Cmp = ICONS[meta?.motif] || ICONS.honor;
  const earned = state === 'earned';
  const locked = state === 'locked';
  const isMaster = earned && !!meta?.chainId && (meta?.level || 0) >= 3;

  const bg = earned ? (isMaster ? MEDALLION_BG.gold : MEDALLION_BG.sky) : MEDALLION_BG.neutral;
  const iconSize = Math.round(size * 0.56);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '36%',
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {locked ? (
        <IconLockFilled size={Math.round(size * 0.34)} color={LOCK_GLYPH} />
      ) : (
        <Cmp
          size={iconSize}
          palette={earned ? ICON_PALETTE : ICON_PALETTE_GRAY}
          style={{ position: 'relative', display: 'block' }}
        />
      )}

      {/* 마스터 반짝이 */}
      {isMaster && (
        <span
          style={{
            position: 'absolute',
            top: size * 0.07,
            right: size * 0.11,
            color: MASTER_SPARK,
            fontSize: Math.max(11, Math.round(size * 0.18)),
            lineHeight: 1,
          }}
        >
          ✦
        </span>
      )}
    </div>
  );
}

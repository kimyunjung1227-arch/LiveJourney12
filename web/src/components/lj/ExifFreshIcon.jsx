import React from 'react';
import { IconBolt, IconClock, IconHistory } from '@tabler/icons-react';
import { LJ } from './tokens';

// EXIF 촬영 시각 경과(신선도)에 따라 아이콘·색이 달라지는 EXIF 시간 배지용 아이콘.
// 무드는 좋아요/댓글/저장과 동일한 tabler 아웃라인. 48h 노출 윈도우와 매핑.
//   0–60분  → 번개(실시간) · 하늘색
//   1–24시간 → 시계(오늘)   · 흰색
//   24–48시간 → 시계(만료 임박) · 앰버
//   48시간+  → 되감기(지난 기록) · 회색
const AMBER = '#F5A623';

export function exifFreshnessTier(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const min = ms / 60000;
  if (min < 60) return { key: 'live', Icon: IconBolt, color: LJ.key };
  const hour = min / 60;
  if (hour < 24) return { key: 'today', Icon: IconClock, color: '#FFFFFF' };
  if (hour < 48) return { key: 'soon', Icon: IconClock, color: AMBER };
  return { key: 'past', Icon: IconHistory, color: LJ.textTertiary };
}

export default function ExifFreshIcon({ iso, size = 12, stroke = 2 }) {
  const tier = exifFreshnessTier(iso);
  if (!tier) return null;
  const { Icon, color } = tier;
  return <Icon size={size} stroke={stroke} color={color} />;
}

import React from 'react';
import { IconAward } from '@tabler/icons-react';

const KEY_DARK = '#1A6EA8';
const HONOR_LABEL = '#4A7DA8';

/**
 * 영예 박스. 프로필의 시각적 주인공.
 * - 도움 준 사람, 베스트 컷, 주 지역 방문
 */
export default function HonorBox({ user }) {
  if (!user) return null;
  const helped = user.helped_count || 0;
  const bestCut = user.best_cut_count || 0;
  const city = user.primary_city;
  const cityCount = user.primary_city_count || 0;

  return (
    <div
      style={{
        margin: '0 18px 14px',
        padding: 16,
        borderRadius: 13,
        background: 'linear-gradient(135deg, #E8F4FB, #F0F9FE)',
        border: '1px solid rgba(77, 184, 232, 0.2)',
      }}
    >
      <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
        <IconAward size={13} color={KEY_DARK} stroke={2.2} />
        <span style={{ fontSize: 12, fontWeight: 700, color: KEY_DARK, letterSpacing: 0.2 }}>
          영예
        </span>
      </div>

      <div className="flex items-center" style={{ gap: 0 }}>
        <Stat value={helped} label="도움 준 사람" />
        <Divider />
        <Stat value={bestCut} label="베스트 컷" />
        <Divider />
        <Stat
          value={city ? cityCount : '–'}
          label={city ? `${city} 방문` : '주 지역'}
        />
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex-1 text-center">
      <p
        className="m-0"
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: KEY_DARK,
          lineHeight: 1.1,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </p>
      <p className="m-0" style={{ fontSize: 11, color: HONOR_LABEL, marginTop: 4 }}>
        {label}
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 40,
        background: 'rgba(77, 184, 232, 0.3)',
        flexShrink: 0,
      }}
    />
  );
}

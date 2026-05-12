import React from 'react';

function parseTierFromDynName(name) {
  const n = String(name || '');
  const m = n.match(/:tier(\d+)$/);
  const tier = m ? Number(m[1]) : 1;
  if (!Number.isFinite(tier)) return 1;
  return Math.max(1, Math.min(3, tier));
}

function frameStyleForTier(tier) {
  // 같은 아이콘이라도 "테두리 디테일"로 등급 차이를 느끼게
  // - tier1: 단색 링
  // - tier2: 그라데이션 링(2중 느낌)
  // - tier3: conic 그라데이션 + 은은한 글로우
  if (tier === 3) {
    return {
      backgroundImage:
        'conic-gradient(from 210deg, rgba(251,191,36,1), rgba(245,158,11,1), rgba(234,179,8,1), rgba(217,119,6,1), rgba(251,191,36,1))',
      boxShadow: '0 12px 34px rgba(245,158,11,0.28)',
    };
  }
  if (tier === 2) {
    return {
      backgroundImage:
        'linear-gradient(135deg, rgba(6,182,212,1), rgba(37,99,235,1))',
      boxShadow: '0 8px 18px rgba(37,99,235,0.18)',
    };
  }
  return {
    backgroundColor: 'rgba(99,102,241,0.9)',
    boxShadow: '0 6px 14px rgba(99,102,241,0.14)',
  };
}

export default function LiveBadgeMedallion({
  badgeName,
  tier: tierProp,
  icon,
  gradientCss,
  size = 64,
  className = '',
}) {
  const tier = tierProp != null ? Math.max(1, Math.min(3, Number(tierProp) || 1)) : parseTierFromDynName(badgeName);
  const pad = Math.max(3, Math.round(size * 0.06));
  const inner = size - pad * 2;
  const frameStyle = frameStyleForTier(tier);

  // 뱃지 자체 gradientCss가 있으면 "메달 내부"에 깔고, 테두리는 tier 디테일을 유지
  const innerStyle = gradientCss
    ? { backgroundImage: gradientCss }
    : { backgroundColor: 'rgba(255,255,255,1)' };

  return (
    <div
      className={`relative inline-flex shrink-0 rounded-full ${tier === 3 ? 'animate-pulse' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        padding: pad,
        ...frameStyle,
      }}
      aria-hidden
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/60 dark:border-black/20"
        style={innerStyle}
      >
        <span className="select-none" style={{ fontSize: Math.round(inner * 0.52), lineHeight: 1 }}>
          {icon || '🏅'}
        </span>
      </div>
    </div>
  );
}


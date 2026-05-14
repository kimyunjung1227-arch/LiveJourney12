import React from 'react';

function parseTierFromDynName(name) {
  const n = String(name || '');
  const m = n.match(/:tier(\d+)$/);
  const tier = m ? Number(m[1]) : 1;
  if (!Number.isFinite(tier)) return 1;
  return Math.max(1, Math.min(3, tier));
}

const BADGE_BORDER_WIDTH = 2;

function frameStyleForTier(tier) {
  if (tier === 3) {
    return { borderColor: '#D97706' };
  }
  if (tier === 2) {
    return { borderColor: '#0284C7' };
  }
  return { borderColor: '#94A3B8' };
}

export default function LiveBadgeMedallion({
  badgeName,
  tier: tierProp,
  icon,
  size = 64,
  className = '',
}) {
  const tier = tierProp != null ? Math.max(1, Math.min(3, Number(tierProp) || 1)) : parseTierFromDynName(badgeName);
  const frameStyle = frameStyleForTier(tier);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border-solid bg-white dark:bg-white ${className}`}
      style={{
        width: size,
        height: size,
        borderWidth: BADGE_BORDER_WIDTH,
        ...frameStyle,
      }}
      aria-hidden
    >
      <span className="select-none" style={{ fontSize: Math.round(size * 0.52), lineHeight: 1 }}>
        {icon || '🏅'}
      </span>
    </div>
  );
}

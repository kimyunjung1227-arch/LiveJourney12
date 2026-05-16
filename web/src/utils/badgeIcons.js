/**
 * 뱃지 시각 표현 헬퍼 — 라이브저니 톤(Material Symbols + 그라데이션) 통일
 */

// 카테고리별 기본 톤 (badge.tone이 없을 때 fallback)
const CATEGORY_DEFAULT_TONE = {
  '자연·풍경': { from: '#7DD3FC', to: '#2563EB' },
  '숨은 명소': { from: '#A7F3D0', to: '#059669' },
  '심야 가이드': { from: '#818CF8', to: '#4338CA' },
  '여행 응원': { from: '#FBBF24', to: '#B45309' },
  '지역 테마': { from: '#A78BFA', to: '#5B21B6' },
};

const FALLBACK_TONE = { from: '#94A3B8', to: '#475569' };

/** '#RRGGBB' → 'r, g, b' (rgba()용) */
export const hexToRgbTuple = (hex) => {
  const s = String(hex || '').replace('#', '').trim();
  if (s.length !== 6) return '148, 163, 184';
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '148, 163, 184';
  return `${r}, ${g}, ${b}`;
};

export const resolveBadgeTone = (badge) => {
  const t = badge?.tone;
  if (t?.from && t?.to) return t;
  const cat = String(badge?.category || '').trim();
  return CATEGORY_DEFAULT_TONE[cat] || FALLBACK_TONE;
};

export const getBadgeGradient = (badge) => {
  const tone = resolveBadgeTone(badge);
  return `linear-gradient(135deg, ${tone.from}, ${tone.to})`;
};

// 이모지 → Material Symbols (라이브저니 톤에 맞춘 아이콘 통일)
const EMOJI_TO_MATERIAL_SYMBOL = {
  '🌱': 'eco',
  '🌸': 'local_florist',
  '💐': 'local_florist',
  '🌊': 'waves',
  '🏞': 'landscape',
  '🏞️': 'landscape',
  '🌅': 'wb_twilight',
  '🔍': 'search',
  '📍': 'location_on',
  '🚩': 'flag',
  '🌙': 'bedtime',
  '🌃': 'dark_mode',
  '✨': 'auto_awesome',
  '🛡': 'shield',
  '🛡️': 'shield',
  '🧭': 'explore',
  '🍀': 'spa',
  '🏆': 'emoji_events',
  '⭐': 'star',
  '🎖': 'military_tech',
  '🎖️': 'military_tech',
};

export const resolveBadgeSymbol = (badge) => {
  const raw = String(badge?.icon || '').trim();
  if (!raw) return 'workspace_premium';
  const stripped = raw.replace(/️/g, '');
  return EMOJI_TO_MATERIAL_SYMBOL[raw] || EMOJI_TO_MATERIAL_SYMBOL[stripped] || 'workspace_premium';
};

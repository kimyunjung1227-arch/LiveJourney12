import { getBadgeDisplayName, hydrateBadgeFromName } from './badgeSystem';

const MAX_GRADIENT_LEN = 4096;
const MAX_STR_FIELD = 512;

const trimStr = (v, maxLen) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

/**
 * profiles.representative_badge(jsonb) 저장용 — 비정상 숫자·과도한 문자열 제거 후 JSON 호환만 보장
 */
export const serializeRepresentativeBadge = (badge) => {
  if (!badge || !badge.name) return null;
  const name = trimStr(badge.name, 200);
  if (!name) return null;

  let difficulty = null;
  if (badge.difficulty != null) {
    const n = Number(badge.difficulty);
    if (Number.isFinite(n)) difficulty = n;
  }

  const raw = {
    name,
    icon: badge.icon != null ? trimStr(badge.icon, 64) : null,
    displayName: badge.displayName != null ? trimStr(badge.displayName, MAX_STR_FIELD) : null,
    category: badge.category != null ? trimStr(badge.category, MAX_STR_FIELD) : null,
    difficulty,
    gradientCss: badge.gradientCss != null ? trimStr(badge.gradientCss, MAX_GRADIENT_LEN) : null,
    region: badge.region != null ? trimStr(badge.region, MAX_STR_FIELD) : null,
  };

  try {
    return JSON.parse(JSON.stringify(raw));
  } catch {
    return null;
  }
};

export const deserializeRepresentativeBadge = (raw) => {
  if (!raw) return null;
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || !value.name) return null;
  const hydrated = hydrateBadgeFromName(String(value.name));
  return {
    ...(hydrated || {}),
    ...value,
    name: String(value.name),
  };
};

export const parseRepresentativeBadgeFromProfileRow = (row) =>
  deserializeRepresentativeBadge(row?.representative_badge ?? row?.representativeBadge ?? null);

export const resolveRepresentativeBadge = (storedBadge, earnedBadges = []) => {
  const stored = deserializeRepresentativeBadge(storedBadge);
  if (!stored) return null;
  const earned = Array.isArray(earnedBadges) ? earnedBadges : [];
  const matched = earned.find((b) => String(b?.name || '') === String(stored.name));
  if (matched) {
    return {
      ...stored,
      ...matched,
      name: stored.name,
      displayName: getBadgeDisplayName(matched) || stored.displayName || matched.displayName || stored.name,
    };
  }
  return stored;
};

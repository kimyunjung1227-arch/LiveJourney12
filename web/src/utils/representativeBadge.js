import { getBadgeDisplayName, hydrateBadgeFromName } from './badgeSystem';

export const serializeRepresentativeBadge = (badge) => {
  if (!badge || !badge.name) return null;
  return {
    name: String(badge.name),
    icon: badge.icon != null ? String(badge.icon) : null,
    displayName: badge.displayName != null ? String(badge.displayName) : null,
    category: badge.category != null ? String(badge.category) : null,
    difficulty: badge.difficulty != null ? Number(badge.difficulty) : null,
    gradientCss: badge.gradientCss != null ? String(badge.gradientCss) : null,
    region: badge.region != null ? String(badge.region) : null,
  };
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

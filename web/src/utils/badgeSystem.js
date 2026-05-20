// 뱃지 기능 제거됨. 다른 화면이 import한 함수들을 깨뜨리지 않도록 no-op 스텁만 유지.

export const setCurrentBadgeUserId = () => {};
export const getBadgeDisplayName = () => '';
export const hydrateBadgeFromName = () => null;
export const getBadgeDisplayNameFromName = () => '';
export const BADGE_PROGRESS_DETAIL = {};
export const BADGES = {};
export const calculateUserStats = () => ({});
export const checkNewBadges = () => [];
export const hasSeenBadge = () => true;
export const markBadgeAsSeen = () => {};
export const awardBadge = () => false;
export const syncEarnedBadgesFromSupabase = async () => [];
export const getEarnedBadges = () => [];
export const getEarnedBadgesForDisplay = () => [];
export const getBadgeProgress = () => null;
export const getBadgesByCategory = () => [];
export const getVisibleBadges = () => [];
export const getEarnedBadgesFromStats = () => [];
export const getEarnedBadgesForUser = () => [];
export const getAvailableBadges = () => [];
export const getBadgeStats = () => ({});

export default BADGES;

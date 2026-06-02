/**
 * 뱃지 테마 — 그룹/카테고리별 색과 섹션 메타.
 * 상태 색(달성=초록·진행=테마/골드·잠금=회색)은 메달리온에서 처리.
 */

// 섹션 헤더 메타 (점 색 · 한글 · 영문 · 우측 태그)
export const GROUP_META = {
  '지역 전문성': { ko: '지역', en: 'LOCATION', dot: '#2BA0DC', tag: '3단계 진화' },
  영예: { ko: '영예', en: 'HONOR', dot: '#8B5CF6', tag: '2단계 진화' },
  '베스트 컷 작가': { ko: '베스트 컷', en: 'BEST CUT', dot: '#E8961E', tag: '3단계 진화' },
  '도움 마일스톤': { ko: '이타심', en: 'ALTRUISM', dot: '#EF5F79', tag: '3단계 진화' },
  '카테고리 전문성': { ko: '시즌 & 테마', en: 'SEASON & THEME', dot: '#2BB7A8', tag: 'LIMITED' },
};

// 그룹별 아이콘/안쪽 원 색
const GROUP_THEME = {
  '지역 전문성': { icon: '#1E9FD6', inner: '#E2F3FB' },
  영예: { icon: '#8B5CF6', inner: '#F0EAFE' },
  '베스트 컷 작가': { icon: '#E8961E', inner: '#FDF1DC' },
  '도움 마일스톤': { icon: '#EF5F79', inner: '#FDE7EC' },
};

// 카테고리(시즌&테마)는 모티프별 색
const CATEGORY_THEME = {
  cherry: { icon: '#EC6FA0', inner: '#FCE7F0' },
  sunset: { icon: '#F0922E', inner: '#FCEEDD' },
  weather: { icon: '#2BA0DC', inner: '#E2F3FB' },
  festival: { icon: '#8B5CF6', inner: '#F0EAFE' },
  crowd: { icon: '#2BB7A8', inner: '#DEF5F1' },
  store: { icon: '#3FB36B', inner: '#E3F6EA' },
};

const DEFAULT_THEME = { icon: '#2BA0DC', inner: '#E2F3FB' };

export function getBadgeTheme(meta) {
  if (!meta) return DEFAULT_THEME;
  if (meta.group === '카테고리 전문성') {
    return CATEGORY_THEME[meta.motif] || DEFAULT_THEME;
  }
  return GROUP_THEME[meta.group] || DEFAULT_THEME;
}

// 상태 색
export const STATE_COLORS = {
  green: '#22C55E', // 달성
  gold: '#ECA033', // 마스터(최상위) 진행
  track: '#EDEFF2', // 링 트랙
  lockedRing: '#D7DCE2',
  lockedIcon: '#AEB6BF',
  lockedInner: '#F1F3F5',
  lockBadge: '#C2C8CE',
};

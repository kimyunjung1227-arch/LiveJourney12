import { LJ } from '../lj/tokens';

/**
 * 뱃지 테마 — 라이브저니 브랜드 토큰(tokens.js)에 통일.
 * - 키컬러 하늘색(LJ.key #4DB8E8) + 옅은 하늘 배경(LJ.keyBgLight #E8F4FB)로 전 뱃지 일관.
 * - 구분은 색이 아니라 아이콘 형태 + 라벨로 (브랜드 응집·과한 색 지양).
 * - 상태 색(달성=초록·진행=브랜드·마스터=브랜드 그라데이션·잠금=회색)은 메달리온에서 처리.
 */

// 브랜드 단일 테마 (아이콘 색 / 안쪽 원 색)
const BRAND = { icon: LJ.key, inner: LJ.keyBgLight };

// 섹션 헤더 메타 (점 색 · 한글 · 영문 · 우측 태그)
export const GROUP_META = {
  '지역 전문성': { ko: '지역', en: 'LOCATION', dot: LJ.key, tag: '3단계 진화' },
  영예: { ko: '영예', en: 'HONOR', dot: LJ.key, tag: '2단계 진화' },
  '베스트 컷 작가': { ko: '베스트 컷', en: 'BEST CUT', dot: LJ.key, tag: '3단계 진화' },
  '도움 마일스톤': { ko: '이타심', en: 'ALTRUISM', dot: LJ.key, tag: '3단계 진화' },
  '카테고리 전문성': { ko: '시즌 & 테마', en: 'SEASON & THEME', dot: LJ.key, tag: 'LIMITED' },
};

// 모든 뱃지 동일 브랜드 테마
export function getBadgeTheme() {
  return BRAND;
}

// 상태 색
export const STATE_COLORS = {
  green: '#22C55E', // 달성
  brand: LJ.key, // 진행(일반)
  gradFrom: '#4DB8E8', // 마스터 진행 — 브랜드 그라데이션(베스트컷 톤)
  gradTo: '#1A6EA8',
  track: '#EDEFF2', // 링 트랙
  lockedRing: '#D7DCE2',
  lockedIcon: '#AEB6BF',
  lockedInner: '#F1F3F5',
  lockBadge: '#C2C8CE',
};

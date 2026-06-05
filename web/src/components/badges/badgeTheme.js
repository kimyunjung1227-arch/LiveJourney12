/**
 * 뱃지 테마 — 통일 팔레트 + 섹션 메타.
 *
 * 팔레트 원칙 (v8)
 * - 메인 = 브랜드 하늘색(+딥 셰이드 같은 색상군), 서브 = 앰버·코랄 딱 2개.
 * - 모든 뱃지 아이콘이 이 5개 토큰(M/D/A/C/W)만 돌려쓴다 → 톤 통일.
 */

// 아이콘 색 토큰: M=메인 하늘 / D=딥 하늘 / A=서브1 앰버 / C=서브2 코랄 / W=컷아웃
export const ICON_PALETTE = {
  M: '#2BA0DC',
  D: '#1A6EA8',
  A: '#FFB94E',
  C: '#FF8A70',
  W: '#FFFFFF',
};

// 미획득(진행 중) — 모티프는 보이되 회색조로
export const ICON_PALETTE_GRAY = {
  M: '#B9C3CC',
  D: '#98A4B0',
  A: '#CFD6DC',
  C: '#C3CCD4',
  W: '#FFFFFF',
};

/** 단색 변형 (칩 등 작은 사이즈용): 모든 면 → fg, 컷아웃 → bg */
export function monoIconPalette(fg, bg = '#FFFFFF') {
  return { M: fg, D: fg, A: fg, C: fg, W: bg };
}

// 메달리온(스쿼클 컨테이너) 배경
export const MEDALLION_BG = {
  sky: '#E9F4FB', // 획득 — 연하늘 파스텔
  gold: '#FCEFD2', // 마스터(최상위) — 골드 파스텔
  neutral: '#F2F4F6', // 진행/잠금 — 뉴트럴 그레이
};

export const LOCK_GLYPH = '#C5CCD4'; // 잠금 자물쇠
export const MASTER_SPARK = '#F2A33C'; // 마스터 반짝이 ✦

// 섹션 헤더 메타 (점 색 · 한글 · 영문 · 우측 태그) — 점 색도 팔레트 3색으로 통일
export const GROUP_META = {
  '지역 전문성': { ko: '지역', en: 'LOCATION', dot: '#2BA0DC', tag: '3단계 진화' },
  영예: { ko: '영예', en: 'HONOR', dot: '#FFB94E', tag: '2단계 진화' },
  '베스트 컷 작가': { ko: '베스트 컷', en: 'BEST CUT', dot: '#FFB94E', tag: '3단계 진화' },
  '도움 마일스톤': { ko: '이타심', en: 'ALTRUISM', dot: '#FF8A70', tag: '3단계 진화' },
  '카테고리 전문성': { ko: '시즌 & 테마', en: 'SEASON & THEME', dot: '#2BA0DC', tag: 'LIMITED' },
};

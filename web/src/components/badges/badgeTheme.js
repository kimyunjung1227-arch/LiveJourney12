/**
 * 뱃지 테마 — 단일 브랜드 컬러(라이브저니 하늘색) 체계.
 *
 * 재디자인 (v9 — 원형 크레스트)
 * - 모든 뱃지는 "흰 원 + 브랜드 하늘색 테두리 + 가운데 아이콘" 한 형태로 통일.
 * - 게임적 장식(골드 마스터 배경, ✦ 반짝이, 멀티 액센트 컬러) 전부 제거.
 * - 등급(level)은 ① 하단 띠(band)의 점(pip) 수 ② level 3의 이중 테두리로만 표현.
 * - 색은 브랜드 하늘색 한 계열의 명도 차로만 — 보조색(앰버/코랄) 폐기.
 */

// 브랜드 메인 (앱 전역 키컬러)
export const BRAND = '#4DB8E8';

// 아이콘 색 토큰 — 전부 하늘색 패밀리(명/암)로 통일.
// M=메인 / D=딥(외곽·음영) / A=라이트 / C=미드 / W=컷아웃(흰 구멍)
export const ICON_PALETTE = {
  M: '#4DB8E8',
  D: '#2F87BC',
  A: '#8BD2F0',
  C: '#62BEEA',
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

// 원형 메달리온 프레임 색
export const MEDALLION = {
  disc: '#FFFFFF', // 원 안쪽 바탕
  discLocked: '#F2F4F6', // 잠금 — 옅은 회색 바탕
  ringEarned: '#4DB8E8', // 획득 — 브랜드 하늘 테두리
  ringMuted: '#CDD6DE', // 진행/잠금 — 회색 테두리
  // 3단계 크레스트(월계수 + 리본) 색
  crest: '#4DB8E8', // 메인
  crestDeep: '#2F87BC', // 리본 underside·음영
  crestLight: '#8BD2F0', // 리본 하이라이트
  crestMuted: '#CDD6DE', // 진행/잠금 — 메인
  crestMutedDeep: '#AEB8C0', // 진행/잠금 — 음영
  crestMutedLight: '#E2E7EB', // 진행/잠금 — 하이라이트
};

export const LOCK_GLYPH = '#BFC8D1'; // 잠금 자물쇠

// 섹션 헤더 메타 (점 색 · 한글 · 영문 · 우측 태그) — 점 색도 전부 브랜드 하늘로 통일
export const GROUP_META = {
  '지역 전문성': { ko: '지역', en: 'LOCATION', dot: BRAND, tag: '3단계' },
  영예: { ko: '영예', en: 'HONOR', dot: BRAND, tag: '2단계' },
  '베스트 컷 작가': { ko: '베스트 컷', en: 'BEST CUT', dot: BRAND, tag: '3단계' },
  '도움 마일스톤': { ko: '이타심', en: 'ALTRUISM', dot: BRAND, tag: '3단계' },
  '카테고리 전문성': { ko: '시즌 & 테마', en: 'SEASON & THEME', dot: BRAND, tag: '전문성' },
};

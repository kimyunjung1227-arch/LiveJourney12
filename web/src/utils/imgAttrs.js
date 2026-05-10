/**
 * 화면 진입 직후 사진이 바로 요청·디코딩되도록 하는 공통 img 속성
 * (lazy 는 뷰포트 밖까지 지연시켜 체감이 느려질 수 있음)
 */
export const IMG_FAST = {
  loading: 'eager',
  decoding: 'async',
};

/** 첫 화면·스크롤 직전까지 그리드·리스트 셀 — loading=eager 구간 */
export const SCREEN_GRID_EAGER_COUNT = 24;

/** fetchPriority=high 를 줄 상단·히어로 구간 */
export const SCREEN_IMAGE_HIGH_PRIORITY_COUNT = 12;

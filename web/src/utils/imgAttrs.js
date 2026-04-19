/**
 * 화면 진입 직후 사진이 바로 요청·디코딩되도록 하는 공통 img 속성
 * (lazy 는 뷰포트 밖까지 지연시켜 체감이 느려질 수 있음)
 */
export const IMG_FAST = {
  loading: 'eager',
  decoding: 'async',
};

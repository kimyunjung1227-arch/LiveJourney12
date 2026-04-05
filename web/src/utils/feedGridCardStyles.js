/** 지금 여기는 더보기·지역 상세 2열 그리드 카드 공통 인라인 스타일 */

export const feedGridCardBox = {
  width: '100%',
  overflow: 'hidden',
  borderRadius: 18,
  background: '#ffffff',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  boxShadow: '0 2px 14px rgba(15, 23, 42, 0.08)',
};

/** 메인 배경 위 그리드 — 흰 카드 박스 없이 썸네일·텍스트만 (지금 여기는 더보기 등) */
export const feedGridCardBoxFlat = {
  width: '100%',
  overflow: 'visible',
  background: 'transparent',
  border: 'none',
  boxShadow: 'none',
};

export const feedGridImageBox = {
  width: '100%',
  paddingBottom: '88%',
  height: 0,
  position: 'relative',
  background: '#e5e7eb',
  overflow: 'hidden',
};

/** 플랫 카드용 — 썸네일 상·하단 라운드 동일 (18px). 세로는 기본 feedGridImageBox(88%)보다 크게 */
export const feedGridImageBoxFlat = {
  ...feedGridImageBox,
  borderRadius: 18,
  paddingBottom: '118%',
};

export const feedGridInfoBox = {
  padding: '10px 12px 12px',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  overflow: 'hidden',
};

export const feedGridTitleStyle = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#111827',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export const feedGridDescStyle = {
  fontSize: '12px',
  color: '#4b5563',
  marginTop: 0,
  lineHeight: 1.35,
  maxHeight: '2.7em',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

export const feedGridMetaRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '1px',
  flexShrink: 0,
  fontSize: '11px',
  color: '#6b7280',
};

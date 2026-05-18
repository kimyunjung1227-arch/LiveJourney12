// Live Journey v2 디자인 토큰 (CLAUDE.md 매핑).
// 모든 신규 컴포넌트는 여기서 색·간격·반경을 import 한다.

export const LJ = {
  // 컬러
  key: '#4DB8E8',
  keyBgLight: '#E8F4FB',
  keyTextDark: '#1A6EA8',
  textPrimary: '#1F1F1F',
  textSecondary: '#6B6B6B',
  textTertiary: '#B8B8B8',
  bgSurface: '#F5F7FA',
  borderLight: '#E8E8E8',
  bgCard: '#FFFFFF',
  error: '#D85050',
  bgDark: '#0A0A0A',

  // 그라데이션 (베스트 컷 + 작성자 뱃지 전용)
  gradientBestCut: 'linear-gradient(135deg, #4DB8E8, #1A6EA8)',
  gradientBestCutSoft:
    'linear-gradient(135deg, rgba(77,184,232,0.08), rgba(77,184,232,0.18))',

  // 폰트 스택
  fontStack:
    'Pretendard, "Apple SD Gothic Neo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const LJ_CATEGORIES = [
  { id: 'nature', label: '개화·자연', iconName: 'IconFlower' },
  { id: 'weather', label: '날씨·체감', iconName: 'IconCloud' },
  { id: 'event', label: '이벤트·축제', iconName: 'IconCalendarEvent' },
  { id: 'crowd', label: '혼잡도·대기', iconName: 'IconUsers' },
  { id: 'sunset', label: '노을·야경', iconName: 'IconMoon' },
  { id: 'business', label: '영업·운영', iconName: 'IconBuildingStore' },
];

/** EXIF 시간 → "N분 전 / N시간 전" */
export function formatExifTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.floor(diff / 60000));
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

/** expires_at → "N시간 남음" */
export function formatRemaining(iso) {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return '곧 종료';
  const hour = Math.floor(diff / (60 * 60 * 1000));
  if (hour < 1) {
    const min = Math.max(1, Math.floor(diff / 60000));
    return `${min}분 남음`;
  }
  return `${hour}시간 남음`;
}

/** "방금 / N분 / N시간 / N일" (댓글용) */
export function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간`;
  return `${Math.floor(hour / 24)}일`;
}

export function categoryLabel(id) {
  return LJ_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

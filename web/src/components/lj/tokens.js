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

  // 폰트 스택 (전 화면 통일 — index.css의 --lj-font-sans와 동일)
  fontStack:
    "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans KR', sans-serif",
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

const pad2 = (n) => String(n).padStart(2, '0');

/** EXIF 촬영 시각의 절대 표기. 같은 해는 "M.D HH:mm", 다른 해는 "YYYY.M.D HH:mm" */
export function formatExifAbsolute(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const mmdd = `${d.getMonth() + 1}.${d.getDate()}`;
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}.${mmdd} ${hhmm}`;
  }
  return `${mmdd} ${hhmm}`;
}

/** EXIF 촬영 시각의 풀 타임스탬프 — 항상 "YYYY.MM.DD HH:mm" (카메라가 새긴 시간임을 명확히) */
export function formatExifStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "5월 22일 (목) 오후 2:32" 형식 — 상세 화면 등 더 또렷한 표기용 */
export function formatExifLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const h24 = d.getHours();
  const ampm = h24 < 12 ? '오전' : '오후';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) ${ampm} ${h12}:${pad2(d.getMinutes())}`;
}

/**
 * weather/weatherSnapshot 객체에서 표시용 값을 안전하게 뽑는다.
 * - temperature 는 "23℃" 같은 문자열일 수도, 23 같은 숫자일 수도 있음
 * - 둘 다 없으면 null
 */
export function pickWeatherDisplay(w) {
  if (!w || typeof w !== 'object') return null;
  const rawTemp = w.temperature ?? w.temp ?? null;
  let tempLabel = null;
  if (rawTemp != null && rawTemp !== '') {
    const asString = String(rawTemp).trim();
    if (asString && asString !== '-') {
      tempLabel = /[℃°]/.test(asString) ? asString : `${asString}℃`;
    }
  }
  const icon = typeof w.icon === 'string' && w.icon.trim() ? w.icon.trim() : null;
  const condition =
    typeof w.condition === 'string' && w.condition.trim() && w.condition.trim() !== '-'
      ? w.condition.trim()
      : null;
  if (!tempLabel && !icon && !condition) return null;
  return { icon, condition, temperature: tempLabel };
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

/**
 * 업로드 시각 기준 노출 파워 등급 (실시간성 가이드라인).
 *  - 'live'  (0~8h)   : LIVE 초신선 정보 — 파워 100%
 *  - 'today' (8~24h)  : 오늘의 현장 정보 — 파워 60%
 *  - 'ref'   (24~48h) : 어제의 참고 정보 — 파워 20%
 *  - null    (48h+)   : 자동 아웃 (피드 미노출)
 * 시간 기준은 홈 피드 48시간 시스템과 동일하게 created_at(업로드 시각).
 */
export function getFreshnessTier(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const h = (Date.now() - t) / (60 * 60 * 1000);
  if (h < 8) return 'live';
  if (h < 24) return 'today';
  if (h < 48) return 'ref';
  return null;
}

/**
 * 등급별 시간 배지 라벨.
 *  - live  : "LIVE"
 *  - today : "N시간 전" (오늘 현장)
 *  - ref   : "어제 상황"
 */
export function freshnessBadgeLabel(iso, tier) {
  const t = tier ?? getFreshnessTier(iso);
  if (t === 'live') return 'LIVE';
  if (t === 'ref') return '어제 상황';
  if (t === 'today') {
    const hour = Math.floor((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
    return hour <= 0 ? '방금 전' : `${hour}시간 전`;
  }
  return '';
}

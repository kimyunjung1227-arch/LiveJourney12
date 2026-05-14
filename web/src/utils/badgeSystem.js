/**
 * 라이브저니 뱃지 시스템 v5.0
 * 동적 뱃지: 지역 / 카테고리 테마 / 여행 응원
 * - [지역명] 뱃지: regionAware + opts.region 저장 → getBadgeDisplayName으로 "[지역명] 가이드" 등 표기
 * - Supabase user_badges 연동: 로그아웃 후 재로그인해도 획득 뱃지·활동 통계 유지
 */
import { logger } from './logger';
import { fetchUserBadgesSupabase, saveUserBadgeSupabase } from '../api/userBadgesSupabase';
import { normalizeRegionName } from './regionNames';
import { getTripSupportStats } from './tripSupportActivity';

// 서버 운영 전환: localStorage 제거 → 세션 메모리 캐시만 유지
// ⚠️ 계정별로 분리 저장하지 않으면, 로그아웃/계정 전환 시 다른 사용자 뱃지가 섞일 수 있음.
const earnedBadgesCacheByUserId = new Map(); // userId -> earnedBadges[]
let currentEarnedBadgesUserId = null;

const setCurrentEarnedBadgesUserId = (userId) => {
  const uid = userId != null ? String(userId).trim() : '';
  currentEarnedBadgesUserId = uid || null;
};

const getEarnedBadgesCacheForUser = (userId) => {
  const uid = userId != null ? String(userId).trim() : (currentEarnedBadgesUserId || '');
  if (!uid) return [];
  const list = earnedBadgesCacheByUserId.get(uid);
  return Array.isArray(list) ? list : [];
};

const setEarnedBadgesCacheForUser = (userId, list) => {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) return;
  earnedBadgesCacheByUserId.set(uid, Array.isArray(list) ? list : []);
};

/** 현재 로그인 사용자 기준으로 뱃지 캐시를 가리키도록 설정(AuthContext에서 호출 권장) */
export const setCurrentBadgeUserId = (userId) => {
  setCurrentEarnedBadgesUserId(userId);
};

/** [지역명] 뱃지일 때 표시명 반환. 그 외는 name 그대로 */
export const getBadgeDisplayName = (badge) => {
  if (badge?.displayName) return String(badge.displayName);
  if (badge?.region && badge?.name && /^지역\s/.test(badge.name))
    return `${badge.region} ${badge.name.replace(/^지역\s/, '')}`;
  return badge?.name || '';
};

const REGION_AWARE_NAMES = ['지역 가이드', '지역 톡파원', '지역 마스터'];
const DYNAMIC_BADGE_PREFIX = 'dyn:';

const isSeasonDynBadgeName = (name) => {
  const n = String(name || '');
  if (!n.startsWith(DYNAMIC_BADGE_PREFIX)) return false;
  const raw = n.slice(DYNAMIC_BADGE_PREFIX.length);
  return raw.startsWith('sm:') || raw.startsWith('season:');
};

const makeTone = (from, to) => ({ from, to });

const toneForDynamic = (name) => {
  const n = String(name || '');
  if (!n.startsWith(DYNAMIC_BADGE_PREFIX)) return null;
  // support
  if (n.includes(':support:guardian')) return makeTone('#34D399', '#047857');
  if (n.includes(':support:pathfinder')) return makeTone('#A78BFA', '#5B21B6');
  if (n.includes(':support:lucky')) return makeTone('#FBBF24', '#B45309');
  // theme tiers
  if (n.includes(':theme:') && n.endsWith(':tier3')) return makeTone('#FBBF24', '#B45309');
  if (n.includes(':theme:') && n.endsWith(':tier2')) return makeTone('#38BDF8', '#6366F1');
  if (n.includes(':theme:') && n.endsWith(':tier1')) return makeTone('#94A3B8', '#64748B');
  // region tiers
  if (n.includes(':region:') && n.endsWith(':tier3')) return makeTone('#9333EA', '#C026D3'); // purple/fuchsia
  if (n.includes(':region:') && n.endsWith(':tier2')) return makeTone('#06B6D4', '#2563EB'); // cyan/blue
  if (n.includes(':region:') && n.endsWith(':tier1')) return makeTone('#64748B', '#334155'); // slate
  return makeTone('#6B7280', '#374151');
};

const decodeDynamicName = (name) => {
  const n = String(name || '');
  if (!n.startsWith(DYNAMIC_BADGE_PREFIX)) return null;
  const raw = n.slice(DYNAMIC_BADGE_PREFIX.length);
  const parts = raw.split(':');
  // theme:<group>:<sub>:tierX
  if (parts[0] === 'theme' && parts.length >= 4) {
    const trackKey = `${parts[1]}:${parts[2]}`;
    const tier = Number(String(parts[3] || '').replace(/^tier/, '')) || 1;
    const track = findThemeTrack(trackKey);
    if (track) {
      return {
        kind: 'theme',
        trackKey,
        tier,
        displayName: track.labels[tier - 1] || track.labels[0],
        icon: track.icons[tier - 1] || track.icons[0],
        category: track.category,
      };
    }
  }
  // region:<region>:tierX
  if (parts[0] === 'region') {
    const region = parts[1] || '';
    const tier = Number(String(parts[2] || '').replace(/^tier/, '')) || 1;
    const labels = ['가이드', '톡파원', '마스터'];
    const icon = '🧭';
    return { kind: 'region', region, tier, displayName: `${region} ${labels[tier - 1] || '비기너'}`, icon, category: '지역 테마' };
  }
  // support:guardian|pathfinder|lucky
  if (parts[0] === 'support' && (parts[1] === 'guardian' || parts[1] === 'pathfinder' || parts[1] === 'lucky')) {
    const t = {
      guardian: { displayName: '실시간 가디언', icon: '🛡️' },
      pathfinder: { displayName: '랜선 길잡이', icon: '🧭' },
      lucky: { displayName: '럭키 메이커', icon: '🍀' },
    }[parts[1]];
    if (t) return { kind: 'support', sub: parts[1], displayName: t.displayName, icon: t.icon, category: '여행 응원' };
  }
  return null;
};

export const hydrateBadgeFromName = (name) => {
  const decoded = decodeDynamicName(name);
  if (!decoded) return null;
  const tone = toneForDynamic(name);
  const gradient = tone ? `linear-gradient(135deg, ${tone.from}, ${tone.to})` : undefined;
  return {
    name: String(name),
    displayName: decoded.displayName,
    icon: decoded.icon,
    category: decoded.category,
    difficulty: decoded.tier != null ? decoded.tier : decoded.sub ? 2 : 1,
    tone,
    gradientCss: gradient,
  };
};

/** name(문자열)만 있을 때도 표시명 반환 */
export const getBadgeDisplayNameFromName = (name) => {
  const hydrated = hydrateBadgeFromName(name);
  return getBadgeDisplayName(hydrated || { name: String(name || '') });
};

const getPostText = (p) => String(p?.note ?? p?.content ?? p?.description ?? p?.caption ?? '').trim();
const getPostCreatedAtMs = (p) => {
  const t = p?.createdAt ?? p?.created ?? p?.timestamp ?? 0;
  const ms = typeof t === 'string' ? new Date(t).getTime() : Number(t) || 0;
  return Number.isFinite(ms) ? ms : 0;
};
const getPostCapturedAtMs = (p) => {
  const t = p?.photoDate ?? p?.capturedAt ?? p?.captured_at ?? p?.captured ?? 0;
  const ms = typeof t === 'string' ? new Date(t).getTime() : Number(t) || 0;
  return Number.isFinite(ms) ? ms : 0;
};
const hasGps = (p) => !!(p?.coordinates || (p?.latitude != null && p?.longitude != null));
const hasPhoto = (p) => Array.isArray(p?.images) ? p.images.length > 0 : !!p?.image || !!p?.thumbnail;
const getPostHelpfulCount = (p) => {
  // "도움돼요"를 likes(좋아요)로 해석 (현재 DB/클라에서 확실히 존재하는 반응 필드)
  const n = Number(p?.helpfulCount ?? p?.helpful ?? p?.usefulCount ?? p?.useful ?? p?.likes ?? p?.likeCount ?? 0) || 0;
  return Math.max(0, n);
};
const getPostPoiKey = (p) => {
  const raw =
    p?.placeId ||
    p?.place_id ||
    p?.poiId ||
    p?.poi_id ||
    p?.placeName ||
    p?.place_name ||
    p?.detailedLocation ||
    p?.detailed_location ||
    p?.location ||
    '';
  const v = String(raw || '').trim();
  return v || null;
};
const getTimeBucket = (ms) => {
  if (!ms) return null;
  const h = new Date(ms).getHours();
  // 오전/오후/야간 3분할 (요청 조건)
  if (h >= 6 && h <= 11) return 'morning';
  if (h >= 12 && h <= 17) return 'afternoon';
  return 'night';
};
const hasWeatherTag = (p) => {
  const tagStr = Array.isArray(p?.tags) ? p.tags.join(' ') : String(p?.tags || '');
  const cat = String(p?.categoryName || p?.category || '').trim();
  const txt = `${tagStr} ${cat} ${getPostText(p)}`.toLowerCase();
  return txt.includes('날씨') || txt.includes('#날씨');
};
const hasWaitingTag = (p) => {
  const tagStr = Array.isArray(p?.tags) ? p.tags.join(' ') : String(p?.tags || '');
  const cat = String(p?.categoryName || p?.category || '').trim();
  const txt = `${tagStr} ${cat} ${getPostText(p)}`.toLowerCase();
  return txt.includes('웨이팅') || txt.includes('#웨이팅') || txt.includes('대기') || txt.includes('#대기');
};
const IMPORTANT_INFO_TAGS = [
  '중요정보',
  '폐업',
  '휴무',
  '임시휴무',
  '혼잡',
  '북적',
  '통제',
  '공사',
  '우회',
  '주차',
  '주차불가',
  '만차',
  '입장마감',
  '웨이팅',
  '대기',
  '줄',
];

const normalizeTagText = (v) => String(v || '').replace(/^#/, '').replace(/\s+/g, '').trim();

const isImportantInfoPost = (p) => {
  // "명확한 행동" 기준: 태그(또는 카테고리)로 중요정보를 표시한 경우만 카운트
  const tags = Array.isArray(p?.tags) ? p.tags : (p?.tags ? [p.tags] : []);
  const normalizedTags = tags.map(normalizeTagText).filter(Boolean);
  const cat = normalizeTagText(p?.categoryName || p?.category || '');
  const hay = new Set([...normalizedTags, cat]);
  return IMPORTANT_INFO_TAGS.some((t) => hay.has(t));
};
const isNightPost = (p) => {
  const ms = getPostCreatedAtMs(p);
  if (!ms) return false;
  const h = new Date(ms).getHours();
  return h >= 20 || h <= 5;
};

const normalizeLoose = (v) => String(v || '').replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase();

const getPostBlobLower = (p) => {
  const tags = Array.isArray(p?.tags) ? p.tags : (p?.tags ? [p.tags] : []);
  const ai = Array.isArray(p?.aiLabels) ? p.aiLabels : (p?.aiLabels ? [p.aiLabels] : []);
  const aiCats = Array.isArray(p?.aiCategories) ? p.aiCategories : [];
  const tagStr = [...tags, ...ai]
    .map((x) => (typeof x === 'string' ? x : (x?.name || x?.label || '')))
    .join(' ');
  const loc = [p?.placeName, p?.detailedLocation, typeof p?.location === 'string' ? p.location : '', p?.region]
    .filter(Boolean)
    .join(' ');
  const cat = String(p?.categoryName || p?.category || p?.aiCategoryName || p?.aiCategory || '').trim();
  const txt = getPostText(p);
  return normalizeLoose(`${tagStr} ${loc} ${cat} ${txt} ${aiCats.join(' ')}`);
};

const blobMatches = (p, keywords = []) => {
  const blob = getPostBlobLower(p);
  if (!blob) return false;
  return (keywords || []).some((kw) => {
    const k = normalizeLoose(kw);
    return k && blob.includes(k);
  });
};

const hasPostCategory = (p, slugs = []) => {
  const list = (Array.isArray(slugs) ? slugs : [slugs]).map((s) => normalizeLoose(s)).filter(Boolean);
  if (!list.length) return false;
  const values = [
    p?.category,
    p?.aiCategory,
    ...(Array.isArray(p?.categories) ? p.categories : []),
    ...(Array.isArray(p?.aiCategories) ? p.aiCategories : []),
  ]
    .map((v) => normalizeLoose(v))
    .filter(Boolean);
  return values.some((v) => list.includes(v));
};

const isLiveWindowPost = (p) => {
  const created = getPostCreatedAtMs(p);
  const captured = getPostCapturedAtMs(p);
  if (created && captured && Math.abs(created - captured) <= 10 * 60 * 1000) return true;
  if (!created) return false;
  return (Date.now() - created) / (60 * 60 * 1000) <= 48;
};

const isLiveNatureConditionPost = (p) =>
  isLiveWindowPost(p) && blobMatches(p, ['개화', '만개', '절정', '파도', '수온', '실시간', '현황', '조건', '상태']);

const isUnregisteredPlacePost = (p) => {
  if (p?.placeId || p?.place_id || p?.poiId || p?.poi_id) return false;
  const poi = getPostPoiKey(p);
  return !!poi && hasGps(p);
};

const NATURE_BLOOM_KW = ['벚꽃', '개화', '만개', '꽃', '봄꽃', '꽃길', '개화상황', '개화상태'];
const NATURE_SCENIC_KW = ['바다', '해변', '절경', '파도', '설경', '단풍', '일출', '일몰', '뷰', '전망', '오션'];

const matchesNatureBloom = (p) => hasPostCategory(p, ['bloom']) || blobMatches(p, NATURE_BLOOM_KW);
const matchesNatureScenic = (p) => hasPostCategory(p, ['scenic']) || blobMatches(p, NATURE_SCENIC_KW);

const THEME_TRACKS = [
  {
    key: 'nature:bloom',
    category: '자연·풍경',
    labels: ['꽃눈인사', '개화 가이드', '꽃의 전령사'],
    icons: ['🌱', '🌸', '💐'],
    tones: [
      { from: '#86EFAC', to: '#22C55E' },
      { from: '#F9A8D4', to: '#EC4899' },
      { from: '#FB7185', to: '#BE123C' },
    ],
    requirements: [
      { posts: 3, short: '꽃·개화 관련 제보 3회' },
      { posts: 15, helpful: 50, short: '제보 15회 + 도움돼요 50' },
      { posts: 40, liveCondition: 10, short: '제보 40회 + 실시간 개화 현황 10회' },
    ],
  },
  {
    key: 'nature:scenic',
    category: '자연·풍경',
    labels: ['풍경 배달부', '뷰 마스터', '절경의 수호자'],
    icons: ['🌊', '🏞️', '🌅'],
    tones: [
      { from: '#7DD3FC', to: '#2563EB' },
      { from: '#5EEAD4', to: '#0D9488' },
      { from: '#FDE68A', to: '#D97706' },
    ],
    requirements: [
      { posts: 3, short: '바다·절경 관련 제보 3회' },
      { posts: 15, helpful: 50, short: '제보 15회 + 도움돼요 50' },
      { posts: 40, liveCondition: 10, short: '제보 40회 + 실시간 파도·풍경 현황 10회' },
    ],
  },
  {
    key: 'hidden:pioneer',
    category: '숨은 명소',
    labels: ['초보 모험가', '로컬 큐레이터', '개척자'],
    icons: ['🔍', '📍', '🚩'],
    tones: [
      { from: '#A7F3D0', to: '#059669' },
      { from: '#93C5FD', to: '#1D4ED8' },
      { from: '#C4B5FD', to: '#6D28D9' },
    ],
    requirements: [
      { unregistered: 1, short: '미등록 장소 첫 제보 1회' },
      { unregistered: 10, hiddenVisitors: 1, short: '미등록 장소 제보 10회 + 방문자 발생' },
      { unregistered: 30, hiddenSaves: 100, short: '미등록 장소 제보 30회 + 저장·도움돼요 100' },
    ],
  },
  {
    key: 'night:guide',
    category: '심야 가이드',
    labels: ['심야 입문', '야경 중계자', '어둠의 여행자'],
    icons: ['🌙', '🌃', '✨'],
    tones: [
      { from: '#94A3B8', to: '#334155' },
      { from: '#818CF8', to: '#4338CA' },
      { from: '#FDE68A', to: '#7C3AED' },
    ],
    requirements: [
      { posts: 3, short: '심야·야경 실시간 제보 3회' },
      { posts: 15, helpful: 30, short: '심야 제보 15회 + 도움돼요 30' },
      { posts: 30, liveCondition: 10, short: '심야 제보 30회 + 실시간 야간 현황 10회' },
    ],
  },
];

const THEME_TRACK_MATCHERS = {
  'nature:bloom': matchesNatureBloom,
  'nature:scenic': matchesNatureScenic,
  'hidden:pioneer': isUnregisteredPlacePost,
  'night:guide': isNightPost,
};

const createEmptyThemeTrackStats = () => ({
  posts: 0,
  helpful: 0,
  liveCondition: 0,
  crowdShares: 0,
  unregistered: 0,
  hiddenVisitors: 0,
  hiddenSaves: 0,
  byDistrict: {},
});

const computeThemeTrackStats = (posts = []) => {
  const tracks = Object.fromEntries(THEME_TRACKS.map((t) => [t.key, createEmptyThemeTrackStats()]));
  const hiddenVisitDates = new Map();

  for (const p of posts || []) {
    const helpful = getPostHelpfulCount(p);
    for (const track of THEME_TRACKS) {
      const matcher = THEME_TRACK_MATCHERS[track.key];
      if (!matcher?.(p)) continue;
      const row = tracks[track.key];
      row.posts += 1;
      row.helpful += helpful;
      if (isLiveNatureConditionPost(p)) row.liveCondition += 1;
      if (track.key === 'hidden:pioneer') {
        row.unregistered += 1;
        row.hiddenSaves += helpful;
        const poi = getPostPoiKey(p) || 'hidden';
        const d = new Date(getPostCreatedAtMs(p) || Date.now()).toDateString();
        if (!hiddenVisitDates.has(poi)) hiddenVisitDates.set(poi, new Set());
        hiddenVisitDates.get(poi).add(d);
      }
      if (track.key === 'night:guide' && isLiveWindowPost(p)) row.liveCondition += 1;
    }
  }

  const hiddenRow = tracks['hidden:pioneer'];
  hiddenRow.hiddenVisitors = [...hiddenVisitDates.values()].filter((dates) => dates.size >= 2).length;

  return tracks;
};

const meetsThemeRequirement = (row, req) => {
  if (!row || !req) return false;
  if (req.posts != null && (Number(row.posts) || 0) < req.posts) return false;
  if (req.helpful != null && (Number(row.helpful) || 0) < req.helpful) return false;
  if (req.liveCondition != null && (Number(row.liveCondition) || 0) < req.liveCondition) return false;
  if (req.crowdShares != null && (Number(row.crowdShares) || 0) < req.crowdShares) return false;
  if (req.unregistered != null && (Number(row.unregistered) || 0) < req.unregistered) return false;
  if (req.hiddenVisitors != null && (Number(row.hiddenVisitors) || 0) < req.hiddenVisitors) return false;
  if (req.hiddenSaves != null && (Number(row.hiddenSaves) || 0) < req.hiddenSaves) return false;
  if (req.districtLeader && !row.districtLeader) return false;
  return true;
};

const resolveThemeTier = (row, requirements = []) => {
  let tier = 0;
  for (let i = 0; i < requirements.length; i += 1) {
    if (meetsThemeRequirement(row, requirements[i])) tier = i + 1;
  }
  if (tier === 0 && (Number(row?.posts) || 0) > 0) tier = 1;
  return tier;
};

const themeProgressFor = (row, req) => {
  if (!row || !req) return 0;
  const parts = [];
  if (req.posts) parts.push(Math.min(1, (Number(row.posts) || 0) / req.posts));
  if (req.helpful) parts.push(Math.min(1, (Number(row.helpful) || 0) / req.helpful));
  if (req.liveCondition) parts.push(Math.min(1, (Number(row.liveCondition) || 0) / req.liveCondition));
  if (req.crowdShares) parts.push(Math.min(1, (Number(row.crowdShares) || 0) / req.crowdShares));
  if (req.unregistered) parts.push(Math.min(1, (Number(row.unregistered) || 0) / req.unregistered));
  if (req.hiddenVisitors) parts.push(Math.min(1, (Number(row.hiddenVisitors) || 0) / req.hiddenVisitors));
  if (req.hiddenSaves) parts.push(Math.min(1, (Number(row.hiddenSaves) || 0) / req.hiddenSaves));
  if (req.districtLeader) parts.push(row.districtLeader ? 1 : Math.min(1, (Number(row.posts) || 0) / (req.posts || 50)));
  if (!parts.length) return 0;
  return Math.min(100, (parts.reduce((sum, v) => sum + v, 0) / parts.length) * 100);
};

const findThemeTrack = (trackKey) => THEME_TRACKS.find((t) => t.key === trackKey) || null;

/**
 * 정적(고정) 뱃지 정의는 제거하고, 동적(성장형) 뱃지만 운영합니다.
 * - 지역 / 여행 응원 2축 + 3단계 성장형
 * - 미획득은 기본 미노출(활동으로 진행이 생기면 자연스럽게 등장)
 */
export const BADGE_PROGRESS_DETAIL = {};
export const BADGES = {};

/**
 * 사용자 통계 계산 (v5 뱃지용)
 * - 지역: maxRegionReports, topRegionName, regionImportantInfo, regionConsecutiveDays, regionTop1Percent
 * - 실시간: weatherReports, waitingShares, fastUploads
 * - 도움: totalInfoViews, preventedFailFeedback, nightWeatherUseful
 * - 정확: gpsVerifiedCount, detailShares, factCheckEdits
 * - 친절: cheerAndComments(←totalComments), questionAnswersFast, helpfulAnswersWithPhoto
 * - 기여: totalPosts, consecutiveDays, firstReportNewPlace
 */
export const calculateUserStats = (posts = [], user = {}) => {
  logger.log('📊 사용자 통계 계산 시작');

  const regionCounts = {};
  const regionCountsByName = {};
  const byRegionAndDate = {};
  const byDate = {};
  const dateSet = new Set();
  const regionRealtimeMeta = {}; // region -> { uploads, helpful, timeBuckets:Set, pois:Set }

  (posts || []).forEach((p) => {
    const rRaw = p.region || (p.location && typeof p.location === 'string' ? p.location.split(' ')[0] : null) || null;
    const r = rRaw ? normalizeRegionName(rRaw) : null;
    if (r) {
      regionCounts[r] = (regionCounts[r] || 0) + 1;
      regionCountsByName[r] = (regionCountsByName[r] || 0) + 1;

      // 지역 뱃지(전문성) 평가용 메타 누적
      if (!regionRealtimeMeta[r]) {
        regionRealtimeMeta[r] = { uploads: 0, helpful: 0, timeBuckets: new Set(), pois: new Set() };
      }
      regionRealtimeMeta[r].uploads += 1;
      regionRealtimeMeta[r].helpful += getPostHelpfulCount(p);
      const ms = getPostCreatedAtMs(p) || getPostCapturedAtMs(p) || 0;
      const tb = getTimeBucket(ms);
      if (tb) regionRealtimeMeta[r].timeBuckets.add(tb);
      const poi = getPostPoiKey(p);
      if (poi) regionRealtimeMeta[r].pois.add(poi);

      const createdAt = p.createdAt || p.created;
      if (createdAt) {
        const d = new Date(createdAt).toDateString();
        if (!byRegionAndDate[r]) byRegionAndDate[r] = new Set();
        byRegionAndDate[r].add(d);
      }
    }
    const createdAt = p.createdAt || p.created;
    if (createdAt) {
      const d = new Date(createdAt).toDateString();
      dateSet.add(d);
      if (!byDate[d]) byDate[d] = new Set();
      const placeKey = p.placeId || p.location || p.region || (p.coordinates && String(p.coordinates)) || 'unknown';
      byDate[d].add(placeKey);
    }
  });

  const regionValues = Object.values(regionCounts);
  const maxRegionReports = regionValues.length > 0 ? Math.max(...regionValues) : 0;
  const topRegionName = regionValues.length > 0
    ? Object.entries(regionCounts).find(([, c]) => c === maxRegionReports)?.[0] || null
    : null;

  let regionConsecutiveDays = 0;
  for (const region of Object.keys(byRegionAndDate)) {
    const sorted = [...byRegionAndDate[region]].sort();
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]).getTime();
      const curr = new Date(sorted[i]).getTime();
      const diffDays = (curr - prev) / (24 * 60 * 60 * 1000);
      if (diffDays === 1) run += 1;
      else run = 1;
      regionConsecutiveDays = Math.max(regionConsecutiveDays, run);
    }
    regionConsecutiveDays = Math.max(regionConsecutiveDays, run);
  }

  const sortedDates = [...dateSet].sort();
  let consecutiveDays = 0;
  if (sortedDates.length > 0) {
    let run = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]).getTime();
      const curr = new Date(sortedDates[i]).getTime();
      const diffDays = (curr - prev) / (24 * 60 * 60 * 1000);
      if (diffDays === 1) run += 1;
      else run = 1;
      consecutiveDays = Math.max(consecutiveDays, run);
    }
    consecutiveDays = Math.max(consecutiveDays, run);
  }

  const totalComments = (posts || []).reduce((sum, p) => {
    const n = Number(p?.commentCount ?? p?.commentsCount ?? (Array.isArray(p?.comments) ? p.comments.length : 0)) || 0;
    return sum + Math.max(0, n);
  }, 0);

  // 명확히 측정 가능한 "행동" 기반 통계
  const gpsVerifiedCount = (posts || []).filter(hasGps).length;
  const photoPosts = (posts || []).filter(hasPhoto).length;
  const detailShares60 = (posts || []).filter((p) => getPostText(p).length >= 60).length;
  const detailShares = (posts || []).filter((p) => getPostText(p).length >= 120).length;
  const weatherReports = (posts || []).filter(hasWeatherTag).length;
  const waitingShares = (posts || []).filter(hasWaitingTag).length;
  const regionImportantInfo = (posts || []).filter(isImportantInfoPost).length;
  const nightPosts = (posts || []).filter(isNightPost).length;
  const uniquePlaces = new Set(
    (posts || [])
      .map((p) => String(p?.placeId || p?.placeName || p?.detailedLocation || p?.location || '').trim())
      .filter(Boolean)
  ).size;
  const fastUploads = (posts || []).filter((p) => {
    const created = getPostCreatedAtMs(p);
    const captured = getPostCapturedAtMs(p);
    if (!created || !captured) return false;
    return Math.abs(created - captured) <= 10 * 60 * 1000;
  }).length;

  const uid = user?.id || user?._id;
  const tripSupport = getTripSupportStats(uid);
  const themeTracks = computeThemeTrackStats(posts);

  const stats = {
    totalPosts: (posts || []).length,
    posts: posts || [],
    userId: user?.id || user?._id,
    totalLikes: (posts || []).reduce((sum, p) => sum + (p.likes || 0), 0),
    maxLikes: (posts || []).length > 0 ? Math.max(0, ...(posts || []).map((p) => p.likes || 0)) : 0,
    visitedRegions: new Set((posts || []).map((p) => p.region || (p.location && p.location.split(' ')[0])).filter(Boolean)).size,
    totalComments,

    maxRegionReports,
    topRegionName,
    regionImportantInfo,
    regionConsecutiveDays,
    regionTop1Percent: 0,
    regionCountsByName,
    regionRealtimeMeta,

    weatherReports,
    waitingShares,
    fastUploads,

    tripSupport,
    themeTracks,

    totalInfoViews: 0,
    preventedFailFeedback: 0,
    nightWeatherUseful: 0,

    gpsVerifiedCount,
    detailShares,
    detailShares60,
    factCheckEdits: 0,

    cheerAndComments: totalComments,
    questionAnswersFast: 0,
    helpfulAnswersWithPhoto: photoPosts,

    consecutiveDays,
    firstReportNewPlace: 0,
    uniquePlaces,
    photoPosts,
    nightPosts,
  };

  logger.log(`✅ 통계 계산 완료: 총 ${stats.totalPosts}개 게시물, ${stats.visitedRegions}개 지역`);
  return stats;
};

/**
 * 동적(성장형) 뱃지: 지역 / 여행 응원
 */
const buildDynamicBadges = (stats) => {
  const s = stats || null;
  if (!s) return [];

  const out = [];
  const mk = (key, b) => {
    const name = `${DYNAMIC_BADGE_PREFIX}${key}`;
    out.push({ ...b, name, dynamic: true });
  };

  // 1) 지역 테마 (전국 지역: "활동한 지역만" 자연 노출)
  const regionCounts = s.regionCountsByName && typeof s.regionCountsByName === 'object' ? s.regionCountsByName : {};
  const regionMeta = s.regionRealtimeMeta && typeof s.regionRealtimeMeta === 'object' ? s.regionRealtimeMeta : {};
  const regionStages = [
    { tier: 1, label: '가이드', targetUploads: 5 },
    { tier: 2, label: '톡파원', targetUploads: 20 },
    // tier3는 업로드 외 추가 조건이 붙는다.
    { tier: 3, label: '마스터', targetUploads: 50, targetHelpful: 100, targetPoi: 5, targetTimeBuckets: 3 },
  ];
  Object.entries(regionCounts)
    .filter(([region]) => region && String(region).trim().length >= 2)
    .forEach(([region, cntRaw]) => {
      const cnt = Number(cntRaw || 0) || 0;
      if (cnt <= 0) return;
      const st =
        cnt >= regionStages[2].targetUploads ? regionStages[2] :
        cnt >= regionStages[1].targetUploads ? regionStages[1] :
        regionStages[0];

      const m = regionMeta?.[region] || null;
      const helpful = m ? Number(m.helpful || 0) || 0 : 0;
      const poiCount = m ? (m.pois instanceof Set ? m.pois.size : Number(m.poiCount || 0) || 0) : 0;
      const timeBucketsCount = m ? (m.timeBuckets instanceof Set ? m.timeBuckets.size : Number(m.timeBucketsCount || 0) || 0) : 0;

      const tier3ExtraOk =
        st.tier !== 3
          ? true
          : cnt >= regionStages[2].targetUploads &&
            helpful >= regionStages[2].targetHelpful &&
            poiCount >= regionStages[2].targetPoi &&
            timeBucketsCount >= regionStages[2].targetTimeBuckets;

      const shortCondition =
        st.tier === 3
          ? `${region} 제보 ${regionStages[2].targetUploads}회 + 도움돼요 ${regionStages[2].targetHelpful} + 시간대 3종 + POI 5곳`
          : `${region} 제보 ${st.targetUploads}회`;

      const progressTarget =
        st.tier === 3
          ? regionStages[2].targetUploads
          : st.targetUploads;
      mk(
        `region:${region}:tier${st.tier}`,
        {
          displayName: `${region} ${st.label}`,
          description:
            st.tier === 3
              ? `${region}의 정보 시차를 줄이는 '지역 마스터'예요. 다양한 시간대·장소에서 검증된 실시간 정보를 연결합니다.`
              : `${region}의 실시간 정보를 꾸준히 공유하며 지역과 여행자를 연결해요.`,
          icon: '🧭',
          category: '지역 테마',
          difficulty: st.tier,
          tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}region:${region}:tier${st.tier}`),
          gradientCss: (() => {
            const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}region:${region}:tier${st.tier}`);
            return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
          })(),
          region,
          condition: () => (st.tier === 3 ? tier3ExtraOk : cnt >= progressTarget),
          getProgress: () => Math.min(100, (cnt / progressTarget) * 100),
          progressCurrent: cnt,
          progressTarget,
          progressUnit: '회',
          shortCondition,

          // tier3 부가 조건(상세 화면에서 추가로 보여줄 수 있게 데이터도 포함)
          regionHelpful: helpful,
          regionPoiCount: poiCount,
          regionTimeBucketsCount: timeBucketsCount,
        }
      );
    });

  // 2) 여행 응원(커뮤니티) — session tripSupport
  const ts = s.tripSupport || {};
  const safety = Math.max(0, Number(ts.safetySupport) || 0);
  const cheer = Math.max(0, Number(ts.cheerReactions) || 0);
  const pathProgress = Math.max(0, Number(ts.pathfinderProgressCount) || 0);

  if (safety > 0) {
    mk('support:guardian', {
      displayName: '실시간 가디언',
      description: '타인이 올린 위험·주의(안전) 맥락의 실시간 글에 응원/댓글을 남기며 집단의 안전 여행을 돕는 역할',
      icon: '🛡️',
      category: '여행 응원',
      difficulty: 2,
      tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}support:guardian`),
      gradientCss: (() => {
        const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}support:guardian`);
        return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
      })(),
      condition: (st) => (Number((st.tripSupport || {}).safetySupport) || 0) >= 10,
      getProgress: (st) => {
        const n = Math.max(0, Number((st.tripSupport || {}).safetySupport) || 0);
        return Math.min(100, (n / 10) * 100);
      },
      progressCurrent: safety,
      progressTarget: 10,
      progressUnit: '회',
      shortCondition: "타인 안전·주의 글 응원/댓글 10회 (post_category safety 등)",
    });
  }
  if (pathProgress > 0) {
    mk('support:pathfinder', {
      displayName: '랜선 길잡이',
      description:
        '질문(Q&A) 게시에 채택 5(우선) — 채택 UI를 붙이기 전엔, 서로 다른 질문 글에 답을 단 횟수(최대치)로 진행도를 표시합니다.',
      icon: '🧭',
      category: '여행 응원',
      difficulty: 2,
      tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}support:pathfinder`),
      gradientCss: (() => {
        const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}support:pathfinder`);
        return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
      })(),
      condition: (st) => (Number((st.tripSupport || {}).pathfinderProgressCount) || 0) >= 5,
      getProgress: (st) => {
        const n = Math.max(0, Number((st.tripSupport || {}).pathfinderProgressCount) || 0);
        return Math.min(100, (n / 5) * 100);
      },
      progressCurrent: pathProgress,
      progressTarget: 5,
      shortCondition: "질문에 채택 5(또는 서로 다른 질문 글 답변 5) — is_accepted·is_question",
    });
  }
  if (cheer > 0) {
    mk('support:lucky', {
      displayName: '럭키 메이커',
      description: '타인의 «라이브저니» 게시글에 응원(좋아요·하트)를 누적. 추적: reaction_type cheer(내부).',
      icon: '🍀',
      category: '여행 응원',
      difficulty: 2,
      tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}support:lucky`),
      gradientCss: (() => {
        const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}support:lucky`);
        return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
      })(),
      condition: (st) => (Number((st.tripSupport || {}).cheerReactions) || 0) >= 50,
      getProgress: (st) => {
        const n = Math.max(0, Number((st.tripSupport || {}).cheerReactions) || 0);
        return Math.min(100, (n / 50) * 100);
      },
      progressCurrent: cheer,
      progressTarget: 50,
      shortCondition: "타인 글 응원(좋아요) 50 (reaction: cheer)",
    });
  }

  // 3) 카테고리 성장형 테마
  const themeRows = s.themeTracks && typeof s.themeTracks === 'object' ? s.themeTracks : {};
  THEME_TRACKS.forEach((track) => {
    const row = themeRows[track.key] || createEmptyThemeTrackStats();
    const hasProgress =
      (Number(row.posts) || 0) > 0 ||
      (Number(row.crowdShares) || 0) > 0 ||
      (Number(row.unregistered) || 0) > 0;
    if (!hasProgress) return;

    const tier = resolveThemeTier(row, track.requirements);
    const req = track.requirements[Math.max(0, tier - 1)] || track.requirements[0];
    const tone = track.tones[Math.max(0, tier - 1)] || track.tones[0];
    const dynKey = `theme:${track.key.replace(':', ':')}:tier${tier}`;
    const dynName = `${DYNAMIC_BADGE_PREFIX}theme:${track.key.split(':')[0]}:${track.key.split(':')[1]}:tier${tier}`;

    mk(`theme:${track.key}:tier${tier}`, {
      displayName: track.labels[Math.max(0, tier - 1)] || track.labels[0],
      description:
        tier >= 3
          ? `${track.category}의 최고 단계 인장입니다. 실시간 현장 정보로 여행자의 선택을 돕는 검증된 기록가예요.`
          : `${track.category} 활동을 쌓으며 성장하는 인장입니다. 다음 단계 조건을 확인해 보세요.`,
      icon: track.icons[Math.max(0, tier - 1)] || track.icons[0],
      category: track.category,
      difficulty: tier,
      tone,
      gradientCss: tone ? `linear-gradient(135deg, ${tone.from}, ${tone.to})` : undefined,
      condition: (st) => meetsThemeRequirement((st.themeTracks || {})[track.key], req),
      getProgress: (st) => themeProgressFor((st.themeTracks || {})[track.key], req),
      progressCurrent: Number(row.posts) || Number(row.crowdShares) || Number(row.unregistered) || 0,
      progressTarget: req.posts || req.crowdShares || req.unregistered || req.liveCondition || req.hiddenSaves || 1,
      progressUnit: '회',
      shortCondition: req.short,
      masterTier: tier >= 3,
    });
  });

  return out;
};

/**
 * 새로 획득한 뱃지 확인
 */
export const checkNewBadges = (stats) => {
  logger.log('🎖️ 새 뱃지 확인 시작');
  
  try {
    const earnedBadges = getEarnedBadgesCacheForUser();
    const earnedBadgeNames = earnedBadges.map(b => b.name);
    
    const newBadges = [];
    
    const staticBadges = Object.values(BADGES);
    const dynamicBadges = buildDynamicBadges(stats);
    for (const badgeInfo of [...staticBadges, ...dynamicBadges]) {
      const badgeName = badgeInfo?.name;
      if (!badgeName) continue;
      // 이미 획득한 뱃지는 스킵
      if (earnedBadgeNames.includes(badgeName)) {
        continue;
      }
      
      // 조건 확인
      try {
        const meetsCondition = badgeInfo.condition(stats);
        if (meetsCondition) {
          newBadges.push(badgeInfo);
          logger.log(`🎉 새 뱃지 획득 가능: ${badgeName} (${badgeInfo.category} 카테고리)`);
        }
      } catch (error) {
        logger.error(`뱃지 조건 확인 오류 (${badgeName}):`, error);
      }
    }
    
    logger.log(`✅ 뱃지 확인 완료: ${newBadges.length}개 신규 획득 가능`);
    return newBadges;
    
  } catch (error) {
    logger.error('❌ 뱃지 체크 오류:', error);
    return [];
  }
};

// "뱃지 안내 노출" 상태: localStorage 제거 → 세션 메모리만 사용
// UploadScreen 등에서 import하므로 기존 API를 유지합니다.
const seenBadgesByUserId = new Map(); // userId -> Set(badgeName)

export const hasSeenBadge = (badgeName, userId = null) => {
  const key = String(badgeName || '').trim();
  if (!key) return false;
  const uid = userId != null ? String(userId).trim() : (currentEarnedBadgesUserId || '');
  const set = seenBadgesByUserId.get(uid || '__anon__');
  return !!(set && set.has(key));
};

export const markBadgeAsSeen = (badgeName, userId = null) => {
  const key = String(badgeName || '').trim();
  if (!key) return false;
  const uid = userId != null ? String(userId).trim() : (currentEarnedBadgesUserId || '');
  const mapKey = uid || '__anon__';
  const prev = seenBadgesByUserId.get(mapKey);
  if (prev) prev.add(key);
  else seenBadgesByUserId.set(mapKey, new Set([key]));
  return true;
};

/**
 * 뱃지 획득 처리 (Supabase + localStorage 둘 다 저장 → 로그아웃 후에도 유지)
 * @param {object} opts - { region, userId } 지역 뱃지일 때 region, Supabase 저장용 userId
 */
export const awardBadge = (badge, opts = {}) => {
  logger.log(`🎁 뱃지 획득 처리 시작: ${badge.name}`);

  try {
    const userId = opts?.userId || currentEarnedBadgesUserId || null;
    const earnedBadges = [...getEarnedBadgesCacheForUser(userId)];

    if (earnedBadges.some((b) => b.name === badge.name)) {
      logger.warn(`⚠️ 이미 획득한 뱃지: ${badge.name}`);
      return false;
    }

    // 성장형(동적) 뱃지는 "같은 트랙의 낮은 티어"를 교체
    const badgeName = String(badge?.name || '');
    if (badgeName.startsWith(DYNAMIC_BADGE_PREFIX)) {
      const baseKey = badgeName.replace(/:tier\d+$/, '');
      for (let i = earnedBadges.length - 1; i >= 0; i -= 1) {
        const n = String(earnedBadges[i]?.name || '');
        if (n && n !== badgeName && n.replace(/:tier\d+$/, '') === baseKey) {
          earnedBadges.splice(i, 1);
        }
      }
    }

    const newBadge = {
      ...badge,
      earnedAt: new Date().toISOString(),
      ...(opts?.region && (badge.regionAware || REGION_AWARE_NAMES.includes(badge.name)) && { region: opts.region })
    };

    earnedBadges.push(newBadge);

    // Supabase에 저장 (userId 있으면 → 재로그인 시에도 유지)
    if (userId) {
      saveUserBadgeSupabase(userId, newBadge).catch(() => {});
      setCurrentEarnedBadgesUserId(userId);
      setEarnedBadgesCacheForUser(userId, earnedBadges);
    }
    logger.log(`✅ 뱃지 저장 완료(메모리): ${badge.name} (${badge.category} 카테고리)`);

    window.dispatchEvent(new CustomEvent('badgeEarned', { detail: newBadge }));
    window.dispatchEvent(new Event('badgeProgressUpdated'));

    return true;
  } catch (error) {
    logger.error(`❌ 뱃지 획득 처리 오류:`, error);
    return false;
  }
};

/**
 * Supabase에서 해당 사용자 뱃지 목록 불러와 localStorage와 동기화 (로그인 시 호출 권장)
 * @param {string} userId - Supabase auth user id (UUID)
 */
export const syncEarnedBadgesFromSupabase = async (userId) => {
  if (!userId) return;
  try {
    setCurrentEarnedBadgesUserId(userId);
    const rows = await fetchUserBadgesSupabase(userId);
    if (!rows || rows.length === 0) return;
    const earned = rows
      .map((r) => {
        const base = hydrateBadgeFromName(r.badge_name) || { name: r.badge_name };
        return {
          ...base,
          name: r.badge_name,
          earnedAt: r.earned_at,
          ...(r.region && { region: r.region }),
        };
      })
      .filter((b) => b?.name); // 정적/동적 모두 유지
    setEarnedBadgesCacheForUser(userId, earned);
    logger.log('✅ Supabase 뱃지 동기화:', earned.length, '개');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('badgeProgressUpdated'));
    }
  } catch (e) {
    logger.warn('syncEarnedBadgesFromSupabase 실패:', e?.message);
  }
};

/**
 * 획득한 뱃지 목록
 */
export const getEarnedBadges = () => {
  try {
    const list = getEarnedBadgesCacheForUser()
      .filter((b) => b?.name && !isSeasonDynBadgeName(b.name))
      .map((b) => {
        const hydrated = hydrateBadgeFromName(b.name);
        return hydrated ? { ...hydrated, ...b } : b;
      });
    return list;
  } catch (error) {
    logger.error('❌ 뱃지 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 뱃지 UI에 표시할 획득 뱃지만 반환
 */
export const getEarnedBadgesForDisplay = () => {
  return getEarnedBadges();
};

/**
 * 뱃지 진행도 계산
 */
export const getBadgeProgress = (badgeName, stats) => {
  const isDynamic = String(badgeName || '').startsWith(DYNAMIC_BADGE_PREFIX);
  const badge = isDynamic ? (buildDynamicBadges(stats).find((b) => b.name === badgeName) || null) : BADGES[badgeName];
  if (!badge || !badge.getProgress) return 0;
  
  try {
    return badge.getProgress(stats);
  } catch (error) {
    logger.error(`뱃지 진행도 계산 오류 (${badgeName}):`, error);
    return 0;
  }
};

/**
 * 카테고리별 뱃지 목록
 */
export const getBadgesByCategory = (category) => {
  // 정적 뱃지는 제거됨
  return [];
};

/**
 * 숨겨진 뱃지 제외한 목록
 */
export const getVisibleBadges = () => {
  // 정적 뱃지는 제거됨
  return [];
};
/**
 * 통계로 달성 가능한 뱃지 목록 (프로필·타인 조회용 — 게시물 기반 추정)
 */
export const getEarnedBadgesFromStats = (stats) => {
  if (!stats) return [];
  const list = [];
  const dynamicBadges = buildDynamicBadges(stats);
  for (const badgeInfo of dynamicBadges) {
    const badgeName = badgeInfo?.name;
    if (!badgeName || isSeasonDynBadgeName(badgeName)) continue;
    if (badgeInfo.hidden) continue;
    try {
      if (badgeInfo.condition(stats)) {
        const item = { ...badgeInfo, name: badgeName };
        if ((badgeInfo.regionAware || REGION_AWARE_NAMES.includes(badgeName)) && stats.topRegionName) {
          item.region = stats.topRegionName;
        }
        list.push(item);
      }
    } catch (_) { /* 조건 함수 예외 무시 */ }
  }
  return list;
};

/**
 * 특정 유저의 획득/추정 뱃지 (표시용)
 * @param {string} userId
 * @param {Array|null} posts - 해당 유저 게시물이 있으면 통계로 뱃지 추정(타인 프로필). 없으면 본인만 로컬 저장 뱃지.
 */
export const getEarnedBadgesForUser = (userId, posts = null) => {
  try {
    if (posts && Array.isArray(posts)) {
      const stats = calculateUserStats(posts, { id: userId });
      const fromStats = getEarnedBadgesFromStats(stats);
      return fromStats;
    }

    return getEarnedBadgesForDisplay();
  } catch (e) {
    logger.warn('getEarnedBadgesForUser:', e?.message);
    return [];
  }
};

/**
 * 사용 가능한 모든 뱃지 목록
 * - regionAware: isEarned이면 earned.region, 아니면 stats?.topRegionName → displayRegion
 * - 달성 조건 표시: shortCondition, progressCurrent, progressTarget, progressUnit
 */
export const getAvailableBadges = (stats = null) => {
  const earnedBadges = getEarnedBadges();
  const earnedSet = new Set(earnedBadges.map((b) => String(b?.name || '')).filter(Boolean));
  const dynamic = stats ? buildDynamicBadges(stats) : [];

  const base = [];

  // earnedBadges에만 존재하는 동적/확장 뱃지도 UI에서 보이게(정의가 없어도)
  const earnedUnknown = earnedBadges
    .filter((b) => b && b.name)
    .map((b) => {
      const hydrated = hydrateBadgeFromName(b.name);
      return {
        ...(hydrated || {}),
        ...b,
        name: b.name,
        isEarned: true,
        progress: 100,
        shortCondition: b.shortCondition || hydrated?.shortCondition || '',
      };
    });

  const merged = [...base, ...dynamic, ...earnedUnknown];

  // "미획득 뱃지 미노출": 획득했거나, 활동으로 진행도가 생긴 뱃지만 반환
  return merged.filter((b) => {
    if (!b) return false;
    if (isSeasonDynBadgeName(b.name)) return false;
    const isEarned = !!b.isEarned || earnedSet.has(String(b.name));
    if (isEarned) return true;
    if (!stats) return false;
    const cur = typeof b.progressCurrent === 'number' ? b.progressCurrent : 0;
    const prog = typeof b.progress === 'number' ? b.progress : getBadgeProgress(b.name, stats);
    return (Number.isFinite(cur) && cur > 0) || (Number.isFinite(prog) && prog > 0);
  });
};

/**
 * 뱃지 통계
 */
export const getBadgeStats = () => {
  const earnedBadges = getEarnedBadgesForDisplay();
  const categoryCounts = {
    '지역 테마': earnedBadges.filter((b) => b.category === '지역 테마').length,
    '자연·풍경': earnedBadges.filter((b) => b.category === '자연·풍경').length,
    '숨은 명소': earnedBadges.filter((b) => b.category === '숨은 명소').length,
    '심야 가이드': earnedBadges.filter((b) => b.category === '심야 가이드').length,
    '여행 응원': earnedBadges.filter((b) => b.category === '여행 응원').length,
  };
  return { total: earnedBadges.length, categoryCounts };
};

export default BADGES;


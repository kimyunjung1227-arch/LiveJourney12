/**
 * 라이브저니 뱃지 시스템 v5.0
 * 7 카테고리: 온보딩, 지역 가이드, 실시간 정보, 도움 지수, 정확한 정보, 친절한 여행자, 기여도, 신뢰지수
 * - [지역명] 뱃지: regionAware + opts.region 저장 → getBadgeDisplayName으로 "[지역명] 가이드" 등 표기
 * - Supabase user_badges 연동: 로그아웃 후 재로그인해도 획득 뱃지·활동 통계 유지
 */
import { logger } from './logger';
import { getTrustRawScore } from './trustIndex';
import { fetchUserBadgesSupabase, saveUserBadgeSupabase } from '../api/userBadgesSupabase';
import { normalizeRegionName } from './regionNames';

/** [지역명] 뱃지일 때 표시명 반환. 그 외는 name 그대로 */
export const getBadgeDisplayName = (badge) => {
  if (badge?.displayName) return String(badge.displayName);
  if (badge?.region && badge?.name && /^지역\s/.test(badge.name))
    return `${badge.region} ${badge.name.replace(/^지역\s/, '')}`;
  return badge?.name || '';
};

const REGION_AWARE_NAMES = ['지역 가이드', '지역 지킴이', '지역 통신원', '지역 마스터'];
const DYNAMIC_BADGE_PREFIX = 'dyn:';

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

const normalizeLoose = (v) => String(v || '').replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase();

const getPostBlobLower = (p) => {
  const tags = Array.isArray(p?.tags) ? p.tags : (p?.tags ? [p.tags] : []);
  const ai = Array.isArray(p?.aiLabels) ? p.aiLabels : (p?.aiLabels ? [p.aiLabels] : []);
  const tagStr = [...tags, ...ai]
    .map((x) => (typeof x === 'string' ? x : (x?.name || x?.label || '')))
    .join(' ');
  const loc = [p?.placeName, p?.detailedLocation, typeof p?.location === 'string' ? p.location : '', p?.region]
    .filter(Boolean)
    .join(' ');
  const cat = String(p?.categoryName || p?.category || '').trim();
  const txt = getPostText(p);
  return normalizeLoose(`${tagStr} ${loc} ${cat} ${txt}`);
};

const matchesAny = (blobLower, keywords = []) => {
  if (!blobLower) return false;
  return (keywords || []).some((kw) => {
    const k = normalizeLoose(kw);
    return k && blobLower.includes(k);
  });
};

const isWithinHours = (p, hours) => {
  const ms = getPostCreatedAtMs(p) || getPostCapturedAtMs(p) || 0;
  if (!ms) return false;
  const ageH = (Date.now() - ms) / (1000 * 60 * 60);
  return Number.isFinite(ageH) && ageH >= 0 && ageH <= hours;
};

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

/** 뱃지별 달성 조건 표시용: 목표 수치, 현재 수치 계산, 단위, 한 줄 설명 */
export const BADGE_PROGRESS_DETAIL = {
  '첫 걸음': { shortCondition: '실시간 제보 1개', progressTarget: 1, getProgressCurrent: (s) => s.totalPosts || 0, progressUnit: '개' },
  '지역 가이드': { shortCondition: '해당 지역 제보 10회', progressTarget: 10, getProgressCurrent: (s) => s.maxRegionReports || 0, progressUnit: '회' },
  '지역 지킴이': { shortCondition: '중요정보 태그 달고 제보 5회', progressTarget: 5, getProgressCurrent: (s) => s.regionImportantInfo || 0, progressUnit: '회' },
  '지역 통신원': { shortCondition: '같은 지역 3일 연속 제보', progressTarget: 3, getProgressCurrent: (s) => s.regionConsecutiveDays || 0, progressUnit: '일' },
  '지역 마스터': { shortCondition: '같은 지역 제보 30회', progressTarget: 30, getProgressCurrent: (s) => s.maxRegionReports || 0, progressUnit: '회' },
  '날씨요정': { shortCondition: '#날씨 태그/카테고리 제보 5회', progressTarget: 5, getProgressCurrent: (s) => s.weatherReports || 0, progressUnit: '회' },
  '웨이팅 요정': { shortCondition: '#웨이팅/#대기 제보 10회', progressTarget: 10, getProgressCurrent: (s) => s.waitingShares || 0, progressUnit: '회' },
  '0.1초 셔터': { shortCondition: '촬영→업로드 10분 이내 5회', progressTarget: 5, getProgressCurrent: (s) => s.fastUploads || 0, progressUnit: '회' },
  '베스트 나침반': { shortCondition: '내 게시물 좋아요 합계 50개', progressTarget: 50, getProgressCurrent: (s) => s.totalLikes || 0, progressUnit: '개' },
  '실패 구조대': { shortCondition: '내 게시물 댓글 30개 받기', progressTarget: 30, getProgressCurrent: (s) => s.totalComments || 0, progressUnit: '개' },
  '라이트하우스': { shortCondition: '밤(20~05시) 제보 5회', progressTarget: 5, getProgressCurrent: (s) => s.nightPosts || 0, progressUnit: '회' },
  '팩트 체크 마스터': { shortCondition: '설명 120자 이상 제보 10회', progressTarget: 10, getProgressCurrent: (s) => s.detailShares || 0, progressUnit: '회' },
  '인간 GPS': { shortCondition: 'GPS 포함 제보 5회', progressTarget: 5, getProgressCurrent: (s) => s.gpsVerifiedCount || 0, progressUnit: '회' },
  '트래블 셜록': { shortCondition: '설명 60자 이상 제보 5회', progressTarget: 5, getProgressCurrent: (s) => s.detailShares60 || 0, progressUnit: '회' },
  '실시간 답변러': { shortCondition: '내 게시물 댓글 10개 받기', progressTarget: 10, getProgressCurrent: (s) => s.totalComments || 0, progressUnit: '개' },
  '길 위의 천사': { shortCondition: '내 게시물 댓글 50개 받기', progressTarget: 50, getProgressCurrent: (s) => s.totalComments || 0, progressUnit: '개' },
  '동행 가이드': { shortCondition: '사진 포함 제보 10회', progressTarget: 10, getProgressCurrent: (s) => s.photoPosts || 0, progressUnit: '회' },
  '라이브 기록가': { shortCondition: '실시간 제보 100개', progressTarget: 100, getProgressCurrent: (s) => s.totalPosts || 0, progressUnit: '개' },
  '연속 중계 마스터': { shortCondition: '30일 연속 1회 이상 공유', progressTarget: 30, getProgressCurrent: (s) => s.consecutiveDays || 0, progressUnit: '일' },
  '지도 개척자': { shortCondition: '서로 다른 장소 10곳 제보', progressTarget: 10, getProgressCurrent: (s) => s.uniquePlaces || 0, progressUnit: '곳' },
};

export const BADGES = {
  // 🌱 온보딩
  '첫 걸음': { name: '첫 걸음', description: '첫 번째 실시간 여행 정보를 공유했어요. 여행의 첫걸음을 내딛었어요!', icon: '👣', category: '온보딩', difficulty: 1, gradient: 'from-green-400 to-emerald-500', condition: (s) => (s.totalPosts || 0) >= 1, getProgress: (s) => Math.min(100, ((s.totalPosts || 0) / 1) * 100) },

  // 🗺️ 1. 지역 가이드 (Locality) — regionAware, 획득 시 region 저장
  '지역 가이드': { name: '지역 가이드', description: '해당 지역 실시간 제보 10회 이상. 가장 직관적인 로컬 전문가 인증', icon: '🗺️', category: '지역 가이드', difficulty: 2, gradient: 'from-indigo-600 to-blue-800', regionAware: true, condition: (s) => (s.maxRegionReports || 0) >= 10, getProgress: (s) => Math.min(100, ((s.maxRegionReports || 0) / 10) * 100) },
  '지역 지킴이': { name: '지역 지킴이', description: '제보 업로드 시 중요정보 태그(예: #혼잡/#폐업/#휴무/#통제/#공사/#만차/#웨이팅 등) 중 하나를 달고 5회 업로드', icon: '🛡️', category: '지역 가이드', difficulty: 2, gradient: 'from-amber-600 to-amber-800', regionAware: true, condition: (s) => (s.regionImportantInfo || 0) >= 5, getProgress: (s) => Math.min(100, ((s.regionImportantInfo || 0) / 5) * 100) },
  '지역 통신원': { name: '지역 통신원', description: '해당 지역에서 3일 연속 실시간 중계. 지역 소식을 실시간으로 전하는 특파원', icon: '📡', category: '지역 가이드', difficulty: 3, gradient: 'from-cyan-500 to-blue-600', regionAware: true, condition: (s) => (s.regionConsecutiveDays || 0) >= 3, getProgress: (s) => Math.min(100, ((s.regionConsecutiveDays || 0) / 3) * 100) },
  '지역 마스터': { name: '지역 마스터', description: '한 지역에서 실시간 제보 30회 이상. 해당 지역의 꾸준한 기록자', icon: '👑', category: '지역 가이드', difficulty: 4, gradient: 'from-purple-600 to-fuchsia-700', regionAware: true, condition: (s) => (s.maxRegionReports || 0) >= 30, getProgress: (s) => Math.min(100, ((s.maxRegionReports || 0) / 30) * 100) },

  // ⚡ 2. 실시간 정보 (Speed)
  '날씨요정': { name: '날씨요정', description: '게시글에 #날씨 태그를 추가하거나 날씨 카테고리로 올린 제보 5회', icon: '🌦️', category: '실시간 정보', difficulty: 2, gradient: 'from-cyan-400 to-blue-600', condition: (s) => (s.weatherReports || 0) >= 5, getProgress: (s) => Math.min(100, ((s.weatherReports || 0) / 5) * 100) },
  '웨이팅 요정': { name: '웨이팅 요정', description: '실시간 대기 줄 상황과 예상 시간 10회 공유. 헛걸음과 시간 낭비를 막아주는 구세주', icon: '⏱️', category: '실시간 정보', difficulty: 2, gradient: 'from-lime-400 to-green-600', condition: (s) => (s.waitingShares || 0) >= 10, getProgress: (s) => Math.min(100, ((s.waitingShares || 0) / 10) * 100) },
  '0.1초 셔터': { name: '0.1초 셔터', description: '촬영시간(캡처시간)과 업로드시간 차이가 10분 이내인 제보 5회', icon: '⚡', category: '실시간 정보', difficulty: 3, gradient: 'from-yellow-300 to-amber-500', condition: (s) => (s.fastUploads || 0) >= 5, getProgress: (s) => Math.min(100, ((s.fastUploads || 0) / 5) * 100) },

  // 🏆 3. 도움 지수 (Impact)
  '베스트 나침반': { name: '베스트 나침반', description: '내 게시물에 달린 좋아요 합계 50개 달성', icon: '🧭', category: '도움 지수', difficulty: 4, gradient: 'from-amber-400 to-yellow-600', condition: (s) => (s.totalLikes || 0) >= 50, getProgress: (s) => Math.min(100, ((s.totalLikes || 0) / 50) * 100) },
  '실패 구조대': { name: '실패 구조대', description: '내 게시물 댓글을 30개 이상 받음 (정보가 도움이 됐다는 반응)', icon: '🫀', category: '도움 지수', difficulty: 3, gradient: 'from-red-400 to-rose-600', condition: (s) => (s.totalComments || 0) >= 30, getProgress: (s) => Math.min(100, ((s.totalComments || 0) / 30) * 100) },
  '라이트하우스': { name: '라이트하우스', description: '밤 시간대(20~05시)에 올린 제보 5회', icon: '🗼', category: '도움 지수', difficulty: 3, gradient: 'from-cyan-400 to-blue-600', condition: (s) => (s.nightPosts || 0) >= 5, getProgress: (s) => Math.min(100, ((s.nightPosts || 0) / 5) * 100) },

  // ✅ 4. 정확한 정보 제공 (Trust)
  '팩트 체크 마스터': { name: '팩트 체크 마스터', description: '설명이 120자 이상인 “상세 제보”를 10회 작성', icon: '✅', category: '정확한 정보', difficulty: 3, gradient: 'from-emerald-600 to-teal-700', condition: (s) => (s.detailShares || 0) >= 10, getProgress: (s) => Math.min(100, ((s.detailShares || 0) / 10) * 100) },
  '인간 GPS': { name: '인간 GPS', description: 'GPS(좌표) 포함 제보 5회 작성', icon: '🛡️', category: '정확한 정보', difficulty: 2, gradient: 'from-slate-500 to-slate-700', condition: (s) => (s.gpsVerifiedCount || 0) >= 5, getProgress: (s) => Math.min(100, ((s.gpsVerifiedCount || 0) / 5) * 100) },
  '트래블 셜록': { name: '트래블 셜록', description: '설명이 60자 이상인 제보를 5회 작성', icon: '🔍', category: '정확한 정보', difficulty: 2, gradient: 'from-amber-600 to-amber-800', condition: (s) => (s.detailShares60 || 0) >= 5, getProgress: (s) => Math.min(100, ((s.detailShares60 || 0) / 5) * 100) },

  // 🤝 5. 친절한 여행자 (Kindness)
  '실시간 답변러': { name: '실시간 답변러', description: '내 게시물이 댓글을 10개 이상 받음', icon: '💬', category: '친절한 여행자', difficulty: 2, gradient: 'from-sky-400 to-blue-500', condition: (s) => (s.totalComments || 0) >= 10, getProgress: (s) => Math.min(100, ((s.totalComments || 0) / 10) * 100) },
  '길 위의 천사': { name: '길 위의 천사', description: '내 게시물이 댓글을 50개 이상 받음', icon: '👼', category: '친절한 여행자', difficulty: 1, gradient: 'from-yellow-400 to-orange-500', condition: (s) => (s.totalComments || 0) >= 50, getProgress: (s) => Math.min(100, ((s.totalComments || 0) / 50) * 100) },
  '동행 가이드': { name: '동행 가이드', description: '사진이 포함된 제보를 10회 이상 업로드', icon: '🤝', category: '친절한 여행자', difficulty: 3, gradient: 'from-violet-500 to-purple-600', condition: (s) => (s.photoPosts || 0) >= 10, getProgress: (s) => Math.min(100, ((s.photoPosts || 0) / 10) * 100) },

  // 🔥 6. 기여도 (Loyalty)
  '라이브 기록가': { name: '라이브 기록가', description: '총 실시간 제보 게시글 100개 달성. 서비스의 성장을 이끄는 핵심 기여자', icon: '📝', category: '기여도', difficulty: 3, gradient: 'from-blue-600 to-indigo-700', condition: (s) => (s.totalPosts || 0) >= 100, getProgress: (s) => Math.min(100, ((s.totalPosts || 0) / 100) * 100) },
  '연속 중계 마스터': { name: '연속 중계 마스터', description: '30일 연속으로 실시간 상황 1회 이상 공유. 변함없는 성실함으로 신뢰를 쌓는 유저', icon: '📅', category: '기여도', difficulty: 4, gradient: 'from-emerald-500 to-green-700', condition: (s) => (s.consecutiveDays || 0) >= 30, getProgress: (s) => Math.min(100, ((s.consecutiveDays || 0) / 30) * 100) },
  '지도 개척자': { name: '지도 개척자', description: '서로 다른 장소(위치 기준) 10곳에 제보 업로드', icon: '🗺️', category: '기여도', difficulty: 2, gradient: 'from-amber-600 to-orange-700', condition: (s) => (s.uniquePlaces || 0) >= 10, getProgress: (s) => Math.min(100, ((s.uniquePlaces || 0) / 10) * 100) },

  // 📊 신뢰지수 (stats.trustScore = Compass 누적, 등급 구간은 trustIndex TRUST_GRADES와 동일)
  '노마드': { name: '노마드', description: '가입 즉시. 정보 열람·기본 업로드', icon: '🧭', category: '신뢰지수', difficulty: 1, gradient: 'from-stone-400 to-amber-700', condition: (s) => (s.trustScore ?? 0) >= 0, getProgress: (s) => Math.min(100, ((s.trustScore ?? 0) / 1200) * 100) },
  '트래커': { name: '트래커', description: 'Compass 누적·조건 충족 시 승급 (GPS·정확해요)', icon: '📍', category: '신뢰지수', difficulty: 1, gradient: 'from-slate-500 to-blue-700', condition: (s) => (s.trustScore ?? 0) >= 1200, getProgress: (s) => Math.min(100, (((s.trustScore ?? 0) - 1200) / 3300) * 100) },
  '가이드': { name: '가이드', description: '높은 등급일수록 같은 활동으로 점수가 더 천천히 오릅니다', icon: '📖', category: '신뢰지수', difficulty: 2, gradient: 'from-cyan-600 to-blue-800', condition: (s) => (s.trustScore ?? 0) >= 4500, getProgress: (s) => Math.min(100, (((s.trustScore ?? 0) - 4500) / 11500) * 100) },
  '마스터': { name: '마스터', description: 'Compass 누적·커뮤니티 검증으로 달성', icon: '🏆', category: '신뢰지수', difficulty: 3, gradient: 'from-amber-600 to-orange-700', condition: (s) => (s.trustScore ?? 0) >= 16000, getProgress: (s) => Math.min(100, (((s.trustScore ?? 0) - 16000) / 36000) * 100) },
  '앰버서더': { name: '앰버서더', description: '최고 등급 — 지속적 기여로 유지', icon: '👑', category: '신뢰지수', difficulty: 4, gradient: 'from-amber-400 to-yellow-600', condition: (s) => (s.trustScore ?? 0) >= 52000, getProgress: (s) => Math.min(100, ((s.trustScore ?? 0) / 52000) * 100) }
};

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
  const recent48h = [];
  const seasonSignals48h = { cherry: 0, foliage: 0, snow: 0, sea: 0 };
  const valueSignals48h = { waiting: 0, photo: 0, weather: 0 };

  (posts || []).forEach((p) => {
    const rRaw = p.region || (p.location && typeof p.location === 'string' ? p.location.split(' ')[0] : null) || null;
    const r = rRaw ? normalizeRegionName(rRaw) : null;
    if (r) {
      regionCounts[r] = (regionCounts[r] || 0) + 1;
      regionCountsByName[r] = (regionCountsByName[r] || 0) + 1;
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

  const totalComments = (posts || []).reduce(
    (sum, p) => sum + (Array.isArray(p.comments) ? p.comments.length : 0),
    0
  );

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

  // 시즌/가치 테마: 최근 48시간 "실시간" 시그널
  (posts || []).forEach((p) => {
    if (isWithinHours(p, 48)) recent48h.push(p);
  });

  const SEASON_KW = {
    cherry: ['벚꽃', '개화', '만개', '봄꽃', '벚꽃길', '벚꽃축제'],
    foliage: ['단풍', '낙엽', '단풍절정', '단풍길', '단풍명소'],
    snow: ['첫눈', '눈', '설경', '적설', '빙판', '결빙', '눈길', '폭설'],
    sea: ['바다', '해변', '파도', '수온', '서핑', '해수욕장', '윤슬', '물멍'],
  };
  const VALUE_KW = {
    photo: ['인생샷', '구도', '채광', '역광', '노을', '일몰', '일출', '골든아워', '블루아워', '매직아워'],
    waiting: ['웨이팅', '대기', '줄', 'queue', 'waiting', '입장', '만차'],
    weather: ['날씨', '비', '눈', '바람', '안개', '구름', '소나기', '강수', '기상', '예보'],
  };

  recent48h.forEach((p) => {
    const blob = getPostBlobLower(p);
    if (matchesAny(blob, SEASON_KW.cherry)) seasonSignals48h.cherry += 1;
    if (matchesAny(blob, SEASON_KW.foliage)) seasonSignals48h.foliage += 1;
    if (matchesAny(blob, SEASON_KW.snow)) seasonSignals48h.snow += 1;
    if (matchesAny(blob, SEASON_KW.sea)) seasonSignals48h.sea += 1;
    if (matchesAny(blob, VALUE_KW.photo)) valueSignals48h.photo += 1;
    if (matchesAny(blob, VALUE_KW.waiting) || hasWaitingTag(p)) valueSignals48h.waiting += 1;
    if (matchesAny(blob, VALUE_KW.weather) || hasWeatherTag(p)) valueSignals48h.weather += 1;
  });

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

    weatherReports,
    waitingShares,
    fastUploads,
    recent48hCount: recent48h.length,
    seasonSignals48h,
    valueSignals48h,

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

    // 신뢰지수는 "현재 사용자 + posts(=Supabase+로컬 병합)" 기준으로 계산해야 누적이 유지됨
    trustScore: (() => {
      try {
        const uid = user?.id || user?._id;
        if (!uid) return getTrustRawScore();
        return getTrustRawScore(String(uid), posts || []);
      } catch {
        return getTrustRawScore();
      }
    })()
  };

  logger.log(`✅ 통계 계산 완료: 총 ${stats.totalPosts}개 게시물, ${stats.visitedRegions}개 지역, 신뢰지수 ${stats.trustScore}`);
  return stats;
};

/**
 * 동적(성장형) 뱃지 빌더: 시즌/지역/가치 3축
 * - 미획득이라도 progress/progressCurrent가 0보다 크면 "자연스럽게" 노출될 수 있음
 * - badge.name은 저장 키로 쓰이므로 유니크하게 구성(dyn:...)
 */
const buildDynamicBadges = (stats) => {
  const s = stats || null;
  if (!s) return [];

  const out = [];
  const mk = (key, b) => {
    const name = `${DYNAMIC_BADGE_PREFIX}${key}`;
    out.push({ ...b, name, dynamic: true });
  };

  // 1) 시즌 테마 (희소성: 시즌에만 활성화)
  const month = new Date().getMonth() + 1;
  const inSpring = month >= 3 && month <= 5;
  const inSummer = month >= 6 && month <= 8;
  const inAutumn = month >= 9 && month <= 11;
  const inWinter = month === 12 || month <= 2;

  const seasonCount = s.seasonSignals48h || {};
  const seasonBadge = (id, enabled, count, stages, icon, gradient) => {
    if (!enabled) return;
    const [t1, t2, t3] = stages;
    const thresholds = [1, 3, 6];
    const st =
      count >= thresholds[2] ? { title: t3, tier: 3, target: thresholds[2] } :
      count >= thresholds[1] ? { title: t2, tier: 2, target: thresholds[1] } :
      { title: t1, tier: 1, target: thresholds[0] };
    mk(
      `season:${id}:tier${st.tier}`,
      {
        displayName: st.title,
        description: '48시간 내 실시간 제보로 시즌 현장을 인증해요.',
        icon,
        category: '시즌 테마',
        difficulty: st.tier,
        gradient,
        condition: () => count >= st.target,
        getProgress: () => Math.min(100, (count / st.target) * 100),
        progressCurrent: count,
        progressTarget: st.target,
        progressUnit: '회',
        shortCondition: `최근 48시간 제보 ${st.target}회`,
        seasonLimited: true,
      }
    );
  };

  seasonBadge('cherry', inSpring, Number(seasonCount.cherry || 0), ['벚꽃 탐색가', '벚꽃 헌터', '벚꽃 사랑꾼'], '🌸', 'from-pink-400 to-rose-500');
  seasonBadge('foliage', inAutumn, Number(seasonCount.foliage || 0), ['단풍 관찰자', '단풍 스나이퍼', '낙엽 기록가'], '🍁', 'from-orange-400 to-amber-600');
  seasonBadge('snow', inWinter, Number(seasonCount.snow || 0), ['첫눈 목격자', '설경 스나이퍼', '겨울왕국 통치자'], '❄️', 'from-sky-300 to-blue-600');
  seasonBadge('sea', inSummer, Number(seasonCount.sea || 0), ['파도 추적자', '서핑 스카우트', '오션 가디언'], '🌊', 'from-cyan-400 to-blue-600');

  // 2) 지역 테마 (전국 지역: "활동한 지역만" 자연 노출)
  const regionCounts = s.regionCountsByName && typeof s.regionCountsByName === 'object' ? s.regionCountsByName : {};
  const regionStages = [
    { tier: 1, label: '비기너', target: 3 },
    { tier: 2, label: '특파원', target: 10 },
    { tier: 3, label: '마스터', target: 30 },
  ];
  Object.entries(regionCounts)
    .filter(([region]) => region && String(region).trim().length >= 2)
    .forEach(([region, cntRaw]) => {
      const cnt = Number(cntRaw || 0) || 0;
      if (cnt <= 0) return;
      const st =
        cnt >= regionStages[2].target ? regionStages[2] :
        cnt >= regionStages[1].target ? regionStages[1] :
        regionStages[0];
      mk(
        `region:${region}:tier${st.tier}`,
        {
          displayName: `${region} ${st.label}`,
          description: `${region} 실시간 정보를 꾸준히 올리면 성장하는 지역 전문가 뱃지예요.`,
          icon: st.tier === 3 ? '👑' : st.tier === 2 ? '📡' : '🧭',
          category: '지역 테마',
          difficulty: st.tier,
          gradient: st.tier === 3 ? 'from-purple-600 to-fuchsia-700' : st.tier === 2 ? 'from-cyan-500 to-blue-600' : 'from-slate-500 to-slate-700',
          region,
          condition: () => cnt >= st.target,
          getProgress: () => Math.min(100, (cnt / st.target) * 100),
          progressCurrent: cnt,
          progressTarget: st.target,
          progressUnit: '회',
          shortCondition: `${region} 제보 ${st.target}회`,
        }
      );
    });

  // 3) 가치 테마 (페인포인트 해결)
  const v = s.valueSignals48h || {};
  const valueBadge = (id, count, stages, icon, gradient) => {
    if (count <= 0) return; // 활동 없으면 미노출
    const thresholds = [1, 3, 6];
    const st =
      count >= thresholds[2] ? { title: stages[2], tier: 3, target: thresholds[2] } :
      count >= thresholds[1] ? { title: stages[1], tier: 2, target: thresholds[1] } :
      { title: stages[0], tier: 1, target: thresholds[0] };
    mk(
      `value:${id}:tier${st.tier}`,
      {
        displayName: st.title,
        description: '48시간 내 실시간 제보로 실패를 줄여주는 솔루션 테마예요.',
        icon,
        category: '가치 테마',
        difficulty: st.tier,
        gradient,
        condition: () => count >= st.target,
        getProgress: () => Math.min(100, (count / st.target) * 100),
        progressCurrent: count,
        progressTarget: st.target,
        progressUnit: '회',
        shortCondition: `최근 48시간 제보 ${st.target}회`,
      }
    );
  };
  valueBadge('waiting', Number(v.waiting || 0), ['줄 서기 관찰자', '대기 시간 스나이퍼', '패스트패스 설계자'], '⏱️', 'from-lime-400 to-green-600');
  valueBadge('photo', Number(v.photo || 0), ['매직아워 마스터', '구도 설계자', '인생샷 디렉터'], '📸', 'from-amber-400 to-orange-600');
  valueBadge('weather', Number(v.weather || 0), ['구름 추적자', '기상 예보관', '맑음의 연금술사'], '🌦️', 'from-cyan-400 to-blue-600');

  return out;
};

/**
 * 새로 획득한 뱃지 확인
 */
export const checkNewBadges = (stats) => {
  logger.log('🎖️ 새 뱃지 확인 시작');
  
  try {
    const earnedBadges = JSON.parse(localStorage.getItem('earnedBadges') || '[]');
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

/**
 * 뱃지 획득 처리 (Supabase + localStorage 둘 다 저장 → 로그아웃 후에도 유지)
 * @param {object} opts - { region, userId } 지역 뱃지일 때 region, Supabase 저장용 userId
 */
export const awardBadge = (badge, opts = {}) => {
  logger.log(`🎁 뱃지 획득 처리 시작: ${badge.name}`);

  try {
    const earnedBadges = JSON.parse(localStorage.getItem('earnedBadges') || '[]');

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
    const userId = opts?.userId || (typeof localStorage !== 'undefined' && JSON.parse(localStorage.getItem('user') || '{}')?.id);
    if (userId) {
      saveUserBadgeSupabase(userId, newBadge).catch(() => {});
    }

    // localStorage 저장
    try {
      localStorage.setItem('earnedBadges', JSON.stringify(earnedBadges));
      logger.log(`✅ 뱃지 저장 완료: ${badge.name} (${badge.category} 카테고리)`);

      const verify = JSON.parse(localStorage.getItem('earnedBadges') || '[]');
      if (verify.some(b => b.name === badge.name)) {
        logger.log(`✅ 뱃지 저장 확인됨: ${badge.name}`);
      } else {
        logger.error(`❌ 뱃지 저장 실패: ${badge.name}`);
        return false;
      }
    } catch (saveError) {
      logger.error(`❌ localStorage 저장 오류:`, saveError);
      return false;
    }

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
    const rows = await fetchUserBadgesSupabase(userId);
    if (!rows || rows.length === 0) return;
    const earned = rows.map((r) => {
      const badge = BADGES[r.badge_name];
      return {
        ...(badge || { name: r.badge_name }),
        name: r.badge_name,
        earnedAt: r.earned_at,
        ...(r.region && { region: r.region }),
      };
    });
    localStorage.setItem('earnedBadges', JSON.stringify(earned));
    logger.log('✅ Supabase 뱃지 동기화:', earned.length, '개');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('badgeProgressUpdated'));
    }
  } catch (e) {
    logger.warn('syncEarnedBadgesFromSupabase 실패:', e?.message);
  }
};

/** 뱃지 표시에서 제외할 카테고리 (신뢰지수는 별도 구역에서만 표시) */
const TRUST_CATEGORY = '신뢰지수';

/**
 * 획득한 뱃지 목록
 */
export const getEarnedBadges = () => {
  try {
    return JSON.parse(localStorage.getItem('earnedBadges') || '[]');
  } catch (error) {
    logger.error('❌ 뱃지 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 뱃지 UI에 표시할 획득 뱃지만 반환 (신뢰지수 등급 제외)
 */
export const getEarnedBadgesForDisplay = () => {
  return getEarnedBadges().filter((b) => b.category !== TRUST_CATEGORY);
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
  return Object.values(BADGES).filter(badge => badge.category === category);
};

/**
 * 숨겨진 뱃지 제외한 목록
 */
export const getVisibleBadges = () => {
  return Object.values(BADGES).filter(badge => !badge.hidden);
};

/**
 * 뱃지를 봤는지 확인
 */
export const hasSeenBadge = (badgeName) => {
  try {
    const seenBadges = JSON.parse(localStorage.getItem('seenBadges') || '[]');
    return seenBadges.includes(badgeName);
  } catch (error) {
    logger.error('❌ 뱃지 확인 오류:', error);
    return false;
  }
};

/**
 * 뱃지를 봤다고 표시
 */
export const markBadgeAsSeen = (badgeName) => {
  try {
    const seenBadges = JSON.parse(localStorage.getItem('seenBadges') || '[]');
    if (!seenBadges.includes(badgeName)) {
      seenBadges.push(badgeName);
      localStorage.setItem('seenBadges', JSON.stringify(seenBadges));
      logger.log(`✅ 뱃지 확인 표시: ${badgeName}`);
    }
    return true;
  } catch (error) {
    logger.error('❌ 뱃지 확인 표시 오류:', error);
    return false;
  }
};
/**
 * 통계로 달성 가능한 뱃지 목록 (프로필·타인 조회용 — 게시물 기반 추정)
 */
export const getEarnedBadgesFromStats = (stats) => {
  if (!stats) return [];
  const list = [];
  const staticBadges = Object.values(BADGES);
  const dynamicBadges = buildDynamicBadges(stats);
  for (const badgeInfo of [...staticBadges, ...dynamicBadges]) {
    const badgeName = badgeInfo?.name;
    if (!badgeName) continue;
    if (badgeInfo.category === TRUST_CATEGORY || badgeInfo.hidden) continue;
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
 * 특정 유저의 획득/추정 뱃지 (표시용, 신뢰지수 등급 제외)
 * @param {string} userId
 * @param {Array|null} posts - 해당 유저 게시물이 있으면 통계로 뱃지 추정(타인 프로필). 없으면 본인만 로컬 저장 뱃지.
 */
export const getEarnedBadgesForUser = (userId, posts = null) => {
  try {
    const saved = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const selfId = saved?.id;
    const isSelf = selfId != null && String(selfId) === String(userId);

    if (posts && Array.isArray(posts)) {
      const stats = calculateUserStats(posts, { id: userId });
      const fromStats = getEarnedBadgesFromStats(stats);
      if (isSelf) {
        const fromStorage = getEarnedBadgesForDisplay();
        const byName = new Map();
        fromStats.forEach((b) => byName.set(b.name, { ...b }));
        fromStorage.forEach((b) => {
          const cur = byName.get(b.name);
          byName.set(b.name, cur ? { ...cur, ...b, earnedAt: b.earnedAt || cur.earnedAt, region: b.region || cur.region } : b);
        });
        return [...byName.values()];
      }
      return fromStats;
    }

    if (isSelf) return getEarnedBadgesForDisplay();
    return [];
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

  const base = Object.entries(BADGES)
    .filter(([, badge]) => badge.category !== TRUST_CATEGORY)
    .map(([name, badge]) => {
      const earnedBadge = earnedBadges.find((b) => b.name === name);
      const isEarned = !!earnedBadge;
      const detail = BADGE_PROGRESS_DETAIL[name];
      const progressCurrent = detail && stats ? detail.getProgressCurrent(stats) : undefined;
      const progressTarget = detail?.progressTarget;
      const progressUnit = detail?.progressUnit;
      const shortCondition = detail?.shortCondition || badge.description?.slice(0, 30) || '';

      return {
        ...badge,
        name,
        isEarned,
        progress: stats ? getBadgeProgress(name, stats) : 0,
        shortCondition,
        progressCurrent: progressCurrent !== undefined ? progressCurrent : undefined,
        progressTarget,
        progressUnit,
        ...(isEarned && earnedBadge?.region && { region: earnedBadge.region }),
        ...(isEarned && earnedBadge?.earnedAt && { earnedAt: earnedBadge.earnedAt }),
        ...(!isEarned && stats?.topRegionName && (badge.regionAware || REGION_AWARE_NAMES.includes(name)) && { displayRegion: stats.topRegionName })
      };
    });

  // earnedBadges에만 존재하는 동적/확장 뱃지도 UI에서 보이게(정의가 없어도)
  const earnedUnknown = earnedBadges
    .filter((b) => b && b.name && !BADGES[b.name])
    .map((b) => ({
      ...b,
      name: b.name,
      isEarned: true,
      progress: 100,
      shortCondition: b.shortCondition || '',
    }));

  const merged = [...base, ...dynamic, ...earnedUnknown];

  // "미획득 뱃지 미노출": 획득했거나, 활동으로 진행도가 생긴 뱃지만 반환
  return merged.filter((b) => {
    if (!b) return false;
    const isEarned = !!b.isEarned || earnedSet.has(String(b.name));
    if (isEarned) return true;
    if (!stats) return false;
    const cur = typeof b.progressCurrent === 'number' ? b.progressCurrent : 0;
    const prog = typeof b.progress === 'number' ? b.progress : getBadgeProgress(b.name, stats);
    return (Number.isFinite(cur) && cur > 0) || (Number.isFinite(prog) && prog > 0);
  });
};

/**
 * 뱃지 통계 (신뢰지수 등급 제외 — 뱃지와 신뢰지수는 별도)
 */
export const getBadgeStats = () => {
  const earnedBadges = getEarnedBadgesForDisplay();
  const categoryCounts = {
    '온보딩': earnedBadges.filter((b) => b.category === '온보딩').length,
    '지역 가이드': earnedBadges.filter((b) => b.category === '지역 가이드').length,
    '실시간 정보': earnedBadges.filter((b) => b.category === '실시간 정보').length,
    '도움 지수': earnedBadges.filter((b) => b.category === '도움 지수').length,
    '정확한 정보': earnedBadges.filter((b) => b.category === '정확한 정보').length,
    '친절한 여행자': earnedBadges.filter((b) => b.category === '친절한 여행자').length,
    '기여도': earnedBadges.filter((b) => b.category === '기여도').length
  };
  return { total: earnedBadges.length, categoryCounts };
};

export default BADGES;


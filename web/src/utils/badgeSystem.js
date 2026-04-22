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

// 서버 운영 전환: localStorage 제거 → 세션 메모리 캐시만 유지
let earnedBadgesCache = [];

/** [지역명] 뱃지일 때 표시명 반환. 그 외는 name 그대로 */
export const getBadgeDisplayName = (badge) => {
  if (badge?.displayName) return String(badge.displayName);
  if (badge?.region && badge?.name && /^지역\s/.test(badge.name))
    return `${badge.region} ${badge.name.replace(/^지역\s/, '')}`;
  return badge?.name || '';
};

const REGION_AWARE_NAMES = ['지역 가이드', '지역 지킴이', '지역 통신원', '지역 마스터'];
const DYNAMIC_BADGE_PREFIX = 'dyn:';

const makeTone = (from, to) => ({ from, to });

const toneForDynamic = (name) => {
  const n = String(name || '');
  if (!n.startsWith(DYNAMIC_BADGE_PREFIX)) return null;
  // season
  if (n.includes(':season:cherry:')) return makeTone('#FB7185', '#F43F5E'); // pink/rose
  if (n.includes(':season:foliage:')) return makeTone('#FB923C', '#D97706'); // orange/amber
  if (n.includes(':season:snow:')) return makeTone('#7DD3FC', '#2563EB'); // sky/blue
  if (n.includes(':season:sea:')) return makeTone('#22D3EE', '#2563EB'); // cyan/blue
  // value
  if (n.includes(':value:waiting:')) return makeTone('#A3E635', '#16A34A'); // lime/green
  if (n.includes(':value:photo:')) return makeTone('#FBBF24', '#EA580C'); // amber/orange
  if (n.includes(':value:weather:')) return makeTone('#22D3EE', '#2563EB'); // cyan/blue
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
  // season:<id>:tierX
  if (parts[0] === 'season') {
    const id = parts[1];
    const tier = Number(String(parts[2] || '').replace(/^tier/, '')) || 1;
    const map = {
      cherry: ['벚꽃 탐색가', '벚꽃 헌터', '벚꽃 사랑꾼'],
      foliage: ['단풍 관찰자', '단풍 스나이퍼', '낙엽 기록가'],
      snow: ['첫눈 목격자', '설경 스나이퍼', '겨울왕국 통치자'],
      sea: ['파도 추적자', '서핑 스카우트', '오션 가디언'],
    };
    const icon = { cherry: '🌸', foliage: '🍁', snow: '❄️', sea: '🌊' }[id] || '🏅';
    return { kind: 'season', id, tier, displayName: (map[id] || [])[tier - 1] || (map[id] || [])[0] || '시즌 뱃지', icon, category: '시즌 테마' };
  }
  // region:<region>:tierX
  if (parts[0] === 'region') {
    const region = parts[1] || '';
    const tier = Number(String(parts[2] || '').replace(/^tier/, '')) || 1;
    const labels = ['비기너', '특파원', '마스터'];
    const icon = tier === 3 ? '👑' : tier === 2 ? '📡' : '🧭';
    return { kind: 'region', region, tier, displayName: `${region} ${labels[tier - 1] || '비기너'}`, icon, category: '지역 테마' };
  }
  // value:<id>:tierX
  if (parts[0] === 'value') {
    const id = parts[1];
    const tier = Number(String(parts[2] || '').replace(/^tier/, '')) || 1;
    const map = {
      waiting: ['줄 서기 관찰자', '대기 시간 스나이퍼', '패스트패스 설계자'],
      photo: ['매직아워 마스터', '구도 설계자', '인생샷 디렉터'],
      weather: ['구름 추적자', '기상 예보관', '맑음의 연금술사'],
    };
    const icon = { waiting: '⏱️', photo: '📸', weather: '🌦️' }[id] || '🏅';
    return { kind: 'value', id, tier, displayName: (map[id] || [])[tier - 1] || (map[id] || [])[0] || '가치 뱃지', icon, category: '가치 테마' };
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
    difficulty: decoded.tier,
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

/**
 * 정적(고정) 뱃지 정의는 제거하고, 동적(성장형) 뱃지만 운영합니다.
 * - 시즌/지역/가치 3축 + 3단계 성장형
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
        tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}season:${id}:tier${st.tier}`),
        gradientCss: (() => {
          const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}season:${id}:tier${st.tier}`);
          return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
        })(),
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

  seasonBadge('cherry', inSpring, Number(seasonCount.cherry || 0), ['벚꽃 탐색가', '벚꽃 헌터', '벚꽃 사랑꾼'], '🌸');
  seasonBadge('foliage', inAutumn, Number(seasonCount.foliage || 0), ['단풍 관찰자', '단풍 스나이퍼', '낙엽 기록가'], '🍁');
  seasonBadge('snow', inWinter, Number(seasonCount.snow || 0), ['첫눈 목격자', '설경 스나이퍼', '겨울왕국 통치자'], '❄️');
  seasonBadge('sea', inSummer, Number(seasonCount.sea || 0), ['파도 추적자', '서핑 스카우트', '오션 가디언'], '🌊');

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
          tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}region:${region}:tier${st.tier}`),
          gradientCss: (() => {
            const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}region:${region}:tier${st.tier}`);
            return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
          })(),
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
        tone: toneForDynamic(`${DYNAMIC_BADGE_PREFIX}value:${id}:tier${st.tier}`),
        gradientCss: (() => {
          const t = toneForDynamic(`${DYNAMIC_BADGE_PREFIX}value:${id}:tier${st.tier}`);
          return t ? `linear-gradient(135deg, ${t.from}, ${t.to})` : undefined;
        })(),
        condition: () => count >= st.target,
        getProgress: () => Math.min(100, (count / st.target) * 100),
        progressCurrent: count,
        progressTarget: st.target,
        progressUnit: '회',
        shortCondition: `최근 48시간 제보 ${st.target}회`,
      }
    );
  };
  valueBadge('waiting', Number(v.waiting || 0), ['줄 서기 관찰자', '대기 시간 스나이퍼', '패스트패스 설계자'], '⏱️');
  valueBadge('photo', Number(v.photo || 0), ['매직아워 마스터', '구도 설계자', '인생샷 디렉터'], '📸');
  valueBadge('weather', Number(v.weather || 0), ['구름 추적자', '기상 예보관', '맑음의 연금술사'], '🌦️');

  return out;
};

/**
 * 새로 획득한 뱃지 확인
 */
export const checkNewBadges = (stats) => {
  logger.log('🎖️ 새 뱃지 확인 시작');
  
  try {
    const earnedBadges = Array.isArray(earnedBadgesCache) ? earnedBadgesCache : [];
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
    const earnedBadges = Array.isArray(earnedBadgesCache) ? [...earnedBadgesCache] : [];

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
    const userId = opts?.userId || null;
    if (userId) {
      saveUserBadgeSupabase(userId, newBadge).catch(() => {});
    }

    earnedBadgesCache = earnedBadges;
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
      .filter((b) => b?.name && String(b.name).startsWith(DYNAMIC_BADGE_PREFIX));
    earnedBadgesCache = earned;
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
    const list = (Array.isArray(earnedBadgesCache) ? earnedBadgesCache : [])
      .filter((b) => b?.name && String(b.name).startsWith(DYNAMIC_BADGE_PREFIX))
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
    if (!badgeName) continue;
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
 * 특정 유저의 획득/추정 뱃지 (표시용, 신뢰지수 등급 제외)
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
    '시즌 테마': earnedBadges.filter((b) => b.category === '시즌 테마').length,
    '지역 테마': earnedBadges.filter((b) => b.category === '지역 테마').length,
    '가치 테마': earnedBadges.filter((b) => b.category === '가치 테마').length,
  };
  return { total: earnedBadges.length, categoryCounts };
};

export default BADGES;


/**
 * 뱃지 카탈로그 (SVG 문장 기반).
 *
 * 각 뱃지 메타:
 * - key         : profiles.earned_badges / 활동분석 결과에 쓰는 식별자
 * - name        : 표시 이름 (지역은 "ㅇㅇ탐험가 / ㅇㅇ톡파원 / ㅇㅇ마스터")
 * - motif       : BadgeIcon 모티프 키 (badgeMotifs.MOTIFS)
 * - level       : 1 | 2 | 3 — 문장 디테일(프레임/왕관/광채) 단계
 * - tier        : 'low' | 'mid' | 'high' — pill 색조
 * - group       : 전체보기 섹션
 * - chainId     : 성장형 체인 식별자 (있으면 성장형 뱃지)
 * - next        : 다음 단계 key (진행 안내용, 선택)
 * - progressOf  : (user) => number — 다음 단계 진행도
 * - progressTarget : 다음 단계 목표값
 */

// ── 전국 17개 시·도 (성장형 지역 뱃지) ──────────────────────────
// motif 는 각 지역 대표 랜드마크/상징.
const REGIONS = [
  { key: 'seoul', label: '서울', motif: 'seoul', match: /(서울|seoul)/i },
  { key: 'busan', label: '부산', motif: 'busan', match: /(부산|busan)/i },
  { key: 'daegu', label: '대구', motif: 'daegu', match: /(대구|daegu)/i },
  { key: 'incheon', label: '인천', motif: 'incheon', match: /(인천|incheon)/i },
  { key: 'gwangju', label: '광주', motif: 'gwangju', match: /(광주|gwangju)/i },
  { key: 'daejeon', label: '대전', motif: 'daejeon', match: /(대전|daejeon)/i },
  { key: 'ulsan', label: '울산', motif: 'ulsan', match: /(울산|ulsan)/i },
  { key: 'sejong', label: '세종', motif: 'sejong', match: /(세종|sejong)/i },
  {
    key: 'gyeonggi',
    label: '경기',
    motif: 'gyeonggi',
    match: /(경기|수원|성남|용인|고양|부천|안양|경기도|gyeonggi)/i,
  },
  {
    key: 'gangwon',
    label: '강원',
    motif: 'gangwon',
    match: /(강원|춘천|강릉|속초|원주|평창|양양|gangwon)/i,
  },
  {
    key: 'chungbuk',
    label: '충북',
    motif: 'chungbuk',
    match: /(충북|충청북도|청주|충주|제천|chungbuk)/i,
  },
  {
    key: 'chungnam',
    label: '충남',
    motif: 'chungnam',
    match: /(충남|충청남도|천안|아산|서산|당진|chungnam)/i,
  },
  {
    key: 'jeonbuk',
    label: '전북',
    motif: 'jeonbuk',
    match: /(전북|전라북도|전주|군산|익산|jeonbuk|jeonju)/i,
  },
  {
    key: 'jeonnam',
    label: '전남',
    motif: 'jeonnam',
    match: /(전남|전라남도|여수|순천|목포|광양|jeonnam)/i,
  },
  {
    key: 'gyeongbuk',
    label: '경북',
    motif: 'gyeongbuk',
    match: /(경북|경상북도|포항|경주|안동|구미|gyeongbuk|gyeongju)/i,
  },
  {
    key: 'gyeongnam',
    label: '경남',
    motif: 'gyeongnam',
    match: /(경남|경상남도|창원|통영|진주|김해|gyeongnam)/i,
  },
  { key: 'jeju', label: '제주', motif: 'jeju', match: /(제주|jeju|서귀포)/i },
];

// 지역 성장 단계 정의 (탐험가 → 톡파원 → 마스터)
const REGION_TIERS = [
  {
    suffix: '탐험가',
    level: 1,
    tier: 'low',
    target: 3,
    blurb: '곳곳을 직접 누비며 실시간 정보를 모으기 시작한',
    role: '탐험가',
  },
  {
    suffix: '톡파원',
    level: 2,
    tier: 'mid',
    target: 10,
    blurb: '생생한 현장을 꾸준히 전하는',
    role: '톡파원',
  },
  {
    suffix: '마스터',
    level: 3,
    tier: 'high',
    target: 25,
    blurb: '구석구석을 가장 깊이 꿰뚫는',
    role: '마스터',
  },
];

const REGION_THRESHOLDS = REGION_TIERS.map((t) => t.target); // [3, 10, 25]

function buildRegionCatalog() {
  const catalog = {};
  const chains = {};
  for (const region of REGIONS) {
    const chainId = `region_${region.key}`;
    const chainKeys = [];
    REGION_TIERS.forEach((t, idx) => {
      const key = `${region.key}_${t.level}`;
      chainKeys.push(key);
      const next = REGION_TIERS[idx + 1];
      catalog[key] = {
        key,
        name: `${region.label} ${t.suffix}`,
        motif: region.motif,
        level: t.level,
        tier: t.tier,
        group: '지역 전문성',
        chainId,
        regionKey: region.key,
        description: `${region.label} ${t.blurb} 지역 ${t.role}입니다.`,
        requirement: `${region.label} 지역 제보 ${t.target}회`,
        ...(next
          ? {
              next: `${region.key}_${next.level}`,
              progressOf: (u) => u?.region_counts?.[region.key] || 0,
              progressTarget: next.target,
            }
          : {}),
      };
    });
    chains[chainId] = chainKeys;
  }
  return { catalog, chains };
}

const { catalog: REGION_CATALOG, chains: REGION_CHAINS } = buildRegionCatalog();

// ── 비지역 뱃지 ────────────────────────────────────────────────
const BASE_CATALOG = {
  // 영예
  honor_bronze: {
    key: 'honor_bronze',
    name: '영예 (동)',
    motif: 'honor',
    level: 2,
    tier: 'mid',
    group: '영예',
    chainId: 'honor',
    description: '꾸준히 커뮤니티에 도움을 나누고 있는 기여자의 인장입니다.',
    requirement: '도움 100명 또는 베스트 컷 1회',
    next: 'honor_gold',
    progressOf: (u) => Math.max(u?.helped_count || 0, (u?.best_cut_count || 0) * 50),
    progressTarget: 500,
  },
  honor_gold: {
    key: 'honor_gold',
    name: '영예 (금)',
    motif: 'honor',
    level: 3,
    tier: 'high',
    group: '영예',
    chainId: 'honor',
    description: '커뮤니티 최상위 기여자에게 주어지는 가장 강한 영예입니다.',
    requirement: '도움 500명 + 베스트 컷 10회 달성',
  },

  // 베스트 컷 작가
  crown_1: {
    key: 'crown_1',
    name: '베스트 컷 1회',
    motif: 'crown',
    level: 1,
    tier: 'low',
    group: '베스트 컷 작가',
    chainId: 'bestcut',
    description: '베스트 컷에 처음 선정된 작가에게 부여되는 왕관입니다.',
    requirement: '베스트 컷 1회 선정',
    next: 'crown_5',
    progressOf: (u) => u?.best_cut_count || 0,
    progressTarget: 5,
  },
  crown_5: {
    key: 'crown_5',
    name: '베스트 컷 5회',
    motif: 'crown',
    level: 2,
    tier: 'mid',
    group: '베스트 컷 작가',
    chainId: 'bestcut',
    description: '5회 베스트 컷에 선정된 인장입니다.',
    requirement: '베스트 컷 5회 선정',
    next: 'crown_10',
    progressOf: (u) => u?.best_cut_count || 0,
    progressTarget: 10,
  },
  crown_10: {
    key: 'crown_10',
    name: '베스트 컷 10회',
    motif: 'crown',
    level: 3,
    tier: 'high',
    group: '베스트 컷 작가',
    chainId: 'bestcut',
    description: '베스트 컷 10회를 달성한 최고 등급 인장입니다.',
    requirement: '베스트 컷 10회 선정',
  },

  // 도움 마일스톤
  flame_100: {
    key: 'flame_100',
    name: '도움 100명',
    motif: 'flame',
    level: 1,
    tier: 'low',
    group: '도움 마일스톤',
    chainId: 'help',
    description: '100명에게 실시간 정보로 도움을 준 인장입니다.',
    requirement: '도움 100명 달성',
    next: 'flame_300',
    progressOf: (u) => u?.helped_count || 0,
    progressTarget: 300,
  },
  flame_300: {
    key: 'flame_300',
    name: '도움 300명',
    motif: 'flame',
    level: 2,
    tier: 'mid',
    group: '도움 마일스톤',
    chainId: 'help',
    description: '300명에게 도움을 준 활발한 기여자의 인장입니다.',
    requirement: '도움 300명 달성',
    next: 'flame_500',
    progressOf: (u) => u?.helped_count || 0,
    progressTarget: 500,
  },
  flame_500: {
    key: 'flame_500',
    name: '도움 500명+',
    motif: 'flame',
    level: 3,
    tier: 'high',
    group: '도움 마일스톤',
    chainId: 'help',
    description: '500명 이상에게 도움을 준 최고 단계 인장입니다.',
    requirement: '도움 500명 달성',
  },

  // 카테고리 전문성 (단일 단계)
  cherry: {
    key: 'cherry',
    name: '벚꽃 마스터',
    motif: 'cherry',
    level: 2,
    tier: 'mid',
    group: '카테고리 전문성',
    description: '개화·자연 카테고리에서 활동을 쌓으며 성장하는 인장입니다.',
    requirement: '꽃·개화 관련 제보 10회',
  },
  sunset: {
    key: 'sunset',
    name: '노을 헌터',
    motif: 'sunset',
    level: 2,
    tier: 'mid',
    group: '카테고리 전문성',
    description: '노을·야경 카테고리 전문가의 인장입니다.',
    requirement: '노을 관련 제보 10회',
  },
  weather: {
    key: 'weather',
    name: '날씨 리포터',
    motif: 'weather',
    level: 2,
    tier: 'mid',
    group: '카테고리 전문성',
    description: '날씨·체감 카테고리 전문가의 인장입니다.',
    requirement: '날씨 관련 제보 10회',
  },
  festival: {
    key: 'festival',
    name: '축제 마니아',
    motif: 'festival',
    level: 2,
    tier: 'mid',
    group: '카테고리 전문성',
    description: '이벤트·축제 카테고리 전문가의 인장입니다.',
    requirement: '축제 관련 제보 10회',
  },
  crowd: {
    key: 'crowd',
    name: '인파 리더',
    motif: 'crowd',
    level: 2,
    tier: 'mid',
    group: '카테고리 전문성',
    description: '혼잡도·대기 카테고리 전문가의 인장입니다.',
    requirement: '인파 관련 제보 10회',
  },
  store: {
    key: 'store',
    name: '단골 탐험가',
    motif: 'store',
    level: 2,
    tier: 'mid',
    group: '카테고리 전문성',
    description: '영업·운영 카테고리 전문가의 인장입니다.',
    requirement: '단골 관련 제보 10회',
  },
};

export const BADGE_CATALOG = { ...BASE_CATALOG, ...REGION_CATALOG };

export const BADGE_GROUP_ORDER = [
  '영예',
  '베스트 컷 작가',
  '도움 마일스톤',
  '카테고리 전문성',
  '지역 전문성',
];

/**
 * 성장형 체인 (chainId → 단계 key 배열, 낮음 → 높음).
 * 같은 체인은 BadgesBox 에서 최고 단계 1개만, 상세화면에서 현재+다음 단계로 노출.
 */
export const CHAINS = {
  honor: ['honor_bronze', 'honor_gold'],
  bestcut: ['crown_1', 'crown_5', 'crown_10'],
  help: ['flame_100', 'flame_300', 'flame_500'],
  ...REGION_CHAINS,
};

// 하위호환 별칭
export const GROWTH_CHAINS = CHAINS;

export function isGrowthBadge(key) {
  const meta = typeof key === 'string' ? BADGE_CATALOG[key] : key;
  return !!meta?.chainId;
}
// 하위호환: 예전 isGrowthGroup(group) 시그니처는 더 이상 쓰지 않음
export const isGrowthGroup = isGrowthBadge;

export function getChainIdForBadge(key) {
  return BADGE_CATALOG[key]?.chainId || null;
}

export function getChainForBadge(key) {
  const id = getChainIdForBadge(key);
  return id ? CHAINS[id] || null : null;
}

/** 체인 내에서 earnedKeys 안에 포함된 가장 높은 단계 key. 없으면 null. */
export function highestEarnedInChain(chain, earnedKeys) {
  if (!Array.isArray(chain) || !Array.isArray(earnedKeys)) return null;
  const set = new Set(earnedKeys);
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (set.has(chain[i])) return chain[i];
  }
  return null;
}

/** 체인에서 currentKey 의 다음 단계 key. currentKey 가 null 이면 첫 단계, 마지막이면 null. */
export function nextInChain(chain, currentKey) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  if (!currentKey) return chain[0];
  const idx = chain.indexOf(currentKey);
  if (idx < 0 || idx >= chain.length - 1) return null;
  return chain[idx + 1];
}

/** profiles.earned_badges 배열을 메타데이터 목록으로 변환. */
export function resolveEarnedBadges(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.map((k) => BADGE_CATALOG[k]).filter(Boolean);
}

/**
 * 획득한 뱃지 메타 목록 — 성장 체인은 최고 단계 1개만 남김(중복 노출 방지),
 * 비성장형은 그대로. 프로필 뱃지 박스 / 전체보기에서 공통 사용.
 * 반환 개수 = "사용자가 획득한 뱃지 수"의 기준.
 */
export function collapseEarnedToHighest(earnedKeys) {
  const earnedMetas = resolveEarnedBadges(earnedKeys);
  const seenChains = new Set();
  const result = [];
  for (const meta of earnedMetas) {
    if (isGrowthBadge(meta)) {
      if (seenChains.has(meta.chainId)) continue;
      seenChains.add(meta.chainId);
      const chain = getChainForBadge(meta.key);
      const topKey = highestEarnedInChain(chain, earnedKeys);
      result.push(topKey ? BADGE_CATALOG[topKey] : meta);
    } else {
      result.push(meta);
    }
  }
  return result;
}

/** 전체 카탈로그를 그룹별로 묶어서 반환 (전체보기 화면용). */
export function getCatalogByGroup() {
  const buckets = new Map(BADGE_GROUP_ORDER.map((g) => [g, []]));
  for (const meta of Object.values(BADGE_CATALOG)) {
    if (!buckets.has(meta.group)) buckets.set(meta.group, []);
    buckets.get(meta.group).push(meta);
  }
  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}

// ── 활동 기반 뱃지 획득 ────────────────────────────────────────
// 사용자가 실제로 활동(제보·좋아요·베스트컷)을 쌓을수록 아래 기준에 따라
// 자동으로 부여된다.

// 게시물 텍스트에서 전문 분야를 추정하는 매처 (뱃지 키 → 정규식)
const CATEGORY_MATCHERS = [
  ['cherry', /(꽃|벚꽃|개화|매화|진달래|철쭉|튤립|유채|수국|코스모스|해바라기|단풍|bloom)/i],
  ['sunset', /(노을|일몰|석양|해질|골든아워|매직아워|야경|밤하늘|sunset)/i],
  ['weather', /(날씨|체감|기온|비\b|눈\b|맑음|흐림|미세먼지|황사|weather)/i],
  ['festival', /(축제|페스티벌|불꽃|행사|이벤트|마켓|플리마켓|festival)/i],
  ['crowd', /(인파|혼잡|대기|웨이팅|줄서|번호표|만석|붐비|대기줄|queue|waiting)/i],
  ['store', /(영업|운영|오픈|마감|브레이크타임|품절|재고|단골|store)/i],
];

const CATEGORY_BADGE_TARGET = 10; // 분야별 제보 10회 → 전문성 뱃지

function postSearchText(p) {
  return [
    p?.category,
    p?.categoryName,
    p?.category_name,
    p?.note,
    p?.content,
    Array.isArray(p?.tags) ? p.tags.join(' ') : '',
    p?.placeName,
    p?.place_name,
    p?.region,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * 실제 활동에서 보유 뱃지 키와 진행 통계를 계산한다.
 * @param {object} user  프로필 user (is_best_cut_artist 등)
 * @param {Array}  posts 내 게시물 목록 (likeCount/category/region 포함)
 * @returns {{ earnedKeys: string[], stats: object }}
 */
export function analyzeBadgeActivity(user, posts = []) {
  const list = Array.isArray(posts) ? posts : [];

  // 받은 좋아요 합계 = "도움 N명" 지표
  const helped = list.reduce(
    (sum, p) => sum + (Number(p?.likeCount ?? p?.likes ?? p?.likes_count) || 0),
    0
  );
  // 베스트컷 횟수
  const bestCut = Number(user?.best_cut_count) || (user?.is_best_cut_artist ? 1 : 0);

  const catCount = {};
  const regionCount = {};
  for (const p of list) {
    const text = postSearchText(p);
    for (const [key, re] of CATEGORY_MATCHERS) {
      if (re.test(text)) catCount[key] = (catCount[key] || 0) + 1;
    }
    // 지역: region 필드 우선, 없으면 전체 텍스트로 추정
    const regionText = String(p?.region || '') + ' ' + text;
    for (const region of REGIONS) {
      if (region.match.test(regionText)) {
        regionCount[region.key] = (regionCount[region.key] || 0) + 1;
      }
    }
  }

  const earned = new Set();

  // 베스트 컷 작가
  if (bestCut >= 1) earned.add('crown_1');
  if (bestCut >= 5) earned.add('crown_5');
  if (bestCut >= 10) earned.add('crown_10');

  // 도움 마일스톤
  if (helped >= 100) earned.add('flame_100');
  if (helped >= 300) earned.add('flame_300');
  if (helped >= 500) earned.add('flame_500');

  // 영예
  if (helped >= 100 || bestCut >= 1) earned.add('honor_bronze');
  if (helped >= 500 && bestCut >= 10) earned.add('honor_gold');

  // 카테고리 전문성
  for (const [key, cnt] of Object.entries(catCount)) {
    if (cnt >= CATEGORY_BADGE_TARGET) earned.add(key);
  }

  // 지역 전문성 — 지역별 제보 수에 따라 탐험가/톡파원/마스터 단계 부여
  for (const [regionKey, cnt] of Object.entries(regionCount)) {
    REGION_TIERS.forEach((t) => {
      if (cnt >= t.target) earned.add(`${regionKey}_${t.level}`);
    });
  }

  // 주 지역 = 가장 많이 게시한 지역
  let topRegionKey = null;
  let topRegionCnt = 0;
  for (const [key, cnt] of Object.entries(regionCount)) {
    if (cnt > topRegionCnt) {
      topRegionCnt = cnt;
      topRegionKey = key;
    }
  }

  return {
    earnedKeys: Array.from(earned),
    stats: {
      helped_count: helped,
      best_cut_count: bestCut,
      category_counts: catCount,
      region_counts: regionCount,
      top_region: topRegionKey,
      post_count: list.length,
    },
  };
}

/**
 * pill 색조 (tier 별) — 테두리 없는 하늘색 톤.
 * - 마스터(high)는 솔리드 하늘색으로 신뢰/최상위를 강조.
 * - 그 외는 옅은 하늘 배경 + 하늘색 텍스트. (border 는 투명 = 테두리 없음)
 */
export function getPillColors(tier) {
  switch (tier) {
    case 'high':
      return { bg: '#2BA0DC', text: '#FFFFFF', border: 'transparent' };
    case 'mid':
      return { bg: '#E3F3FB', text: '#1577B5', border: 'transparent' };
    case 'low':
    default:
      return { bg: '#EEF6FB', text: '#4E83AC', border: 'transparent' };
  }
}

// ── 단계별 자기 진행도 (메달리온 진행 링/카운트용) ─────────────
const REGION_TARGET_BY_LEVEL = { 1: 3, 2: 10, 3: 25 };
const HELP_TARGET = { flame_100: 100, flame_300: 300, flame_500: 500 };
const BESTCUT_TARGET = { crown_1: 1, crown_5: 5, crown_10: 10 };
const HONOR_TARGET = { honor_bronze: 100, honor_gold: 500 };

/**
 * 해당 뱃지 자체를 얻기 위한 진행도. { current, target, unit } 또는 null.
 * (catalog 의 progressOf 는 "다음 단계" 기준이라, 여기선 단계 자기 기준으로 계산)
 */
export function getBadgeProgress(meta, stats) {
  if (!meta) return null;
  const s = stats || {};
  if (meta.regionKey) {
    return {
      current: s.region_counts?.[meta.regionKey] || 0,
      target: REGION_TARGET_BY_LEVEL[meta.level] || 0,
      unit: '회',
    };
  }
  if (meta.chainId === 'help') {
    return { current: s.helped_count || 0, target: HELP_TARGET[meta.key] || 0, unit: '명' };
  }
  if (meta.chainId === 'bestcut') {
    return { current: s.best_cut_count || 0, target: BESTCUT_TARGET[meta.key] || 0, unit: '회' };
  }
  if (meta.chainId === 'honor') {
    return { current: s.helped_count || 0, target: HONOR_TARGET[meta.key] || 0, unit: '명' };
  }
  if (meta.group === '카테고리 전문성') {
    return { current: s.category_counts?.[meta.key] || 0, target: 10, unit: '회' };
  }
  return null;
}

export { REGIONS, REGION_THRESHOLDS };

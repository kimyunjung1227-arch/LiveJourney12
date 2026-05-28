import honorGold from '../../assets/badges/honor_gold.png';
import honorBronze from '../../assets/badges/honor_bronze.png';
import crown1 from '../../assets/badges/crown_1.png';
import crown5 from '../../assets/badges/crown_5.png';
import crown10 from '../../assets/badges/crown_10.png';
import flame100 from '../../assets/badges/flame_100.png';
import flame300 from '../../assets/badges/flame_300.png';
import flame500 from '../../assets/badges/flame_500.png';
import cherry from '../../assets/badges/cherry.png';
import sunset from '../../assets/badges/sunset.png';
import weather from '../../assets/badges/weather.png';
import festival from '../../assets/badges/festival.png';
import crowd from '../../assets/badges/crowd.png';
import store from '../../assets/badges/store.png';
import seoul from '../../assets/badges/seoul.png';
import jeju from '../../assets/badges/jeju.png';
import busan from '../../assets/badges/busan.png';
import gangneung from '../../assets/badges/gangneung.png';
import gyeongju from '../../assets/badges/gyeongju.png';

/**
 * 뱃지 키 → 메타데이터.
 * - key: profiles.earned_badges 배열에 저장되는 문자열
 * - tier: 'low' | 'mid' | 'high' (pill 배경 색조)
 * - next: 다음 단계 뱃지 키 (있을 때만)
 * - progressOf: 진행도 산출 함수 (현재 user → number)
 * - progressTarget: 다음 단계까지 목표값
 */
export const BADGE_CATALOG = {
  honor_gold: {
    key: 'honor_gold',
    name: '영예 (금)',
    img: honorGold,
    group: '영예',
    description: '커뮤니티 최상위 기여자에게 주어지는 가장 강한 영예입니다.',
    requirement: '도움 500명 + 베스트 컷 10회 달성',
    tier: 'high',
  },
  honor_bronze: {
    key: 'honor_bronze',
    name: '영예 (동)',
    img: honorBronze,
    group: '영예',
    description: '꾸준히 커뮤니티에 도움을 나누고 있는 기여자의 인장입니다.',
    requirement: '도움 100명 또는 베스트 컷 1회',
    tier: 'low',
    next: 'honor_gold',
    progressOf: (u) => Math.max(u?.helped_count || 0, (u?.best_cut_count || 0) * 50),
    progressTarget: 500,
  },
  crown_1: {
    key: 'crown_1',
    name: '베스트 컷 1회',
    img: crown1,
    group: '베스트 컷 작가',
    description: '베스트 컷에 처음 선정된 작가에게 부여되는 왕관입니다.',
    requirement: '베스트 컷 1회 선정',
    tier: 'low',
    next: 'crown_5',
    progressOf: (u) => u?.best_cut_count || 0,
    progressTarget: 5,
  },
  crown_5: {
    key: 'crown_5',
    name: '베스트 컷 5회',
    img: crown5,
    group: '베스트 컷 작가',
    description: '5회 베스트 컷에 선정된 인장입니다.',
    requirement: '베스트 컷 5회 선정',
    tier: 'mid',
    next: 'crown_10',
    progressOf: (u) => u?.best_cut_count || 0,
    progressTarget: 10,
  },
  crown_10: {
    key: 'crown_10',
    name: '베스트 컷 10회',
    img: crown10,
    group: '베스트 컷 작가',
    description: '베스트 컷 10회를 달성한 최고 등급 인장입니다.',
    requirement: '베스트 컷 10회 선정',
    tier: 'high',
  },
  flame_100: {
    key: 'flame_100',
    name: '도움 100명',
    img: flame100,
    group: '도움 마일스톤',
    description: '100명에게 실시간 정보로 도움을 준 인장입니다.',
    requirement: '도움 100명 달성',
    tier: 'low',
    next: 'flame_300',
    progressOf: (u) => u?.helped_count || 0,
    progressTarget: 300,
  },
  flame_300: {
    key: 'flame_300',
    name: '도움 300명',
    img: flame300,
    group: '도움 마일스톤',
    description: '300명에게 도움을 준 활발한 기여자의 인장입니다.',
    requirement: '도움 300명 달성',
    tier: 'mid',
    next: 'flame_500',
    progressOf: (u) => u?.helped_count || 0,
    progressTarget: 500,
  },
  flame_500: {
    key: 'flame_500',
    name: '도움 500명+',
    img: flame500,
    group: '도움 마일스톤',
    description: '500명 이상에게 도움을 준 최고 단계 인장입니다.',
    requirement: '도움 500명 달성',
    tier: 'high',
  },
  cherry: {
    key: 'cherry',
    name: '벚꽃 마스터',
    img: cherry,
    group: '카테고리 전문성',
    description: '개화·자연 카테고리에서 활동을 쌓으며 성장하는 인장입니다.',
    requirement: '꽃·개화 관련 제보 10회',
    tier: 'mid',
  },
  sunset: {
    key: 'sunset',
    name: '노을 헌터',
    img: sunset,
    group: '카테고리 전문성',
    description: '노을·야경 카테고리 전문가의 인장입니다.',
    requirement: '노을 관련 제보 10회',
    tier: 'mid',
  },
  weather: {
    key: 'weather',
    name: '날씨 리포터',
    img: weather,
    group: '카테고리 전문성',
    description: '날씨·체감 카테고리 전문가의 인장입니다.',
    requirement: '날씨 관련 제보 10회',
    tier: 'mid',
  },
  festival: {
    key: 'festival',
    name: '축제 마니아',
    img: festival,
    group: '카테고리 전문성',
    description: '이벤트·축제 카테고리 전문가의 인장입니다.',
    requirement: '축제 관련 제보 10회',
    tier: 'mid',
  },
  crowd: {
    key: 'crowd',
    name: '인파 리더',
    img: crowd,
    group: '카테고리 전문성',
    description: '혼잡도·대기 카테고리 전문가의 인장입니다.',
    requirement: '인파 관련 제보 10회',
    tier: 'mid',
  },
  store: {
    key: 'store',
    name: '단골 탐험가',
    img: store,
    group: '카테고리 전문성',
    description: '영업·운영 카테고리 전문가의 인장입니다.',
    requirement: '단골 관련 제보 10회',
    tier: 'mid',
  },
  seoul: {
    key: 'seoul',
    name: '서울 토박이',
    img: seoul,
    group: '지역 전문성',
    description: '서울 지역에서 가장 활발한 활동을 보여주는 인장입니다.',
    requirement: '주 지역이 서울',
    tier: 'mid',
  },
  jeju: {
    key: 'jeju',
    name: '제주 단골',
    img: jeju,
    group: '지역 전문성',
    description: '제주 지역 전문가의 인장입니다.',
    requirement: '주 지역이 제주',
    tier: 'mid',
  },
  busan: {
    key: 'busan',
    name: '부산 탐험가',
    img: busan,
    group: '지역 전문성',
    description: '부산 지역 전문가의 인장입니다.',
    requirement: '주 지역이 부산',
    tier: 'mid',
  },
  gangneung: {
    key: 'gangneung',
    name: '강릉 바닷가',
    img: gangneung,
    group: '지역 전문성',
    description: '강릉 지역 전문가의 인장입니다. (출시 예정)',
    requirement: '주 지역이 강릉',
    tier: 'mid',
    upcoming: true,
  },
  gyeongju: {
    key: 'gyeongju',
    name: '경주 고도',
    img: gyeongju,
    group: '지역 전문성',
    description: '경주 지역 전문가의 인장입니다. (출시 예정)',
    requirement: '주 지역이 경주',
    tier: 'mid',
    upcoming: true,
  },
};

export const BADGE_GROUP_ORDER = [
  '영예',
  '베스트 컷 작가',
  '도움 마일스톤',
  '카테고리 전문성',
  '지역 전문성',
];

/**
 * 성장형 그룹의 단계 순서 (낮음 → 높음).
 * 이 그룹의 뱃지는 상세화면에서 "현재 단계 + 다음 단계" 카드로 노출되고,
 * BadgesBox 에서는 가장 높은 단계 1개만 노출된다.
 */
export const GROWTH_CHAINS = {
  영예: ['honor_bronze', 'honor_gold'],
  '베스트 컷 작가': ['crown_1', 'crown_5', 'crown_10'],
  '도움 마일스톤': ['flame_100', 'flame_300', 'flame_500'],
};

export function isGrowthGroup(group) {
  return Object.prototype.hasOwnProperty.call(GROWTH_CHAINS, group);
}

export function getChainForBadge(key) {
  const meta = BADGE_CATALOG[key];
  if (!meta) return null;
  return GROWTH_CHAINS[meta.group] || null;
}

/**
 * 체인 내에서 earnedKeys 안에 포함된 가장 높은 단계 키. 없으면 null.
 */
export function highestEarnedInChain(chain, earnedKeys) {
  if (!Array.isArray(chain) || !Array.isArray(earnedKeys)) return null;
  const set = new Set(earnedKeys);
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    if (set.has(chain[i])) return chain[i];
  }
  return null;
}

/**
 * 체인에서 currentKey 의 다음 단계 키. currentKey 가 null 이면 첫 단계.
 * 마지막 단계면 null.
 */
export function nextInChain(chain, currentKey) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  if (!currentKey) return chain[0];
  const idx = chain.indexOf(currentKey);
  if (idx < 0 || idx >= chain.length - 1) return null;
  return chain[idx + 1];
}

/**
 * profiles.earned_badges 배열을 메타데이터 목록으로 변환.
 */
export function resolveEarnedBadges(keys) {
  if (!Array.isArray(keys)) return [];
  return keys
    .map((k) => BADGE_CATALOG[k])
    .filter(Boolean);
}

/**
 * 전체 카탈로그를 그룹별로 묶어서 반환 (전체보기 화면용).
 */
export function getCatalogByGroup() {
  const buckets = new Map(BADGE_GROUP_ORDER.map((g) => [g, []]));
  for (const meta of Object.values(BADGE_CATALOG)) {
    if (!buckets.has(meta.group)) buckets.set(meta.group, []);
    buckets.get(meta.group).push(meta);
  }
  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}

/**
 * pill 색조 (tier 별).
 */
export function getPillColors(tier) {
  switch (tier) {
    case 'high':
      return { bg: '#FFF2D6', text: '#A67419', border: '#F5D89B' };
    case 'mid':
      return { bg: '#E5F4FB', text: '#1A6EA8', border: '#BFE0F0' };
    case 'low':
    default:
      return { bg: '#EEF5FA', text: '#4A7DA8', border: '#D5E5F0' };
  }
}

/**
 * 추천 여행지 엔진
 * 고객들이 올린 데이터를 분석하여 추천 여행지를 생성합니다.
 * - "시간"과 "태그" 중심으로 실시간성을 최대한 반영합니다.
 */

import { filterRecentPosts, getTimeAgo, getPostAgeInHours, isPostLive } from './timeUtils';

/**
 * (구) 지역 추천 → (신) 분위기/장소 추천으로 확장
 * - 호출부 호환을 위해 반환 객체 키는 기존(`regionName`, `title`)을 유지합니다.
 * - 내부 집계 단위는 "장소(placeKey)"를 우선으로 사용합니다.
 */
const normalizeText = (v) =>
  String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getPostTextBlob = (post) => {
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  const aiLabels = Array.isArray(post?.aiLabels) ? post.aiLabels : [];
  const aiCats = Array.isArray(post?.aiCategories) ? post.aiCategories : [];
  const parts = [
    post?.note,
    post?.content,
    post?.location,
    post?.placeName,
    post?.detailedLocation,
    post?.categoryName,
    post?.aiCategoryName,
    post?.category,
    post?.aiCategory,
    ...aiCats,
    ...tags.map((t) => (typeof t === 'string' ? t : (t?.name || t?.label || ''))),
    ...aiLabels.map((l) => (typeof l === 'string' ? l : (l?.name || l?.label || ''))),
  ].filter(Boolean);
  return normalizeText(parts.join(' ')).replace(/#+/g, '');
};

/**
 * 추천 카드의 "장소 단위" 키 추출 (가능하면 placeName/상세명 우선)
 * - 예: "여의도 윤중로" 그대로 유지
 * - 예: "서울 여의도 윤중로" -> "여의도 윤중로" (광역 토큰 제거)
 */
const getPlaceKey = (post) => {
  const raw =
    post?.placeName ||
    post?.detailedLocation ||
    (typeof post?.location === 'string' ? post.location : (post?.location?.name || '')) ||
    post?.address ||
    '';
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '기록';

  // 광역/행정 접두 제거 (서울특별시/경기도/강원도 등) 후 나머지를 장소로
  const tokens = text.split(' ').filter(Boolean);
  if (tokens.length >= 3) {
    const t0 = tokens[0];
    const looksProvince =
      /(특별자치도|특별자치시|특별시|광역시|도)$/.test(t0) ||
      ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'].includes(t0);
    if (looksProvince) {
      return tokens.slice(1).join(' ');
    }
  }
  return text;
};

const hasCategory = (post, slug) =>
  post?.category === slug ||
  post?.aiCategory === slug ||
  (Array.isArray(post?.categories) && post.categories.includes(slug)) ||
  (Array.isArray(post?.aiCategories) && post.aiCategories.includes(slug));

const pickRepresentativeImage = (posts) => {
  const list = Array.isArray(posts) ? posts : [];
  const withImage = list
    .filter((p) => p?.images?.[0] || p?.thumbnail || p?.image)
    .slice()
    .sort((a, b) => {
      const timeA = a?.timestamp || a?.createdAt || a?.time || 0;
      const timeB = b?.timestamp || b?.createdAt || b?.time || 0;
      return timeB - timeA;
    });
  const first = withImage[0];
  if (!first) return null;
  const raw = first.images?.[0] ?? first.thumbnail ?? first.image;
  return typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null);
};

const matchesAny = (text, keywords) => {
  if (!text) return false;
  const t = normalizeText(text);
  return (keywords || []).some((kw) => t.includes(normalizeText(kw)));
};

// 테마 자체가 태그로 노출되는 것은 제거하고,
// 사용자 입력/AI 태그(테마 외) → 신호 태그 → 테마로 매핑합니다.
const THEME_TAG_BLOCKLIST = new Set([
  '지금이절정',
  '한적한아지트',
  '딥씨블루',
  '힙활기',
  '안심나들이',
].map((t) => normalizeText(t)));

const getPostSignalTokens = (post) => {
  const tags = [
    ...(Array.isArray(post?.tags) ? post.tags : []),
    ...(Array.isArray(post?.aiLabels) ? post.aiLabels : []),
  ]
    .map((x) => (typeof x === 'string' ? x : (x?.name || x?.label || '')))
    .filter(Boolean)
    .map((s) => normalizeText(String(s).replace(/^#+/, '')));

  return tags.filter((t) => t && !THEME_TAG_BLOCKLIST.has(t));
};

const THEME_SIGNALS = {
  season_peak: ['만개', '개화', '벚꽃', '단풍', '설경', '절정', '윤슬', '일출', '일몰', '풍경', '전망', '경치'],
  silent_healing: ['한적', '조용', '여유', '고즈넉', '힐링', '산책', '쉼', '쉼표', '책', '웨이팅없', '줄없'],
  deep_sea_blue: ['바다', '해변', '파도', '윤슬', '물멍', '에메랄드', '푸른', '파란', '청량', '맑은하늘'],
  lively_vibe: ['힙', '핫플', '북적', '활기', '인생샷', '축제', '공연', '버스킹', '팝업', '웨이팅', '대기'],
  night_good: ['밤', '야경', '야시장', '야간', '조명', '라이트', '빛', '불빛', '노을', '일몰', '밤바다', '루프탑'],
};

const inferThemeScoreForPost = (post) => {
  const text = getPostTextBlob(post);
  const tokens = getPostSignalTokens(post);
  const blob = `${text} ${tokens.join(' ')}`;

  const scoreBy = {};
  Object.keys(THEME_SIGNALS).forEach((themeId) => {
    const signals = THEME_SIGNALS[themeId] || [];
    let s = 0;
    signals.forEach((kw) => {
      const k = normalizeText(kw);
      if (!k) return;
      if (blob.includes(k)) s += 1;
    });
    // 카테고리 가중치 (기본 데이터 품질 보정)
    if (themeId === 'season_peak' && (hasCategory(post, 'bloom') || hasCategory(post, 'scenic') || hasCategory(post, 'landmark'))) s += 1;
    if (themeId === 'deep_sea_blue' && hasCategory(post, 'scenic')) s += 0.5;
    scoreBy[themeId] = s;
  });
  return scoreBy;
};

const KEYWORDS = {
  seasonPeak: [
    '만개', '만개함', '개화', '꽃피', '벚꽃', '매화', '유채', '수국', '코스모스', '철쭉', '튤립',
    '단풍', '절정', '눈', '설경', '눈이', '함박눈',
    '풍경', '뷰', '전망', '경치', '윤슬', '일출', '일몰',
  ],
  silentHealing: [
    '한적', '조용', '여유', '고즈넉', '힐링', '아지트', '산책', '쉼', '쉼표', '책읽',
    '웨이팅없', '대기없', '줄없',
  ],
  deepSeaBlue: [
    '바다', '해변', '해수욕장', '파도', '해안', '포구', '항구', '서핑',
    '물멍', '윤슬', '탁트', '시원', '푸른바다', '푸른', '파란', '청량', '맑음', '맑은',
  ],
  livelyVibe: [
    '활기', '힙', '핫플', '북적', '인생샷', '감성', '축제', '사람많', '분위기최고', '재밌',
    '음악', '공연', '클럽', '야시장',
  ],
};

const COASTAL_HINT_REGIONS = new Set(['부산', '제주', '강릉', '속초', '여수', '인천', '울산', '포항', '통영', '거제']);

const calculatePlaceUnitStats = (posts, placeKey) => {
  const placePosts = (Array.isArray(posts) ? posts : []).filter((post) => getPlaceKey(post) === placeKey);

  const total = placePosts.length;
  const bloomCount = placePosts.filter((p) => hasCategory(p, 'bloom')).length;
  const foodCount = placePosts.filter((p) => hasCategory(p, 'food')).length;
  const waitingCount = placePosts.filter((p) => hasCategory(p, 'waiting')).length;
  const scenicCount = placePosts.filter((p) => hasCategory(p, 'landmark') || hasCategory(p, 'scenic')).length;

  const recent3hPosts = filterRecentPosts(placePosts, 2, 3);
  const recent1hPosts = filterRecentPosts(placePosts, 2, 1);
  const recent24hPosts = filterRecentPosts(placePosts, 1, 24);
  const recent3hCount = recent3hPosts.length;
  const recent1hCount = recent1hPosts.length;
  const recent24hCount = recent24hPosts.length;

  const totalLikes = placePosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const avgLikes = total > 0 ? totalLikes / total : 0;

  const bloomRecentPosts = recent24hPosts.filter((p) => hasCategory(p, 'bloom'));
  const bloomRecentCount = bloomRecentPosts.length;

  const bloomPercentage = total > 0 ? (bloomCount / total) * 100 : 0;
  const activityScore = recent3hCount * 3 + recent1hCount * 5 + avgLikes * 0.3;
  const popularityScore = total * 1.5 + avgLikes;

  const latestPost = recent24hPosts[0] || placePosts
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0);
      const timeB = new Date(b.timestamp || b.createdAt || 0);
      return timeB - timeA;
    })[0];

  const latestTimestamp = latestPost ? (latestPost.timestamp || latestPost.createdAt) : null;
  const lastPostAgeHours = latestTimestamp ? getPostAgeInHours(latestTimestamp) : null;
  const lastPostAgeMinutes = lastPostAgeHours != null ? Math.round(lastPostAgeHours * 60) : null;
  const lastPostTimeAgoLabel = latestTimestamp ? getTimeAgo(latestTimestamp) : null;
  const isLiveRegion = latestTimestamp ? isPostLive(latestTimestamp, 30) : false;

  return {
    placeKey,
    total,
    bloomCount,
    foodCount,
    waitingCount,
    scenicCount,
    recentCount: recent24hCount,
    recent3hCount,
    recent1hCount,
    recent24hCount,
    bloomRecentCount,
    avgLikes: Math.round(avgLikes * 10) / 10,
    bloomPercentage: Math.round(bloomPercentage * 10) / 10,
    activityScore: Math.round(activityScore * 10) / 10,
    popularityScore: Math.round(popularityScore * 10) / 10,
    lastPostAgeMinutes,
    lastPostTimeAgoLabel,
    isLive: isLiveRegion,
    representativeImage: pickRepresentativeImage(placePosts),
    recentPosts: recent24hPosts.slice(0, 3),
    recent1hPosts,
    recent3hPosts,
    placePosts,
  };
};

/**
 * 추천 타입별 추천 장소 계산 (호환: regionName 필드 유지)
 */
export const getRecommendedRegions = (posts, recommendationType = 'blooming') => {
  const rawType = String(recommendationType || '').trim();
  const type = (() => {
    // 기존 타입 호환(별칭)
    if (rawType === 'active' || rawType === 'popular' || rawType === 'food') return 'lively_vibe';
    if (rawType === 'blooming' || rawType === 'scenic') return 'season_peak';
    if (rawType === 'waiting') return 'silent_healing';
    return rawType || 'season_peak';
  })();

  const list = Array.isArray(posts) ? posts : [];
  const keys = Array.from(new Set(list.map((p) => getPlaceKey(p)).filter((k) => k && k !== '기록')));
  const stats = keys.map((k) => calculatePlaceUnitStats(list, k)).filter((s) => s.total > 0);

  const getPlacePosts = (placeKey) => list.filter((p) => getPlaceKey(p) === placeKey);

  const scoreRegion = (placeKey) => {
    const postsForPlace = getPlacePosts(placeKey);
    const blobAll = postsForPlace.map((p) => getPostTextBlob(p)).join(' ');
    const regionHint = (postsForPlace[0]?.region || '').split(/\s+/)[0] || '';
    const isCoastal = COASTAL_HINT_REGIONS.has(regionHint);

    const recent1h = filterRecentPosts(postsForPlace, 2, 1);
    const recent3h = filterRecentPosts(postsForPlace, 2, 3);
    const recent24h = filterRecentPosts(postsForPlace, 1, 24);

    const seasonPred = (p) => {
      const scores = inferThemeScoreForPost(p);
      return (scores.season_peak || 0) >= 2;
    };
    const silentPred = (p) => {
      const scores = inferThemeScoreForPost(p);
      const hasWaiting = matchesAny(getPostTextBlob(p), ['웨이팅', '대기', '줄', 'queue', 'waiting']) || hasCategory(p, 'waiting');
      return (scores.silent_healing || 0) >= 2 && !hasWaiting;
    };
    const seaPred = (p) => {
      const scores = inferThemeScoreForPost(p);
      return (scores.deep_sea_blue || 0) >= 2 || isCoastal;
    };
    const livelyPred = (p) => {
      const scores = inferThemeScoreForPost(p);
      return (scores.lively_vibe || 0) >= 2;
    };
    const nightPred = (p) => {
      const scores = inferThemeScoreForPost(p);
      return (scores.night_good || 0) >= 2;
    };

    const count = (arr, pred) => (Array.isArray(arr) ? arr.filter((x) => pred(x)).length : 0);

    const season3h = count(recent3h, seasonPred);
    const season24h = count(recent24h, seasonPred);
    const silent3h = count(recent3h, silentPred);
    const silent24h = count(recent24h, silentPred);
    const sea3h = count(recent3h, seaPred);
    const sea24h = count(recent24h, seaPred);
    const lively1h = count(recent1h, livelyPred);
    const lively3h = count(recent3h, livelyPred);
    const night3h = count(recent3h, nightPred);
    const night24h = count(recent24h, nightPred);

    const avgLikes = postsForPlace.reduce((s, p) => s + (p?.likes || 0), 0) / Math.max(1, postsForPlace.length);

    const surgeBoost = (recentN, recentTotal) => {
      if (recentTotal <= 0) return 0;
      const ratio = recentN / recentTotal;
      if (recentN >= 3 && ratio >= 0.45) return 3;
      if (recentN >= 2 && ratio >= 0.35) return 2;
      if (recentN >= 1 && ratio >= 0.25) return 1;
      return 0;
    };

    if (type === 'season_peak') {
      const score = season3h * 9 + season24h * 3 + surgeBoost(season3h, season24h) * 6 + avgLikes * 0.35;
      return { score, extra: { season3h, season24h } };
    }
    if (type === 'silent_healing') {
      const waitingPenalty = matchesAny(blobAll, ['웨이팅', '대기', '줄', '북적']) ? 2 : 0;
      const score = silent3h * 9 + silent24h * 3 - waitingPenalty * 6 + avgLikes * 0.15;
      return { score, extra: { silent3h, silent24h } };
    }
    if (type === 'deep_sea_blue') {
      const blueBoost = matchesAny(blobAll, ['푸른', '파란', '윤슬', '맑음', '청량']) ? 2 : 0;
      const score = sea3h * 8 + sea24h * 3 + blueBoost * 5 + avgLikes * 0.2;
      return { score, extra: { sea3h, sea24h, isCoastal } };
    }
    if (type === 'lively_vibe') {
      const vividBoost = matchesAny(blobAll, ['화려', '선명', '축제', '공연', '힙']) ? 2 : 0;
      const score = recent1h.length * 8 + lively1h * 4 + lively3h * 2 + vividBoost * 6 + avgLikes * 0.45;
      return { score, extra: { recent1h: recent1h.length, lively1h } };
    }
    if (type === 'night_good') {
      const nightBoost = matchesAny(blobAll, ['야경', '조명', '불빛', '야간', '루프탑', '야시장']) ? 2 : 0;
      const score = night3h * 9 + night24h * 3 + nightBoost * 6 + avgLikes * 0.25;
      return { score, extra: { night3h, night24h } };
    }
    const score = recent1h.length * 6 + recent3h.length * 3 + avgLikes * 0.3;
    return { score, extra: { recent1h: recent1h.length } };
  };

  const buildEdgePointScript = (typeId, placeKey, extra) => {
    if (typeId === 'season_peak') {
      return '놓치면 일 년을 기다려야 할, 찰나의 풍경';
    }
    if (typeId === 'silent_healing') {
      return '북적임 대신 바람 소리만 들리는, 잠시 멈춘 동네';
    }
    if (typeId === 'deep_sea_blue') {
      return '가슴 뻥 뚫리는 파도 소리, 에메랄드빛 파란 맛';
    }
    if (typeId === 'lively_vibe') {
      return '유행의 중심에서 즐기는, 기분 좋은 에너지';
    }
    if (typeId === 'night_good') {
      return '낮보다 더 반짝이는, 밤에 더 좋은 장면';
    }
    return `${placeKey}의 최신 제보를 모았어요.`;
  };

  const buildStatusBadges = (typeId, stat, extra) => {
    const postsForPlace = Array.isArray(stat.placePosts) ? stat.placePosts : [];
    const recent = Array.isArray(stat.recent3hPosts) ? stat.recent3hPosts : postsForPlace;
    const blobAll = recent.map((p) => getPostTextBlob(p)).join(' ');

    const countKw = (kwList) => kwList.reduce((s, kw) => s + (blobAll.includes(normalizeText(kw)) ? 1 : 0), 0);
    const totalSignals = Math.max(1, recent.length);

    // 사용자 입력(노트/내용/태그) 기반 비율 산출
    const waitingHits = countKw(['웨이팅', '대기', '줄', 'queue', 'waiting']);
    const quietHits = countKw(['한적', '조용', '여유', '고즈넉', '힐링', '쉼']);
    const seasonHits = countKw(['만개', '개화', '벚꽃', '단풍', '설경', '눈', '절정']);
    const seaHits = countKw(['바다', '해변', '파도', '윤슬', '물멍', '에메랄드', '청량']);
    const parkingHits = countKw(['주차', '주차장', '주차편']);
    const nightHits = countKw(['야경', '밤', '야시장', '조명', '불빛', '야간', '루프탑', '일몰', '노을']);
    const popupHits = countKw(['팝업', '버스킹', '공연', '축제', '이벤트']);

    const quietPct = Math.max(0, Math.min(95, Math.round(70 + (quietHits / (quietHits + waitingHits + 1)) * 30)));

    const out = [];
    if (quietHits > 0 && waitingHits === 0) out.push(`● 한적함 ${quietPct}%`);
    if (waitingHits > 0) out.push('● 웨이팅 있음');
    if (seasonHits > 0) out.push('● 절정/만개');
    if (seaHits > 0) out.push('● 바다 무드');
    if (nightHits > 0) out.push('● 야경/밤 무드');
    if (parkingHits > 0) out.push('● 주차 정보');
    if (popupHits > 0) out.push('● 이벤트/공연');

    // 테마에 따라 우선순위 조정
    const prefer = {
      season_peak: ['● 절정/만개', '● 주차 정보', '● 이벤트/공연'],
      silent_healing: [`● 한적함 ${quietPct}%`, '● 주차 정보', '● 바다 무드'],
      deep_sea_blue: ['● 바다 무드', '● 주차 정보', '● 한적함'],
      lively_vibe: ['● 이벤트/공연', '● 웨이팅 있음', '● 주차 정보'],
      night_good: ['● 야경/밤 무드', '● 이벤트/공연', '● 주차 정보'],
    };

    const order = prefer[typeId] || [];
    const sorted = [
      ...order.filter((x) => out.some((v) => v.startsWith(x.replace(/\s*\d+%/, '').trim())) || out.includes(x)),
      ...out.filter((x) => !order.some((o) => x.startsWith(o.replace(/\s*\d+%/, '').trim()) || x === o)),
    ];

    const uniq = [];
    sorted.forEach((b) => { if (b && !uniq.includes(b)) uniq.push(b); });
    return uniq.slice(0, 3);
  };

  const buildTopTags = (typeId, stat, extra) => {
    const placePosts = Array.isArray(stat?.placePosts) ? stat.placePosts : [];
    const blob = placePosts.map((p) => getPostTextBlob(p)).join(' ');
    const norm = (s) => normalizeText(String(s || '').replace(/^●\s*/, '').trim());
    const has = (keywords) => matchesAny(blob, keywords);

    // 장소별 태그 후보(테마와 무관하게 최대한 다르게)
    const candidates = [];
    const push = (t) => {
      const raw = String(t || '').trim();
      const cleaned = raw.replace(/^●\s*/, '').trim();
      const key = norm(cleaned);
      if (!cleaned || !key) return;
      // 너무 긴 태그는 제외
      if (cleaned.length > 14) return;
      if (!candidates.some((x) => norm(x) === key)) candidates.push(cleaned);
    };

    // 1) 데이터 신호(뱃지) 먼저
    buildStatusBadges(typeId, stat, extra)
      .map((b) => String(b || '').replace(/^●\s*/, '').trim())
      .filter(Boolean)
      .forEach(push);

    // 2) 장소 텍스트 기반 키워드
    if (has(['벚꽃', '개화', '만개', '절정', '꽃', '매화', '유채', '수국', '단풍'])) push('절정/만개');
    if (has(['바다', '해변', '파도', '윤슬', '물멍', '오션', '해수욕장', '서핑'])) push('바다 무드');
    if (has(['야경', '밤', '조명', '노을', '일몰', '루프탑', '야시장'])) push('야경/노을');
    if (has(['산', '등산', '트레킹', '오름', '숲', '공원', '산책', '둘레길'])) push('산책 코스');
    if (has(['카페', '커피', '브런치', '디저트'])) push('카페');
    if (has(['맛집', '식당', '음식', '국밥', '면', '고기', '횟집', '시장'])) push('맛집');
    if (has(['주차', '주차장', '주차편', '주차 가능'])) push('주차');
    if (has(['축제', '공연', '버스킹', '이벤트', '팝업'])) push('이벤트');
    if (has(['아이', '가족', '유모차', '아이와'])) push('가족');

    // 3) 그래도 부족하면 타입 기반으로 채우기(최소)
    const fallbackByType = {
      season_peak: ['포토 스팟', '산책 코스', '추천'],
      silent_healing: ['힐링', '산책 코스', '추천'],
      deep_sea_blue: ['청량', '드라이브', '추천'],
      lively_vibe: ['지금 핫플', '활기', '추천'],
      night_good: ['감성', '야경/노을', '추천'],
    };
    (fallbackByType[typeId] || ['추천', '포토 스팟', '산책 코스']).forEach(push);

    return candidates.slice(0, 3);
  };

  const pickLiveImage = (stat) => {
    const recent = Array.isArray(stat.recent1hPosts) ? stat.recent1hPosts : [];
    const sorted = recent
      .slice()
      .sort((a, b) => (Number(b?.likes) || 0) - (Number(a?.likes) || 0));
    const best = sorted.find((p) => p?.images?.[0] || p?.thumbnail || p?.image) || recent[0];
    const raw = best?.images?.[0] ?? best?.thumbnail ?? best?.image ?? null;
    return raw ? (typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null)) : null;
  };

  const buildProof = (stat, typeId, extra) => {
    const t = stat.lastPostTimeAgoLabel || '방금';
    const proofCount = Math.min(9, (stat.recent3hCount || 0));
    const vibeWord =
      typeId === 'silent_healing' ? '여유로움' :
      typeId === 'season_peak' ? '절정' :
      typeId === 'deep_sea_blue' ? '바다 무드' :
      typeId === 'lively_vibe' ? '힙한 분위기' :
      typeId === 'night_good' ? '야경 무드' :
      '최신성';
    if (proofCount <= 0) return { proofSummary: '', timelineThumbs: [] };

    // 시간문장(“~ 전후로”, “1일 전후…”) 제거: 숫자만 남김
    const proofSummary = `${proofCount}명이 ‘${vibeWord}’을 인증했어요.`;

    const thumbs = (Array.isArray(stat.recent3hPosts) ? stat.recent3hPosts : [])
      .slice()
      .sort((a, b) => {
        const timeA = a?.timestamp || a?.createdAt || 0;
        const timeB = b?.timestamp || b?.createdAt || 0;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      })
      .map((p) => p?.images?.[0] ?? p?.thumbnail ?? p?.image ?? null)
      .filter(Boolean)
      .slice(0, 4)
      .map((raw) => (typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null)))
      .filter(Boolean);

    return { proofSummary, timelineThumbs: thumbs };
  };

  const toBadge = (typeId) => {
    if (typeId === 'season_peak') return '🌸 지금이 절정';
    if (typeId === 'silent_healing') return '🌿 한적한 아지트';
    if (typeId === 'deep_sea_blue') return '🌊 시원한 바다';
    if (typeId === 'lively_vibe') return '🔥 힙 & 활기';
    if (typeId === 'night_good') return '🌙 밤에 더 좋은';
    return '✨ 추천';
  };

  const getUserSnippet = (postsForPlace) => {
    const list = Array.isArray(postsForPlace) ? postsForPlace : [];
    const sorted = list.slice().sort((a, b) => {
      const ta = new Date(a?.timestamp || a?.createdAt || 0).getTime();
      const tb = new Date(b?.timestamp || b?.createdAt || 0).getTime();
      return tb - ta;
    });
    const raw = String(sorted.find((p) => (p?.note || p?.content || '').trim())?.note
      || sorted.find((p) => (p?.note || p?.content || '').trim())?.content
      || '').trim();
    if (!raw) return '';
    const single = raw.replace(/\s+/g, ' ');
    return single.length > 38 ? `${single.slice(0, 36)}…` : single;
  };

  const buildAiIntroForPlace = (typeId, placeKey, postsForPlace) => {
    const blob = postsForPlace.map((p) => getPostTextBlob(p)).join(' ');
    const hasCherry = matchesAny(blob, ['벚꽃', '개화', '만개', '절정', '꽃']);
    const hasNight = matchesAny(blob, ['야경', '조명', '밤', '노을', '일몰', '루프탑']);
    const hasSea = matchesAny(blob, ['바다', '해변', '윤슬', '파도', '물멍', '청량']);
    const hasWalk = matchesAny(blob, ['산책', '걷기', '트레킹', '등산', '공원', '숲']);
    const hasCafe = matchesAny(blob, ['카페', '커피', '브런치', '디저트']);
    const hasFood = matchesAny(blob, ['맛집', '식당', '음식', '국밥', '면', '고기', '횟집']);

    if (typeId === 'season_peak' && hasCherry) return `${placeKey}은(는) 지금 꽃이 가장 예쁜 타이밍이라, 짧은 시간만으로도 풍경이 확 달라져요.`;
    if (typeId === 'season_peak') return `${placeKey}은(는) 지금 가장 예쁜 순간을 만나기 좋은 곳으로, 사진 한 장만으로도 계절감이 전해져요.`;
    if (typeId === 'deep_sea_blue' || hasSea) return `${placeKey}은(는) 바다 바람과 탁 트인 풍경이 매력이라, 잠깐만 있어도 머리가 맑아져요.`;
    if (typeId === 'night_good' || hasNight) return `${placeKey}은(는) 해질녘~밤에 분위기가 살아나는 곳이라, 야경/노을 타이밍에 특히 좋아요.`;
    if (typeId === 'silent_healing') return `${placeKey}은(는) 조용히 걷고 쉬기 좋은 포인트가 많아, 생각 정리하기에 잘 어울려요.`;
    if (typeId === 'lively_vibe') return `${placeKey}은(는) 지금 분위기가 올라오는 곳이라, 가볍게 들러도 재미있는 장면을 만나기 좋아요.`;
    if (hasCafe) return `${placeKey}은(는) 카페·산책 코스를 엮기 좋아, 느긋한 반나절 코스로 추천해요.`;
    if (hasFood) return `${placeKey}은(는) 주변에 먹거리 선택지가 좋아, 구경하고 먹고 쉬는 코스가 자연스럽게 이어져요.`;
    if (hasWalk) return `${placeKey}은(는) 걷기 좋은 동선이 있어, 가벼운 산책만으로도 만족도가 높아요.`;
    return `${placeKey}은(는) 지금 올라온 최신 제보를 바탕으로 골라낸 추천 장소예요.`;
  };

  const ranked = stats
    .map((s) => {
      const { score, extra } = scoreRegion(s.placeKey);
      return { stat: s, score, extra };
    })
    .filter((x) => x.score > 0 || x.stat.recent24hCount > 0)
    .sort((a, b) => b.score - a.score || (a.stat.lastPostAgeMinutes ?? 999999) - (b.stat.lastPostAgeMinutes ?? 999999))
    .slice(0, 10);

  // 카드 간 태그 중복을 줄이기 위한 전역 사용 카운트 (한 번 호출 내에서만)
  const globalTagUse = new Map(); // key -> count

  const diversifyTopTags = (tags) => {
    const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
    const scored = list.map((t, idx) => {
      const key = normalizeText(t);
      const used = globalTagUse.get(key) || 0;
      // 이미 많이 나온 태그일수록 뒤로
      return { t, key, score: used * 10 + idx };
    });
    scored.sort((a, b) => a.score - b.score);
    const picked = [];
    const seen = new Set();
    for (const s of scored) {
      if (picked.length >= 3) break;
      if (!s.key || seen.has(s.key)) continue;
      seen.add(s.key);
      picked.push(s.t);
    }
    picked.forEach((t) => {
      const key = normalizeText(t);
      globalTagUse.set(key, (globalTagUse.get(key) || 0) + 1);
    });
    return picked;
  };

  return ranked.map(({ stat, score, extra }) => {
    const liveImage = pickLiveImage(stat) || stat.representativeImage;
    const { proofSummary, timelineThumbs } = buildProof(stat, type, extra);
    const statusBadges = buildStatusBadges(type, stat, extra);
    const topTags = diversifyTopTags(buildTopTags(type, stat, extra));
    const placePosts = Array.isArray(stat.placePosts) ? stat.placePosts : [];
    const userSnippet = getUserSnippet(placePosts);
    const aiIntro = buildAiIntroForPlace(type, stat.placeKey, placePosts);
    const edgePointScript = aiIntro;

    return {
      regionName: stat.placeKey, // 호환 필드(실제는 placeKey)
      placeName: stat.placeKey,
      title: stat.placeKey,
      description: edgePointScript,
      userSnippet,
      topTags,
      image: stat.representativeImage,
      liveImage,
      badge: toBadge(type),
      statusBadges,
      proofSummary,
      timelineThumbs,
      _score: score,
      stats: {
        total: stat.total,
        recent24hCount: stat.recent24hCount,
        recent3hCount: stat.recent3hCount,
        recent1hCount: stat.recent1hCount,
        avgLikes: stat.avgLikes,
        isLive: stat.isLive,
        lastPostTimeAgoLabel: stat.lastPostTimeAgoLabel,
      },
    };
  });
};

/**
 * 추천 타입 목록 (분위기/테마 기반)
 */
export const RECOMMENDATION_TYPES = [
  {
    id: 'season_peak',
    name: '지금 만개한 벚꽃 명소',
    description: '놓치면 일 년을 기다려야 할, 찰나의 풍경',
    icon: '🌸'
  },
  {
    id: 'silent_healing',
    name: '생각 정리하기 좋은 지역',
    description: '북적임 대신 바람 소리만 들리는, 잠시 멈춘 동네',
    icon: '🌾'
  },
  {
    id: 'deep_sea_blue',
    name: '바다 보며 멍 때리기 좋은 곳',
    description: '가슴 뻥 뚫리는 파도 소리, 에메랄드빛 파란 맛',
    icon: '🌊'
  },
  {
    id: 'lively_vibe',
    name: '지금 사람 몰리는 핫플',
    description: '유행의 중심에서 즐기는, 기분 좋은 에너지',
    icon: '🔥'
  },
  {
    id: 'night_good',
    name: '밤에 더 좋은 장소',
    description: '낮보다 더 반짝이는, 밤에 더 좋은 장면',
    icon: '🌙'
  }
];

import { getDisplayImageUrl } from '../api/upload';
import { getTimeAgo, filterRecentPosts } from './timeUtils';
import { normalizePlaceIdentityKey } from './placeKeyNormalize';

/** 메인 실시간 핫플과 동일한 시드 기반 수치 (급상승 % 등) */
export function deterministicHashRange(seed, min, max) {
  const text = String(seed || 'seed');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const range = Math.max(1, max - min + 1);
  return min + (hash % range);
}

/**
 * 메인 loadMockData와 동일: 태그/집계용으로 24h 우선, 부족 시 72h 보강
 */
export function selectPostsForPlaceStats(allPosts) {
  const recent24h = filterRecentPosts(allPosts, 2, 24);
  if (recent24h.length >= 40) return recent24h;
  const recent72h = filterRecentPosts(allPosts, 5, 72);
  const existingIds = new Set(recent24h.map((p) => String(p.id)));
  const merged = [...recent24h];
  recent72h.forEach((p) => {
    if (p && p.id && !existingIds.has(String(p.id))) merged.push(p);
  });
  return merged.length > 0 ? merged : recent72h;
}

function formatCaptureLabel(post) {
  const src = post.photoDate || post.timestamp || post.createdAt;
  if (!src) return null;
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export function getPlaceKeyForHotStats(post) {
  return post.location || post.placeName || post.detailedLocation || '기록';
}

/** buildPlaceStatsMap / transformPostForHotFeed 집계용 — 표기 공백 차이 통합 */
export function getPlaceStatsAggregationKey(post) {
  const raw = String(getPlaceKeyForHotStats(post) || '').trim();
  const norm = normalizePlaceIdentityKey(raw);
  return norm || '기록';
}

function collectTextForPost(post) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const parts = [
    post.note,
    post.content,
    post.categoryName,
    post.location,
    post.placeName,
    ...tags.map((t) => (typeof t === 'string' ? t : String(t || ''))),
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * 장소별 키워드 집계 — MainScreen.loadMockData와 동일
 */
export function buildPlaceStatsMap(posts) {
  const now = Date.now();
  const placeStats = {};

  posts.forEach((post) => {
    const placeKey = getPlaceStatsAggregationKey(post);
    if (!placeStats[placeKey]) {
      placeStats[placeKey] = {
        waitingRecent: 0,
        soldoutRecent: 0,
        blossom24h: 0,
        newMenu24h: 0,
        popup24h: 0,
        total24h: 0,
        nightViewAll: 0,
        parkingAll: 0,
        photoSpotAll: 0,
        totalAll: 0,
      };
    }

    const stats = placeStats[placeKey];
    const text = collectTextForPost(post);
    const ts = post.timestamp || post.createdAt || post.time;
    const postTime = ts ? new Date(ts).getTime() : now;
    const diffMinutes = Math.max(0, (now - postTime) / 60000);
    const diffHours = diffMinutes / 60;

    const hasWaiting = text.includes('웨이팅') || text.includes('대기') || text.includes('줄') || text.includes('북적');
    const hasSoldout = text.includes('재고') || text.includes('소진') || text.includes('품절');
    const hasBlossom = text.includes('벚꽃') || text.includes('꽃놀이') || text.includes('벚꽃축제');
    const hasNewMenu = text.includes('신메뉴') || text.includes('신상') || text.includes('한정') || text.includes('시즌메뉴');
    const hasPopup = text.includes('팝업') || text.includes('팝업스토어');
    const hasNightView = text.includes('야경');
    const hasParking = text.includes('주차');
    const hasPhotoSpot = text.includes('포토존') || text.includes('사진 맛집') || text.includes('사진맛집') || text.includes('인스타');

    if (diffMinutes <= 60) {
      if (hasWaiting) stats.waitingRecent += 1;
      if (hasSoldout) stats.soldoutRecent += 1;
    }

    if (diffHours <= 24) {
      stats.total24h += 1;
      if (hasBlossom) stats.blossom24h += 1;
      if (hasNewMenu) stats.newMenu24h += 1;
      if (hasPopup) stats.popup24h += 1;
    }

    stats.totalAll += 1;
    if (hasNightView) stats.nightViewAll += 1;
    if (hasParking) stats.parkingAll += 1;
    if (hasPhotoSpot) stats.photoSpotAll += 1;
  });

  return placeStats;
}

/**
 * 메인 화면 `transformPost`와 동일 — 실시간 핫플 카드 좌상단 태그(reasonTags·급상승 등) 일치용
 */
export function transformPostForHotFeed(post, placeStats) {
  const dynamicTime = getTimeAgo(post.timestamp || post.createdAt || post.time);
  const recentLikes = post.likes || 0;
  const surgeIndicator = recentLikes > 50 ? '급상승' : recentLikes > 20 ? '인기' : '실시간';
  const surgePercent =
    recentLikes > 50
      ? deterministicHashRange(post.id, 100, 149)
      : recentLikes > 20
        ? deterministicHashRange(post.id, 50, 79)
        : deterministicHashRange(post.id, 20, 49);

  const placeKey = getPlaceStatsAggregationKey(post);
  const stats = placeStats[placeKey] || {
    waitingRecent: 0,
    soldoutRecent: 0,
    blossom24h: 0,
    newMenu24h: 0,
    popup24h: 0,
    total24h: 0,
    nightViewAll: 0,
    parkingAll: 0,
    photoSpotAll: 0,
    totalAll: 0,
  };

  const postReasonTags = [];
  const text = collectTextForPost(post);
  const hasWaiting = text.includes('웨이팅') || text.includes('대기') || text.includes('줄') || text.includes('북적');
  const hasSoldout = text.includes('재고') || text.includes('소진') || text.includes('품절');
  const hasBlossom = text.includes('벚꽃') || text.includes('개화') || text.includes('만개');
  const hasNewMenu = text.includes('신메뉴') || text.includes('신상') || text.includes('한정') || text.includes('시즌메뉴');
  const hasPopup = text.includes('팝업') || text.includes('팝업스토어');
  const hasNightView = text.includes('야경');
  const hasParking = text.includes('주차');
  const hasSea = text.includes('바다') || text.includes('해변') || text.includes('파도') || text.includes('윤슬') || text.includes('물멍');
  const hasPhotoSpot = text.includes('포토존') || text.includes('사진 맛집') || text.includes('사진맛집') || text.includes('인스타');

  if (hasWaiting) postReasonTags.push('#지금_웨이팅');
  if (hasSoldout) postReasonTags.push('#재고_소진');
  if (hasBlossom) postReasonTags.push('#지금_절정');
  if (hasSea) postReasonTags.push('#바다_무드');
  if (hasPopup) postReasonTags.push('#팝업');
  if (hasNewMenu) postReasonTags.push('#신상');
  if (hasNightView) postReasonTags.push('#야경');
  if (hasParking) postReasonTags.push('#주차');
  if (hasPhotoSpot) postReasonTags.push('#사진_맛집');

  const reasonTags = [];

  if (stats.waitingRecent >= 3) {
    reasonTags.push('#지금_웨이팅_폭주');
  }
  if (stats.soldoutRecent >= 2) {
    reasonTags.push('#재고_소진_임박');
  }

  if (stats.total24h > 0) {
    const blossomRatio = stats.blossom24h / stats.total24h;
    if (blossomRatio >= 0.7) {
      reasonTags.push('#벚꽃_절정');
    }
    const newMenuRatio = stats.newMenu24h / stats.total24h;
    if (newMenuRatio >= 0.4) {
      reasonTags.push('#신메뉴_출시');
    }
    const popupRatio = stats.popup24h / stats.total24h;
    if (popupRatio >= 0.4) {
      reasonTags.push('#팝업스토어');
    }
  }

  if (stats.totalAll > 0) {
    const nightRatio = stats.nightViewAll / stats.totalAll;
    if (nightRatio >= 0.3) {
      reasonTags.push('#야경_최고');
    }
    const parkingRatio = stats.parkingAll / stats.totalAll;
    if (parkingRatio >= 0.3) {
      reasonTags.push('#주차_편함');
    }
    const photoRatio = stats.photoSpotAll / stats.totalAll;
    if (photoRatio >= 0.3) {
      reasonTags.push('#사진_맛집');
    }
  }

  const aiBasedTags = (Array.isArray(post.tags) ? post.tags : [])
    .map((t) => String(typeof t === 'string' ? t : (t?.name || t?.label || '')).replace(/^#+/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => `#${t}`);

  const uniqueReasons = [...new Set([...postReasonTags, ...reasonTags])];

  const feedReasonTags = aiBasedTags.length > 0 ? aiBasedTags : uniqueReasons.slice(0, 3);

  const firstImageUrl = post.images?.[0] ? post.images[0] : post.image || post.thumbnail || '';
  const firstVideoUrl = post.videos?.[0] ? post.videos[0] : '';
  const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
  const commentsArr = Array.isArray(post.comments) ? post.comments : [];

  return {
    ...post,
    id: post.id,
    image: getDisplayImageUrl(firstImageUrl || firstVideoUrl || ''),
    thumbnailIsVideo: !firstImageUrl && !!firstVideoUrl,
    firstVideoUrl: firstVideoUrl ? getDisplayImageUrl(firstVideoUrl) : null,
    title: post.location,
    time: dynamicTime,
    content: post.note || post.content || `${post.location}의 모습`,
    likes: likesNum,
    likeCount: likesNum,
    comments: commentsArr,
    weather: post.weatherSnapshot || post.weather || null,
    weatherSnapshot: post.weatherSnapshot || null,
    surgeIndicator,
    surgePercent,
    captureLabel: formatCaptureLabel(post),
    aiHotTags: aiBasedTags,
    reasonTags: feedReasonTags,
  };
}

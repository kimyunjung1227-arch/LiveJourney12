import { getDisplayImageUrl } from '../api/upload';

const STORAGE_KEY = 'lj_main_feed_v1_last';
const MAX_POSTS_IN_CACHE = 350;

/**
 * 메인 상단 이미지 변환(플랜에서 transform 사용 시) — 카드 높이 기준으로 과도한 원본 요청 방지
 */
export const MAIN_FEED_IMAGE_OPTS = { maxWidth: 720, quality: 76 };

/**
 * localStorage quota 피하기 위해 posts 배열 길이 제한
 */
function trimPostsForCache(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.length > MAX_POSTS_IN_CACHE ? posts.slice(0, MAX_POSTS_IN_CACHE) : posts;
}

/**
 * 새로고침 직후 첫 페인트용: 직전에 성공적으로 불러온 피드 스냅샷
 */
export function loadMainFeedSnapshotLast() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return o;
  } catch {
    return null;
  }
}

/**
 * 피드 로드 성공 시 스냅샷 저장 (HTTP 캐시와 함께 쓰면 새로고침 체감이 빨라짐)
 */
export function saveMainFeedSnapshotLast(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  try {
    const payload = {
      ...snapshot,
      allPostsForRecommend: trimPostsForCache(snapshot.allPostsForRecommend),
      savedAt: Date.now(),
    };
    const str = JSON.stringify(payload);
    if (str.length > 4_500_000) {
      const lean = { ...payload, allPostsForRecommend: [] };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, str);
  } catch {
    try {
      const lean = {
        realtimeData: snapshot.realtimeData || [],
        crowdedData: snapshot.crowdedData || [],
        recommendedData: snapshot.recommendedData || [],
        allPostsForRecommend: [],
        savedAt: Date.now(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
    } catch {
      /* ignore */
    }
  }
}

function firstDisplayMediaUrlForPost(post, imgOpts) {
  if (!post || typeof post !== 'object') return '';
  const hasVideo =
    (Array.isArray(post.videos) && post.videos.length > 0) ||
    (typeof post.videos === 'string' && post.videos.trim());
  const rawImg =
    Array.isArray(post.images) && post.images.length > 0
      ? post.images[0]
      : post.image || post.thumbnail || '';
  // 메인 카드와 동일: 동영상이면 포스터(첫 이미지)를 먼저 그린다 — preload는 이미지 URL만
  if (hasVideo && rawImg) {
    return getDisplayImageUrl(rawImg, imgOpts);
  }
  if (hasVideo && !rawImg) {
    return '';
  }
  return rawImg ? getDisplayImageUrl(rawImg, imgOpts) : '';
}

/**
 * 브라우저가 상단 카드 이미지를 미리 가져가도록 힌트 (동일 세션·직후 요청에도 유리)
 */
export function preloadMainFeedImageUrls(realtimeData, crowdedData, { limit = 6, imgOpts = MAIN_FEED_IMAGE_OPTS } = {}) {
  if (typeof document === 'undefined') return () => {};
  const urls = [];
  const push = (u) => {
    const s = typeof u === 'string' ? u.trim() : '';
    if (!s || s.startsWith('data:') || s.startsWith('blob:')) return;
    urls.push(s);
  };

  const rt = Array.isArray(realtimeData) ? realtimeData : [];
  for (let i = 0; i < Math.min(3, rt.length); i += 1) {
    push(firstDisplayMediaUrlForPost(rt[i], imgOpts));
  }

  const cr = Array.isArray(crowdedData) ? crowdedData : [];
  if (cr[0]) push(firstDisplayMediaUrlForPost(cr[0], imgOpts));

  const unique = Array.from(new Set(urls)).filter(Boolean).slice(0, limit);
  const nodes = [];
  unique.forEach((href, idx) => {
    const id = `lj-preload-main-feed-${idx}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    try {
      const u = new URL(href);
      if (u.hostname.endsWith('.supabase.co')) link.crossOrigin = 'anonymous';
    } catch {
      /* ignore */
    }
    document.head.appendChild(link);
    nodes.push(link);
  });

  return () => {
    nodes.forEach((n) => {
      try {
        n.remove();
      } catch {
        /* ignore */
      }
    });
  };
}

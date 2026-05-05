import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, LocateFixed, X } from 'lucide-react';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import { getCombinedPosts } from '../utils/mockData';
import { getCoordinatesByLocation } from '../utils/locationCoordinates';
import { searchPlaceWithKakaoFirst } from '../utils/kakaoPlacesGeocode';
import { logger } from '../utils/logger';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

/** Live Journey 메인 컬러 (tailwind `primary`와 동일) */
const PRIMARY_HEX = '#26C6DA';
const PRIMARY_DARK = '#0891b2';

const GEO_CACHE_KEY = '__lj_map_geo_cache_v3';

const escapeHtmlAttr = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

// NOTE: Non-ASCII UI strings are written as \u escapes to avoid encoding corruption in patches.
const t = {
  errMissingKey:
    'VITE_KAKAO_MAP_API_KEY\uac00 \ube44\uc5b4\uc788\uc2b5\ub2c8\ub2e4. web/.env\uc5d0 \uc124\uc815\ud574 \uc8fc\uc138\uc694.',
  errSdkLoad: 'Kakao Maps SDK \uc2a4\ud06c\ub9bd\ud2b8 \ub85c\ub4dc\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.',
  errSdkInit: 'Kakao Maps SDK\uac00 \ucd08\uae30\ud654\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.',
  warnMapInit: '\uc9c0\ub3c4 \ucd08\uae30\ud654 \uc2e4\ud328',
  warnOverlays: '\uc624\ubc84\ub808\uc774 \uac31\uc2e0 \uc2e4\ud328',
  warnUserOverlay: '\ub0b4 \uc704\uce58 \ud45c\uc2dc \uc2e4\ud328',
  warnSearch: '\uac80\uc0c9 \uc2e4\ud328',
  warnGeoUnsupported: '\uc774 \ube0c\ub77c\uc6b0\uc800\ub294 \uc704\uce58 \uc815\ubcf4\ub97c \uc9c0\uc6d0\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.',
  warnGeoFailed: '\ud604\uc7ac \uc704\uce58\ub97c \uac00\uc838\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.',
  warnRefreshPosts: '\uac8c\uc2dc\ubb3c \uc0c8\ub85c\uace0\uce68 \uc2e4\ud328',
  loadingSdk: '\uc9c0\ub3c4\ub97c \uc900\ube44\ud558\ub294 \uc911\uc785\ub2c8\ub2e4...',
  mapLoadFailedTitle: '\uc9c0\ub3c4\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc5b4\uc694',
  mapLoadFailedHint:
    'web/.env\uc758 VITE_KAKAO_MAP_API_KEY\uc640 \uce74\uce74\uc624 \ub514\ubc1c\ub85c\ud37c\uc2a4 \ub3c4\uba54\uc778(\ub85c\uceec/\ubc30\ud3ec URL) \uc124\uc815\uc744 \ud655\uc778\ud574 \uc8fc\uc138\uc694.',
  back: '\ub4a4\ub85c\uac00\uae30',
  searchPlaceholder: '\uc9c0\uc5ed \uac80\uc0c9',
  refresh: '\uc0c8\ub85c\uace0\uce68',
  situationCta: '\uc9c0\uae08 \uc0c1\ud669 \uc54c\uc544\ubcf4\uae30',
  chipBloom: '\uac1c\ud654\uc815\ubcf4',
  chipPlaces: '\uac00\ubcfc\ub9cc\ud55c\uacf3',
  myLocation: '\ub0b4 \uc704\uce58',
  sheetToggle: '\ubc14\ud2f7\uc2dc\ud2b8 \ud655\uc7a5/\ucd95\uc18c',
  nearbyTitle: '\uc8fc\ubcc0 \uc0ac\uc9c4',
  showPhotosAgain: '\uc0ac\uc9c4 \ub2e4\uc2dc \ubcf4\uae30',
  close: '\ub2eb\uae30',
  postsSummary: (inView, total) =>
    `\ubcf4\uc774\ub294 \uc9c0\uc5ed ${inView.toLocaleString()} \xb7 \uc120\ud0dd\ud544\ud130 ${total.toLocaleString()}`,
  emptyLoading: '\uac8c\uc2dc\ubb3c\uc744 \ubd88\ub7ec\uc624\ub294 \uc911...',
  emptyNone: '\ud45c\uc2dc\ud560 \uc0ac\uc9c4\uc774 \uc5c6\uc2b5\ub2c8\ub2e4',
  emptyHint:
    '\ud544\ud130\ub97c \ubc14\uafb8\uac70\ub098 \uc9c0\ub3c4\ub97c \uc62e\uaca8 \ubcf4\uc138\uc694. \uac1c\ud654/\uba85\uc18c\ub294 \uae0d\uc81c/\ub0b4\uc6a9\uc5d0 \uad00\ub828 \ud0a4\uc6cc\ub4dc\uac00 \uc788\uc73c\uba74 \uac80\uc0c9\ub429\ub2c8\ub2e4.',
};

const readGeoCache = () => {
  try {
    const g = globalThis;
    if (!g[GEO_CACHE_KEY] || typeof g[GEO_CACHE_KEY] !== 'object') g[GEO_CACHE_KEY] = new Map();
    return g[GEO_CACHE_KEY];
  } catch {
    return new Map();
  }
};

const getKakaoAppKey = () => String(import.meta.env.VITE_KAKAO_MAP_API_KEY || '').trim();

const loadKakaoSdkOnce = (appKey) =>
  new Promise((resolve, reject) => {
    const key = String(appKey || '').trim();
    if (!key) {
      reject(new Error(t.errMissingKey));
      return;
    }

    if (window.kakao?.maps) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-kakao-maps-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(t.errSdkLoad)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.kakaoMapsSdk = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(t.errSdkLoad));
    document.head.appendChild(script);
  });

const ensureKakaoMapsReady = async () => {
  const key = getKakaoAppKey();
  await loadKakaoSdkOnce(key);
  await new Promise((resolve, reject) => {
    try {
      if (!window.kakao?.maps?.load) {
        reject(new Error(t.errSdkInit));
        return;
      }
      window.kakao.maps.load(() => resolve());
    } catch (e) {
      reject(e);
    }
  });
};

const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
};

function metersToLatLngDeltaMeters(meters, atLat) {
  const lat = Number(atLat) || 0;
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { dLat, dLng };
}

/**
 * 같은 좌표로 겹치는 핀을 주변으로 퍼지게(spiderfy) 배치.
 * - 좌표를 소수점 5자리 단위로 묶어(약 1m 단위) "같은 위치"를 판단
 * - 그룹 내 index에 따라 원형으로 오프셋(미터) 부여
 */
function buildSpreadCoordsByPostId(posts) {
  const list = Array.isArray(posts) ? posts : [];
  const groups = new Map(); // key -> post[]
  const keyOf = (pos) => {
    const lat = Number(pos?.lat);
    const lng = Number(pos?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  };

  for (const p of list) {
    const pos = p?.__coords;
    const k = keyOf(pos);
    if (!k) continue;
    const arr = groups.get(k);
    if (arr) arr.push(p);
    else groups.set(k, [p]);
  }

  const out = new Map(); // postId -> {lat,lng}
  for (const [, arrRaw] of groups) {
    const arr = (arrRaw || []).slice().sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
    if (arr.length <= 1) continue;
    const base = arr[0]?.__coords;
    if (!base) continue;

    // 핀 2~6개는 한 바퀴에 배치, 더 많으면 반경을 조금씩 늘리며 분산
    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i];
      const id = p?.id != null ? String(p.id) : '';
      if (!id) continue;

      const ring = Math.floor(i / 8); // 0,1,2...
      const idxInRing = i % 8;
      const n = Math.min(8, arr.length - ring * 8);
      const angle = (2 * Math.PI * idxInRing) / Math.max(1, n);
      const radiusM = 12 + ring * 10; // 12m, 22m, 32m...
      const { dLat, dLng } = metersToLatLngDeltaMeters(radiusM, base.lat);
      const lat = base.lat + Math.sin(angle) * dLat;
      const lng = base.lng + Math.cos(angle) * dLng;
      out.set(id, { lat, lng });
    }
  }

  return out;
}

const extractCoordsFromPost = (post) => {
  /** Supabase에 저장된 업로드 시 확정 좌표(모든 기기 동일) */
  const mp = post?.exifData?.map_pin;
  if (mp && Number.isFinite(Number(mp.lat)) && Number.isFinite(Number(mp.lng))) {
    return { lat: Number(mp.lat), lng: Number(mp.lng) };
  }
  const c = post?.coordinates;
  const lat = Number(
    c?.lat ?? c?.latitude ?? post?.lat ?? post?.latitude ?? post?.exifData?.latitude ?? post?.exifData?.lat,
  );
  const lng = Number(
    c?.lng ?? c?.longitude ?? post?.lng ?? post?.longitude ?? post?.exifData?.longitude ?? post?.exifData?.lng,
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const buildGeoQuery = (post) => {
  const place = String(post?.placeName || '').trim();
  const detailed = String(post?.detailedLocation || '').trim();
  const loc = String(post?.location || '').trim();
  const region = String(post?.region || '').trim();
  const primary = place || detailed || loc || region;
  if (!primary) return '';
  if (region && primary !== region) return `${primary} ${region}`;
  return primary;
};

/** 장소명·상세 위치 우선 — 카카오 키워드 검색이 지역 중심점보다 정확 */
function buildKakaoPriorityQuery(post) {
  const place = String(post?.placeName || '').trim();
  const detailed = String(post?.detailedLocation || '').trim();
  const loc = String(post?.location || '').trim();
  const region = String(post?.region || '').trim();
  const primary = place || detailed || loc;
  if (!primary) return region || '';
  if (region && !primary.includes(region)) return `${primary} ${region}`.trim();
  return primary;
}

const normalizePost = (p) => {
  if (!p || typeof p !== 'object') return null;
  const id = p.id != null ? String(p.id) : `${p.timestamp || 'noid'}-${Math.random().toString(16).slice(2)}`;
  return { ...p, id };
};

const mergePostsUnique = (lists) => {
  const map = new Map();
  for (const arr of lists) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      const p = normalizePost(raw);
      if (!p?.id) continue;
      if (!map.has(p.id)) map.set(p.id, p);
    }
  }
  return [...map.values()].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
};

function postTextBlob(post) {
  const tags = Array.isArray(post.tags) ? post.tags.join(' ') : '';
  return [
    post.note,
    post.content,
    post.location,
    post.placeName,
    post.detailedLocation,
    post.region,
    post.category,
    post.categoryName,
    tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesMapFilter(post, selectedFilters) {
  if (!Array.isArray(selectedFilters) || selectedFilters.length === 0) return true;
  const blob = postTextBlob(post);
  const matchBloom = () =>
    [
      '\uac1c\ud654',
      '\ubc94\uaf43',
      '\uaf43',
      '\ubd04',
      'flower',
      'bloom',
      'cherry',
      'sakura',
      '\uaf43\ub180\uc774',
    ].some((k) => blob.includes(k.toLowerCase()));
  const matchPlaces = () =>
    [
      '\uac00\ubcfc\ub9cc',
      '\uba85\uc18c',
      '\uad00\uad11',
      '\uc5ec\ud589',
      '\ud56b\ud50c',
      'spot',
      'landmark',
      'attraction',
      '\uad6c\uacbd',
      '\ucf54\uc2a4',
      '\uc5ec\ud589\uc9c0',
      '\ucd94\ucc9c',
      '\uad00\ub9ac',
      '\uc5b4\ud2b8',
    ].some((k) => blob.includes(k.toLowerCase()));

  return selectedFilters.some((f) => {
    if (f === 'bloom') return matchBloom();
    if (f === 'places') return matchPlaces();
    return true;
  });
}

function pointInBounds(lat, lng, bounds) {
  if (!bounds) return true;
  return (
    lat >= bounds.sw.lat && lat <= bounds.ne.lat && lng >= bounds.sw.lng && lng <= bounds.ne.lng
  );
}

const chipClass = (active) =>
  active
    ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-sm font-semibold shadow-sm whitespace-nowrap'
    : 'inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-sm font-semibold shadow-sm whitespace-nowrap';

const chipStyle = (active) => ({
  borderColor: active ? 'rgba(38,198,218,0.38)' : 'rgba(226,232,240,1)',
  color: active ? PRIMARY_DARK : '#334155',
});

const iconColorForFilter = (key, active) => {
  if (key === 'bloom') return '#ec4899'; // pink
  if (key === 'places') return '#6366f1'; // indigo
  return '#64748b';
};

const msIcon = (name, opts = {}) => (
  <span
    className="material-symbols-outlined text-[18px] leading-none"
    style={{
      fontVariationSettings: "'wght' 300",
      color: opts.color || '#64748b',
    }}
    aria-hidden
  >
    {name}
  </span>
);

const MapScreen = () => {
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const postOverlaysRef = useRef([]);
  const postOverlayByIdRef = useRef(new Map()); // postId -> { overlay, el }
  const userOverlayRef = useRef(null);
  const searchOverlayRef = useRef(null);
  const searchDebounceRef = useRef(0);
  const idleListenerRef = useRef(null);
  const sheetDragRef = useRef(null);
  const rafSyncRef = useRef(0);
  const prefetchedThumbsRef = useRef(new Set()); // url -> true

  /** expanded: 큰 시트 | peek: 미리보기 | hidden: 내려감 */
  const [sheetMode, setSheetMode] = useState('peek');
  const [sdkStatus, setSdkStatus] = useState({ ok: false, message: '' });
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPostCard, setSelectedPostCard] = useState(null);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [searchedPlace, setSearchedPlace] = useState(null); // { lat, lng, label }
  const [remoteSuggests, setRemoteSuggests] = useState([]); // Kakao keywordSearch results
  const [remoteSuggestLoading, setRemoteSuggestLoading] = useState(false);

  const [userPos, setUserPos] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapBounds, setMapBounds] = useState(null);
  const [viewCenter, setViewCenter] = useState(DEFAULT_CENTER);

  const [posts, setPosts] = useState([]);
  const [postsWithCoords, setPostsWithCoords] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const PIN_MAX_AGE_MS = 48 * 60 * 60 * 1000;

  // 처음 진입 시 필터는 기본으로 "미선택"(전체 표시)
  const [selectedFilters, setSelectedFilters] = useState([]);
  const geoCache = useMemo(() => readGeoCache(), []);

  const filterScroll = useHorizontalDragScroll();
  const photoScroll = useHorizontalDragScroll();

  const resolveCoordsForPost = useCallback(
    async (post) => {
      const tryKakaoQuery = async (queryText) => {
        const q = String(queryText || '').trim();
        if (!q) return null;
        const cached = geoCache.get(q);
        if (cached !== undefined) return cached;
        await ensureKakaoMapsReady();
        const found = await searchPlaceWithKakaoFirst(q);
        const coord =
          found && Number.isFinite(found.lat) && Number.isFinite(found.lng) ? { lat: found.lat, lng: found.lng } : null;
        geoCache.set(q, coord);
        return coord;
      };

      const qPriority = buildKakaoPriorityQuery(post);
      // ✅ 사용자 입력 위치/장소명을 우선으로 핀 위치 결정
      let coord = await tryKakaoQuery(qPriority);
      if (coord) return coord;

      const direct = extractCoordsFromPost(post);
      if (direct) return direct;

      const qFallback = buildGeoQuery(post);
      if (qFallback && qFallback !== qPriority) {
        coord = await tryKakaoQuery(qFallback);
        if (coord) return coord;
      }

      const regionOnly = String(post?.region || '').trim();
      if (regionOnly) {
        const regionCoord = getCoordinatesByLocation(regionOnly);
        if (regionCoord) return regionCoord;
      }
      const locOnly = String(post?.location || '').trim();
      if (locOnly && locOnly !== regionOnly) {
        const locCoord = getCoordinatesByLocation(locOnly);
        if (locCoord) return locCoord;
      }
      return null;
    },
    [geoCache],
  );

  const refreshPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const local = getUploadedPostsSafe();
      const remote = await fetchPostsSupabase();
      const mergedAll = mergePostsUnique([getCombinedPosts(local), remote]);
      const now = Date.now();
      const getUploadTimeMs = (p) => {
        const ts = Number(p?.timestamp);
        if (Number.isFinite(ts) && ts > 0) return ts;
        const ca = p?.createdAt;
        if (typeof ca === 'string' && ca.trim()) {
          const t = new Date(ca).getTime();
          return Number.isFinite(t) ? t : null;
        }
        return null;
      };
      // 업로드 시간 기준 48시간 지난 게시물은 지도 핀에서 제외
      const merged = mergedAll.filter((p) => {
        const t = getUploadTimeMs(p);
        if (t == null) return true; // 시간 정보가 없으면 일단 유지(데이터 소실 방지)
        return now - t <= PIN_MAX_AGE_MS;
      });

      const MAX_ENRICH = 200;
      const slice = merged.slice(0, MAX_ENRICH);

      const enriched = [];
      for (const p of slice) {
        // eslint-disable-next-line no-await-in-loop
        const coords = await resolveCoordsForPost(p);
        if (coords) enriched.push({ ...p, __coords: coords });
      }

      setPosts(merged);
      setPostsWithCoords(enriched);
    } catch (e) {
      logger.warn(t.warnRefreshPosts, e?.message || e);
      setPosts([]);
      setPostsWithCoords([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [resolveCoordsForPost]);

  const postsFiltered = useMemo(
    () => postsWithCoords.filter((p) => matchesMapFilter(p, selectedFilters)),
    [postsWithCoords, selectedFilters],
  );

  const recommendedQueries = useMemo(
    () => [
      { label: '석촌호수', query: '석촌호수' },
      { label: '성수', query: '성수' },
      { label: '홍대', query: '홍대입구' },
      { label: '강남역', query: '강남역' },
      { label: '여의도 한강공원', query: '여의도 한강공원' },
      { label: '해운대', query: '해운대 해수욕장' },
      { label: '광안리', query: '광안리 해수욕장' },
      { label: '전주 한옥마을', query: '전주 한옥마을' },
      { label: '경주 황리단길', query: '황리단길' },
      { label: '제주', query: '제주도' },
    ],
    [],
  );

  const searchResults = useMemo(() => {
    const q = String(query || '').trim();
    if (!q) {
      return recommendedQueries.map((x) => ({ kind: 'preset', key: `preset:${x.query}`, label: x.label, query: x.query }));
    }
    return (remoteSuggests || []).map((r) => ({
      kind: 'kakao',
      key: `kakao:${r.id || `${r.x}|${r.y}|${r.place_name}`}`,
      label: r.place_name || r.address_name || q,
      address: r.road_address_name || r.address_name || '',
      lat: Number(r.y),
      lng: Number(r.x),
    }));
  }, [query, remoteSuggests, recommendedQueries]);

  const toggleFilter = useCallback((key) => {
    setSelectedFilters((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key];
    });
  }, []);

  const postsInViewport = useMemo(() => {
    return postsFiltered.filter((p) => pointInBounds(p.__coords.lat, p.__coords.lng, mapBounds));
  }, [postsFiltered, mapBounds]);

  const sheetPhotoPosts = useMemo(() => {
    const center = viewCenter;
    return [...postsInViewport]
      .map((p) => ({ p, km: haversineKm(center, p.__coords) }))
      .sort((a, b) => a.km - b.km)
      .map((x) => x.p);
  }, [postsInViewport, viewCenter]);

  const sheetStripPosts = useMemo(() => sheetPhotoPosts.slice(0, 10), [sheetPhotoPosts]);

  const openMorePhotos = useCallback(() => {
    setSheetMode('expanded');
  }, []);

  const syncViewportFromMap = useCallback(() => {
    const map = kakaoMapRef.current;
    if (!map) return;
    try {
      const b = map.getBounds();
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      setMapBounds({
        sw: { lat: sw.getLat(), lng: sw.getLng() },
        ne: { lat: ne.getLat(), lng: ne.getLng() },
      });
      const c = map.getCenter();
      setViewCenter({ lat: c.getLat(), lng: c.getLng() });
    } catch {
      /* ignore */
    }
  }, []);

  const scheduleViewportSync = useCallback(() => {
    if (rafSyncRef.current) cancelAnimationFrame(rafSyncRef.current);
    rafSyncRef.current = requestAnimationFrame(() => {
      syncViewportFromMap();
      rafSyncRef.current = requestAnimationFrame(() => {
        syncViewportFromMap();
        rafSyncRef.current = 0;
      });
    });
  }, [syncViewportFromMap]);

  const panToPost = useCallback(
    (post) => {
      const map = kakaoMapRef.current;
      const pos = post?.__coords;
      if (!map || !pos || !window.kakao?.maps) return;
      try {
        map.panTo(new window.kakao.maps.LatLng(pos.lat, pos.lng));
        setViewCenter({ lat: pos.lat, lng: pos.lng });
        scheduleViewportSync();
      } catch {
        /* ignore */
      }
    },
    [scheduleViewportSync],
  );

  const panToLatLng = useCallback(
    (lat, lng) => {
      const map = kakaoMapRef.current;
      if (!map || !window.kakao?.maps) return;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
      try {
        map.panTo(new window.kakao.maps.LatLng(Number(lat), Number(lng)));
        setViewCenter({ lat: Number(lat), lng: Number(lng) });
        scheduleViewportSync();
      } catch {
        /* ignore */
      }
    },
    [scheduleViewportSync],
  );

  const keywordSuggest = useCallback(async (q) => {
    const queryText = String(q || '').trim();
    if (!queryText) {
      setRemoteSuggests([]);
      return;
    }
    try {
      await ensureKakaoMapsReady();
      if (!window.kakao?.maps?.services) return;
      setRemoteSuggestLoading(true);
      const places = new window.kakao.maps.services.Places();
      places.keywordSearch(
        queryText,
        (data, status) => {
          try {
            if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data)) {
              setRemoteSuggests([]);
              return;
            }
            setRemoteSuggests(data.slice(0, 20));
          } finally {
            setRemoteSuggestLoading(false);
          }
        },
        { size: 15 },
      );
    } catch {
      setRemoteSuggests([]);
      setRemoteSuggestLoading(false);
    }
  }, []);

  // 검색 오버레이가 열려 있고 입력이 바뀌면 전국 키워드 추천 자동 갱신(디바운스)
  useEffect(() => {
    if (!searchOpen) return undefined;
    const q = String(query || '').trim();
    if (!q) {
      setRemoteSuggests([]);
      setRemoteSuggestLoading(false);
      return undefined;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void keywordSuggest(q);
    }, 220);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [query, searchOpen, keywordSuggest]);

  const selectSearchResult = useCallback(
    (item) => {
      if (!item) return;
      setSearchOpen(false);
      setSelectedPostCard(null);
      setSheetMode('peek');

      if (item.kind === 'preset') {
        // 프리셋은 키워드 검색 후 첫 결과로 이동
        const q = String(item.query || item.label || '').trim();
        if (!q) return;
        void (async () => {
          try {
            await ensureKakaoMapsReady();
            if (!window.kakao?.maps?.services) return;
            const places = new window.kakao.maps.services.Places();
            places.keywordSearch(q, (data, status) => {
              if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data) || data.length === 0) return;
              const first = data[0];
              const lat = Number(first.y);
              const lng = Number(first.x);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              setSearchedPlace({ lat, lng, label: first.place_name || q });
              setMapCenter({ lat, lng });
              panToLatLng(lat, lng);
            });
          } catch {
            /* ignore */
          }
        })();
        return;
      }

      if (item.kind === 'kakao') {
        const lat = Number(item.lat);
        const lng = Number(item.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setSearchedPlace({ lat, lng, label: String(item.label || '').trim() });
        setMapCenter({ lat, lng });
        panToLatLng(lat, lng);
        return;
      }
    },
    [panToLatLng],
  );

  const openPostCard = useCallback(
    (post) => {
      if (!post) return;
      setSelectedPostCard(post);
      setHighlightedPostId(post?.id != null ? String(post.id) : null);
      setSheetMode('hidden');
      panToPost(post);
    },
    [panToPost],
  );

  const goPostDetail = useCallback(
    (post) => {
      if (!post?.id) return;
      setSelectedPostCard(null);
      setSheetMode('peek');
      navigate(`/post/${encodeURIComponent(String(post.id))}`, { state: { post } });
    },
    [navigate],
  );

  const onSheetPointerDown = (e) => {
    sheetDragRef.current = { startY: e.clientY, pointerId: e.pointerId };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onSheetPointerUp = (e) => {
    const start = sheetDragRef.current;
    sheetDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (start == null) return;
    const dy = e.clientY - start.startY;

    if (Math.abs(dy) < 14) {
      setSheetMode((m) => {
        if (m === 'hidden') return 'peek';
        if (m === 'expanded') return 'peek';
        return 'expanded';
      });
      return;
    }
    if (dy > 36) {
      setSheetMode((m) => (m === 'expanded' ? 'peek' : 'hidden'));
    } else if (dy < -36) {
      setSheetMode((m) => (m === 'hidden' ? 'peek' : 'expanded'));
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureKakaoMapsReady();
        if (cancelled) return;
        setSdkStatus({ ok: true, message: '' });
      } catch (e) {
        if (cancelled) return;
        setSdkStatus({ ok: false, message: e?.message || String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    let cancelled = false;
    const el = mapRef.current;
    if (!el) return undefined;

    void (async () => {
      try {
        await ensureKakaoMapsReady();
        if (cancelled) return;
        const kakao = window.kakao;
        const center = new kakao.maps.LatLng(mapCenter.lat, mapCenter.lng);
        const map = new kakao.maps.Map(el, {
          center,
          level: 5,
        });
        kakaoMapRef.current = map;

        const onIdle = () => {
          syncViewportFromMap();
        };
        kakao.maps.event.addListener(map, 'idle', onIdle);
        idleListenerRef.current = { map, onIdle };
        onIdle();
      } catch (e) {
        logger.warn(t.warnMapInit, e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
      const il = idleListenerRef.current;
      if (il?.map && il?.onIdle && window.kakao?.maps?.event) {
        try {
          window.kakao.maps.event.removeListener(il.map, 'idle', il.onIdle);
        } catch {
          /* ignore */
        }
      }
      idleListenerRef.current = null;
      kakaoMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return;
    try {
      const kakao = window.kakao;
      map.setCenter(new kakao.maps.LatLng(mapCenter.lat, mapCenter.lng));
    } catch {
      /* ignore */
    }
  }, [mapCenter]);

  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return;

    try {
      const kakao = window.kakao;
      const spread = buildSpreadCoordsByPostId(postsInViewport);
      const nextIds = new Set(postsInViewport.map((p) => String(p?.id ?? '')).filter(Boolean));

      // 1) viewport에 없는 기존 오버레이는 제거(전체 리셋 금지 → 깜빡임 방지)
      for (const [id, item] of postOverlayByIdRef.current.entries()) {
        if (!nextIds.has(id)) {
          try {
            item?.overlay?.setMap(null);
          } catch {
            /* ignore */
          }
          postOverlayByIdRef.current.delete(id);
        }
      }

      // 2) 썸네일은 미리 프리로드(브라우저 캐시에 올려 깜빡임/지연 최소화)
      try {
        const list = postsInViewport.slice(0, 40);
        for (const p of list) {
          const raw = p?.thumbnail || (Array.isArray(p?.images) ? p.images[0] : '');
          const url = raw ? getDisplayImageUrl(raw) : '';
          if (!url || prefetchedThumbsRef.current.has(url)) continue;
          prefetchedThumbsRef.current.add(url);
          const img = new Image();
          img.decoding = 'async';
          img.src = url;
        }
      } catch {
        /* ignore */
      }

      // 3) viewport 오버레이는 "추가/업데이트"만 수행
      postsInViewport.forEach((p) => {
        const pos = p?.__coords;
        if (!pos) return;
        const id = String(p?.id ?? '');
        if (!id) return;
        const spreadPos = spread.get(id) || pos;

        const thumbRaw = p.thumbnail || (Array.isArray(p.images) ? p.images[0] : '');
        const thumb = escapeHtmlAttr(getDisplayImageUrl(thumbRaw));
        const isHighlight = highlightedPostId && String(p.id) === String(highlightedPostId);
        const ring = isHighlight
          ? `box-shadow:0 2px 10px rgba(0,0,0,.18), 0 0 0 3px ${PRIMARY_HEX};border:1px solid rgba(255,255,255,.98);`
          : 'box-shadow:0 2px 10px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.95);';

        const existing = postOverlayByIdRef.current.get(id);
        if (existing?.overlay && existing?.el) {
          // highlight 스타일만 갱신 (DOM 재생성 금지)
          existing.el.setAttribute(
            'style',
            `width:52px;height:52px;border-radius:10px;overflow:hidden;cursor:pointer;${ring}background:#f3f4f6;transform:${isHighlight ? 'translateY(-2px)' : 'translateY(0)'};transition:transform .15s ease;`
          );
          try {
            existing.overlay.setPosition(new kakao.maps.LatLng(spreadPos.lat, spreadPos.lng));
          } catch {
            /* ignore */
          }
          return;
        }

        const wrap = document.createElement('div');
        wrap.innerHTML = `
          <div class="lj-map-post-pin" style="width:52px;height:52px;border-radius:10px;overflow:hidden;cursor:pointer;${ring}background:#f3f4f6;transform:${isHighlight ? 'translateY(-2px)' : 'translateY(0)'};transition:transform .15s ease;">
            ${
              thumb
                ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;"/>`
                : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#e0f7fa,#b2ebf2);"></div>`
            }
          </div>`;
        const el = wrap.firstElementChild;
        if (!el) return;
        el.addEventListener('click', () => openPostCard(p));

        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(spreadPos.lat, spreadPos.lng),
          content: el,
          yAnchor: 1,
          xAnchor: 0.5,
          zIndex: 3,
        });
        overlay.setMap(map);
        postOverlayByIdRef.current.set(id, { overlay, el });
      });

      // 디버깅/정리 용: 현재 오버레이 목록도 유지(기존 코드 호환)
      postOverlaysRef.current = Array.from(postOverlayByIdRef.current.values())
        .map((x) => x?.overlay)
        .filter(Boolean);
    } catch (e) {
      logger.warn(t.warnOverlays, e?.message || e);
    }
  }, [openPostCard, postsInViewport, highlightedPostId]);

  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return;

    try {
      if (userOverlayRef.current) {
        userOverlayRef.current.setMap(null);
        userOverlayRef.current = null;
      }
      if (!userPos) return;

      const kakao = window.kakao;
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="lj-map-user-wrap" style="position:relative;width:68px;height:68px;pointer-events:none;">
          <div class="lj-map-user-pulse"></div>
          <div class="lj-map-user-dot"></div>
        </div>`;
      const el = wrap.firstElementChild;
      if (!el) return;

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(userPos.lat, userPos.lng),
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 5,
      });
      overlay.setMap(map);
      userOverlayRef.current = overlay;
    } catch (e) {
      logger.warn(t.warnUserOverlay, e?.message || e);
    }
  }, [userPos]);

  const onSearchSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const q = String(query || '').trim();
      if (!q) return;
      try {
        await ensureKakaoMapsReady();
        const found = await searchPlaceWithKakaoFirst(q);
        if (found && Number.isFinite(found.lat) && Number.isFinite(found.lng)) {
          setSearchedPlace({ lat: found.lat, lng: found.lng, label: q });
          setMapCenter({ lat: found.lat, lng: found.lng });
          panToLatLng(found.lat, found.lng);
          setSearchOpen(false);
          return;
        }
        const fallback = getCoordinatesByLocation(q);
        if (fallback) {
          setSearchedPlace({ lat: fallback.lat, lng: fallback.lng, label: q });
          setMapCenter(fallback);
          panToLatLng(fallback.lat, fallback.lng);
          setSearchOpen(false);
        }
      } catch (err) {
        logger.warn(t.warnSearch, err?.message || err);
      }
    },
    [query, panToLatLng],
  );

  // 검색한 장소 전용 핀(오버레이)
  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return;
    try {
      if (searchOverlayRef.current) {
        searchOverlayRef.current.setMap(null);
        searchOverlayRef.current = null;
      }
      if (!searchedPlace || !Number.isFinite(Number(searchedPlace.lat)) || !Number.isFinite(Number(searchedPlace.lng))) return;

      const kakao = window.kakao;
      const wrap = document.createElement('div');
      const label = escapeHtmlAttr(String(searchedPlace.label || '').trim());
      wrap.innerHTML = `
        <div style="position:relative;transform:translateY(-10px);">
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
            <div style="max-width:220px;padding:6px 10px;border-radius:9999px;background:#ffffff;border:1px solid rgba(38,198,218,0.35);box-shadow:0 8px 20px rgba(15,23,42,0.10);font-size:12px;font-weight:700;color:${PRIMARY_DARK};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${label || '검색 위치'}
            </div>
            <div style="width:18px;height:18px;border-radius:9999px;background:${PRIMARY_HEX};box-shadow:0 10px 22px rgba(38,198,218,0.35);border:3px solid #ffffff;"></div>
          </div>
        </div>`;
      const el = wrap.firstElementChild;
      if (!el) return;
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(searchedPlace.lat, searchedPlace.lng),
        content: el,
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: 6,
      });
      overlay.setMap(map);
      searchOverlayRef.current = overlay;
    } catch {
      /* ignore */
    }
  }, [searchedPlace]);

  const requestMyLocationAndCenter = useCallback(() => {
    if (!navigator?.geolocation) {
      logger.warn(t.warnGeoUnsupported);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setUserPos({ lat, lng });
        setMapCenter({ lat, lng });
      },
      (err) => {
        logger.warn(t.warnGeoFailed, err?.message || err);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  /** 첫 진입 시 서울 기본 중심 대신 사용자 위치로 맞춤 */
  useEffect(() => {
    requestMyLocationAndCenter();
  }, [requestMyLocationAndCenter]);

  const onMyLocation = useCallback(() => {
    requestMyLocationAndCenter();
  }, [requestMyLocationAndCenter]);

  // peek(기본)에서 사진이 바로 보이도록 조금 더 크게
  const sheetHeightClass = sheetMode === 'expanded' ? 'h-[100dvh]' : 'h-[32vh]';

  return (
    <div className="relative w-full h-[100dvh] bg-gray-100 overflow-hidden font-sans">
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {searchOpen && (
        <div
          className="absolute inset-0 z-[70] bg-white/95 backdrop-blur-sm"
          onMouseDown={() => setSearchOpen(false)}
          role="dialog"
          aria-label="검색"
        >
          <div className="mx-auto h-full w-full max-w-[414px] px-4 pt-12" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-full bg-white p-2.5 shadow-sm transition hover:bg-gray-50"
                aria-label="닫기"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSearchSubmit(e);
                  }}
                  autoFocus
                  type="text"
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[12px] font-semibold text-gray-500">
                {String(query || '').trim() ? '추천 결과' : '지도에 보이는 장소'}
              </div>
              <div className="mt-2 max-h-[calc(100dvh-140px)] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                {remoteSuggestLoading ? (
                  <div className="px-4 py-4 text-sm text-gray-500">검색 중…</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-gray-500">검색 결과가 없어요</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {searchResults.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => selectSearchResult(it)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900">{it.label}</div>
                          {it.kind === 'kakao' ? (
                            <div className="mt-0.5 truncate text-[12px] text-gray-500">{it.address || ''}</div>
                          ) : (
                            <div className="mt-0.5 text-[12px] text-gray-500">추천 장소</div>
                          )}
                        </div>
                        <div className="shrink-0 text-[12px] font-semibold" style={{ color: PRIMARY_DARK }}>
                          이동
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!sdkStatus.ok && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/70 px-6 text-center">
          <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-md">
            <p className="text-sm font-bold text-gray-900">{t.mapLoadFailedTitle}</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">{sdkStatus.message || t.loadingSdk}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{t.mapLoadFailedHint}</p>
          </div>
        </div>
      )}

      {/* 상단은 뿌연(그라데이션/블러) 효과 없이 투명 처리 */}
      <div className="absolute top-0 z-10 w-full p-4 pt-12">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-white p-2.5 shadow-sm transition hover:bg-gray-50"
            onClick={() => navigate(-1)}
            aria-label={t.back}
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>

          <form className="relative flex-1" onSubmit={onSearchSubmit}>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              onFocus={() => setSearchOpen(true)}
              type="text"
              placeholder={t.searchPlaceholder}
              className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>

          <button
            type="button"
            className="rounded-full bg-white p-2.5 shadow-sm transition hover:bg-gray-50"
            onClick={() => void refreshPosts()}
            aria-label={t.refresh}
          >
            <RefreshCw className={`h-5 w-5 text-gray-700 ${loadingPosts ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div
          onMouseDown={filterScroll.handleDragStart}
          className="flex cursor-grab gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] scrollbar-hide active:cursor-grabbing snap-x snap-mandatory"
        >
          <button
            type="button"
            onClick={() => navigate('/map/ask-situation')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-sm font-semibold shadow-sm whitespace-nowrap"
            style={{
              borderColor: PRIMARY_HEX,
              background: PRIMARY_HEX,
              color: '#ffffff',
            }}
          >
            {msIcon('help', { color: '#ffffff' })}
            <span>{t.situationCta}</span>
          </button>
          <button
            type="button"
            className={chipClass(selectedFilters.includes('bloom'))}
            style={chipStyle(selectedFilters.includes('bloom'))}
            onClick={() => toggleFilter('bloom')}
          >
            {msIcon('local_florist', { color: iconColorForFilter('bloom', selectedFilters.includes('bloom')) })}
            <span>{t.chipBloom}</span>
          </button>
          <button
            type="button"
            className={chipClass(selectedFilters.includes('places'))}
            style={chipStyle(selectedFilters.includes('places'))}
            onClick={() => toggleFilter('places')}
          >
            {msIcon('place', { color: iconColorForFilter('places', selectedFilters.includes('places')) })}
            <span>{t.chipPlaces}</span>
          </button>
        </div>
      </div>

      {/* 컨트롤 버튼: 하단 시트 바로 우측 위 */}
      <div
        className={`absolute right-4 z-20 ${
          sheetMode === 'hidden'
            ? 'bottom-24'
            : sheetMode === 'expanded'
              ? 'top-[148px]'
              : 'bottom-[calc(32vh+12px)]'
        }`}
      >
        <button
          type="button"
          className="rounded-full bg-white p-3 text-primary shadow-md ring-1 ring-primary/20 transition hover:bg-primary-soft"
          onClick={onMyLocation}
          aria-label={t.myLocation}
        >
          <LocateFixed className="h-6 w-6" />
        </button>
      </div>

      {sheetMode === 'hidden' && (
        <div className="absolute bottom-3 left-0 right-0 z-[25] flex justify-center px-4">
          <button
            type="button"
            onClick={() => setSheetMode('peek')}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30"
          >
            {t.showPhotosAgain}
          </button>
        </div>
      )}

      {/* 핀 클릭 시 간략 정보 카드 */}
      {selectedPostCard && (
        <div className="absolute bottom-3 left-0 right-0 z-[30] px-4">
          <div className="mx-auto flex w-full max-w-[414px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-lg">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[4px] bg-gray-100 ring-1 ring-gray-200/80">
              {(() => {
                const thumb = getDisplayImageUrl(
                  selectedPostCard.thumbnail || (Array.isArray(selectedPostCard.images) ? selectedPostCard.images[0] : ''),
                );
                return thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null;
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-gray-900">
                {String(selectedPostCard.placeName || selectedPostCard.location || selectedPostCard.region || '장소').trim()}
              </div>
              <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                {String(selectedPostCard.note || selectedPostCard.content || '').trim()}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPostCard(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goPostDetail(selectedPostCard)}
                className="rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark"
              >
                상세보기
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 z-20 flex max-w-[414px] flex-col rounded-t-3xl bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out ${
          sheetMode === 'hidden' ? 'pointer-events-none translate-y-full' : 'translate-y-0'
        } ${sheetHeightClass}`}
      >
        <button
          type="button"
          className="flex w-full shrink-0 cursor-grab touch-none justify-center pt-3 pb-2 active:cursor-grabbing"
          aria-label={t.sheetToggle}
          onPointerDown={onSheetPointerDown}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
        >
          <span className="h-1.5 w-12 rounded-full bg-gray-300" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 sm:px-4">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-0.5">
            <h2 className="text-base font-bold text-gray-900">{t.nearbyTitle}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">{t.postsSummary(sheetStripPosts.length, postsFiltered.length)}</span>
            </div>
          </div>

          {sheetMode === 'expanded' ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs text-gray-500">{t.postsSummary(sheetPhotoPosts.length, postsFiltered.length)}</div>
                <button
                  type="button"
                  onClick={() => setSheetMode('peek')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
                >
                  <X className="h-4 w-4" />
                  <span>{t.close}</span>
                </button>
              </div>
              {sheetPhotoPosts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-10 text-gray-400">
                  <p className="text-sm font-medium">{loadingPosts ? t.emptyLoading : t.emptyNone}</p>
                  <p className="mt-2 max-w-sm px-2 text-center text-xs text-gray-400">{t.emptyHint}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {sheetPhotoPosts.map((p) => {
                    const thumb = getDisplayImageUrl(p.thumbnail || (Array.isArray(p.images) ? p.images[0] : ''));
                    const label = String(p.placeName || p.location || p.region || '').trim();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => panToPost(p)}
                        className="flex w-[104px] shrink-0 flex-col gap-1"
                      >
                        <div className="aspect-square overflow-hidden bg-gray-100 ring-1 ring-gray-200/80" style={{ borderRadius: 3 }}>
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary-10 text-primary">·</div>
                          )}
                        </div>
                        <div className="truncate text-[11px] font-medium leading-tight text-gray-500">{label}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              {sheetStripPosts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-6 text-gray-400">
                  <p className="text-sm font-medium">{loadingPosts ? t.emptyLoading : t.emptyNone}</p>
                  <p className="mt-2 max-w-sm px-2 text-center text-xs text-gray-400">{t.emptyHint}</p>
                </div>
              ) : (
                <div
                  onMouseDown={photoScroll.handleDragStart}
                  className="flex cursor-grab gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide active:cursor-grabbing snap-x"
                >
                  {sheetStripPosts.map((p) => {
                    const thumb = getDisplayImageUrl(p.thumbnail || (Array.isArray(p.images) ? p.images[0] : ''));
                    const label = String(p.placeName || p.location || p.region || '').trim();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => panToPost(p)}
                        className="flex w-[104px] shrink-0 snap-start flex-col gap-1"
                      >
                        <div className="h-[104px] w-[104px] overflow-hidden bg-gray-100 ring-1 ring-gray-200/80" style={{ borderRadius: 3 }}>
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary-10 text-primary">·</div>
                          )}
                        </div>
                        <div className="truncate text-[11px] font-medium text-gray-500">{label}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapScreen;

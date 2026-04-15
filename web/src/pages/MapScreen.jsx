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
  chipFood: '\ub9db\uc9d1\uc815\ubcf4',
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
    '\ud544\ud130\ub97c \ubc14\uafb8\uac70\ub098 \uc9c0\ub3c4\ub97c \uc62e\uaca8 \ubcf4\uc138\uc694. \uac1c\ud654/\ub9db\uc9d1/\uba85\uc18c\ub294 \uae0d\uc81c/\ub0b4\uc6a9\uc5d0 \uad00\ub828 \ud0a4\uc6cc\ub4dc\uac00 \uc788\uc73c\uba74 \uac80\uc0c9\ub429\ub2c8\ub2e4.',
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

const extractCoordsFromPost = (post) => {
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

/**
 * @param {'bloom'|'food'|'places'} chip
 */
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
  const matchFood = () =>
    [
      '\ub9db\uc9d1',
      '\uc74c\uc2dd',
      '\uc2dd\ub2f9',
      '\uce74\ud398',
      '\ub808\uc2a4\ud1a0\ub791',
      'food',
      '\uba39',
      '\ub514\uc800\ud2b8',
      '\ube0c\ub7f0\uce58',
      'cafe',
      'restaurant',
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
    if (f === 'food') return matchFood();
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
    ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary bg-white px-3.5 py-2 text-sm font-semibold text-primary shadow-sm whitespace-nowrap'
    : 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-white px-3.5 py-2 text-sm font-medium text-gray-600 shadow-sm whitespace-nowrap';

const msIcon = (name) => (
  <span className="material-symbols-outlined text-[18px] leading-none" style={{ fontVariationSettings: "'wght' 300" }}>
    {name}
  </span>
);

const MapScreen = () => {
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const postOverlaysRef = useRef([]);
  const userOverlayRef = useRef(null);
  const idleListenerRef = useRef(null);
  const sheetDragRef = useRef(null);
  const rafSyncRef = useRef(0);

  /** expanded: 큰 시트 | peek: 미리보기 | hidden: 내려감 */
  const [sheetMode, setSheetMode] = useState('peek');
  const [sdkStatus, setSdkStatus] = useState({ ok: false, message: '' });
  const [query, setQuery] = useState('');
  const [selectedPostCard, setSelectedPostCard] = useState(null);

  const [userPos, setUserPos] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapBounds, setMapBounds] = useState(null);
  const [viewCenter, setViewCenter] = useState(DEFAULT_CENTER);

  const [posts, setPosts] = useState([]);
  const [postsWithCoords, setPostsWithCoords] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [selectedFilters, setSelectedFilters] = useState(['bloom']);
  const geoCache = useMemo(() => readGeoCache(), []);

  const filterScroll = useHorizontalDragScroll();
  const photoScroll = useHorizontalDragScroll();

  const resolveCoordsForPost = useCallback(
    async (post) => {
      const direct = extractCoordsFromPost(post);
      if (direct) return direct;

      const qRaw = buildGeoQuery(post);
      const q = String(qRaw || '').trim();
      if (!q) return null;

      const cached = geoCache.get(q);
      if (cached !== undefined) return cached;

      const regionCoord = getCoordinatesByLocation(post?.region || post?.location || '');
      if (regionCoord) {
        geoCache.set(q, regionCoord);
        return regionCoord;
      }

      await ensureKakaoMapsReady();
      const found = await searchPlaceWithKakaoFirst(q);
      const coord =
        found && Number.isFinite(found.lat) && Number.isFinite(found.lng) ? { lat: found.lat, lng: found.lng } : null;
      geoCache.set(q, coord);
      return coord;
    },
    [geoCache],
  );

  const refreshPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const local = getUploadedPostsSafe();
      const remote = await fetchPostsSupabase();
      const merged = mergePostsUnique([getCombinedPosts(local), remote]);

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

  const openPostCard = useCallback(
    (post) => {
      if (!post) return;
      setSelectedPostCard(post);
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
      postOverlaysRef.current.forEach((ov) => ov.setMap(null));
      postOverlaysRef.current = [];

      const kakao = window.kakao;

      postsInViewport.forEach((p) => {
        const pos = p?.__coords;
        if (!pos) return;

        const thumbRaw = p.thumbnail || (Array.isArray(p.images) ? p.images[0] : '');
        const thumb = escapeHtmlAttr(getDisplayImageUrl(thumbRaw));

        const wrap = document.createElement('div');
        wrap.innerHTML = `
          <div class="lj-map-post-pin" style="width:52px;height:52px;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer;border:1px solid rgba(255,255,255,.95);background:#f3f4f6;">
            ${
              thumb
                ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;"/>`
                : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#e0f7fa,#b2ebf2);"></div>`
            }
          </div>`;
        const el = wrap.firstElementChild;
        if (!el) return;

        el.addEventListener('click', () => {
          openPostCard(p);
        });

        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(pos.lat, pos.lng),
          content: el,
          // 좌표에 더 정확히 맞게: 하단 중앙을 기준으로 앵커링
          yAnchor: 1,
          xAnchor: 0.5,
          zIndex: 3,
        });
        overlay.setMap(map);
        postOverlaysRef.current.push(overlay);
      });
    } catch (e) {
      logger.warn(t.warnOverlays, e?.message || e);
    }
  }, [openPostCard, postsInViewport]);

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
          setMapCenter({ lat: found.lat, lng: found.lng });
          return;
        }
        const fallback = getCoordinatesByLocation(q);
        if (fallback) setMapCenter(fallback);
      } catch (err) {
        logger.warn(t.warnSearch, err?.message || err);
      }
    },
    [query],
  );

  const onMyLocation = useCallback(() => {
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

  // peek(기본)에서 사진이 바로 보이도록 조금 더 크게
  const sheetHeightClass = sheetMode === 'expanded' ? 'h-[100dvh]' : 'h-[32vh]';

  return (
    <div className="relative w-full h-[100dvh] bg-gray-100 overflow-hidden font-sans">
      <div ref={mapRef} className="absolute inset-0 z-0" />

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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-900 shadow-sm whitespace-nowrap"
          >
            {msIcon('help')}
            <span>{t.situationCta}</span>
          </button>
          <button type="button" className={chipClass(selectedFilters.includes('bloom'))} onClick={() => toggleFilter('bloom')}>
            {msIcon('local_florist')}
            <span>{t.chipBloom}</span>
          </button>
          <button type="button" className={chipClass(selectedFilters.includes('food'))} onClick={() => toggleFilter('food')}>
            {msIcon('restaurant')}
            <span>{t.chipFood}</span>
          </button>
          <button type="button" className={chipClass(selectedFilters.includes('places'))} onClick={() => toggleFilter('places')}>
            {msIcon('place')}
            <span>{t.chipPlaces}</span>
          </button>
        </div>
      </div>

      {/* 컨트롤 버튼: 사진처럼 우측 중단(시트 위) */}
      <div className="absolute right-4 top-[214px] z-20">
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

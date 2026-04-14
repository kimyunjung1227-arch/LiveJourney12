import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, Navigation, LocateFixed } from 'lucide-react';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import { getCombinedPosts } from '../utils/mockData';
import { getCoordinatesByLocation } from '../utils/locationCoordinates';
import { searchPlaceWithKakaoFirst } from '../utils/kakaoPlacesGeocode';
import { logger } from '../utils/logger';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

const GEO_CACHE_KEY = '__lj_map_geo_cache_v3';

// NOTE: Non-ASCII UI strings are written as \u escapes to avoid encoding corruption in patches.
const t = {
  errMissingKey:
    'VITE_KAKAO_MAP_API_KEY\uac00 \ube44\uc5b4\uc788\uc2b5\ub2c8\ub2e4. web/.env\uc5d0 \uc124\uc815\ud574 \uc8fc\uc138\uc694.',
  errSdkLoad: 'Kakao Maps SDK \uc2a4\ud06c\ub9bd\ud2b8 \ub85c\ub4dc\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.',
  errSdkInit: 'Kakao Maps SDK\uac00 \ucd08\uae30\ud654\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.',
  warnMapInit: '\uc9c0\ub3c4 \ucd08\uae30\ud654 \uc2e4\ud328',
  warnMarkers: '\ub9c8\ucee4 \uac31\uc2e0 \uc2e4\ud328',
  warnUserMarker: '\ub0b4 \uc704\uce58 \ud45c\uc2dc \uc2e4\ud328',
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
  chipSituation: '\uc9c0\uae08 \uc0c1\ud669 \uc54c\uc544\ubcf4\uae30',
  chipBloom: '\U0001F338 \uac1c\ud654\uc815\ubcf4',
  chipFood: '\U0001F35C \ub9db\uc9d1\uc815\ubcf4',
  chipSoon:
    '\uc774 \ud544\ud130\ub294 \ud604\uc7ac UI\ub9cc \uc900\ube44\ub418\uc5b4 \uc788\uc5b4\uc694. \ub370\uc774\ud130 \uc18c\uc2a4\ub97c \uc5f0\uacb0\ud558\uba74 \ud544\ud130\ub9c1\uc744 \uc801\uc6a9\ud560 \uc218 \uc788\uc5b4\uc694.',
  route: '\uacbd\ub85c \ub9cc\ub4e4\uae30',
  myLocation: '\ub0b4 \uc704\uce58',
  sheetToggle: '\ubc14\ud2f7\uc2dc\ud2b8 \ud655\uc7a5/\ucd95\uc18c',
  nearbyTitle: '\uc8fc\ubcc0 \uc7a5\uc18c',
  postsSummary: (all, mapped) =>
    `\uac8c\uc2dc\ubb3c ${all.toLocaleString()} \xb7 \uc9c0\ub3c4\ud45c\uc2dc ${mapped.toLocaleString()}`,
  emptyLoading: '\uac8c\uc2dc\ubb3c\uc744 \ubd88\ub7ec\uc624\ub294 \uc911...',
  emptyNone: '\ud45c\uc2dc\ud560 \uc7a5\uc18c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4',
  emptyHint:
    '\uc5c5\ub85c\ub4dc \uac8c\uc2dc\ubb3c\uc5d0 \uc704\uce58/\uc7a5\uc18c\uba85\uc774 \uc788\uc73c\uba74 \uc790\ub3d9\uc73c\ub85c \ud540\uc744 \ud45c\uc2dc\ud569\ub2c8\ub2e4.',
  noContent: '\ub0b4\uc6a9 \uc5c6\uc74c',
  placeFallback: '\uc7a5\uc18c',
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

const chipClass = (active) =>
  active
    ? 'px-4 py-2 bg-white text-sky-500 font-semibold text-sm rounded-full shadow-sm border border-sky-100 whitespace-nowrap'
    : 'px-4 py-2 bg-white text-gray-600 text-sm rounded-full shadow-sm whitespace-nowrap';

const MapScreen = () => {
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const kakaoMapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);

  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [sdkStatus, setSdkStatus] = useState({ ok: false, message: '' });
  const [query, setQuery] = useState('');

  const [userPos, setUserPos] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  const [posts, setPosts] = useState([]);
  const [postsWithCoords, setPostsWithCoords] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [activeChip, setActiveChip] = useState('situation'); // situation | bloom | food
  const geoCache = useMemo(() => readGeoCache(), []);

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

      const MAX_ENRICH = 80;
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
      } catch (e) {
        logger.warn(t.warnMapInit, e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
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
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const kakao = window.kakao;

      postsWithCoords.forEach((p) => {
        const pos = p?.__coords;
        if (!pos) return;

        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(pos.lat, pos.lng),
          map,
        });

        kakao.maps.event.addListener(marker, 'click', () => {
          navigate(`/post/${encodeURIComponent(String(p.id))}`, { state: { post: p } });
        });

        markersRef.current.push(marker);
      });
    } catch (e) {
      logger.warn(t.warnMarkers, e?.message || e);
    }
  }, [navigate, postsWithCoords]);

  useEffect(() => {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps) return;

    try {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      if (!userPos) return;

      const kakao = window.kakao;
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(userPos.lat, userPos.lng),
        map,
      });
      userMarkerRef.current = marker;
    } catch (e) {
      logger.warn(t.warnUserMarker, e?.message || e);
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

  const nearbyPosts = useMemo(() => {
    const center = userPos || mapCenter;
    const withDist = postsWithCoords
      .map((p) => ({
        post: p,
        km: haversineKm(center, p.__coords),
      }))
      .filter((x) => Number.isFinite(x.km))
      .sort((a, b) => a.km - b.km);
    return withDist.slice(0, 30).map((x) => x.post);
  }, [mapCenter, postsWithCoords, userPos]);

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

      <div className="absolute top-0 z-10 w-full bg-gradient-to-b from-white/90 to-transparent p-4 pt-12">
        <div className="mb-4 flex items-center gap-3">
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
              className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500"
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

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button type="button" className={chipClass(activeChip === 'situation')} onClick={() => setActiveChip('situation')}>
            {t.chipSituation}
          </button>
          <button type="button" className={chipClass(activeChip === 'bloom')} onClick={() => setActiveChip('bloom')}>
            {t.chipBloom}
          </button>
          <button type="button" className={chipClass(activeChip === 'food')} onClick={() => setActiveChip('food')}>
            {t.chipFood}
          </button>
        </div>
      </div>

      <div
        className={`absolute z-10 flex w-full items-end justify-between px-4 transition-all duration-300 ease-in-out ${
          isSheetExpanded ? 'bottom-[65%]' : 'bottom-[25%]'
        }`}
      >
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-md transition hover:bg-gray-50"
          onClick={() => {
            const target = userPos || mapCenter;
            const url = `https://map.kakao.com/link/map/${target.lat},${target.lng}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          <Navigation className="h-4 w-4" />
          {t.route}
        </button>

        <button
          type="button"
          className="rounded-full bg-white p-3.5 text-sky-500 shadow-md transition hover:bg-gray-50"
          onClick={onMyLocation}
          aria-label={t.myLocation}
        >
          <LocateFixed className="h-6 w-6" />
        </button>
      </div>

      <div
        className={`absolute bottom-0 z-20 flex w-full flex-col rounded-t-3xl bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out ${
          isSheetExpanded ? 'h-[60%]' : 'h-[22%]'
        }`}
      >
        <button
          type="button"
          className="flex w-full cursor-pointer justify-center pt-4 pb-3"
          onClick={() => setIsSheetExpanded((v) => !v)}
          aria-label={t.sheetToggle}
        >
          <span className="h-1.5 w-12 rounded-full bg-gray-300" />
        </button>

        <div className="flex flex-1 flex-col overflow-hidden px-6 py-2">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900">{t.nearbyTitle}</h2>
            <div className="text-[11px] text-gray-400">{t.postsSummary(posts.length, postsWithCoords.length)}</div>
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            {activeChip !== 'situation' && (
              <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">{t.chipSoon}</div>
            )}

            {nearbyPosts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center pb-10 text-gray-400">
                <p className="text-sm font-medium">{loadingPosts ? t.emptyLoading : t.emptyNone}</p>
                <p className="mt-2 max-w-sm text-center text-xs text-gray-400">{t.emptyHint}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {nearbyPosts.map((p) => {
                  const title = String(p.placeName || p.location || p.region || t.placeFallback).trim();
                  const body = String(p.note || p.content || '').trim();
                  const thumb = getDisplayImageUrl(p.thumbnail || (Array.isArray(p.images) ? p.images[0] : ''));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/post/${encodeURIComponent(String(p.id))}`, { state: { post: p } })}
                      className="flex w-full gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:bg-gray-50"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-gray-900">{title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-gray-600">{body || t.noContent}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;

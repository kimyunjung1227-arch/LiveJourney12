import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createPostSupabase, mapSupabasePostRowToPost } from '../api/postsSupabase';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'mapSituationQuestions_v1';

/** 지도 클릭 시 주변에서 찾을 카테고리(카카오 로컬). 타일에 자주 보이는 유형 위주로 소수만 병렬 요청 */
const NEARBY_CATEGORY_CODES = ['FD6', 'CE7', 'AT4', 'MT1', 'CS2', 'BK9', 'PO3', 'AD5', 'CT1', 'SC4', 'OL7', 'HP8'];

/** 클릭 지점에서 이 거리(미터) 안의 검색된 장소만 선택으로 인정 */
const MAX_PICK_DISTANCE_M = 90;

const getKakaoAppKey = () => String(import.meta.env.VITE_KAKAO_MAP_API_KEY || '').trim();

const SUGGEST_DEBOUNCE_MS = 220;
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_LIMIT = 8;

const loadKakaoSdkOnce = (appKey) =>
  new Promise((resolve, reject) => {
    const key = String(appKey || '').trim();
    if (!key) {
      reject(new Error('VITE_KAKAO_MAP_API_KEY가 비어있습니다. web/.env에 설정해 주세요.'));
      return;
    }

    if (window.kakao?.maps) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-kakao-maps-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Kakao Maps SDK 로드 실패')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.kakaoMapsSdk = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kakao Maps SDK 로드 실패'));
    document.head.appendChild(script);
  });

const ensureKakaoMapsReady = async () => {
  const key = getKakaoAppKey();
  await loadKakaoSdkOnce(key);
  await new Promise((resolve, reject) => {
    try {
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao Maps SDK 초기화 실패'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    } catch (e) {
      reject(e);
    }
  });
};

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export default function MapAskSituationScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const pickOverlayRef = useRef(null);
  const mapClickListenerRef = useRef(null);
  const suggestTimerRef = useRef(0);
  const suggestReqIdRef = useRef(0);

  const [sdkError, setSdkError] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(null); // { lat, lng, name? }
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState([]); // { key, label, address?, lat, lng }
  const [geoStatus, setGeoStatus] = useState({ tried: false, ok: false });

  const pickedLabel = useMemo(() => {
    if (!picked) return '';
    if (picked.name && String(picked.name).trim()) return String(picked.name).trim();
    return `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`;
  }, [picked]);

  /** 지도/검색으로 선택한 위치를 위치 입력창에도 동일하게 표시 */
  useEffect(() => {
    if (!picked) return;
    setLocationQuery(pickedLabel);
    setSuggestOpen(false);
  }, [picked, pickedLabel]);

  const submit = async () => {
    const q = text.trim();
    if (!q) return;
    if (!user?.id) {
      alert('로그인이 필요합니다. 로그인 후 다시 시도해 주세요.');
      return;
    }
    if (!picked || !Number.isFinite(Number(picked.lat)) || !Number.isFinite(Number(picked.lng))) {
      alert('위치를 먼저 선택해 주세요. (검색 또는 지도 선택)');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const uid = String(user.id).trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);
      const userIdForDb = isUuid ? uid : null;
      const locationLabel = String(pickedLabel || locationQuery || '').trim() || '현장 질문';
      const region = locationLabel.split(/\s+/)[0] || '기타';

      const res = await createPostSupabase({
        userId: userIdForDb,
        user:
          userIdForDb && user && typeof user === 'object'
            ? { id: userIdForDb, username: user.username || user.email?.split('@')?.[0] || '유저', profileImage: user.profileImage || user.avatar_url || null }
            : { username: user?.username || user?.email?.split('@')?.[0] || '유저' },
        note: q,
        content: q,
        images: [],
        videos: [],
        location: locationLabel,
        detailedLocation: locationLabel,
        placeName: locationLabel,
        region,
        tags: ['질문', region].filter(Boolean),
        category: 'question',
        categoryName: '현장 질문',
        likes: 0,
        comments: [],
        coordinates: { lat: Number(picked.lat), lng: Number(picked.lng) },
        // 지도 핀 좌표는 exif_data.map_pin으로도 저장되어 MapScreen에서 우선 사용
        exifData: { map_pin: { lat: Number(picked.lat), lng: Number(picked.lng) } },
        photoDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      if (!res?.success || !res?.post) {
        alert('등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      const uploadedPost = mapSupabasePostRowToPost(res.post);
      logger.log('✅ 현장 질문 등록 완료:', uploadedPost?.id);
      alert('질문이 등록됐어요!');
      if (uploadedPost?.id) {
        navigate(`/ask-situation/${uploadedPost.id}`, { state: { post: uploadedPost } });
      } else {
        navigate(-1);
      }
    } catch (e) {
      alert('등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  /** zoomLevel: 숫자가 작을수록 확대(카카오맵 기본 1~14). 검색 이동 시에만 넘기면 됨 */
  const setPickOverlayAt = useCallback((lat, lng, zoomLevel) => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    const kakao = window.kakao;
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!pickOverlayRef.current) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="lj-map-user-wrap" style="position:relative;width:68px;height:68px;pointer-events:none;">
          <div class="lj-map-user-pulse"></div>
          <div class="lj-map-user-dot"></div>
        </div>`;
      const el = wrap.firstElementChild;
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 10,
      });
      overlay.setMap(map);
      pickOverlayRef.current = overlay;
    } else {
      pickOverlayRef.current.setPosition(pos);
    }
    if (Number.isFinite(zoomLevel)) {
      map.setLevel(zoomLevel);
    }
    map.panTo(pos);
  }, []);

  const centerToMyLocation = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        const map = mapRef.current;
        if (!navigator?.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              resolve(null);
              return;
            }
            try {
              if (map && window.kakao?.maps) {
                const kakao = window.kakao;
                const p = new kakao.maps.LatLng(lat, lng);
                map.setCenter(p);
              }
            } catch {
              /* ignore */
            }
            resolve({ lat, lng });
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000, ...opts },
        );
      }),
    [],
  );

  const clearPickOverlay = useCallback(() => {
    if (pickOverlayRef.current) {
      try {
        pickOverlayRef.current.setMap(null);
      } catch {
        /* ignore */
      }
      pickOverlayRef.current = null;
    }
  }, []);

  /**
   * 타일 라벨 클릭 이벤트는 웹 API에 없음 → 클릭 좌표 주변 카테고리 검색으로
   * 지도에 표시된 것과 같은(근접한) 등록 장소만 선택.
   */
  const findNearestRegisteredPlace = useCallback(async (lat, lng) => {
    if (!window.kakao?.maps?.services) return null;
    const kakao = window.kakao;
    const loc = new kakao.maps.LatLng(lat, lng);
    const sort = kakao.maps.services.SortBy.DISTANCE;

    const chunk = await Promise.all(
      NEARBY_CATEGORY_CODES.map(
        (code) =>
          new Promise((resolve) => {
            try {
              const places = new kakao.maps.services.Places();
              places.categorySearch(
                code,
                (data, status) => {
                  if (status === kakao.maps.services.Status.OK && Array.isArray(data) && data.length > 0) {
                    resolve(data);
                  } else {
                    resolve([]);
                  }
                },
                { location: loc, radius: MAX_PICK_DISTANCE_M, sort },
              );
            } catch {
              resolve([]);
            }
          }),
      ),
    );

    const seen = new Set();
    const merged = [];
    for (const arr of chunk) {
      for (const p of arr) {
        const id = p.id || `${p.x}|${p.y}|${p.place_name}`;
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push(p);
      }
    }
    if (merged.length === 0) return null;

    let best = null;
    let bestD = Infinity;
    for (const p of merged) {
      const plat = Number(p.y);
      const plng = Number(p.x);
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      const dFromApi = p.distance != null && p.distance !== '' ? Number(p.distance) : NaN;
      const d = Number.isFinite(dFromApi) ? dFromApi : haversineM(lat, lng, plat, plng);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best || bestD > MAX_PICK_DISTANCE_M) return null;
    return {
      lat: Number(best.y),
      lng: Number(best.x),
      name: best.place_name || best.address_name || null,
    };
  }, []);

  /** 검색: 항상 첫 결과 위치로 이동·선택 (지도선택 모드와 무관) */
  const keywordSearch = useCallback(
    async (q) => {
      const query = String(q || '').trim();
      if (!query) return;
      if (!window.kakao?.maps?.services) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(query, (data, status) => {
          if (status !== window.kakao.maps.services.Status.OK || !data || data.length === 0) return;

          const first = data[0];
          const lat = Number(first.y);
          const lng = Number(first.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setPickOverlayAt(lat, lng, 3);
          setPicked({ lat, lng, name: first.place_name || first.address_name || query });
        });
      } catch {
        /* ignore */
      }
    },
    [setPickOverlayAt],
  );

  const runSuggest = useCallback(
    async (q) => {
      const query = String(q || '').trim();
      if (!query || query.length < SUGGEST_MIN_CHARS) {
        setSuggestItems([]);
        setSuggestLoading(false);
        return;
      }
      if (!window.kakao?.maps?.services) return;

      const reqId = (suggestReqIdRef.current += 1);
      setSuggestLoading(true);

      try {
        const places = new window.kakao.maps.services.Places();
        places.keywordSearch(
          query,
          (data, status) => {
            if (reqId !== suggestReqIdRef.current) return;
            setSuggestLoading(false);
            if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data) || data.length === 0) {
              setSuggestItems([]);
              return;
            }
            const out = [];
            for (const it of data.slice(0, SUGGEST_LIMIT)) {
              const lat = Number(it.y);
              const lng = Number(it.x);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
              const label = String(it.place_name || it.address_name || '').trim() || query;
              out.push({
                key: String(it.id || `${lng}|${lat}|${label}`),
                label,
                address: String(it.road_address_name || it.address_name || '').trim(),
                lat,
                lng,
              });
            }
            setSuggestItems(out);
          },
          { size: SUGGEST_LIMIT },
        );
      } catch {
        if (reqId !== suggestReqIdRef.current) return;
        setSuggestLoading(false);
        setSuggestItems([]);
      }
    },
    [setSuggestItems],
  );

  const scheduleSuggest = useCallback(
    (q) => {
      if (suggestTimerRef.current) window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = window.setTimeout(() => {
        void runSuggest(q);
      }, SUGGEST_DEBOUNCE_MS);
    },
    [runSuggest],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureKakaoMapsReady();
        if (cancelled) return;
        const el = mapElRef.current;
        if (!el) return;
        const kakao = window.kakao;
        const map = new kakao.maps.Map(el, {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 6,
        });
        mapRef.current = map;
        // 지도선택 UX: 시작은 GPS 중심이 더 자연스러움(권한 거부 시 서울 기본 유지)
        const loc = await centerToMyLocation();
        setGeoStatus({ tried: true, ok: Boolean(loc) });
      } catch (e) {
        if (cancelled) return;
        setSdkError(e?.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, [centerToMyLocation]);

  /** 지도선택 모드: 지도에 보이는 장소(등록 POI) 근처만 탭으로 지정 — 빈 땅은 무시 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps?.event) return;
    const kakao = window.kakao;

    if (mapClickListenerRef.current) {
      try {
        kakao.maps.event.removeListener(map, 'click', mapClickListenerRef.current);
      } catch {
        /* ignore */
      }
      mapClickListenerRef.current = null;
    }

    if (!picking) return;

    const onMapClick = async (mouseEvent) => {
      try {
        const latlng = mouseEvent.latLng;
        const lat = latlng.getLat();
        const lng = latlng.getLng();
        const place = await findNearestRegisteredPlace(lat, lng);
        if (!place) return;
        setPickOverlayAt(place.lat, place.lng, 3);
        setPicked({ lat: place.lat, lng: place.lng, name: place.name });
      } catch {
        /* ignore */
      }
    };

    mapClickListenerRef.current = onMapClick;
    kakao.maps.event.addListener(map, 'click', onMapClick);

    return () => {
      if (!mapClickListenerRef.current) return;
      try {
        kakao.maps.event.removeListener(map, 'click', mapClickListenerRef.current);
      } catch {
        /* ignore */
      }
      mapClickListenerRef.current = null;
    };
  }, [findNearestRegisteredPlace, picking, setPickOverlayAt]);

  useEffect(() => {
    return () => {
      clearPickOverlay();
      if (suggestTimerRef.current) window.clearTimeout(suggestTimerRef.current);
    };
  }, [clearPickOverlay]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 pt-12">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
        <h1 className="text-base font-bold text-gray-900">현장 상황 물어보기</h1>
      </header>
      <div className="flex flex-1 flex-col px-4 py-4">
        <p className="mb-3 text-sm leading-relaxed text-gray-600">
          위치를 선택하고, 그곳의 날씨·혼잡도·분위기 등 궁금한 점을 물어보세요.
        </p>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={locationQuery}
              onChange={(e) => {
                const v = e.target.value;
                setLocationQuery(v);
                setSuggestOpen(true);
                scheduleSuggest(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void keywordSearch(locationQuery);
                }
              }}
              onFocus={() => {
                setSuggestOpen(true);
                scheduleSuggest(locationQuery);
              }}
              placeholder="위치 입력 (예: 여의도 한강공원)"
              className="w-full rounded-full border border-gray-200 bg-white py-3 pl-4 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />

            {suggestOpen && (String(locationQuery || '').trim().length >= SUGGEST_MIN_CHARS || suggestLoading) ? (
              <div
                className="absolute left-0 right-0 top-[52px] z-[60] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
                onMouseDown={(e) => e.preventDefault()}
                role="listbox"
                aria-label="위치 자동 추천"
              >
                {suggestLoading ? (
                  <div className="px-4 py-3 text-[12px] text-gray-500">추천 검색 중…</div>
                ) : suggestItems.length === 0 ? (
                  <div className="px-4 py-3 text-[12px] text-gray-500">추천 결과가 없어요</div>
                ) : (
                  <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-100">
                    {suggestItems.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-gray-50"
                        onClick={() => {
                          setPickOverlayAt(it.lat, it.lng, 3);
                          setPicked({ lat: it.lat, lng: it.lng, name: it.label });
                          setSuggestOpen(false);
                        }}
                      >
                        <div className="truncate text-sm font-semibold text-gray-900">{it.label}</div>
                        {it.address ? <div className="mt-0.5 truncate text-[12px] text-gray-500">{it.address}</div> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setPicking((v) => !v);
              // 지도 선택하기를 켜는 순간에는 GPS 중심으로 시작하는 게 UX상 가장 자연스러움
              if (!picking) {
                void centerToMyLocation();
                setGeoStatus((s) => ({ tried: true, ok: s.ok || false }));
              }
            }}
            className={`rounded-full border px-3.5 py-3 text-sm font-semibold shadow-sm ${
              picking ? 'border-primary bg-primary-10 text-primary' : 'border-gray-200 bg-white text-gray-900'
            }`}
            aria-label="지도선택하기"
            title="지도선택하기"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'wght' 300" }}
            >
              map
            </span>
          </button>
        </div>

        <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
          {sdkError ? (
            <div className="px-3 py-2 text-[11px] text-red-600">{`지도 로드 실패: ${sdkError}`}</div>
          ) : null}
          {!sdkError && geoStatus.tried && !geoStatus.ok ? (
            <div className="px-3 py-2 text-[11px] text-gray-500">내 위치 권한이 없어서 서울 기준으로 시작했어요.</div>
          ) : null}
          <div ref={mapElRef} className="h-[220px] w-full" />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="궁금한 내용을 입력해 주세요. (예: 지금 벚꽃 많이 폈나요? 줄이 길까요?)"
          className="min-h-[160px] w-full resize-none rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || submitting}
          className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-40"
        >
          {submitting ? '등록 중…' : '질문 등록하기'}
        </button>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'mapSituationQuestions_v1';

const getKakaoAppKey = () => String(import.meta.env.VITE_KAKAO_MAP_API_KEY || '').trim();

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

export default function MapAskSituationScreen() {
  const navigate = useNavigate();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const pickOverlayRef = useRef(null);
  const placeMarkersRef = useRef([]);

  const [sdkError, setSdkError] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(null); // { lat, lng, name? }
  const [text, setText] = useState('');

  const pickedLabel = useMemo(() => {
    if (!picked) return '';
    if (picked.name && String(picked.name).trim()) return String(picked.name).trim();
    return `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`;
  }, [picked]);

  /** 지도/검색으로 선택한 위치를 위치 입력창에도 동일하게 표시 */
  useEffect(() => {
    if (!picked) return;
    setLocationQuery(pickedLabel);
  }, [picked, pickedLabel]);

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    try {
      const prev = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || '[]' : '[]');
      const next = Array.isArray(prev) ? prev : [];
      next.unshift({
        id: String(Date.now()),
        location: picked ? { lat: picked.lat, lng: picked.lng, name: picked.name || null } : null,
        body: q,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50)));
    } catch {
      /* ignore */
    }
    navigate(-1);
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

  const clearPlaceMarkers = useCallback(() => {
    placeMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch {
        /* ignore */
      }
    });
    placeMarkersRef.current = [];
  }, []);

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

          const kakao = window.kakao;
          const map = mapRef.current;
          if (!map) return;

          if (picking) {
            clearPickOverlay();
            clearPlaceMarkers();
            setPicked(null);

            const slice = data.slice(0, 15);
            slice.forEach((place) => {
              const lat = Number(place.y);
              const lng = Number(place.x);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              const marker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(lat, lng),
                map,
              });
              kakao.maps.event.addListener(marker, 'click', () => {
                setPickOverlayAt(lat, lng, 3);
                setPicked({
                  lat,
                  lng,
                  name: place.place_name || place.address_name || query,
                });
              });
              placeMarkersRef.current.push(marker);
            });

            if (slice.length === 1) {
              const lat = Number(slice[0].y);
              const lng = Number(slice[0].x);
              map.setLevel(3);
              map.panTo(new kakao.maps.LatLng(lat, lng));
            } else {
              const bounds = new kakao.maps.LatLngBounds();
              slice.forEach((place) => {
                const lat = Number(place.y);
                const lng = Number(place.x);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  bounds.extend(new kakao.maps.LatLng(lat, lng));
                }
              });
              map.setBounds(bounds, 24, 24, 24, 24);
            }
            return;
          }

          clearPlaceMarkers();
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
    [clearPickOverlay, clearPlaceMarkers, picking, setPickOverlayAt],
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
      } catch (e) {
        if (cancelled) return;
        setSdkError(e?.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, []);

  /** 지도에서 고르기 OFF 시 검색 핀만 정리(빈 땅 탭 선택은 사용하지 않음) */
  useEffect(() => {
    if (picking) return;
    clearPlaceMarkers();
  }, [picking, clearPlaceMarkers]);

  useEffect(() => {
    return () => {
      clearPlaceMarkers();
      clearPickOverlay();
    };
  }, [clearPlaceMarkers, clearPickOverlay]);

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
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void keywordSearch(locationQuery);
                }
              }}
              placeholder="위치 입력 (예: 여의도 한강공원)"
              className="w-full rounded-full border border-gray-200 bg-white py-3 pl-4 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className={`rounded-full border px-3.5 py-3 text-sm font-semibold shadow-sm ${
              picking ? 'border-primary bg-primary-10 text-primary' : 'border-gray-200 bg-white text-gray-900'
            }`}
            aria-label="지도에서 고르기"
            title="지도에서 고르기"
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
          disabled={!text.trim()}
          className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-40"
        >
          질문 등록하기
        </button>
      </div>
    </div>
  );
}

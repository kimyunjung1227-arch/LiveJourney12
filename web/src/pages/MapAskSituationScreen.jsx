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

    const existing = document.querySelector('script[data-kakao-maps-sdk=\"1\"]');
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
  const markerRef = useRef(null);
  const clickListenerRef = useRef(null);

  const [sdkError, setSdkError] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(null); // { lat, lng, name? }
  const [text, setText] = useState('');

  const pickedLabel = useMemo(() => {
    if (!picked) return '';
    return String(picked.name || `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`);
  }, [picked]);

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

  const setMarkerAt = useCallback((lat, lng) => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    const kakao = window.kakao;
    const pos = new kakao.maps.LatLng(lat, lng);
    if (!markerRef.current) {
      markerRef.current = new kakao.maps.Marker({ position: pos });
      markerRef.current.setMap(map);
    } else {
      markerRef.current.setPosition(pos);
    }
    map.panTo(pos);
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    if (!window.kakao?.maps?.services) return null;
    return await new Promise((resolve) => {
      try {
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2Address(lng, lat, (res, status) => {
          if (status === window.kakao.maps.services.Status.OK && Array.isArray(res) && res[0]) {
            const a = res[0].address?.address_name || res[0].road_address?.address_name || null;
            resolve(a);
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }, []);

  const keywordSearch = useCallback(async (q) => {
    const query = String(q || '').trim();
    if (!query) return;
    if (!window.kakao?.maps?.services) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const places = new window.kakao.maps.services.Places();
      places.keywordSearch(query, async (data, status) => {
        if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
          const first = data[0];
          const lat = Number(first.y);
          const lng = Number(first.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setMarkerAt(lat, lng);
          setPicked({ lat, lng, name: first.place_name || first.address_name || query });
        }
      });
    } catch {
      /* ignore */
    }
  }, [setMarkerAt]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps?.event) return;
    const kakao = window.kakao;
    if (clickListenerRef.current) {
      try {
        kakao.maps.event.removeListener(map, 'click', clickListenerRef.current);
      } catch {
        /* ignore */
      }
      clickListenerRef.current = null;
    }
    if (!picking) return;

    const onClick = async (mouseEvent) => {
      try {
        const latlng = mouseEvent.latLng;
        const lat = latlng.getLat();
        const lng = latlng.getLng();
        setMarkerAt(lat, lng);
        const name = await reverseGeocode(lat, lng);
        setPicked({ lat, lng, name });
        setPicking(false);
      } catch {
        /* ignore */
      }
    };
    clickListenerRef.current = onClick;
    kakao.maps.event.addListener(map, 'click', onClick);
    return () => {
      if (!clickListenerRef.current) return;
      try {
        kakao.maps.event.removeListener(map, 'click', clickListenerRef.current);
      } catch {
        /* ignore */
      }
      clickListenerRef.current = null;
    };
  }, [picking, reverseGeocode, setMarkerAt]);

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
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: \"'wght' 300\" }}>map</span>
          </button>
        </div>

        <div className="mb-3 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
          <div className="px-3 py-2 text-[11px] text-gray-600">
            {sdkError ? `지도 로드 실패: ${sdkError}` : picking ? '지도에서 위치를 탭해서 선택해 주세요.' : pickedLabel ? `선택 위치: ${pickedLabel}` : '위치를 검색하거나 지도에서 선택하세요.'}
          </div>
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

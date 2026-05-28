import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMap2 } from '@tabler/icons-react';
import { supabase } from '../../utils/supabaseClient';
import { searchPlaceWithKakaoFirst } from '../../utils/kakaoPlacesGeocode';
import { getDisplayImageUrl } from '../../api/upload';
import { logger } from '../../utils/logger';

const KEY = '#4DB8E8';
const TEXT_SECONDARY = '#6B6B6B';
const DEFAULT_CENTER = { lat: 36.0, lng: 127.8 }; // 한국 중앙 (전국이 화면에 들어오게)
const DEFAULT_LEVEL = 13; // 카카오 level 13 ≈ 대한민국 전체
const CLUSTER_MIN_LEVEL = 6; // 이 레벨 이상에서 클러스터링 (전국~광역)

// ── Kakao SDK 로더 (MapScreen 과 동일 패턴) ────────────────
const getKakaoAppKey = () =>
  String(import.meta.env.VITE_KAKAO_MAP_API_KEY || '').trim();

const loadKakaoSdkOnce = (appKey) =>
  new Promise((resolve, reject) => {
    const key = String(appKey || '').trim();
    if (!key) {
      reject(new Error('VITE_KAKAO_MAP_API_KEY가 비어있습니다.'));
      return;
    }
    if (window.kakao?.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-kakao-maps-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Kakao SDK 로드 실패')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.dataset.kakaoMapsSdk = '1';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      key,
    )}&autoload=false&libraries=services,clusterer`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kakao SDK 로드 실패'));
    document.head.appendChild(script);
  });

const ensureKakaoMapsReady = async () => {
  await loadKakaoSdkOnce(getKakaoAppKey());
  await new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.load) {
      reject(new Error('Kakao SDK 초기화 실패'));
      return;
    }
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('지도 로드 시간 초과'));
    }, 12000);
    window.kakao.maps.load(() => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve();
    });
  });
};

// ── 부드러운 단계적 줌인 ────────────────────────────────
// 카카오 setLevel({animate:true}) 한 번에 큰 단계로 점프하면 줌이 빠름.
// 한 단계씩 setTimeout 으로 호출해 "서서히 확대" 효과.
function smoothZoom(map, targetLevel, anchor) {
  const STEP_MS = 240; // setLevel animate 한 사이클과 비슷
  const step = () => {
    if (!map || typeof map.getLevel !== 'function') return;
    const cur = map.getLevel();
    if (cur <= targetLevel) return;
    const next = Math.max(targetLevel, cur - 1);
    try {
      map.setLevel(next, { anchor, animate: true });
    } catch {
      try {
        map.setLevel(next);
      } catch {
        /* ignore */
      }
    }
    if (next > targetLevel) {
      window.setTimeout(step, STEP_MS);
    }
  };
  step();
}

// ── 핀 HTML ────────────────────────────────────────────
function buildThumbPinHTML(thumbUrl) {
  const bg = thumbUrl
    ? `background-image:url('${thumbUrl}');background-size:cover;background-position:center;`
    : 'background:linear-gradient(135deg,#e0f7fa,#b2ebf2);';
  return `<div style="width:50px;height:50px;border-radius:11px;border:2.5px solid white;box-shadow:0 5px 14px rgba(0,0,0,0.24);background-color:#f3f4f6;${bg}cursor:pointer;"></div>`;
}

/**
 * 프로필의 여행 지도 — 사용자의 모든 게시물 좌표를 핀으로 표시.
 * - 좌표가 exif_data 에 있으면 그대로, 없으면 place_name 으로 지오코드 보완
 * - 핀 클릭 → 해당 게시물 상세화면
 * - 모든 핀 보이게 bounds fit
 *
 * @param {object} props
 * @param {string} props.userId 대상 사용자 UUID
 */
export default function TravelMapView({ userId }) {
  const navigate = useNavigate();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const overlayMapRef = useRef(new Map()); // post_id -> overlay
  const clustererRef = useRef(null);
  const idleListenerRef = useRef(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapLevel, setMapLevel] = useState(DEFAULT_LEVEL);

  // 1) Kakao SDK 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureKakaoMapsReady();
        if (!cancelled) setSdkReady(true);
      } catch (e) {
        if (!cancelled) setSdkError(e?.message || '지도 로드 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) 게시물 좌표 fetch + 지오코드 보완
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setPins([]);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(
            'id, place_name, region, exif_data, images, photo_url, captured_at, created_at',
          )
          .eq('user_id', userId)
          .order('captured_at', { ascending: false, nullsFirst: false })
          .limit(200);

        if (cancelled) return;
        if (error) {
          logger.warn('travel-map fetch 실패', error.message || error);
          setPins([]);
          return;
        }

        const rows = Array.isArray(data) ? data : [];
        const withCoords = [];
        const needGeocode = [];
        for (const p of rows) {
          const e = p?.exif_data || {};
          const lat = Number(
            e?.map_pin?.lat ?? e.lat ?? e.gpsLatitude ?? Number.NaN,
          );
          const lng = Number(
            e?.map_pin?.lng ?? e.lng ?? e.gpsLongitude ?? Number.NaN,
          );
          const thumb =
            (Array.isArray(p.images) && typeof p.images[0] === 'string'
              ? p.images[0]
              : '') || p.photo_url || '';
          const base = {
            post_id: p.id,
            thumb: thumb ? getDisplayImageUrl(thumb) : '',
            place_name: p.place_name || p.region || '',
            captured_at: p.captured_at || p.created_at,
          };
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            withCoords.push({ ...base, lat, lng });
          } else if (base.place_name) {
            needGeocode.push(base);
          }
        }
        if (cancelled) return;
        setPins(withCoords);

        // 좌표 없는 것 — place_name 지오코드 (캐시 자체는 utility 안에서 처리)
        for (const item of needGeocode) {
          if (cancelled) return;
          try {
            const coords = await searchPlaceWithKakaoFirst(item.place_name);
            if (cancelled) return;
            if (!coords || !Number.isFinite(coords.lat)) continue;
            setPins((prev) => [...prev, { ...item, lat: coords.lat, lng: coords.lng }]);
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 3) 지도 인스턴스 생성 (SDK 준비 후 1회) + level 추적
  useEffect(() => {
    if (!sdkReady) return undefined;
    const el = mapEl.current;
    if (!el || mapRef.current) return undefined;
    const kakao = window.kakao;
    const map = new kakao.maps.Map(el, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: DEFAULT_LEVEL,
    });
    mapRef.current = map;
    setMapLevel(map.getLevel());

    const onIdle = () => setMapLevel(map.getLevel());
    kakao.maps.event.addListener(map, 'idle', onIdle);
    idleListenerRef.current = { map, onIdle };

    return () => {
      const il = idleListenerRef.current;
      if (il?.map && window.kakao?.maps?.event) {
        try {
          window.kakao.maps.event.removeListener(il.map, 'idle', il.onIdle);
        } catch {
          /* ignore */
        }
      }
      idleListenerRef.current = null;
      for (const ov of overlayMapRef.current.values()) {
        try {
          ov.setMap(null);
        } catch {
          /* ignore */
        }
      }
      overlayMapRef.current.clear();
      try {
        clustererRef.current?.clear();
      } catch {
        /* ignore */
      }
      clustererRef.current = null;
      mapRef.current = null;
    };
  }, [sdkReady]);

  // 4) 핀 + 클러스터러 갱신
  //    - level ≥ CLUSTER_MIN_LEVEL: 클러스터링 활성, 사진 핀 숨김 (display:none)
  //    - level <  CLUSTER_MIN_LEVEL: 사진 핀 표시
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    const kakao = window.kakao;
    const useClustering = mapLevel >= CLUSTER_MIN_LEVEL;

    // 기존 핀 제거 (단순화)
    for (const ov of overlayMapRef.current.values()) {
      try {
        ov.setMap(null);
      } catch {
        /* ignore */
      }
    }
    overlayMapRef.current.clear();

    if (pins.length === 0) {
      try {
        clustererRef.current?.clear();
      } catch {
        /* ignore */
      }
      return;
    }

    // 사진 핀 CustomOverlay
    pins.forEach((p) => {
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const wrap = document.createElement('div');
      wrap.style.display = useClustering ? 'none' : '';
      wrap.innerHTML = buildThumbPinHTML(p.thumb);
      wrap.firstChild.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(`/post/${encodeURIComponent(p.post_id)}`);
      });
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: wrap,
        yAnchor: 0.5,
        xAnchor: 0.5,
        clickable: true,
      });
      overlay.setMap(map);
      overlayMapRef.current.set(p.post_id, overlay);
    });

    // 클러스터러 (활동 많으면 숫자로 묶음, 클릭 시 줌인)
    try {
      const Clusterer = window.kakao?.maps?.MarkerClusterer;
      if (!Clusterer) return;
      if (!clustererRef.current) {
        clustererRef.current = new Clusterer({
          map,
          averageCenter: true,
          minLevel: CLUSTER_MIN_LEVEL,
          gridSize: 60,
          minClusterSize: 1,
          disableClickZoom: true, // 직접 줌인 처리
          styles: [
            {
              // 1~9장
              width: '38px',
              height: '38px',
              background: '#ffffff',
              border: `2px solid ${KEY}`,
              borderRadius: '10px',
              color: '#1F1F1F',
              textAlign: 'center',
              fontWeight: '800',
              fontSize: '13px',
              lineHeight: '34px',
              boxShadow: '0 3px 10px rgba(0,0,0,0.16)',
            },
            {
              // 10~49장
              width: '46px',
              height: '46px',
              background: '#ffffff',
              border: `2px solid ${KEY}`,
              borderRadius: '10px',
              color: '#1F1F1F',
              textAlign: 'center',
              fontWeight: '800',
              fontSize: '14px',
              lineHeight: '42px',
              boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
            },
            {
              // 50장+
              width: '56px',
              height: '56px',
              background: KEY,
              border: '2px solid #ffffff',
              borderRadius: '12px',
              color: '#ffffff',
              textAlign: 'center',
              fontWeight: '800',
              fontSize: '15px',
              lineHeight: '52px',
              boxShadow: '0 4px 14px rgba(77,184,232,0.45)',
            },
          ],
          calculator: [10, 50],
        });

        // 클러스터 클릭 → 부드럽게 줌인. 10장 이하면 충분히 줌인해 사진 핀이 바로 풀리게.
        kakao.maps.event.addListener(
          clustererRef.current,
          'clusterclick',
          (cluster) => {
            const curLevel =
              typeof map.getLevel === 'function' ? map.getLevel() : DEFAULT_LEVEL;
            const anchor = cluster.getCenter();
            const markerCount =
              typeof cluster.getMarkers === 'function'
                ? cluster.getMarkers().length
                : 0;
            // 10장 이하 → CLUSTER_MIN_LEVEL 아래(=5)까지 한 번에 풀리도록
            // 10장 초과 → 한 번에 3단계 정도만 점진적
            const targetLevel =
              markerCount > 0 && markerCount <= 10
                ? Math.max(3, CLUSTER_MIN_LEVEL - 1)
                : Math.max(3, Math.min(curLevel - 3, CLUSTER_MIN_LEVEL - 1));
            smoothZoom(map, targetLevel, anchor);
          },
        );
      }

      clustererRef.current.clear();
      if (useClustering) {
        const markers = pins.map(
          (p) =>
            new kakao.maps.Marker({
              position: new kakao.maps.LatLng(p.lat, p.lng),
            }),
        );
        clustererRef.current.addMarkers(markers);
      }
    } catch {
      /* ignore */
    }
  }, [pins, mapLevel, navigate]);

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div
        ref={mapEl}
        style={{
          width: '100%',
          height: '60vh',
          minHeight: 360,
          borderRadius: 12,
          background: '#EDF3F7',
          overflow: 'hidden',
        }}
      />

      {/* 로딩/상태 오버레이 */}
      {sdkError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.85)',
            color: TEXT_SECONDARY,
            fontSize: 13,
            padding: 16,
            textAlign: 'center',
          }}
        >
          지도를 불러오지 못했어요
        </div>
      )}

      {!sdkError && loading && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontSize: 11,
            color: TEXT_SECONDARY,
            background: 'rgba(255,255,255,0.9)',
            padding: '6px 10px',
            borderRadius: 6,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          여행지 불러오는 중...
        </div>
      )}

      {!sdkError && !loading && pins.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_SECONDARY,
            fontSize: 13,
            padding: 16,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: '#F5F7FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <IconMap2 size={22} color={KEY} stroke={1.8} />
          </div>
          아직 표시할 여행지가 없어요
        </div>
      )}
    </div>
  );
}

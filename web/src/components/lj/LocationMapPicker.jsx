import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconX, IconCurrentLocation, IconMapPin, IconSearch } from '@tabler/icons-react';
import { LJ } from './tokens';
import { logger } from '../../utils/logger';
import {
  ensureKakaoMapsServicesReady,
  searchPlacesKakao,
  searchNearbyPlacesKakao,
} from '../../utils/kakaoPlacesGeocode';
import { reverseGeocodeToPlaceDetail } from '../../utils/locationFromGeocode';

const SEOUL = { lat: 37.5665, lng: 126.978 };

// 앱 프레임 폭 (.app-container 와 동일) — 업로드 화면과 같은 크기로 뜨게 한다
const APP_FRAME_MAX_WIDTH = 414;

// 선택 위치 표시 핀 — 지도 화면 검색 핀과 같은 티어드롭(키컬러, 플랫)
const PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">' +
  '<path d="M17 42.5S30.5 27.6 30.5 17A13.5 13.5 0 1 0 3.5 17C3.5 27.6 17 42.5 17 42.5z" ' +
  'fill="#4DB8E8" stroke="#ffffff" stroke-width="3"/>' +
  '<circle cx="17" cy="16.5" r="4.8" fill="#ffffff"/></svg>';
const PIN_IMAGE_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(PIN_SVG)}`;

/** 카카오 장소 결과의 고유 키 (선택 표시용) */
const placeKeyOf = (r) => String(r?.id || `${r?.x}|${r?.y}|${r?.place_name}`);

/** 거리(m) 표기 */
const formatDistance = (m) => {
  const n = Number(m);
  if (!Number.isFinite(n) || n < 0) return '';
  return n < 1000 ? `${Math.round(n)}m` : `${(n / 1000).toFixed(1)}km`;
};

/**
 * 지도에서 업로드 위치를 직접 고르는 시트 (업로드 화면과 같은 앱 프레임 폭).
 *
 * - 선택한 위치에 표시 핀이 꽂힌다. 지도를 탭하거나 핀을 끌면 그 지점이 선택 위치가 된다.
 * - 위치가 바뀔 때마다 역지오코딩해 장소명·지역을 아래 카드에 보여준다.
 * - "현재 위치" 버튼으로 기기 GPS 위치로 한 번에 이동.
 * - 상단 검색으로 장소를 찾아 그 지점에 핀을 놓을 수도 있다.
 *
 * @param {{
 *   open: boolean,
 *   initial?: { lat?: number, lng?: number, placeName?: string } | null,
 *   onClose: () => void,
 *   onConfirm: (loc: { lat: number, lng: number, placeName: string, region: string }) => void,
 *   onRequestCurrentLocation?: () => Promise<{ lat: number, lng: number } | null>,
 * }} props
 */
export default function LocationMapPicker({
  open,
  initial,
  onClose,
  onConfirm,
  onRequestCurrentLocation,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocodeTimerRef = useRef(0);
  const geocodeSeqRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [placeName, setPlaceName] = useState('');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  // 이 근처 장소 후보 — 탭하면 그 장소 이름·좌표로 확정한다
  const [nearby, setNearby] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [pickedPlaceKey, setPickedPlaceKey] = useState('');
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const hasInitialCoords =
    Number.isFinite(Number(initial?.lat)) && Number.isFinite(Number(initial?.lng));

  // 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 좌표 → 장소명/지역/주소 + 근처 장소 후보. 마지막 요청 결과만 반영한다.
  // keepName=true 면 이름은 사용자가 고른 값을 유지하고 주소·지역·후보만 갱신.
  const resolvePlace = useCallback(async (lat, lng, { keepName = false } = {}) => {
    const seq = ++geocodeSeqRef.current;
    setGeocoding(true);
    setNearbyLoading(true);
    try {
      const [detail, list] = await Promise.all([
        reverseGeocodeToPlaceDetail(lat, lng),
        searchNearbyPlacesKakao(lat, lng, { radius: 300, limit: 10 }),
      ]);
      if (seq !== geocodeSeqRef.current) return;
      if (!keepName) setPlaceName(detail?.name || '');
      setRegion(detail?.region || '');
      setAddress(detail?.address || '');
      setNearby(Array.isArray(list) ? list : []);
    } catch (_) {
      if (seq !== geocodeSeqRef.current) return;
      if (!keepName) setPlaceName('');
      setRegion('');
      setAddress('');
      setNearby([]);
    } finally {
      if (seq === geocodeSeqRef.current) {
        setGeocoding(false);
        setNearbyLoading(false);
      }
    }
  }, []);

  // 선택 위치 갱신 — 핀 이동 + 좌표 상태 + (디바운스) 역지오코딩
  // name 을 넘기면 그 이름을 그대로 쓰고(사용자가 고른 장소), 주소·지역만 좌표로 보강한다.
  const selectPoint = useCallback(
    (lat, lng, { movePin = true, name = null, placeKey = '' } = {}) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (movePin && markerRef.current && window.kakao?.maps) {
        markerRef.current.setPosition(new window.kakao.maps.LatLng(lat, lng));
      }
      setCoords({ lat, lng });
      setPickedPlaceKey(placeKey);
      const keepName = typeof name === 'string' && name.trim().length > 0;
      if (keepName) setPlaceName(name.trim());
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = window.setTimeout(
        () => resolvePlace(lat, lng, { keepName }),
        200,
      );
    },
    [resolvePlace],
  );

  // 지도 생성 (열릴 때 1회)
  useEffect(() => {
    if (!open) {
      mapRef.current = null;
      markerRef.current = null;
      setReady(false);
      return undefined;
    }
    let cancelled = false;
    const start = hasInitialCoords
      ? { lat: Number(initial.lat), lng: Number(initial.lng) }
      : SEOUL;

    (async () => {
      try {
        await ensureKakaoMapsServicesReady();
        if (cancelled || !containerRef.current) return;
        const kakao = window.kakao;
        const startPos = new kakao.maps.LatLng(start.lat, start.lng);
        const map = new kakao.maps.Map(containerRef.current, {
          center: startPos,
          level: hasInitialCoords ? 3 : 6,
        });
        mapRef.current = map;

        // 선택 위치 표시 핀 — 끌어서 미세 조정 가능
        const marker = new kakao.maps.Marker({
          position: startPos,
          draggable: true,
          image: new kakao.maps.MarkerImage(
            PIN_IMAGE_URL,
            new kakao.maps.Size(34, 44),
            { offset: new kakao.maps.Point(17, 43) },
          ),
        });
        marker.setMap(map);
        markerRef.current = marker;

        setReady(true);
        setCoords(start);
        void resolvePlace(start.lat, start.lng);

        // 지도를 탭하면 그 지점으로 핀 이동
        kakao.maps.event.addListener(map, 'click', (e) => {
          const pos = e.latLng;
          selectPoint(pos.getLat(), pos.getLng());
        });

        // 핀을 끌어 놓으면 그 지점이 선택 위치
        kakao.maps.event.addListener(marker, 'dragend', () => {
          const pos = marker.getPosition();
          selectPoint(pos.getLat(), pos.getLng(), { movePin: false });
        });

        // 시트가 열리면서 컨테이너 크기가 확정되므로 한 번 다시 그린다
        window.setTimeout(() => {
          try {
            map.relayout();
            map.setCenter(startPos);
          } catch (_) {
            /* ignore */
          }
        }, 60);
      } catch (e) {
        if (!cancelled) {
          logger.warn('위치 선택 지도 로드 실패', e?.message || e);
          setLoadError('지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 장소 검색 (입력 디바운스)
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const list = await searchPlacesKakao(q, 8);
        if (!cancelled) setResults(Array.isArray(list) ? list : []);
      } catch (_) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, open]);

  // 지도를 그 좌표로 옮기고 핀도 함께 꽂는다 (검색 결과·현재 위치)
  const moveTo = useCallback(
    (lat, lng, level, opts) => {
      const map = mapRef.current;
      if (!map || !window.kakao?.maps) return;
      const pos = new window.kakao.maps.LatLng(lat, lng);
      if (Number.isFinite(level)) map.setLevel(level);
      map.setCenter(pos);
      selectPoint(lat, lng, opts);
    },
    [selectPoint],
  );

  const handleCurrentLocation = useCallback(async () => {
    if (locating || typeof onRequestCurrentLocation !== 'function') return;
    setLocating(true);
    try {
      const fix = await onRequestCurrentLocation();
      if (fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng)) {
        moveTo(fix.lat, fix.lng, 3);
      }
    } finally {
      setLocating(false);
    }
  }, [locating, moveTo, onRequestCurrentLocation]);

  // 검색 결과 선택 — 그 장소 이름을 그대로 쓰고 핀도 그 지점에 꽂는다
  const handleSelectResult = useCallback(
    (r) => {
      const lat = Number(r.y);
      const lng = Number(r.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setQuery('');
      setResults([]);
      moveTo(lat, lng, 3, { name: r.place_name || '', placeKey: placeKeyOf(r) });
    },
    [moveTo],
  );

  // "이 근처 장소" 선택 — 핀을 그 장소 좌표로 옮기고 이름을 확정
  const handleSelectNearby = useCallback(
    (r) => {
      const lat = Number(r.y);
      const lng = Number(r.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      moveTo(lat, lng, undefined, { name: r.place_name || '', placeKey: placeKeyOf(r) });
    },
    [moveTo],
  );

  const handleConfirm = useCallback(() => {
    if (!coords) return;
    onConfirm({
      lat: coords.lat,
      lng: coords.lng,
      // 장소명이 없으면 주소라도 이름으로 — 업로드 후 "이름 없음"이 되지 않게
      placeName: placeName || address || region || '',
      region: region || '',
    });
  }, [coords, placeName, address, region, onConfirm]);

  if (!open) return null;

  const roundBtn = {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    padding: 0,
    borderRadius: 999,
    background: '#fff',
    border: `1px solid ${LJ.borderLight}`,
    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };

  return (
    <>
      {/* 프레임 밖(데스크톱 여백) 어둡게 — 모달로 읽히게 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div
      style={{
        // 업로드 화면과 같은 앱 프레임 폭(414px)으로 가운데 정렬.
        // (.app-container 가 zoom 을 걸고 있어 fixed 도 같은 스케일로 렌더된다)
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: APP_FRAME_MAX_WIDTH,
        zIndex: 1000,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: LJ.fontStack,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="지도에서 위치 선택"
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: `1px solid ${LJ.borderLight}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{ ...roundBtn, boxShadow: 'none', border: 'none', background: 'transparent' }}
        >
          <IconX size={20} stroke={2} color={LJ.textPrimary} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: LJ.textPrimary }}>
          지도에서 위치 선택
        </span>
      </div>

      {/* 검색 */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: LJ.bgSurface,
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 10,
            padding: '9px 12px',
          }}
        >
          <IconSearch size={16} stroke={2} color={LJ.textTertiary} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소 검색 (예: 석촌호수)"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: LJ.fontStack,
              fontSize: 13,
              color: LJ.textPrimary,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
              style={{
                width: 20,
                height: 20,
                minWidth: 20,
                minHeight: 20,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconX size={14} stroke={2} color={LJ.textTertiary} />
            </button>
          )}
        </div>

        {query.trim().length >= 2 && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              marginTop: 6,
              background: '#fff',
              border: `1px solid ${LJ.borderLight}`,
              borderRadius: 10,
              maxHeight: 240,
              overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            }}
          >
            {searching ? (
              <div style={{ padding: 12, fontSize: 12, color: LJ.textTertiary }}>검색 중…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: LJ.textTertiary }}>
                검색 결과가 없어요
              </div>
            ) : (
              results.map((r) => (
                <button
                  key={r.id || `${r.x}|${r.y}|${r.place_name}`}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${LJ.borderLight}`,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontFamily: LJ.fontStack,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>
                    {r.place_name}
                  </div>
                  <div style={{ fontSize: 11, color: LJ.textSecondary, marginTop: 2 }}>
                    {r.road_address_name || r.address_name}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 지도 */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, margin: '10px 0 0' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {(!ready || loadError) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: LJ.bgSurface,
              fontSize: 12.5,
              color: loadError ? LJ.error : LJ.textTertiary,
              textAlign: 'center',
              padding: 20,
            }}
          >
            {loadError || '지도를 불러오는 중…'}
          </div>
        )}

        {/* 조작 안내 — 핀은 지도 위 마커로 표시된다 */}
        {ready && !loadError && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top: 10,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: 999,
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              지도를 탭하거나 핀을 끌어 위치를 지정하세요
            </span>
          </div>
        )}

        {/* 현재 위치 */}
        {typeof onRequestCurrentLocation === 'function' && (
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={locating}
            aria-label="현재 위치로 이동"
            style={{
              ...roundBtn,
              position: 'absolute',
              right: 12,
              bottom: 12,
              opacity: locating ? 0.6 : 1,
            }}
          >
            <IconCurrentLocation size={18} stroke={2} color={LJ.key} />
          </button>
        )}
      </div>

      {/* 선택 위치 + 확정 */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${LJ.borderLight}`,
          background: '#fff',
        }}
      >
        {/* 선택된 장소 — 이름 + 주소로 어디인지 분명히 */}
        <div
          style={{
            background: LJ.bgSurface,
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: placeName ? LJ.textPrimary : LJ.textTertiary,
              lineHeight: 1.35,
              wordBreak: 'keep-all',
            }}
          >
            {geocoding && !placeName
              ? '장소 확인 중…'
              : placeName || '아래에서 장소를 골라 주세요'}
          </div>
          {(address || region) && (
            <div
              style={{
                marginTop: 3,
                fontSize: 11.5,
                color: LJ.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                lineHeight: 1.35,
              }}
            >
              <IconMapPin size={11} stroke={2} color={LJ.textTertiary} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {address || region}
              </span>
            </div>
          )}
        </div>

        {/* 이 근처 장소 — 탭하면 그 장소 이름으로 확정되고 핀도 그 자리로 */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: LJ.textTertiary,
              marginBottom: 6,
            }}
          >
            이 근처 장소
          </div>
          {nearbyLoading && nearby.length === 0 ? (
            <div style={{ fontSize: 11.5, color: LJ.textTertiary, padding: '4px 0' }}>
              주변 장소 찾는 중…
            </div>
          ) : nearby.length === 0 ? (
            <div style={{ fontSize: 11.5, color: LJ.textTertiary, padding: '4px 0' }}>
              주변에 등록된 장소가 없어요 — 주소로 올라가요
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 2,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {nearby.map((r) => {
                const key = placeKeyOf(r);
                const active = key === pickedPlaceKey || r.place_name === placeName;
                const dist = formatDistance(r.distance);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectNearby(r)}
                    style={{
                      flex: '0 0 auto',
                      maxWidth: 190,
                      minHeight: 0,
                      padding: '7px 11px',
                      borderRadius: 999,
                      border: `1px solid ${active ? LJ.key : LJ.borderLight}`,
                      background: active ? LJ.keyBgLight : '#fff',
                      color: active ? LJ.keyTextDark : LJ.textPrimary,
                      fontFamily: LJ.fontStack,
                      fontSize: 12,
                      fontWeight: active ? 700 : 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 130,
                      }}
                    >
                      {r.place_name}
                    </span>
                    {dist && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: active ? LJ.keyTextDark : LJ.textTertiary,
                        }}
                      >
                        {dist}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!coords}
          style={{
            width: '100%',
            height: 48,
            minHeight: 48,
            background: coords ? LJ.key : LJ.borderLight,
            color: coords ? '#fff' : LJ.textTertiary,
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: coords ? 'pointer' : 'default',
          }}
        >
          이 위치로 설정
        </button>
      </div>
      </div>
    </>
  );
}

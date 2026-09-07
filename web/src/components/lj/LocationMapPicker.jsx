import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconX, IconCurrentLocation, IconMapPin, IconSearch } from '@tabler/icons-react';
import { LJ } from './tokens';
import { logger } from '../../utils/logger';
import { ensureKakaoMapsServicesReady, searchPlacesKakao } from '../../utils/kakaoPlacesGeocode';
import { reverseGeocodeToPlaceDetail } from '../../utils/locationFromGeocode';

const SEOUL = { lat: 37.5665, lng: 126.978 };

/**
 * 지도에서 업로드 위치를 직접 고르는 전체화면 시트.
 *
 * - 지도를 움직이면 화면 중앙 핀이 가리키는 좌표가 선택 위치가 된다(모바일에서 가장 정확한 방식).
 * - 멈출 때마다 좌표를 역지오코딩해 장소명·지역을 아래 카드에 보여준다.
 * - "현재 위치" 버튼으로 기기 GPS 위치로 한 번에 이동.
 * - 상단 검색으로 장소를 찾아 그 지점으로 이동할 수도 있다.
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
  const idleTimerRef = useRef(0);
  const geocodeSeqRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [placeName, setPlaceName] = useState('');
  const [region, setRegion] = useState('');
  const [geocoding, setGeocoding] = useState(false);
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

  // 좌표 → 장소명/지역 (지도가 멈출 때마다, 마지막 요청만 반영)
  const resolvePlace = useCallback(async (lat, lng) => {
    const seq = ++geocodeSeqRef.current;
    setGeocoding(true);
    try {
      const detail = await reverseGeocodeToPlaceDetail(lat, lng);
      if (seq !== geocodeSeqRef.current) return;
      setPlaceName(detail?.name || '');
      setRegion(detail?.region || '');
    } catch (e) {
      if (seq !== geocodeSeqRef.current) return;
      setPlaceName('');
      setRegion('');
    } finally {
      if (seq === geocodeSeqRef.current) setGeocoding(false);
    }
  }, []);

  // 지도 생성 (열릴 때 1회)
  useEffect(() => {
    if (!open) {
      mapRef.current = null;
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
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(start.lat, start.lng),
          level: hasInitialCoords ? 3 : 6,
        });
        mapRef.current = map;
        setReady(true);
        setCoords(start);
        void resolvePlace(start.lat, start.lng);

        // 지도가 멈추면 중앙 좌표를 선택 위치로 확정
        kakao.maps.event.addListener(map, 'idle', () => {
          const c = map.getCenter();
          const next = { lat: c.getLat(), lng: c.getLng() };
          setCoords(next);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          idleTimerRef.current = window.setTimeout(
            () => resolvePlace(next.lat, next.lng),
            250,
          );
        });

        // 지도를 탭하면 그 지점을 가운데로
        kakao.maps.event.addListener(map, 'click', (e) => {
          map.panTo(e.latLng);
        });

        // 시트가 열리면서 컨테이너 크기가 확정되므로 한 번 다시 그린다
        window.setTimeout(() => {
          try {
            map.relayout();
            map.setCenter(new kakao.maps.LatLng(start.lat, start.lng));
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
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
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

  const moveTo = useCallback((lat, lng, level) => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    const pos = new window.kakao.maps.LatLng(lat, lng);
    if (Number.isFinite(level)) map.setLevel(level);
    map.setCenter(pos); // idle 이벤트가 좌표·장소명을 갱신
  }, []);

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

  const handleSelectResult = useCallback(
    (r) => {
      const lat = Number(r.y);
      const lng = Number(r.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setQuery('');
      setResults([]);
      moveTo(lat, lng, 3);
    },
    [moveTo],
  );

  const handleConfirm = useCallback(() => {
    if (!coords) return;
    onConfirm({
      lat: coords.lat,
      lng: coords.lng,
      placeName: placeName || '',
      region: region || '',
    });
  }, [coords, placeName, region, onConfirm]);

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
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

        {/* 중앙 고정 핀 — 지도를 움직여 이 핀 아래를 맞춘다 */}
        {ready && !loadError && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                background: LJ.key,
                border: '3px solid #fff',
                borderRadius: '50% 50% 50% 6px',
                transform: 'rotate(-45deg)',
                boxShadow: '0 6px 18px rgba(77,184,232,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: '#fff',
                  borderRadius: '50%',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
            <div
              style={{
                width: 8,
                height: 4,
                marginTop: 3,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.22)',
              }}
            />
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
              fontSize: 14,
              fontWeight: 600,
              color: placeName ? LJ.textPrimary : LJ.textTertiary,
              lineHeight: 1.35,
              wordBreak: 'keep-all',
            }}
          >
            {geocoding ? '장소 확인 중…' : placeName || '이 지점에는 알려진 장소명이 없어요'}
          </div>
          {region && (
            <div
              style={{
                marginTop: 3,
                fontSize: 11.5,
                color: LJ.textSecondary,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <IconMapPin size={11} stroke={2} color={LJ.textTertiary} />
              <span>{region}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!coords || geocoding}
          style={{
            width: '100%',
            height: 48,
            minHeight: 48,
            background: !coords || geocoding ? LJ.borderLight : LJ.key,
            color: !coords || geocoding ? LJ.textTertiary : '#fff',
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: !coords || geocoding ? 'default' : 'pointer',
          }}
        >
          이 위치로 설정
        </button>
      </div>
    </div>
  );
}

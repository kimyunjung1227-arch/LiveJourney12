import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseGeocodeToPlace } from '../utils/locationFromGeocode';

/**
 * 위치 추적 + 카카오 reverse geocoding.
 *
 * - watchPosition으로 실시간 좌표 추적 (throttle 5초 기본)
 * - 좌표가 의미 있게 바뀌면(>= 30m) reverseGeocodeToPlace 호출 → placeName 채움
 *   카카오 REST 키(VITE_KAKAO_REST_API_KEY)가 없으면 placeName은 null로 유지되고
 *   UI는 좌표 표시로 폴백
 * - getPreciseLocation: 셔터 시점에 호출. 캐시된 위치가 충분히 정확하면 즉시 반환,
 *   아니면 fresh getCurrentPosition으로 한 번 더 받고 더 나은 fix를 채택.
 *   accuracy(m)를 함께 반환.
 *
 * @param {{ throttleMs?: number, geocodeMinMoveMeters?: number }} opt
 */
export function useGeolocation({ throttleMs = 5000, geocodeMinMoveMeters = 30 } = {}) {
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(0);
  const [placeName, setPlaceName] = useState(null);
  const [status, setStatus] = useState('idle');
  const lastUpdateRef = useRef(0);
  const lastGeocodedAtRef = useRef(null); // { lat, lng }
  const bestFixRef = useRef(null); // { lat, lng, accuracy, ts }

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return undefined;
    }
    setStatus('requesting');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy || 0;
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: acc,
          ts: Date.now(),
        };
        // 더 정확한 fix(낮은 accuracy)일 때만 갱신 — 추적 흔들림 완화
        const prev = bestFixRef.current;
        if (!prev || acc <= prev.accuracy + 5 || Date.now() - prev.ts > 30000) {
          bestFixRef.current = fix;
        }

        const now = Date.now();
        if (now - lastUpdateRef.current < throttleMs) return;
        lastUpdateRef.current = now;
        setCoords({ lat: fix.lat, lng: fix.lng });
        setAccuracy(acc);
        setStatus('granted');
      },
      (err) => {
        setStatus(
          err && err.code === err.PERMISSION_DENIED ? 'denied' : 'unsupported'
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch (_) {}
    };
  }, [throttleMs]);

  // coords가 충분히 움직였을 때만 reverse geocode
  useEffect(() => {
    if (!coords) return;
    const prev = lastGeocodedAtRef.current;
    if (prev && haversine(prev.lat, prev.lng, coords.lat, coords.lng) < geocodeMinMoveMeters) {
      return;
    }
    lastGeocodedAtRef.current = { lat: coords.lat, lng: coords.lng };
    let cancelled = false;
    (async () => {
      try {
        const name = await reverseGeocodeToPlace(coords.lat, coords.lng);
        if (!cancelled) setPlaceName(name || null);
      } catch (_) {
        if (!cancelled) setPlaceName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords, geocodeMinMoveMeters]);

  /**
   * 셔터 시점 정밀 위치 요청.
   * - 최근(<8s) fix가 50m 이내면 그대로 반환 (배터리/속도 절약)
   * - 아니면 fresh getCurrentPosition(timeout 8s)로 한 번 더 받음
   * - getCurrentPosition 실패 시 캐시된 bestFix 또는 현재 coords로 폴백
   */
  const getPreciseLocation = useCallback(
    (maxWaitMs = 8000) =>
      new Promise((resolve) => {
        const cached = bestFixRef.current;
        const now = Date.now();
        if (cached && cached.accuracy <= 50 && now - cached.ts < 8000) {
          resolve({
            lat: cached.lat,
            lng: cached.lng,
            accuracy: cached.accuracy,
            source: 'cache',
          });
          return;
        }
        if (
          typeof navigator === 'undefined' ||
          !navigator.geolocation ||
          !navigator.geolocation.getCurrentPosition
        ) {
          if (cached) {
            resolve({
              lat: cached.lat,
              lng: cached.lng,
              accuracy: cached.accuracy,
              source: 'cache_no_api',
            });
          } else {
            resolve(null);
          }
          return;
        }
        let settled = false;
        const fallback = () => {
          if (settled) return;
          settled = true;
          if (cached) {
            resolve({
              lat: cached.lat,
              lng: cached.lng,
              accuracy: cached.accuracy,
              source: 'cache_timeout',
            });
          } else if (coords) {
            resolve({
              lat: coords.lat,
              lng: coords.lng,
              accuracy: accuracy || null,
              source: 'state',
            });
          } else {
            resolve(null);
          }
        };
        const timer = setTimeout(fallback, maxWaitMs + 200);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const fix = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy || null,
              ts: Date.now(),
            };
            bestFixRef.current = fix;
            resolve({ ...fix, source: 'fresh' });
          },
          () => {
            fallback();
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
        );
      }),
    [coords, accuracy],
  );

  return { coords, accuracy, placeName, status, getPreciseLocation };
}

/** 두 좌표 간 거리(m) — 카카오 호출 throttle 용. */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

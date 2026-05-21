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
// GPS fix가 충분히 정확하다고 볼 수 있는 임계치 (m). 이 값을 넘어가면 사용자 위치가
// 아닌 주변 영역으로 매칭될 수 있어 reverse geocode 결과가 부정확해진다.
const PRECISE_ACCURACY_M = 80;
const ACCEPT_FIX_M = 150; // 이 값을 넘는 fix는 watchPosition에서 좌표 갱신을 건너뜀

export function useGeolocation({ throttleMs = 2500, geocodeMinMoveMeters = 15 } = {}) {
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
        // 더 정확한 fix(낮은 accuracy)일 때만 best fix 갱신
        const prev = bestFixRef.current;
        if (!prev || acc <= prev.accuracy + 5 || Date.now() - prev.ts > 30000) {
          bestFixRef.current = fix;
        }

        // accuracy가 너무 나쁘면 (>150m) 상태 좌표 갱신을 건너뜀 — 주변 매칭 방지.
        // 첫 fix는 정확도와 무관하게 한 번 반영(완전한 빈 상태 회피)하되, 그 이후엔 게이트.
        if (acc > ACCEPT_FIX_M && coordsExist()) return;

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

    function coordsExist() {
      return !!bestFixRef.current && bestFixRef.current.ts > 0 &&
        Date.now() - bestFixRef.current.ts < 30000;
    }
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
   * 셔터/업로드 진입 시 정밀 위치 요청.
   * - 최근(<3s) fix가 30m 이내면 그대로 반환 (매우 신선/정확할 때만)
   * - 아니면 fresh getCurrentPosition으로 받음 (정확도 향상)
   * - 첫 fix가 부정확하면(>80m) 한 번 더 짧게 재시도해 더 좋은 fix 채택
   * - 실패 시 캐시된 bestFix 또는 현재 coords로 폴백
   */
  const getPreciseLocation = useCallback(
    (maxWaitMs = 8000) =>
      new Promise((resolve) => {
        const cached = bestFixRef.current;
        const now = Date.now();
        if (cached && cached.accuracy <= 30 && now - cached.ts < 3000) {
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

        // 첫 fix를 받고 정확도가 부정확하면 짧게 한 번 더 시도해 더 좋은 fix 선택
        const tryGet = (attempt) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (settled) return;
              const fix = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy || null,
                ts: Date.now(),
              };
              const prev = bestFixRef.current;
              if (!prev || (fix.accuracy ?? 9999) < (prev.accuracy ?? 9999)) {
                bestFixRef.current = fix;
              }
              // 충분히 정확하면 즉시 반환 — 아니면 한 번 더 시도
              if ((fix.accuracy ?? 9999) <= PRECISE_ACCURACY_M || attempt >= 1) {
                settled = true;
                clearTimeout(timer);
                resolve({ ...bestFixRef.current, source: 'fresh' });
                return;
              }
              // 부정확한 첫 fix — 짧게 한 번 더
              setTimeout(() => tryGet(attempt + 1), 600);
            },
            () => {
              if (attempt >= 1) {
                fallback();
              } else {
                setTimeout(() => tryGet(attempt + 1), 400);
              }
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
          );
        };
        tryGet(0);
      }),
    [coords, accuracy],
  );

  // 정밀 fix 기준 (UI에서 정확도 표시/판정에 사용)
  const isPrecise = Number.isFinite(accuracy) && accuracy > 0 && accuracy <= PRECISE_ACCURACY_M;

  return { coords, accuracy, placeName, status, getPreciseLocation, isPrecise };
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

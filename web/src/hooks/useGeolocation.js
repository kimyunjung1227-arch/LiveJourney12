import { useEffect, useRef, useState } from 'react';
import { reverseGeocodeToPlace } from '../utils/locationFromGeocode';

/**
 * 위치 추적 + 카카오 reverse geocoding.
 *
 * - watchPosition으로 실시간 좌표 추적 (throttle 5초 기본)
 * - 좌표가 의미 있게 바뀌면(>= 30m) reverseGeocodeToPlace 호출 → placeName 채움
 *   카카오 REST 키(VITE_KAKAO_REST_API_KEY)가 없으면 placeName은 null로 유지되고
 *   UI는 좌표 표시로 폴백
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

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return undefined;
    }
    setStatus('requesting');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < throttleMs) return;
        lastUpdateRef.current = now;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy || 0);
        setStatus('granted');
      },
      (err) => {
        setStatus(
          err && err.code === err.PERMISSION_DENIED ? 'denied' : 'unsupported'
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
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

  return { coords, accuracy, placeName, status };
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

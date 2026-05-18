import { useEffect, useRef, useState } from 'react';

/**
 * 위치 추적 훅 — navigator.geolocation.watchPosition 기반.
 *
 * placeName 역지오코딩은 별도 인프라(places 테이블/외부 API)가 필요해
 * 현재는 항상 null. coords가 잡히면 lat/lng를 표시용 문자열로 사용 가능.
 *
 * @param {{ throttleMs?: number }} opt - 좌표 업데이트 최소 간격 (기본 5초)
 */
export function useGeolocation({ throttleMs = 5000 } = {}) {
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(0);
  const [placeName] = useState(null); // TODO: 역지오코딩 연결 시 setter로 전환
  const [status, setStatus] = useState('idle');
  const lastUpdateRef = useRef(0);

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

  return { coords, accuracy, placeName, status };
}

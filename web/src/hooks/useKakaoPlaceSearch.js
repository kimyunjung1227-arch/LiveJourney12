import { useCallback, useEffect, useRef, useState } from 'react';

// 카카오 services 라이브러리는 main.jsx에서 libraries=services,clusterer로 로드됨
function ensureKakao() {
  return new Promise((resolve) => {
    if (window.kakao?.maps?.services) return resolve(true);
    if (window.kakao?.maps?.load) {
      window.kakao.maps.load(() => resolve(!!window.kakao.maps.services));
      return;
    }
    resolve(false);
  });
}

export function useKakaoPlaceSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const search = useCallback((query) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = String(query || '').trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const ready = await ensureKakao();
      if (!ready) {
        setResults([]);
        setLoading(false);
        return;
      }
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(q, (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK) {
          setResults([]);
          setLoading(false);
          return;
        }
        const mapped = (data || []).map((d) => {
          const parts = String(d.address_name || '').split(' ');
          return {
            kakao_id: String(d.id),
            name: d.place_name,
            city: parts[0] || '',
            district: parts[1] || '',
            lat: parseFloat(d.y),
            lng: parseFloat(d.x),
            address: d.address_name || d.road_address_name || '',
            category: d.category_group_name || '',
          };
        });
        setResults(mapped);
        setLoading(false);
      });
    }, 250);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { results, loading, search };
}

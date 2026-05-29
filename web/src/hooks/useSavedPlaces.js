import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { fetchSavedPlaces, unsavePlace } from '../api/savedPlacesSupabase';
import { normalizePostRow, makePlaceId } from './ljPostsMapping';

const PHOTO_SELECT = `id, user_id, images, place_name, region, created_at, captured_at, exif_data`;
const PHOTO_FETCH_LIMIT = 200;

/**
 * 프로필 "저장한 장소" 탭 데이터.
 * 1) interest_places 에서 내 저장 목록을 가져오고
 * 2) posts 에서 최근 게시물을 한 번에 받아 makePlaceId 매칭으로 대표 사진/게시물 수를 붙인다.
 *    (usePlaceDetail 과 동일한 매칭 전략 — place_name 자유 텍스트 대응)
 */
export function useSavedPlaces(userId) {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const saved = await fetchSavedPlaces(userId);
      if (saved.length === 0) {
        setPlaces([]);
        return;
      }

      // 저장 장소의 대표 사진/게시물 수 매칭용 최근 게시물 일괄 조회
      let photoByPlace = new Map();
      let countByPlace = new Map();
      try {
        const { data } = await supabase
          .from('posts')
          .select(PHOTO_SELECT)
          .not('place_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(PHOTO_FETCH_LIMIT);
        (data || []).map(normalizePostRow).forEach((p) => {
          if (!p.photo_url) return;
          const key = makePlaceId(p.place_name);
          if (!key) return;
          countByPlace.set(key, (countByPlace.get(key) || 0) + 1);
          // 최신순 정렬이라 첫 번째가 가장 최근 사진
          if (!photoByPlace.has(key)) photoByPlace.set(key, p.photo_url);
        });
      } catch {
        /* 사진 매칭 실패해도 목록 자체는 보여준다 */
      }

      const enriched = saved.map((row) => {
        const key = makePlaceId(row.name);
        return {
          id: row.id,
          name: row.name,
          region: row.region || '',
          placeId: key,
          photoUrl: key ? photoByPlace.get(key) || null : null,
          postsCount: key ? countByPlace.get(key) || 0 : 0,
          created_at: row.created_at,
        };
      });
      setPlaces(enriched);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // 목록에서 바로 저장 해제 (낙관적 제거 후 실패 시 복구)
  const remove = useCallback(
    async (placeName) => {
      const prev = places;
      setPlaces((list) => list.filter((p) => p.name !== placeName));
      const res = await unsavePlace(userId, placeName);
      if (!res.success) setPlaces(prev);
      return res.success;
    },
    [userId, places]
  );

  return { places, loading, refresh: load, remove };
}

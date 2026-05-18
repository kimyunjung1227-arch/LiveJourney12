import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow, bestCutScore, decodePlaceId, makePlaceId } from './ljPostsMapping';

const SELECT_COLUMNS = `
  id, user_id, content, images, location, detailed_location, place_name, region,
  category, category_name, likes_count, comments_count, captured_at, created_at,
  author_username, author_avatar_url, is_in_app_camera
`;

const RECENT_HOURS = 6;

/**
 * 한 장소의 모든 게시물 + 베스트 컷을 가져온다.
 * placeId는 makePlaceId(name)로 만들어진 url-encoded 정규화 키.
 * place_name으로 ilike 매칭 (대소문자 무시).
 */
export function usePlaceDetail(placeId) {
  const [posts, setPosts] = useState([]);
  const [place, setPlace] = useState(null);
  const [bestCut, setBestCut] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!placeId) return;
    setLoading(true);
    setError(null);
    const placeName = decodePlaceId(placeId).trim();

    try {
      // place_name 또는 location 어느 쪽이든 매칭
      const { data, error: queryError } = await supabase
        .from('posts')
        .select(SELECT_COLUMNS)
        .or(`place_name.ilike.${placeName},location.ilike.${placeName}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (queryError) throw queryError;

      const normalized = (data || [])
        .map(normalizePostRow)
        .filter((p) => !!p.photo_url && makePlaceId(p.place_name) === placeId);

      let best = null;
      let bestScore = -Infinity;
      for (const p of normalized) {
        const s = bestCutScore(p);
        if (s > bestScore) {
          best = p;
          bestScore = s;
        }
      }

      const recentCutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000;
      const recentCount = normalized.filter(
        (p) => p.created_at && new Date(p.created_at).getTime() >= recentCutoff
      ).length;

      const placeMeta =
        normalized.length > 0
          ? {
              id: placeId,
              name: normalized[0].place_name,
              region: normalized[0].region,
              postsCount: normalized.length,
              recentCount,
            }
          : { id: placeId, name: placeName, region: '', postsCount: 0, recentCount: 0 };

      setPlace(placeMeta);
      setBestCut(best);
      setPosts(normalized);
    } catch (e) {
      setError(e);
      setPlace({ id: placeId, name: placeName, region: '', postsCount: 0, recentCount: 0 });
      setBestCut(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { place, bestCut, posts, loading, error, refresh: fetchAll };
}

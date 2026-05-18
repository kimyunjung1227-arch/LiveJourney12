import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow, bestCutScore, decodePlaceId, makePlaceId } from './ljPostsMapping';

const SELECT_COLUMNS = `
  id, user_id, content, images, location, detailed_location, place_name, region,
  category, category_name, likes_count, comments_count, captured_at, created_at,
  author_username, author_avatar_url, is_in_app_camera
`;

const RECENT_HOURS = 6;
const FETCH_LIMIT = 200;

/**
 * 한 장소의 모든 게시물 + 베스트 컷.
 * placeId는 makePlaceId(name)로 만들어진 url-encoded(소문자/trim) 키.
 *
 * 매칭 전략: place_name이 자유 텍스트라 PostgREST의 .or(.ilike.value) 같은 좁은
 * 필터는 표기 차이/공백/대소문자/와일드카드 부재로 종종 빈 결과가 된다.
 * 그래서 place_name not null인 최근 게시물을 한 번에 가져온 뒤
 * 클라이언트에서 makePlaceId(p.place_name) === placeId 로 정확히 필터한다.
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
    // useParams는 이미 디코드된 문자열을 주지만, 외부 링크가 인코딩된 채 들어올 수
    // 있어 한 번 더 디코드 시도 후 normalize 해서 비교 키를 일관되게 만든다.
    const placeNameFallback = decodePlaceId(placeId).trim();
    const normalizedTarget = makePlaceId(placeNameFallback);

    try {
      const { data, error: queryError } = await supabase
        .from('posts')
        .select(SELECT_COLUMNS)
        .not('place_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT);
      if (queryError) throw queryError;

      const normalized = (data || [])
        .map(normalizePostRow)
        .filter((p) => !!p.photo_url && makePlaceId(p.place_name) === normalizedTarget);

      let best = null;
      let bestScore = -Infinity;
      for (const p of normalized) {
        const s = bestCutScore(p);
        if (s > bestScore) {
          best = p;
          bestScore = s;
        }
      }
      // 점수 모두 0이어서 best가 안 잡힌 경우엔 가장 최신 게시물을 베스트로 폴백
      if (!best && normalized.length > 0) best = normalized[0];

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
          : { id: placeId, name: placeNameFallback, region: '', postsCount: 0, recentCount: 0 };

      setPlace(placeMeta);
      setBestCut(best);
      setPosts(normalized);
    } catch (e) {
      setError(e);
      setPlace({ id: placeId, name: placeNameFallback, region: '', postsCount: 0, recentCount: 0 });
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

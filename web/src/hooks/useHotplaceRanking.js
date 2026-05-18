import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow, bestCutScore, makePlaceId } from './ljPostsMapping';

const SELECT_COLUMNS = `
  id, user_id, content, images, location, detailed_location, place_name, region,
  category, category_name, likes_count, comments_count, captured_at, created_at,
  author_username, author_avatar_url, is_in_app_camera
`;

const RECENT_HOURS = 6;
const FETCH_LIMIT = 300; // 집계 대상 풀

/**
 * posts를 place_name 단위로 그룹핑해 핫플 랭킹을 만든다.
 * - 베스트 컷 = 그 장소의 게시물 중 likes + saves*1.5 최고 점수
 * - postsCount = 최근 RECENT_HOURS시간 내 게시물 수
 * - growthRate = recent / (total - recent) 의 증가율 (없으면 0)
 * - 정렬: postsCount desc, bestCutScore desc 보조
 */
export function useHotplaceRanking({ limit = 20 } = {}) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from('posts')
          .select(SELECT_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (cancelled) return;
        if (queryError) throw queryError;

        const normalized = (data || [])
          .map(normalizePostRow)
          .filter((p) => !!p.photo_url && !!p.place_id);

        const groups = new Map();
        const recentCutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000;

        for (const p of normalized) {
          const key = p.place_id;
          if (!groups.has(key)) {
            groups.set(key, {
              place_id: key,
              place_name: p.place_name,
              region: p.region,
              posts: [],
              recentCount: 0,
            });
          }
          const g = groups.get(key);
          g.posts.push(p);
          const createdAt = p.created_at ? new Date(p.created_at).getTime() : 0;
          if (createdAt >= recentCutoff) g.recentCount += 1;
        }

        const ranked = [];
        for (const g of groups.values()) {
          let best = g.posts[0];
          let bestScore = -Infinity;
          for (const p of g.posts) {
            const s = bestCutScore(p);
            if (s > bestScore) {
              best = p;
              bestScore = s;
            }
          }
          // 베스트컷 제외한 최근 사진 2장 (썸네일 리스트용)
          const recent = g.posts
            .filter((p) => p.id !== best.id)
            .slice(0, 2);

          const olderCount = Math.max(0, g.posts.length - g.recentCount);
          const growthRate =
            olderCount === 0
              ? g.recentCount > 0
                ? 100
                : 0
              : Math.round((g.recentCount / olderCount) * 100);

          ranked.push({
            place_id: g.place_id,
            place_name: g.place_name,
            region: g.region,
            postsCount: g.posts.length,
            recentCount: g.recentCount,
            growthRate,
            bestCutPost: best,
            recentPosts: recent,
            // 합산 점수: 최근 활동을 우선, 동률이면 베스트컷 점수
            _sortScore: g.recentCount * 100 + bestScore,
          });
        }

        ranked.sort((a, b) => b._sortScore - a._sortScore);

        setRanking(ranked.slice(0, limit));
      } catch (e) {
        setError(e);
        setRanking([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { ranking, loading, error };
}

export { makePlaceId };

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow, mapCategoryToLj } from './ljPostsMapping';

const PAGE_SIZE = 20;

const SELECT_COLUMNS = `
  id,
  user_id,
  content,
  images,
  location,
  detailed_location,
  place_name,
  region,
  category,
  category_name,
  likes_count,
  comments_count,
  captured_at,
  created_at,
  author_username,
  author_avatar_url,
  is_in_app_camera
`;

/**
 * 홈 피드 — 실제 Supabase posts 테이블에서 가져온다.
 * - 사진 없는(content만 있는) 게시물은 노출하지 않음 (Live Journey는 사진이 정보)
 * - PostCard가 기대하는 형태로 normalizePostRow 매핑
 * - 페이지네이션: created_at desc 커서
 */
export function useHomeFeed(selectedCategory = 'all') {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const cursorRef = useRef(null);

  const fetchPage = useCallback(
    async ({ reset = false } = {}) => {
      if (reset) {
        setLoading(true);
        cursorRef.current = null;
        setHasMore(true);
      } else {
        if (!hasMore) return;
        setLoadingMore(true);
      }
      setError(null);

      try {
        let query = supabase
          .from('posts')
          .select(SELECT_COLUMNS)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        // 카테고리 필터: posts.category가 자유 텍스트라 lj 라벨/id 양쪽 매칭
        if (selectedCategory && selectedCategory !== 'all') {
          const labelOrId = `%${selectedCategory}%`;
          query = query.or(`category.ilike.${labelOrId},category_name.ilike.${labelOrId}`);
        }
        if (cursorRef.current) {
          query = query.lt('created_at', cursorRef.current);
        }

        const { data: rows, error: feedError } = await query;
        if (feedError) throw feedError;

        const raw = rows || [];
        if (raw.length > 0) cursorRef.current = raw[raw.length - 1].created_at;
        if (raw.length < PAGE_SIZE) setHasMore(false);

        const next = raw
          .map(normalizePostRow)
          .filter((p) => !!p.photo_url); // 사진이 정보 — 사진 없으면 노출 X

        setPosts((prev) => (reset ? next : [...prev, ...next]));
      } catch (e) {
        setError(e);
        if (reset) setPosts([]);
      } finally {
        if (reset) setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, hasMore]
  );

  useEffect(() => {
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchPage({ reset: false });
    }
  }, [fetchPage, hasMore, loading, loadingMore]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh: () => fetchPage({ reset: true }),
    loadMore,
  };
}

// 외부에서도 쓸 수 있도록 재노출
export { mapCategoryToLj };

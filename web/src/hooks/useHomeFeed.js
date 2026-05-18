import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const PAGE_SIZE = 20;

const SELECT_COLUMNS = `
  id,
  author_id,
  photo_url,
  category,
  place_id,
  place_name,
  body,
  exif_taken_at,
  expires_at,
  is_on_site,
  helped_count,
  like_count,
  comment_count,
  save_count,
  created_at,
  author:profiles!lj_posts_author_id_fkey ( id, nickname, avatar_url, helped_count )
`;

/**
 * 홈 피드 — 실제 Supabase 데이터만, 무한 스크롤 페이지네이션.
 * - 48시간 룰: expires_at > now() 인 게시물만 노출
 * - cursor: created_at (desc) 로 다음 페이지 fetch
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
          .from('lj_posts')
          .select(SELECT_COLUMNS)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (selectedCategory && selectedCategory !== 'all') {
          query = query.eq('category', selectedCategory);
        }
        if (cursorRef.current) {
          query = query.lt('created_at', cursorRef.current);
        }

        const { data: rows, error: feedError } = await query;
        if (feedError) throw feedError;

        const next = rows || [];
        if (next.length > 0) cursorRef.current = next[next.length - 1].created_at;
        if (next.length < PAGE_SIZE) setHasMore(false);

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

  // 카테고리 변경 시 reset
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const PAGE_SIZE = 20;

// profiles와의 embed는 FK 이름·존재 여부에 따라 404가 날 수 있어서
// posts와 profiles를 두 단계로 나눠 가져온다.
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
  created_at
`;

/**
 * 홈 피드 — 실제 Supabase 데이터만, 무한 스크롤 페이지네이션.
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
        const enriched = await enrichWithAuthors(next);

        if (next.length > 0) cursorRef.current = next[next.length - 1].created_at;
        if (next.length < PAGE_SIZE) setHasMore(false);

        setPosts((prev) => (reset ? enriched : [...prev, ...enriched]));
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

/**
 * 작성자 정보를 별도 쿼리로 붙인다.
 * profiles 테이블·컬럼이 없으면 조용히 비워둔다.
 */
export async function enrichWithAuthors(rows) {
  if (!rows || rows.length === 0) return rows || [];
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean)));
  if (authorIds.length === 0) return rows;

  let map = new Map();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', authorIds);
    if (!error && Array.isArray(data)) {
      data.forEach((p) => map.set(p.id, p));
    }
  } catch (_) {
    // profiles 테이블 누락 등 — 작성자 정보 없이 진행
  }

  return rows.map((r) => ({
    ...r,
    author: map.get(r.author_id) || {
      id: r.author_id,
      nickname: '익명',
      avatar_url: null,
    },
  }));
}

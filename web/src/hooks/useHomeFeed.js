import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { LJ_MOCK_POSTS, LJ_MOCK_LIVE_COUNT } from '../data/ljMockFeed';

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
 * 홈 피드 데이터를 가져온다.
 * - 카테고리 'all'은 전체, 그 외는 lj_category 값으로 필터링.
 * - 48시간 룰: expires_at > now() 인 게시물만 노출.
 * - Supabase가 비어있으면 mock 폴백으로 UI가 항상 보이도록 함.
 */
export function useHomeFeed(selectedCategory = 'all') {
  const [posts, setPosts] = useState([]);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('lj_posts')
        .select(SELECT_COLUMNS)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(40);

      if (selectedCategory && selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const [{ data: rows, error: feedError }, { data: countRow, error: countError }] =
        await Promise.all([
          query,
          supabase.from('lj_live_count').select('live_count').maybeSingle(),
        ]);

      if (feedError) throw feedError;
      if (countError) throw countError;

      if (!rows || rows.length === 0) {
        const filtered =
          selectedCategory === 'all'
            ? LJ_MOCK_POSTS
            : LJ_MOCK_POSTS.filter((p) => p.category === selectedCategory);
        setPosts(filtered);
        setLiveCount(LJ_MOCK_LIVE_COUNT);
      } else {
        setPosts(rows);
        setLiveCount(countRow?.live_count ?? rows.length);
      }
    } catch (e) {
      const filtered =
        selectedCategory === 'all'
          ? LJ_MOCK_POSTS
          : LJ_MOCK_POSTS.filter((p) => p.category === selectedCategory);
      setPosts(filtered);
      setLiveCount(LJ_MOCK_LIVE_COUNT);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return { posts, liveCount, loading, error, refresh: fetchFeed };
}

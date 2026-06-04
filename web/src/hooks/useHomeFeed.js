import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow, mapCategoryToLj } from './ljPostsMapping';

const PAGE_SIZE = 20;

// 실시간성이 핵심 가치 — 업로드 후 48시간이 지난 게시물은 피드에서 내린다.
// (created_at desc 정렬이라 커서가 cutoff 이전으로 내려가면 자연히 멈춘다)
const FEED_WINDOW_HOURS = 48;

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
  exif_data,
  weather,
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
        // 48시간 이내 게시물만 — 시차 없는 실시간 피드
        const windowStart = new Date(
          Date.now() - FEED_WINDOW_HOURS * 60 * 60 * 1000,
        ).toISOString();

        // posts.category가 자유 텍스트/혼합 언어라 서버 필터 대신 클라이언트에서 매핑/필터
        let query = supabase
          .from('posts')
          .select(SELECT_COLUMNS)
          .gte('created_at', windowStart) // 업로드 48시간 지난 글은 노출 X
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (cursorRef.current) {
          query = query.lt('created_at', cursorRef.current);
        }

        const { data: rows, error: feedError } = await query;
        if (feedError) throw feedError;

        const raw = rows || [];
        if (raw.length > 0) cursorRef.current = raw[raw.length - 1].created_at;
        if (raw.length < PAGE_SIZE) setHasMore(false);

        const normalized = raw
          .map(normalizePostRow)
          .filter((p) => !!p.photo_url); // 사진이 정보 — 사진 없으면 노출 X

        // 카테고리 필터링 (클라 사이드, normalized.category는 lj_category id로 매핑됨)
        const filtered =
          selectedCategory === 'all'
            ? normalized
            : normalized.filter((p) => p.category === selectedCategory);

        // 1차: 즉시 렌더 (사진 빨리 띄움) — author.post_count는 일단 0
        setPosts((prev) => (reset ? filtered : [...prev, ...filtered]));

        // 첫 페이지가 채워졌으니 스켈레톤 종료
        if (reset) setLoading(false);

        // 2차: 작성자별 글 수는 백그라운드로 받아 패치 (블로킹 X)
        void enrichWithAuthorPostCount(filtered).then((enriched) => {
          if (!enriched || enriched.length === 0) return;
          const countById = new Map(
            enriched.map((p) => [p.id, p.author?.post_count ?? 0]),
          );
          setPosts((prev) =>
            prev.map((p) =>
              countById.has(p.id)
                ? { ...p, author: { ...p.author, post_count: countById.get(p.id) } }
                : p,
            ),
          );
        });
      } catch (e) {
        setError(e);
        if (reset) setPosts([]);
        if (reset) setLoading(false);
      } finally {
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

/**
 * 작성자별 게시물 수를 병렬 head 조회로 채워 author.post_count에 붙인다.
 * 동일 author가 여러 게시물에 있으면 한 번만 카운트.
 */
async function enrichWithAuthorPostCount(rows) {
  if (!rows || rows.length === 0) return rows || [];
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean)));
  if (authorIds.length === 0) return rows;

  const counts = await Promise.all(
    authorIds.map(async (id) => {
      try {
        const { count } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', id);
        return [id, count ?? 0];
      } catch (_) {
        return [id, 0];
      }
    })
  );
  const map = new Map(counts);
  return rows.map((r) => ({
    ...r,
    author: { ...r.author, post_count: map.get(r.author_id) ?? 0 },
  }));
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { LJ_MOCK_POSTS, LJ_MOCK_COMMENTS } from '../data/ljMockFeed';

const POST_COLUMNS = `
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

const COMMENT_COLUMNS = `
  id,
  post_id,
  parent_id,
  author_id,
  body,
  like_count,
  created_at,
  author:profiles!lj_comments_author_id_fkey ( id, nickname, avatar_url )
`;

/**
 * 댓글 flat 리스트를 부모 → 자식 트리(1단계 깊이)로 묶는다.
 */
function buildCommentTree(rows) {
  const byId = new Map();
  const roots = [];
  rows.forEach((row) => byId.set(row.id, { ...row, replies: [] }));
  rows.forEach((row) => {
    const node = byId.get(row.id);
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id).replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function usePostDetail(postId) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);

    try {
      const [{ data: postRow, error: postError }, { data: commentRows, error: commentError }] =
        await Promise.all([
          supabase.from('lj_posts').select(POST_COLUMNS).eq('id', postId).maybeSingle(),
          supabase
            .from('lj_comments')
            .select(COMMENT_COLUMNS)
            .eq('post_id', postId)
            .order('created_at', { ascending: true }),
        ]);

      if (postError) throw postError;
      if (commentError) throw commentError;

      if (!postRow) {
        // Supabase에 없으면 mock 폴백
        const mock = LJ_MOCK_POSTS.find((p) => String(p.id) === String(postId)) || LJ_MOCK_POSTS[0];
        setPost(mock);
        setComments(buildCommentTree(LJ_MOCK_COMMENTS));
      } else {
        setPost(postRow);
        setComments(buildCommentTree(commentRows || []));
      }
    } catch (e) {
      const mock = LJ_MOCK_POSTS.find((p) => String(p.id) === String(postId)) || LJ_MOCK_POSTS[0];
      setPost(mock);
      setComments(buildCommentTree(LJ_MOCK_COMMENTS));
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addCommentLocal = useCallback((newComment) => {
    setComments((prev) => {
      // parent_id가 있고 부모가 답글이면 평탄화(서버 트리거와 동일)
      let parent = newComment.parent_id;
      if (parent) {
        const findRoot = (list) => {
          for (const c of list) {
            if (c.id === parent) return c.parent_id || c.id;
            for (const r of c.replies || []) {
              if (r.id === parent) return c.id;
            }
          }
          return parent;
        };
        parent = findRoot(prev);
      }
      const node = { ...newComment, parent_id: parent, replies: [] };
      if (!parent) return [...prev, node];
      return prev.map((root) =>
        root.id === parent ? { ...root, replies: [...root.replies, node] } : root
      );
    });
    setPost((prev) => (prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev));
  }, []);

  return { post, comments, loading, error, refresh: fetchAll, addCommentLocal };
}

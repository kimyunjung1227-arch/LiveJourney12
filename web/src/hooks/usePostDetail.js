import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow } from './ljPostsMapping';

const POST_COLUMNS = `
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

const COMMENT_COLUMNS = `
  id,
  post_id,
  user_id,
  username,
  avatar_url,
  content,
  parent_comment_id,
  likes_count,
  created_at
`;

function normalizeComment(row) {
  return {
    id: row.id,
    post_id: row.post_id,
    parent_id: row.parent_comment_id || null,
    author_id: row.user_id,
    body: row.content || '',
    like_count: row.likes_count ?? 0,
    created_at: row.created_at,
    author: {
      id: row.user_id,
      nickname: row.username || '익명',
      avatar_url: row.avatar_url || null,
    },
  };
}

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
          supabase.from('posts').select(POST_COLUMNS).eq('id', postId).maybeSingle(),
          supabase
            .from('post_comments')
            .select(COMMENT_COLUMNS)
            .eq('post_id', postId)
            .order('created_at', { ascending: true }),
        ]);

      if (postError) throw postError;
      if (commentError) throw commentError;

      setPost(postRow ? normalizePostRow(postRow) : null);
      const normalizedComments = (commentRows || []).map(normalizeComment);
      setComments(buildCommentTree(normalizedComments));
    } catch (e) {
      setError(e);
      setPost(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addCommentLocal = useCallback((newComment) => {
    setComments((prev) => {
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

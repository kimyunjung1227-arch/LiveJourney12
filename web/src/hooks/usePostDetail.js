import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow } from './ljPostsMapping';
import { fetchProfileByIdSupabase } from '../api/profilesSupabase';
import { fetchCommentsForPostSupabase } from '../api/socialSupabase';

const POST_COLUMNS = `
  id,
  user_id,
  content,
  images,
  videos,
  location,
  detailed_location,
  place_name,
  region,
  category,
  category_name,
  tags,
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

function normalizeComment(row) {
  return {
    id: row.id,
    post_id: row.post_id,
    parent_id: row.parent_comment_id || null,
    author_id: row.user_id,
    body: row.content || '',
    like_count: row.likes_count ?? 0,
    liked_by_me: !!row.liked_by_me,
    is_author: row.is_author === true,
    created_at: row.created_at,
    // username/avatar_url 은 fetchCommentsForPostSupabase 가
    // 실제 프로필(사용자가 설정한 이름/사진) 기준으로 해석해 준 값이다.
    author: {
      id: row.user_id,
      nickname: row.username || '익명',
      avatar_url: row.avatar_url || null,
      post_count: row.post_count ?? 0,
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

export function usePostDetail(postId, viewerUserId = null) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError(null);

    try {
      const [{ data: postRow, error: postError }, commentRows] = await Promise.all([
        supabase.from('posts').select(POST_COLUMNS).eq('id', postId).maybeSingle(),
        fetchCommentsForPostSupabase(postId, viewerUserId),
      ]);

      if (postError) throw postError;

      const normalized = postRow ? normalizePostRow(postRow) : null;
      // 작성자 표시명은 가입 계정(author_username placeholder) 대신
      // 사용자가 설정한 프로필 이름(profiles.username)을 우선 사용.
      if (normalized?.author_id) {
        const profile = await fetchProfileByIdSupabase(normalized.author_id);
        if (profile) {
          normalized.author = {
            ...normalized.author,
            nickname:
              (typeof profile.username === 'string' && profile.username.trim()) ||
              normalized.author.nickname,
            avatar_url: profile.avatar_url || normalized.author.avatar_url,
          };
        }
      }
      setPost(normalized);
      const normalizedComments = (commentRows || []).map(normalizeComment);
      setComments(buildCommentTree(normalizedComments));
    } catch (e) {
      setError(e);
      setPost(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId, viewerUserId]);

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

  const updateCommentLocal = useCallback((commentId, body) => {
    setComments((prev) =>
      prev.map((root) => {
        if (root.id === commentId) return { ...root, body };
        const replies = (root.replies || []).map((r) =>
          r.id === commentId ? { ...r, body } : r
        );
        return { ...root, replies };
      })
    );
  }, []);

  const removeCommentLocal = useCallback((commentId) => {
    setComments((prev) => {
      // 루트 댓글이면 통째로 제거, 아니면 replies에서만 제거
      const isRoot = prev.some((root) => root.id === commentId);
      const next = isRoot
        ? prev.filter((root) => root.id !== commentId)
        : prev.map((root) => ({
            ...root,
            replies: (root.replies || []).filter((r) => r.id !== commentId),
          }));
      return next;
    });
    setPost((prev) =>
      prev ? { ...prev, comment_count: Math.max(0, (prev.comment_count || 1) - 1) } : prev
    );
  }, []);

  return {
    post,
    comments,
    loading,
    error,
    refresh: fetchAll,
    addCommentLocal,
    updateCommentLocal,
    removeCommentLocal,
  };
}

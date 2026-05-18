import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * 좋아요/저장을 낙관적 업데이트로 토글한다.
 * - postId별 { liked, saved, likeCount, saveCount } 로컬 상태 관리.
 * - UI 먼저 변경 → 백그라운드로 lj_reactions insert/delete.
 * - 실패 시 롤백.
 */
export function useReactions(initialPosts = []) {
  const { user } = useAuth();
  const [state, setState] = useState(() => buildInitial(initialPosts));

  useEffect(() => {
    setState((prev) => {
      const next = buildInitial(initialPosts);
      // 이미 토글했던 로컬 상태는 보존
      Object.keys(prev).forEach((id) => {
        if (next[id] && prev[id].touched) next[id] = prev[id];
      });
      return next;
    });
  }, [initialPosts]);

  // 내가 누른 반응을 한 번에 hydrate
  useEffect(() => {
    if (!user || initialPosts.length === 0) return;
    const ids = initialPosts.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('lj_reactions')
        .select('post_id, kind')
        .eq('user_id', user.id)
        .in('post_id', ids);
      if (cancelled || !data) return;
      setState((prev) => {
        const next = { ...prev };
        data.forEach(({ post_id, kind }) => {
          if (!next[post_id]) return;
          if (kind === 'like') next[post_id] = { ...next[post_id], liked: true };
          if (kind === 'save') next[post_id] = { ...next[post_id], saved: true };
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, initialPosts]);

  const toggle = useCallback(
    async (postId, kind) => {
      if (!postId) return;
      const isLike = kind === 'like';
      let rolledBack = false;

      setState((prev) => {
        const cur = prev[postId] || { liked: false, saved: false, likeCount: 0, saveCount: 0 };
        const active = isLike ? cur.liked : cur.saved;
        const delta = active ? -1 : 1;
        return {
          ...prev,
          [postId]: {
            ...cur,
            touched: true,
            liked: isLike ? !cur.liked : cur.liked,
            saved: !isLike ? !cur.saved : cur.saved,
            likeCount: isLike ? Math.max(0, cur.likeCount + delta) : cur.likeCount,
            saveCount: !isLike ? Math.max(0, cur.saveCount + delta) : cur.saveCount,
          },
        };
      });

      if (!user) return; // 비로그인은 로컬 토글만

      try {
        const active = isLike ? state[postId]?.liked : state[postId]?.saved;
        if (active) {
          const { error } = await supabase
            .from('lj_reactions')
            .delete()
            .eq('user_id', user.id)
            .eq('post_id', postId)
            .eq('kind', kind);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('lj_reactions')
            .insert({ user_id: user.id, post_id: postId, kind });
          if (error && error.code !== '23505') throw error; // 중복은 무시
        }
      } catch (e) {
        rolledBack = true;
        // 롤백
        setState((prev) => {
          const cur = prev[postId];
          if (!cur) return prev;
          const delta = isLike
            ? cur.liked
              ? 1
              : -1
            : cur.saved
              ? 1
              : -1;
          return {
            ...prev,
            [postId]: {
              ...cur,
              liked: isLike ? !cur.liked : cur.liked,
              saved: !isLike ? !cur.saved : cur.saved,
              likeCount: isLike ? Math.max(0, cur.likeCount + delta) : cur.likeCount,
              saveCount: !isLike ? Math.max(0, cur.saveCount + delta) : cur.saveCount,
            },
          };
        });
      }
      return !rolledBack;
    },
    [state, user]
  );

  return {
    state,
    toggleLike: (postId) => toggle(postId, 'like'),
    toggleSave: (postId) => toggle(postId, 'save'),
  };
}

function buildInitial(posts) {
  const out = {};
  posts.forEach((p) => {
    if (!p?.id) return;
    out[p.id] = {
      liked: false,
      saved: false,
      likeCount: p.like_count ?? p.reactions?.like ?? 0,
      saveCount: p.save_count ?? p.reactions?.save ?? 0,
      touched: false,
    };
  });
  return out;
}

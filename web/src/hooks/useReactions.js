import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * 좋아요/저장 낙관적 업데이트.
 * - 좋아요: 기존 post_likes 테이블 (user_id, post_id)
 * - 저장: 현재 DB 스키마에 미지원 → 로컬 토글만 (UI 표시용)
 */
export function useReactions(initialPosts = []) {
  const { user } = useAuth();
  const [state, setState] = useState(() => buildInitial(initialPosts));

  useEffect(() => {
    setState((prev) => {
      const next = buildInitial(initialPosts);
      Object.keys(prev).forEach((id) => {
        if (next[id] && prev[id].touched) next[id] = prev[id];
      });
      return next;
    });
  }, [initialPosts]);

  // 내가 누른 좋아요 hydrate
  useEffect(() => {
    if (!user || initialPosts.length === 0) return;
    const ids = initialPosts.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', ids);
      if (cancelled || error || !data) return;
      setState((prev) => {
        const next = { ...prev };
        data.forEach(({ post_id }) => {
          if (next[post_id]) next[post_id] = { ...next[post_id], liked: true };
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, initialPosts]);

  const toggleLike = useCallback(
    async (postId) => {
      if (!postId) return;
      // 토글 전 상태 캡처 후 낙관 업데이트
      let wasLiked = false;
      setState((prev) => {
        const cur = prev[postId] || { liked: false, saved: false, likeCount: 0, saveCount: 0 };
        wasLiked = cur.liked;
        return {
          ...prev,
          [postId]: {
            ...cur,
            touched: true,
            liked: !cur.liked,
            likeCount: Math.max(0, cur.likeCount + (cur.liked ? -1 : 1)),
          },
        };
      });

      if (!user) return; // 비로그인은 로컬 토글만

      try {
        if (wasLiked) {
          // 삭제: select 옵션으로 실제 지워진 row 받아 검증
          const { data, error } = await supabase
            .from('post_likes')
            .delete()
            .eq('user_id', user.id)
            .eq('post_id', postId)
            .select('post_id');
          if (error) throw error;
          // 실제로 지운 게 없으면(이미 없는 좋아요였음) 낙관 -1 보정 → +1 되돌림
          if (!data || data.length === 0) {
            setState((prev) => {
              const cur = prev[postId];
              if (!cur) return prev;
              return {
                ...prev,
                [postId]: { ...cur, liked: false, likeCount: cur.likeCount + 1 },
              };
            });
          }
        } else {
          const { error } = await supabase
            .from('post_likes')
            .insert({ user_id: user.id, post_id: postId });
          if (error) {
            if (error.code === '23505') {
              // 이미 좋아요 누른 상태였음 → 낙관 +1 보정 -1 (DB는 변화 없음)
              setState((prev) => {
                const cur = prev[postId];
                if (!cur) return prev;
                return {
                  ...prev,
                  [postId]: {
                    ...cur,
                    liked: true,
                    likeCount: Math.max(0, cur.likeCount - 1),
                  },
                };
              });
            } else {
              throw error;
            }
          }
        }

        // 정합성 보강: 트리거가 갱신한 posts.likes_count를 정확히 가져와 동기화
        const { data: fresh } = await supabase
          .from('posts')
          .select('likes_count')
          .eq('id', postId)
          .maybeSingle();
        if (fresh && typeof fresh.likes_count === 'number') {
          setState((prev) => {
            const cur = prev[postId];
            if (!cur) return prev;
            return { ...prev, [postId]: { ...cur, likeCount: fresh.likes_count } };
          });
        }
      } catch (_) {
        // 롤백
        setState((prev) => {
          const cur = prev[postId];
          if (!cur) return prev;
          return {
            ...prev,
            [postId]: {
              ...cur,
              liked: wasLiked,
              likeCount: Math.max(0, cur.likeCount + (wasLiked ? 1 : -1)),
            },
          };
        });
      }
    },
    [user]
  );

  // 저장은 DB 스키마 미지원 — UI 토글만 수행
  const toggleSave = useCallback((postId) => {
    if (!postId) return;
    setState((prev) => {
      const cur = prev[postId] || { liked: false, saved: false, likeCount: 0, saveCount: 0 };
      return {
        ...prev,
        [postId]: {
          ...cur,
          touched: true,
          saved: !cur.saved,
          saveCount: Math.max(0, cur.saveCount + (cur.saved ? -1 : 1)),
        },
      };
    });
  }, []);

  return { state, toggleLike, toggleSave };
}

function buildInitial(posts) {
  const out = {};
  posts.forEach((p) => {
    if (!p?.id) return;
    out[p.id] = {
      liked: false,
      saved: false,
      likeCount: p.like_count ?? 0,
      saveCount: p.save_count ?? 0,
      touched: false,
    };
  });
  return out;
}

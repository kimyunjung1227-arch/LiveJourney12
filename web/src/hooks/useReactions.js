import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { savePlace, unsavePlace, fetchSavedPlaces } from '../api/savedPlacesSupabase';
import { makePlaceId } from './ljPostsMapping';

/**
 * 좋아요/저장 낙관적 업데이트.
 * - 좋아요: 기존 post_likes 테이블 (user_id, post_id)
 * - 저장: 게시물의 장소를 interest_places 에 저장 (프로필 "저장한 장소" 탭과 연동).
 *   같은 장소를 가진 게시물은 함께 토글된다. 비로그인/장소명 없음은 로컬 토글만.
 */
export function useReactions(initialPosts = []) {
  const { user } = useAuth();
  const [state, setState] = useState(() => buildInitial(initialPosts));

  // toggleSave 에서 postId 로 장소명/지역을 역참조하기 위한 최신 posts 스냅샷
  const postsRef = useRef(initialPosts);
  useEffect(() => {
    postsRef.current = initialPosts;
  }, [initialPosts]);

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

  // 내가 저장한 장소 hydrate — 저장된 장소를 가진 게시물의 북마크를 채움
  useEffect(() => {
    if (!user || initialPosts.length === 0) return;
    let cancelled = false;
    (async () => {
      const saved = await fetchSavedPlaces(user.id);
      if (cancelled || !saved || saved.length === 0) return;
      const savedKeys = new Set(saved.map((s) => makePlaceId(s.name)).filter(Boolean));
      setState((prev) => {
        const next = { ...prev };
        initialPosts.forEach((p) => {
          const key = makePlaceId(p.place_name);
          // 사용자가 직접 토글하지 않은 항목만 갱신 (낙관 업데이트 보호)
          if (key && savedKeys.has(key) && next[p.id] && !next[p.id].touched) {
            next[p.id] = { ...next[p.id], saved: true };
          }
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

  // 저장: 게시물의 장소를 interest_places 에 저장/해제 (낙관 업데이트 + 실패 롤백)
  const toggleSave = useCallback(
    async (postId) => {
      if (!postId) return;
      const post = postsRef.current.find((p) => p.id === postId);
      const placeName = String(post?.place_name || '').trim();
      const region = post?.region || '';
      const placeKey = makePlaceId(placeName);

      // 같은 장소를 가진 게시물은 함께 토글 (북마크 상태 일관성)
      const affectedIds = placeKey
        ? postsRef.current
            .filter((p) => makePlaceId(p.place_name) === placeKey)
            .map((p) => p.id)
        : [postId];

      let wasSaved = false;
      setState((prev) => {
        const cur = prev[postId] || { liked: false, saved: false, likeCount: 0, saveCount: 0 };
        wasSaved = cur.saved;
        const next = { ...prev };
        affectedIds.forEach((id) => {
          const c = next[id];
          if (!c) return;
          next[id] = {
            ...c,
            touched: true,
            saved: !wasSaved,
            saveCount: Math.max(0, c.saveCount + (wasSaved ? -1 : 1)),
          };
        });
        return next;
      });

      // 비로그인이거나 장소명이 없으면 로컬 토글만 (DB 미반영)
      if (!user || !placeName) return;

      const res = wasSaved
        ? await unsavePlace(user.id, placeName)
        : await savePlace(user.id, placeName, region);

      if (!res.success) {
        // 롤백
        setState((prev) => {
          const next = { ...prev };
          affectedIds.forEach((id) => {
            const c = next[id];
            if (!c) return;
            next[id] = {
              ...c,
              saved: wasSaved,
              saveCount: Math.max(0, c.saveCount + (wasSaved ? 1 : -1)),
            };
          });
          return next;
        });
      }
    },
    [user]
  );

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

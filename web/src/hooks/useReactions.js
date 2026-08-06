import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { savePlace, unsavePlace, fetchSavedPlaces } from '../api/savedPlacesSupabase';
import { toggleLikeForPost } from '../utils/postLikeActions';
import { makePlaceId } from './ljPostsMapping';

/**
 * 좋아요/저장 낙관적 업데이트.
 * - 좋아요: `set_post_like` RPC (서버가 단일 진실). 응답의 is_liked/likes_count 로 최종 동기화.
 * - 저장: 게시물의 장소를 interest_places 에 저장 (프로필 "저장한 장소" 탭과 연동).
 *   같은 장소를 가진 게시물은 함께 토글된다. 비로그인/장소명 없음은 로컬 토글만.
 *
 * 좋아요 취소가 풀리던 원인과 대응:
 * 1) 클릭 시점의 liked 를 `setState(prev => ...)` 안에서 읽었는데, 이 updater 는 동기 실행이 보장되지
 *    않아(렌더 단계에서 실행) 뒤따르는 코드가 항상 "안 눌린 상태"로 판단 → 취소가 다시 insert 로 갔다.
 *    → 사용자의 최신 의도를 `likeIntentRef` 에 동기적으로 기록해서 판단한다.
 * 2) hydrate 가 liked=true 만 칠하고 false 는 지우지 않아, 응답이 늦게 오면 방금 취소한 하트가 되살아났다.
 *    → true/false 를 모두 반영하고, 사용자가 건드린(intent 가 있는) 게시물은 건너뛴다.
 * 3) 연타 시 늦게 도착한 이전 응답이 최신 상태를 덮어썼다. → 요청 시퀀스로 오래된 응답을 버린다.
 */
export function useReactions(initialPosts = []) {
  const { user } = useAuth();
  const [state, setState] = useState(() => buildInitial(initialPosts));

  // toggleSave 에서 postId 로 장소명/지역을 역참조하기 위한 최신 posts 스냅샷
  const postsRef = useRef(initialPosts);
  useEffect(() => {
    postsRef.current = initialPosts;
  }, [initialPosts]);

  // 렌더된 최신 state 스냅샷 (핸들러가 stale closure 없이 현재 값을 읽기 위함)
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 좋아요: 사용자가 마지막으로 "의도한" 상태 (클릭 즉시 동기 기록 → 연타/취소 판정의 기준)
  const likeIntentRef = useRef(new Map());
  // 좋아요: postId 별 요청 순번 (늦게 도착한 과거 응답 폐기용)
  const likeSeqRef = useRef(new Map());

  useEffect(() => {
    setState((prev) => {
      const next = buildInitial(initialPosts);
      Object.keys(prev).forEach((id) => {
        if (next[id] && prev[id].touched) next[id] = prev[id];
      });
      return next;
    });
  }, [initialPosts]);

  // 내가 누른 좋아요 hydrate — 켜기/끄기를 모두 반영하고, 방금 누른 건(intent 보유) 덮지 않는다
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
      const likedIds = new Set(data.map(({ post_id }) => String(post_id)));
      setState((prev) => {
        const next = { ...prev };
        let changed = false;
        ids.forEach((rawId) => {
          const id = String(rawId);
          // 사용자가 직접 토글한 게시물은 서버 응답(토글 결과)이 진실 — hydrate 로 덮지 않는다
          if (likeIntentRef.current.has(id)) return;
          const cur = next[id];
          if (!cur) return;
          const liked = likedIds.has(id);
          if (cur.liked === liked) return;
          next[id] = { ...cur, liked };
          changed = true;
        });
        return changed ? next : prev;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, initialPosts]);

  // 다른 화면(핫플/추천/지역 피드)에서 같은 게시물을 토글하면 여기도 맞춘다
  useEffect(() => {
    const onLikeUpdated = (e) => {
      const { postId, isLiked, likesCount } = e.detail || {};
      if (!postId) return;
      const id = String(postId);
      likeIntentRef.current.set(id, !!isLiked);
      setState((prev) => {
        const cur = prev[id];
        if (!cur) return prev;
        return {
          ...prev,
          [id]: {
            ...cur,
            touched: true,
            liked: !!isLiked,
            likeCount: typeof likesCount === 'number' ? Math.max(0, likesCount) : cur.likeCount,
          },
        };
      });
    };
    window.addEventListener('postLikeUpdated', onLikeUpdated);
    return () => window.removeEventListener('postLikeUpdated', onLikeUpdated);
  }, []);

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
      const id = String(postId);

      // 클릭 시점의 "진짜" 현재 상태 — setState updater 가 아니라 동기 ref 에서 읽는다
      const wasLiked = likeIntentRef.current.has(id)
        ? !!likeIntentRef.current.get(id)
        : !!stateRef.current[id]?.liked;
      const nextLiked = !wasLiked;
      likeIntentRef.current.set(id, nextLiked);

      const seq = (likeSeqRef.current.get(id) || 0) + 1;
      likeSeqRef.current.set(id, seq);

      // 낙관 업데이트
      setState((prev) => {
        const cur = prev[id] || { liked: false, saved: false, likeCount: 0, saveCount: 0 };
        return {
          ...prev,
          [id]: {
            ...cur,
            touched: true,
            liked: nextLiked,
            likeCount: Math.max(0, cur.likeCount + (nextLiked ? 1 : -1)),
          },
        };
      });

      if (!user) return; // 비로그인은 로컬 토글만

      const res = await toggleLikeForPost({ postId: id, userId: user.id, likedBefore: wasLiked });

      // 그 사이 더 눌렀으면 이 응답은 이미 낡았다 — 마지막 요청의 응답만 반영
      if (likeSeqRef.current.get(id) !== seq) return;

      if (res?.success) {
        // 서버 응답이 최종 진실
        likeIntentRef.current.set(id, !!res.isLiked);
        setState((prev) => {
          const cur = prev[id];
          if (!cur) return prev;
          return {
            ...prev,
            [id]: {
              ...cur,
              liked: !!res.isLiked,
              likeCount:
                typeof res.likesCount === 'number' ? Math.max(0, res.likesCount) : cur.likeCount,
            },
          };
        });
        return;
      }

      // UUID 가 아닌 목업/로컬 게시물은 서버에 못 쓰므로 로컬 토글을 유지
      if (res?.reason === 'non_uuid' || res?.reason === 'invalid_ids') return;

      // 서버 실패 → 롤백
      likeIntentRef.current.set(id, wasLiked);
      setState((prev) => {
        const cur = prev[id];
        if (!cur) return prev;
        return {
          ...prev,
          [id]: {
            ...cur,
            liked: wasLiked,
            likeCount: Math.max(0, cur.likeCount + (nextLiked ? -1 : 1)),
          },
        };
      });
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

      // 좋아요와 같은 이유로, 클릭 시점 상태는 updater 안이 아니라 ref 에서 동기적으로 읽는다
      const wasSaved = !!stateRef.current[postId]?.saved;
      setState((prev) => {
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

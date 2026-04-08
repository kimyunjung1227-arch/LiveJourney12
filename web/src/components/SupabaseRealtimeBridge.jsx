import React, { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { syncNotificationsFromSupabase } from '../utils/notifications';

/**
 * Supabase Realtime → window 이벤트 브리지
 * - 화면들은 기존처럼 postsUpdated / notificationUpdate 등을 듣고 빠르게 갱신
 * - 다른 기기/계정에서 발생한 변경도 즉시 반영
 */
const SupabaseRealtimeBridge = () => {
  const debounceRef = useRef(null);

  useEffect(() => {
    const emitPostsUpdatedDebounced = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          window.dispatchEvent(new Event('postsUpdated'));
        } catch {}
      }, 350);
    };

    const emit = (name, detail) => {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      } catch {}
    };

    // posts: 새 게시물/수정/삭제 → 피드 재조회
    const chPosts = supabase
      .channel('rt-posts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => emitPostsUpdatedDebounced()
      )
      .subscribe();

    // comments: post_comments 삽입/수정/삭제 → 해당 postId만도 알릴 수 있게
    const chComments = supabase
      .channel('rt-post-comments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload) => {
          const postId = payload?.new?.post_id || payload?.old?.post_id || null;
          if (postId) emit('postCommentsUpdated', { postId, comments: [] });
          emitPostsUpdatedDebounced();
        }
      )
      .subscribe();

    // likes: post_likes 삽입/삭제 → posts.likes_count 트리거 갱신되므로 피드 재조회
    const chLikes = supabase
      .channel('rt-post-likes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        (payload) => {
          const postId = payload?.new?.post_id || payload?.old?.post_id || null;
          if (postId) emit('postLikeUpdated', { postId, likesCount: NaN });
          emitPostsUpdatedDebounced();
        }
      )
      .subscribe();

    // follows: 팔로우/언팔로우 → 프로필 팔로워 수 갱신
    const chFollows = supabase
      .channel('rt-follows')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => {
          try {
            window.dispatchEvent(new Event('followsUpdated'));
          } catch {}
        }
      )
      .subscribe();

    // notifications: 알림 추가/읽음/삭제 → 알림 화면/배지 갱신
    const chNoti = supabase
      .channel('rt-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        async () => {
          try {
            // 다른 기기에서 생긴 알림도 알림화면에서 보이도록 Supabase → 로컬 캐시 동기화
            let uid = null;
            try {
              const raw = localStorage.getItem('user');
              const u = raw ? JSON.parse(raw) : null;
              uid = u?.id ? String(u.id) : null;
            } catch {
              uid = null;
            }
            if (uid) {
              await syncNotificationsFromSupabase(uid);
            }
            window.dispatchEvent(new Event('notificationUpdate'));
            window.dispatchEvent(new Event('notificationCountChanged'));
          } catch {}
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(chPosts);
      supabase.removeChannel(chComments);
      supabase.removeChannel(chLikes);
      supabase.removeChannel(chFollows);
      supabase.removeChannel(chNoti);
    };
  }, []);

  return null;
};

export default SupabaseRealtimeBridge;


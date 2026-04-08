import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { sendNotificationToUser } from '../utils/notifications';
import { setLikedPostLocalCache } from '../utils/socialInteractions';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/** @returns {string[]|null} 실패 시 null(로컬 likedPosts 캐시를 잘못 덮어쓰지 않음) */
export const fetchLikedPostIdsSupabase = async (userId, postIds) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return [];
  const ids = (Array.isArray(postIds) ? postIds : []).map(String).filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', uid)
      .in('post_id', ids);
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((r) => String(r.post_id));
  } catch (e) {
    logger.warn('fetchLikedPostIdsSupabase 실패:', e?.message);
    return null;
  }
};

export const isPostLikedSupabase = async (userId, postId) => {
  const uid = String(userId || '').trim();
  const pid = String(postId || '').trim();
  if (!isValidUuid(uid) || !isValidUuid(pid)) return false;
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', uid)
      .eq('post_id', pid)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) {
    logger.warn('isPostLikedSupabase 실패:', e?.message);
    return false;
  }
};

async function resolveActorDisplayForLike(uid, hint) {
  if (hint?.username && String(hint.username).trim()) {
    return { name: String(hint.username).trim(), avatar: hint.avatarUrl || null };
  }
  try {
    const { data: row } = await supabase
      .from('posts')
      .select('author_username, author_avatar_url')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row?.author_username) {
      return { name: String(row.author_username), avatar: row.author_avatar_url || null };
    }
  } catch {
    // ignore
  }
  return { name: '여행자', avatar: null };
}

export const togglePostLikeSupabase = async (userId, postId, actorHint = null) => {
  const uid = String(userId || '').trim();
  const pid = String(postId || '').trim();
  if (!isValidUuid(uid) || !isValidUuid(pid)) return { success: false, isLiked: false };
  try {
    const { data: existing, error: existErr } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', uid)
      .eq('post_id', pid)
      .maybeSingle();
    if (existErr) throw existErr;

    if (existing) {
      const { error: delErr } = await supabase
        .from('post_likes')
        .delete()
        .eq('user_id', uid)
        .eq('post_id', pid);
      if (delErr) throw delErr;
      setLikedPostLocalCache(pid, false);
      return { success: true, isLiked: false };
    }

    const { error: insErr } = await supabase
      .from('post_likes')
      .insert({ user_id: uid, post_id: pid });
    if (insErr) throw insErr;

    setLikedPostLocalCache(pid, true);

    const { data: postRow } = await supabase
      .from('posts')
      .select('user_id, images')
      .eq('id', pid)
      .maybeSingle();
    const ownerId = postRow?.user_id ? String(postRow.user_id) : null;
    if (ownerId && ownerId !== uid) {
      const { name: actorName, avatar: actorAv } = await resolveActorDisplayForLike(uid, actorHint);
      const imgs = postRow?.images;
      const thumb =
        Array.isArray(imgs) && imgs[0]
          ? imgs[0]
          : imgs && typeof imgs === 'string'
            ? imgs
            : null;
      await sendNotificationToUser({
        recipientUserId: ownerId,
        actorUserId: uid,
        actorUsername: actorName,
        actorAvatar: actorAv,
        postId: pid,
        thumbnailUrl: thumb || null,
        type: 'like',
        message: `${actorName}님이 회원님이 올린 정보를 좋아합니다.`,
      });
    }

    return { success: true, isLiked: true };
  } catch (e) {
    logger.warn('togglePostLikeSupabase 실패:', e?.message);
    return { success: false, isLiked: false };
  }
};

export const fetchCommentsForPostSupabase = async (postId) => {
  const pid = String(postId || '').trim();
  if (!isValidUuid(pid)) return [];
  try {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', pid)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchCommentsForPostSupabase 실패:', e?.message);
    return [];
  }
};

export const addCommentSupabase = async ({ postId, userId, username, avatarUrl, content }) => {
  const pid = String(postId || '').trim();
  const uid = String(userId || '').trim();
  if (!isValidUuid(pid) || !isValidUuid(uid) || !String(content || '').trim()) return { success: false };
  try {
    const payload = {
      post_id: pid,
      user_id: uid,
      username: username || null,
      avatar_url: avatarUrl || null,
      content: String(content).trim(),
    };
    const { data, error } = await supabase.from('post_comments').insert(payload).select('*').single();
    if (error) throw error;

    const { data: postRow } = await supabase
      .from('posts')
      .select('user_id, images')
      .eq('id', pid)
      .maybeSingle();
    const ownerId = postRow?.user_id ? String(postRow.user_id) : null;
    if (ownerId && ownerId !== uid) {
      const actorName = String(username || '').trim() || '여행자';
      const imgs = postRow?.images;
      const thumb =
        Array.isArray(imgs) && imgs[0]
          ? imgs[0]
          : imgs && typeof imgs === 'string'
            ? imgs
            : null;
      await sendNotificationToUser({
        recipientUserId: ownerId,
        actorUserId: uid,
        actorUsername: actorName,
        actorAvatar: avatarUrl || null,
        postId: pid,
        thumbnailUrl: thumb || null,
        type: 'comment',
        message: `${actorName}님이 회원님이 올린 정보에 댓글을 남겼습니다.`,
      });
    }

    return { success: true, row: data };
  } catch (e) {
    logger.warn('addCommentSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const updateCommentSupabase = async ({ commentId, userId, content }) => {
  const cid = String(commentId || '').trim();
  const uid = String(userId || '').trim();
  if (!cid || !isValidUuid(uid) || !String(content || '').trim()) return { success: false };
  try {
    const { error } = await supabase
      .from('post_comments')
      .update({ content: String(content).trim(), updated_at: new Date().toISOString() })
      .eq('id', cid)
      .eq('user_id', uid);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('updateCommentSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const deleteCommentSupabase = async ({ commentId, userId }) => {
  const cid = String(commentId || '').trim();
  const uid = String(userId || '').trim();
  if (!cid || !isValidUuid(uid)) return { success: false };
  try {
    const { error } = await supabase.from('post_comments').delete().eq('id', cid).eq('user_id', uid);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('deleteCommentSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const isFollowingSupabase = async (followerId, followingId) => {
  const fid = String(followerId || '').trim();
  const tid = String(followingId || '').trim();
  if (!isValidUuid(fid) || !isValidUuid(tid)) return false;
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', fid)
      .eq('following_id', tid)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) {
    logger.warn('isFollowingSupabase 실패:', e?.message);
    return false;
  }
};

export const followSupabase = async (followerId, followingId) => {
  const fid = String(followerId || '').trim();
  const tid = String(followingId || '').trim();
  if (!isValidUuid(fid) || !isValidUuid(tid) || fid === tid) return { success: false };
  try {
    const { error } = await supabase.from('follows').insert({ follower_id: fid, following_id: tid });
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('followSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const unfollowSupabase = async (followerId, followingId) => {
  const fid = String(followerId || '').trim();
  const tid = String(followingId || '').trim();
  if (!isValidUuid(fid) || !isValidUuid(tid) || fid === tid) return { success: false };
  try {
    const { error } = await supabase.from('follows').delete().eq('follower_id', fid).eq('following_id', tid);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('unfollowSupabase 실패:', e?.message);
    return { success: false };
  }
};


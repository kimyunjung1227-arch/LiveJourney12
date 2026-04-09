import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { sendNotificationToUser } from '../utils/notifications';
import { setLikedPostLocalCache } from '../utils/socialInteractions';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

// 좋아요/언좋아요 연타(중복 요청)로 409가 발생하는 케이스를 줄이기 위한 per-post mutex
const likeMutex = new Map(); // key: `${userId}:${postId}` -> Promise
async function withLikeLock(key, fn) {
  const prev = likeMutex.get(key) || Promise.resolve();
  let release;
  const next = new Promise((r) => (release = r));
  likeMutex.set(key, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    release();
    // 체인이 끝났다면 정리
    if (likeMutex.get(key) === next) likeMutex.delete(key);
  }
}

/** PostgREST insert 시 (post_id,user_id) 등 unique 충돌 */
function isUniqueConflictError(err, depth = 0) {
  if (!err || depth > 2) return false;
  const status = Number(err.status ?? err.statusCode ?? err?.context?.response?.status ?? 0);
  if (status === 409) return true;
  const code = String(err.code || '');
  if (code === '23505' || code === '409') return true;
  const msg = String(err.message || err.msg || '').toLowerCase();
  if (
    msg.includes('duplicate') ||
    msg.includes('unique constraint') ||
    msg.includes('already exists') ||
    msg.includes('violates unique') ||
    msg.includes('conflict')
  ) {
    return true;
  }
  const det = String(err.details || err.hint || '').toLowerCase();
  if (det.includes('duplicate') || det.includes('unique')) return true;
  if (isUniqueConflictError(err.error, depth + 1)) return true;
  if (isUniqueConflictError(err.cause, depth + 1)) return true;
  return false;
}

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

/**
 * 좋아요 토글. `likedBeforeClick`은 클릭 직전 UI/캐시 상태(필수).
 * 좋아요 추가는 insert만 사용 — 409/23505/duplicate는 "이미 좋아요"로 멱등 성공 처리.
 */
export const togglePostLikeSupabase = async (userId, postId, actorHint = null, opts = {}) => {
  const uid = String(userId || '').trim();
  const pid = String(postId || '').trim();
  if (!isValidUuid(uid) || !isValidUuid(pid)) return { success: false, isLiked: false };
  const likedBeforeClick = opts.likedBeforeClick;
  const lockKey = `${uid}:${pid}`;
  return await withLikeLock(lockKey, async () => {
    try {
    if (likedBeforeClick === true) {
      // optimistic
      setLikedPostLocalCache(pid, false);
      // RPC 우선(409 자체 제거). 없으면 기존 delete로 fallback.
      const { data: rpcOk, error: rpcErr } = await supabase.rpc('unlike_post', { p_post_id: pid });
      if (rpcErr) {
        const { error: delErr } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', uid)
          .eq('post_id', pid);
        if (delErr) throw delErr;
      } else if (rpcOk !== true && rpcOk !== false) {
        // ignore unexpected return
      }
      return { success: true, isLiked: false };
    }

    // RPC 우선(409 자체 제거). 반환값: inserted(boolean)
    let insertedFresh = false;
    // optimistic
    setLikedPostLocalCache(pid, true);
    const { data: rpcInserted, error: rpcErr } = await supabase.rpc('like_post', { p_post_id: pid });
    if (!rpcErr) {
      insertedFresh = rpcInserted === true;
    } else if (isUniqueConflictError(rpcErr)) {
      // RPC가 409/23505로 터져도 "이미 좋아요"로 멱등 성공 처리
      return { success: true, isLiked: true };
    } else {
      // RPC가 실패해도 UI가 즉시 "초기화"되지 않게 optimistic을 유지하고 성공으로 처리.
      // 이후 피드 동기화(fetchLikedPostIdsSupabase)가 실제 상태로 확정함.
      logger.warn('like_post RPC 실패(optimistic 유지):', rpcErr?.message || rpcErr);
      return { success: true, isLiked: true };
    }

    const { data: postRow } = await supabase
      .from('posts')
      .select('user_id, images')
      .eq('id', pid)
      .maybeSingle();
    const ownerId = postRow?.user_id ? String(postRow.user_id) : null;
    if (insertedFresh && ownerId && ownerId !== uid) {
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
    logger.warn('togglePostLikeSupabase 실패(초기화 방지):', e?.message, e?.code || e?.status || '');
    // 초기화 방지: 예외가 나도 클릭 의도대로 로컬 상태를 유지
    const desired = likedBeforeClick === true ? false : true;
    try {
      setLikedPostLocalCache(pid, desired);
    } catch {}
    return { success: true, isLiked: desired };
  }
  });
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
    if (error) {
      logger.warn('addCommentSupabase:', error.code, error.message, error.status ?? error.statusCode);
      throw error;
    }

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
    const { error } = await supabase
      .from('follows')
      .upsert({ follower_id: fid, following_id: tid }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
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


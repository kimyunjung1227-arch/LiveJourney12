import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
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

async function fetchLikesCountFromLikesTable(postId) {
  const pid = String(postId || '').trim();
  if (!isValidUuid(pid)) return null;
  try {
    const { count, error } = await supabase
      .from('post_likes')
      .select('post_id', { count: 'exact', head: true })
      .eq('post_id', pid);
    if (error) throw error;
    if (typeof count !== 'number') return null;
    return Math.max(0, count);
  } catch (e) {
    logger.warn('fetchLikesCountFromLikesTable 실패:', e?.message);
    return null;
  }
}

/**
 * 좋아요 토글. `likedBeforeClick`은 클릭 직전 UI/캐시 상태(필수).
 * 서버는 `set_post_like` RPC로 멱등 처리.
 */
export const togglePostLikeSupabase = async (userId, postId, actorHint = null, opts = {}) => {
  const uid = String(userId || '').trim();
  const pid = String(postId || '').trim();
  if (!isValidUuid(uid) || !isValidUuid(pid)) return { success: false, isLiked: false, likesCount: null };
  const likedBeforeClick = opts.likedBeforeClick;
  const baseLikesCount = Number.isFinite(Number(opts.baseLikesCount)) ? Math.max(0, Number(opts.baseLikesCount)) : null;
  const lockKey = `${uid}:${pid}`;
  return await withLikeLock(lockKey, async () => {
    try {
    // ✅ 세션이 없으면(auth.uid=null) RPC는 항상 {is_liked:false, likes_count:0}로 회귀할 수 있다.
    // 이 경우는 "좋아요가 안 되는" 상태이므로 요청 자체를 막고 UI도 롤백시킨다.
    try {
      const { data: ses } = await supabase.auth.getSession();
      const sid = ses?.session?.user?.id ? String(ses.session.user.id) : null;
      if (!sid || sid !== uid) {
        logger.warn('togglePostLikeSupabase: 세션 없음/불일치', { sid, uid });
        return { success: false, isLiked: !!likedBeforeClick, likesCount: null, error: 'no_session' };
      }
    } catch (_) {
      return { success: false, isLiked: !!likedBeforeClick, likesCount: null, error: 'no_session' };
    }

    const desired = likedBeforeClick === true ? false : true;
    // optimistic
    setLikedPostLocalCache(pid, desired);

    // ✅ 최종값(좋아요 여부 + likes_count)을 서버에서 한 번에 받아온다.
    const { data: rows, error: rpcErr } = await supabase.rpc('set_post_like', { p_post_id: pid, p_like: desired });
    if (rpcErr) {
      // RPC가 없거나 실패해도, 수동으로 post_likes를 맞추고 likes_count를 읽어온다.
      logger.warn('set_post_like RPC 실패 → 수동 폴백 시도:', rpcErr?.message || rpcErr);
      try {
        if (desired) {
          const { error: insErr } = await supabase.from('post_likes').insert({ user_id: uid, post_id: pid });
          if (insErr && !isUniqueConflictError(insErr)) throw insErr;
        } else {
          const { error: delErr } = await supabase.from('post_likes').delete().eq('user_id', uid).eq('post_id', pid);
          if (delErr) throw delErr;
        }
        // likes_count 트리거가 없거나 반영이 느려도 0으로 되돌아가지 않게
        // post_likes를 직접 count해서 최종값을 만든다.
        let likesCount = await fetchLikesCountFromLikesTable(pid);
        // RLS/반영지연으로 count가 0/NULL로 보이는 경우를 방지: 클라이언트가 알고 있는 base값을 우선 사용
        if ((likesCount == null || likesCount === 0) && baseLikesCount != null) {
          const delta = (desired ? 1 : 0) - (likedBeforeClick === true ? 1 : 0);
          likesCount = Math.max(0, baseLikesCount + delta);
        }
        // 확정 liked 캐시 갱신
        setLikedPostLocalCache(pid, desired);
        if (likesCount != null) {
          try {
            window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId: pid, likesCount } }));
          } catch {}
        }
        return { success: true, isLiked: desired, likesCount };
      } catch (fallbackErr) {
        // 서버가 안 되면 일단 optimistic 유지(초기화 방지)
        logger.warn('좋아요 수동 폴백 실패(optimistic 유지):', fallbackErr?.message || fallbackErr);
        return { success: true, isLiked: desired, likesCount: null };
      }
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    const isLiked = row?.is_liked != null ? !!row.is_liked : desired;
    let likesCount = row?.likes_count != null ? Math.max(0, Number(row.likes_count) || 0) : null;
    if (likesCount == null || likesCount === 0) {
      const fromLikes = await fetchLikesCountFromLikesTable(pid);
      if (typeof fromLikes === 'number') likesCount = fromLikes;
    }
    if ((likesCount == null || likesCount === 0) && baseLikesCount != null) {
      const delta = (isLiked ? 1 : 0) - (likedBeforeClick === true ? 1 : 0);
      likesCount = Math.max(0, baseLikesCount + delta);
    }
    setLikedPostLocalCache(pid, isLiked);
    if (likesCount != null) {
      try {
        window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId: pid, likesCount } }));
      } catch {}
    }

    // ✅ 알림은 DB 트리거가 생성한다.

    return { success: true, isLiked, likesCount };
  } catch (e) {
    logger.warn('togglePostLikeSupabase 실패(초기화 방지):', e?.message, e?.code || e?.status || '');
    // 초기화 방지: 예외가 나도 클릭 의도대로 로컬 상태를 유지
    const desired = likedBeforeClick === true ? false : true;
    try {
      setLikedPostLocalCache(pid, desired);
    } catch {}
    return { success: true, isLiked: desired, likesCount: null };
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

    // ✅ 알림은 DB 트리거가 생성한다.

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
    if (error) {
      if (isUniqueConflictError(error)) return { success: true };
      throw error;
    }
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


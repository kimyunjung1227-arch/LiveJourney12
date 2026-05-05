import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { getSessionOnce } from '../utils/supabaseAuthCache';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

// 좋아요/언좋아요 연타(중복 요청) 방어용 per-post mutex
const likeMutex = new Map();
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
    if (likeMutex.get(key) === next) likeMutex.delete(key);
  }
}

/**
 * 좋아요 토글. 서버(`set_post_like` RPC)가 단일 진실.
 * - 세션 검증 → RPC 호출 → 응답 그대로 반환
 * - UI의 optimistic은 호출부(React state)에서 처리한다. 여기서는 캐시 안 씀.
 */
export const togglePostLikeSupabase = async (userId, postId, opts = {}) => {
  const uid = String(userId || '').trim();
  const pid = String(postId || '').trim();
  if (!isValidUuid(uid) || !isValidUuid(pid)) return { success: false, isLiked: false, likesCount: null };
  const likedBeforeClick = opts.likedBeforeClick === true;
  const desired = !likedBeforeClick;

  return await withLikeLock(`${uid}:${pid}`, async () => {
    try {
      const { data: ses } = await getSessionOnce();
      const sid = ses?.session?.user?.id ? String(ses.session.user.id) : null;
      if (!sid || sid !== uid) {
        logger.warn('togglePostLikeSupabase: 세션 없음/불일치', { sid, uid });
        return { success: false, isLiked: likedBeforeClick, likesCount: null, error: 'no_session' };
      }

      const { data: rows, error: rpcErr } = await supabase.rpc('set_post_like', {
        p_post_id: pid,
        p_like: desired,
      });
      if (rpcErr) {
        logger.warn('set_post_like RPC 실패:', rpcErr?.message || rpcErr);
        return { success: false, isLiked: likedBeforeClick, likesCount: null, error: 'server_write_failed' };
      }

      const row = Array.isArray(rows) ? rows[0] : rows;
      const isLiked = row?.is_liked != null ? !!row.is_liked : desired;
      const likesCount = row?.likes_count != null ? Math.max(0, Number(row.likes_count) || 0) : null;

      // 화면 간 동기화: 다른 피드/상세가 같은 postId를 들고 있으면 업데이트
      try {
        window.dispatchEvent(
          new CustomEvent('postLikeUpdated', { detail: { postId: pid, isLiked, likesCount } })
        );
      } catch {}

      return { success: true, isLiked, likesCount };
    } catch (e) {
      logger.warn('togglePostLikeSupabase 예외:', e?.message);
      return { success: false, isLiked: likedBeforeClick, likesCount: null, error: 'unknown' };
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
    // ✅ 409(Conflict) 노이즈 제거: REST upsert 대신 RPC로 멱등 처리(항상 200)
    const { data: ses } = await getSessionOnce();
    const sid = ses?.session?.user?.id ? String(ses.session.user.id) : null;
    if (!sid || sid !== fid) return { success: false };

    const { data, error } = await supabase.rpc('set_follow', { p_following_id: tid, p_follow: true });
    if (error) throw error;
    if (data === false) return { success: false };
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
    const { data: ses } = await getSessionOnce();
    const sid = ses?.session?.user?.id ? String(ses.session.user.id) : null;
    if (!sid || sid !== fid) return { success: false };

    const { data, error } = await supabase.rpc('set_follow', { p_following_id: tid, p_follow: false });
    if (error) throw error;
    if (data === false) return { success: false };
    return { success: true };
  } catch (e) {
    logger.warn('unfollowSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const fetchFollowingIdsSupabase = async (userId) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return [];
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', uid);
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .map((r) => (r?.following_id ? String(r.following_id) : null))
      .filter(Boolean);
  } catch (e) {
    logger.warn('fetchFollowingIdsSupabase 실패:', e?.message);
    return null;
  }
};

export const fetchFollowerIdsSupabase = async (userId) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return [];
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', uid);
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .map((r) => (r?.follower_id ? String(r.follower_id) : null))
      .filter(Boolean);
  } catch (e) {
    logger.warn('fetchFollowerIdsSupabase 실패:', e?.message);
    return null;
  }
};


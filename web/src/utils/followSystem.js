/**
 * 팔로우 시스템 유틸리티 (Supabase 단일 진실)
 * - localStorage 기반 팔로우 캐시는 사용하지 않는다.
 * - UI 반응성(버튼 토글)을 위해 메모리 캐시만 사용하며, 원본 데이터는 Supabase `follows` 테이블/RPC에서 조회한다.
 */

import { logger } from './logger';
import {
  fetchFollowerIdsSupabase,
  fetchFollowingIdsSupabase,
  followSupabase,
  isFollowingSupabase,
  unfollowSupabase,
} from '../api/socialSupabase';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

// in-memory caches (per-session only)
const followingCache = new Map(); // userId -> Set(followingId)
const followerCache = new Map(); // userId -> Set(followerId)

const getSet = (map, userId) => {
  const uid = String(userId || '').trim();
  if (!uid) return new Set();
  if (!map.has(uid)) map.set(uid, new Set());
  return map.get(uid);
};

let currentUserId = null;

/** AuthContext 등에서 현재 로그인 사용자 id를 주입 */
export const setCurrentUserId = (uid) => {
  const s = uid != null ? String(uid).trim() : '';
  currentUserId = s || null;
};

const getCurrentUserId = () => currentUserId;

/** 특정 사용자를 팔로우 */
export const follow = (targetUserId) => {
  const me = getCurrentUserId();
  if (!me) return { success: false, isFollowing: false };
  const t = String(targetUserId || '').trim();
  if (me === t) return { success: false, isFollowing: false };

  // optimistic: memory cache only
  try {
    if (isValidUuid(me) && isValidUuid(t)) {
      getSet(followingCache, me).add(t);
      getSet(followerCache, t).add(me);
    }
  } catch (_) {}

  followSupabase(me, t).then((res) => {
    if (!res?.success) {
      // rollback optimistic
      try {
        getSet(followingCache, me).delete(t);
        getSet(followerCache, t).delete(me);
      } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('followsUpdated'));
  });

  return { success: true, isFollowing: true };
};

/** 팔로우 해제 */
export const unfollow = (targetUserId) => {
  const me = getCurrentUserId();
  if (!me) return { success: false, isFollowing: false };
  const t = String(targetUserId || '').trim();

  // optimistic: memory cache only
  try {
    if (isValidUuid(me) && isValidUuid(t)) {
      getSet(followingCache, me).delete(t);
      getSet(followerCache, t).delete(me);
    }
  } catch (_) {}

  unfollowSupabase(me, t).then((res) => {
    if (!res?.success) {
      // rollback optimistic
      try {
        getSet(followingCache, me).add(t);
        getSet(followerCache, t).add(me);
      } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('followsUpdated'));
  });

  return { success: true, isFollowing: false };
};

/** 팔로우 토글. returns { isFollowing } */
export const toggleFollow = (targetUserId) => {
  if (isFollowing(null, targetUserId)) {
    unfollow(targetUserId);
    return { isFollowing: false };
  }
  follow(targetUserId);
  return { isFollowing: true };
};

/** followerId가 followingId를 팔로우 중인지. followerId null이면 현재 로그인 사용자 */
export const isFollowing = (followerId, followingId) => {
  const fid = followerId ? String(followerId) : getCurrentUserId();
  if (!fid || !followingId) return false;
  const t = String(followingId).trim();
  if (!isValidUuid(String(fid).trim()) || !isValidUuid(t)) return false;
  return getSet(followingCache, fid).has(t);
};

/** userId를 팔로우하는 사람 수 */
export const getFollowerCount = (userId) => {
  if (!userId) return 0;
  const t = String(userId).trim();
  if (!isValidUuid(t)) return 0;
  return getSet(followerCache, t).size;
};

/** userId가 팔로우하는 사람 수 */
export const getFollowingCount = (userId) => {
  if (!userId) return 0;
  const t = String(userId).trim();
  if (!isValidUuid(t)) return 0;
  return getSet(followingCache, t).size;
};

/** userId를 팔로우하는 사람 ID 목록 (팔로워) */
export const getFollowerIds = (userId) => {
  if (!userId) return [];
  const t = String(userId).trim();
  if (!isValidUuid(t)) return [];
  return Array.from(getSet(followerCache, t));
};

/** userId가 팔로우하는 사람 ID 목록 (팔로잉) */
export const getFollowingIds = (userId) => {
  if (!userId) return [];
  const t = String(userId).trim();
  if (!isValidUuid(t)) return [];
  return Array.from(getSet(followingCache, t));
};

/** 현재 로그인 사용자 id (없으면 null) */
export { getCurrentUserId };

/**
 * 동기화: DB(follows) → 메모리 캐시
 */
export const syncFollowingFromSupabase = async (userId) => {
  const uid = userId ? String(userId).trim() : '';
  if (!isValidUuid(uid)) return { success: false };
  const ids = await fetchFollowingIdsSupabase(uid);
  if (!Array.isArray(ids)) return { success: false };
  const set = getSet(followingCache, uid);
  set.clear();
  ids.filter(Boolean).map(String).forEach((id) => set.add(String(id)));
  // ⚠️ 주의: 여기서 followsUpdated를 emit하면,
  // (listener → syncFollowingFromSupabase → emit → listener …) 무한 루프가 발생할 수 있다.
  return { success: true, count: set.size };
};

/** DB(follows) → 메모리 캐시: 팔로워 목록 */
export const syncFollowersFromSupabase = async (userId) => {
  const uid = userId ? String(userId).trim() : '';
  if (!isValidUuid(uid)) return { success: false };
  const ids = await fetchFollowerIdsSupabase(uid);
  if (!Array.isArray(ids)) return { success: false };
  const set = getSet(followerCache, uid);
  set.clear();
  ids.filter(Boolean).map(String).forEach((id) => set.add(String(id)));
  // ⚠️ 주의: sync 계열에서 followsUpdated를 emit하면 무한 루프/과도한 네트워크 호출 원인이 된다.
  return { success: true, count: set.size };
};

/** 버튼/카운트 정확도 우선: 서버 단일 조회 */
export const isFollowingRemote = async (followerId, followingId) => {
  const fid = String(followerId || '').trim();
  const tid = String(followingId || '').trim();
  if (!isValidUuid(fid) || !isValidUuid(tid)) return false;
  const ok = await isFollowingSupabase(fid, tid);
  // best-effort 캐시 보정
  try {
    if (ok) {
      getSet(followingCache, fid).add(tid);
      getSet(followerCache, tid).add(fid);
    } else {
      getSet(followingCache, fid).delete(tid);
      getSet(followerCache, tid).delete(fid);
    }
  } catch (_) {}
  return ok;
};

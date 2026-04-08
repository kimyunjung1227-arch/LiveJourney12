/**
 * 팔로우 시스템 유틸리티 (localStorage)
 * follows_v1: [ { followerId, followingId }, ... ]
 */

import { logger } from './logger';
import { followSupabase, isFollowingSupabase, unfollowSupabase } from '../api/socialSupabase';

const STORAGE_KEY = 'follows_v1';

const getRaw = () => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

const setRaw = (arr) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent('followsUpdated'));
  } catch (e) {
    logger.warn('followSystem setRaw:', e);
  }
};

const getCurrentUserId = () => {
  try {
    const u = localStorage.getItem('user');
    if (!u) return null;
    const o = JSON.parse(u);
    return o?.id ? String(o.id) : null;
  } catch {
    return null;
  }
};

/** 특정 사용자를 팔로우 */
export const follow = (targetUserId) => {
  const me = getCurrentUserId();
  if (!me) return { success: false, isFollowing: false };
  const t = String(targetUserId);
  if (me === t) return { success: false, isFollowing: false };

  // Supabase UUID면 DB 기반 동기화(멀티계정)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  if (isUuid) {
    // 로컬 캐시도 즉시 갱신(버튼 상태/배지)
    const arr = getRaw();
    if (!arr.some((x) => String(x.followerId) === me && String(x.followingId) === t)) {
      arr.push({ followerId: me, followingId: t });
      setRaw(arr);
    }
    followSupabase(me, t).then(() => {
      window.dispatchEvent(new CustomEvent('followsUpdated'));
    });
    return { success: true, isFollowing: true };
  }

  const arr = getRaw();
  if (arr.some((x) => String(x.followerId) === me && String(x.followingId) === t)) {
    return { success: true, isFollowing: true };
  }
  arr.push({ followerId: me, followingId: t });
  setRaw(arr);
  return { success: true, isFollowing: true };
};

/** 팔로우 해제 */
export const unfollow = (targetUserId) => {
  const me = getCurrentUserId();
  if (!me) return { success: false, isFollowing: false };
  const t = String(targetUserId);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(me) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  if (isUuid) {
    // 로컬 캐시도 즉시 갱신
    const nextLocal = getRaw().filter(
      (x) => !(String(x.followerId) === me && String(x.followingId) === t)
    );
    setRaw(nextLocal);
    unfollowSupabase(me, t).then(() => {
      window.dispatchEvent(new CustomEvent('followsUpdated'));
    });
    return { success: true, isFollowing: false };
  }

  const arr = getRaw().filter(
    (x) => !(String(x.followerId) === me && String(x.followingId) === t)
  );
  setRaw(arr);
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
  const t = String(followingId);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fid) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  if (isUuid) {
    // sync API가 아니라서 캐시 없이 best-effort(버튼 UI는 이후 이벤트로 갱신됨)
    // 기본은 로컬값을 사용하되, 없으면 false.
    // 화면에서 필요 시 별도 로딩로직(프로필 화면 등)에서 보정 가능.
    return getRaw().some(
      (x) => String(x.followerId) === fid && String(x.followingId) === t
    );
  }

  return getRaw().some(
    (x) => String(x.followerId) === fid && String(x.followingId) === t
  );
};

/** userId를 팔로우하는 사람 수 */
export const getFollowerCount = (userId) => {
  if (!userId) return 0;
  const t = String(userId);
  return getRaw().filter((x) => String(x.followingId) === t).length;
};

/** userId가 팔로우하는 사람 수 */
export const getFollowingCount = (userId) => {
  if (!userId) return 0;
  const t = String(userId);
  return getRaw().filter((x) => String(x.followerId) === t).length;
};

/** userId를 팔로우하는 사람 ID 목록 (팔로워) */
export const getFollowerIds = (userId) => {
  if (!userId) return [];
  const t = String(userId);
  return [...new Set(getRaw().filter((x) => String(x.followingId) === t).map((x) => String(x.followerId)))];
};

/** userId가 팔로우하는 사람 ID 목록 (팔로잉) */
export const getFollowingIds = (userId) => {
  if (!userId) return [];
  const t = String(userId);
  return [...new Set(getRaw().filter((x) => String(x.followerId) === t).map((x) => String(x.followingId)))];
};

/** 현재 로그인 사용자 id (없으면 null) */
export { getCurrentUserId };

import { useEffect, useMemo, useRef, useState } from 'react';
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { analyzeBadgeActivity, BADGE_CATALOG } from '../components/profile/badgeData';
import { persistEarnedBadges } from '../api/userBadgesSupabase';
import { useAuth } from '../contexts/AuthContext';
import { useBadgeAchievement } from '../contexts/BadgeAchievementContext';

const onlyValid = (keys) =>
  Array.from(new Set((Array.isArray(keys) ? keys : []).filter((k) => BADGE_CATALOG[k])));

function loadSeen(userId) {
  try {
    const raw = localStorage.getItem(`lj_badge_seen_v1_${userId}`);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveSeen(userId, set) {
  try {
    localStorage.setItem(`lj_badge_seen_v1_${userId}`, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

/**
 * 실제 활동 + 영구 저장 기반 뱃지 획득 훅.
 * - 내 게시물(받은 좋아요·카테고리·지역)과 베스트컷 여부로 보유 뱃지를 산출하고,
 *   profiles.earned_badges 에 저장된 "영구 획득분"과 합집합으로 노출한다.
 *   → 한번 얻은 뱃지는 활동이 줄어도 사라지지 않는다.
 * - 본인 프로필에서 "새로" 획득한 뱃지는 영구 저장 + 달성 화면(축하)을 띄운다.
 *
 * @param {object|null} user 프로필 user 객체 (id, is_best_cut_artist, earned_badges 등)
 * @returns {{ earnedKeys: string[], stats: object, loading: boolean }}
 */
export function useEarnedBadges(user) {
  const userId = user?.id || null;
  const { user: authUser } = useAuth();
  const { celebrateBadges } = useBadgeAchievement();
  const authId = authUser?.id || null;
  const isSelf = !!authId && !!userId && String(authId) === String(userId);

  const [posts, setPosts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPosts([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await getMergedMyPostsForStats(userId);
        if (!cancelled) setPosts(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 영구 저장분 (DB)
  const persisted = useMemo(() => onlyValid(user?.earned_badges), [user?.earned_badges]);

  // 활동 기반 계산분
  const { earnedKeys: computedKeys, stats } = useMemo(
    () => analyzeBadgeActivity(user, posts || []),
    [user, posts]
  );
  const computed = useMemo(() => onlyValid(computedKeys), [computedKeys]);

  // 표시용 = 영구 ∪ 활동 (한번 얻으면 유지)
  const earnedKeys = useMemo(
    () => onlyValid([...persisted, ...computed]),
    [persisted, computed]
  );

  // 새로 획득한 뱃지 감지 → 영구 저장 + 달성 화면 (본인만)
  const lastSigRef = useRef('');
  useEffect(() => {
    if (!isSelf || loading || posts == null || !userId) return;
    const sig = computed.slice().sort().join('|');
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    const seen = loadSeen(userId);
    const known = new Set([...persisted, ...seen]);
    const newly = computed.filter((k) => !known.has(k));

    const baselineKey = `lj_badge_baseline_v1_${userId}`;
    let baselineSet = false;
    try {
      baselineSet = localStorage.getItem(baselineKey) === '1';
    } catch {
      baselineSet = false;
    }

    if (!baselineSet) {
      // 최초 동기화: 기존 보유분은 축하 없이 영구 저장만 (기존 유저 폭주 방지)
      try {
        localStorage.setItem(baselineKey, '1');
      } catch {
        /* noop */
      }
      computed.forEach((k) => seen.add(k));
      saveSeen(userId, seen);
      if (computed.length > 0) void persistEarnedBadges(userId, computed);
      return;
    }

    if (newly.length > 0) {
      newly.forEach((k) => seen.add(k));
      saveSeen(userId, seen);
      void persistEarnedBadges(userId, newly);
      celebrateBadges(newly);
    }
  }, [isSelf, loading, posts, computed, persisted, userId, celebrateBadges]);

  return { earnedKeys, stats, loading };
}

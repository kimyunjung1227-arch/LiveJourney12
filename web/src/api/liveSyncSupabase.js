import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { pct, ts }

const clampPct = (n, fallback = 35) => {
  // DB 값이 NULL이면 Number(null) === 0 이 되어 0%로 보이는 문제가 있어,
  // null/undefined/빈 문자열은 fallback(기본 35)로 처리한다.
  if (n == null) return fallback;
  if (typeof n === 'string' && n.trim() === '') return fallback;
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const dispatchTrustEvent = () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trustIndexUpdated'));
    }
  } catch {
    /* ignore */
  }
};

export function invalidateLiveSyncCache(userId) {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) {
    cache.clear();
    return;
  }
  cache.delete(uid);
}

export async function fetchLiveSyncPctSupabase(userId, { bypassCache = false } = {}) {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) return 35;

  const now = Date.now();
  const cached = cache.get(uid);
  if (!bypassCache && cached && now - cached.ts <= CACHE_TTL_MS) {
    return clampPct(cached.pct);
  }

  try {
    // DB에 live_sync_* 컬럼이 없으면 특정 컬럼만 select 할 때 400이 나므로 * 로 읽고 필드는 옵션 처리
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    const pct = clampPct(data?.live_sync_pct);
    cache.set(uid, { pct, ts: now });
    return pct;
  } catch (e) {
    logger.warn('fetchLiveSyncPctSupabase 실패:', e?.message || e);
    return cached ? clampPct(cached.pct) : 35;
  }
}

export async function setLiveSyncPctSupabase(userId, pct) {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) return { success: false };
  const value = clampPct(pct);
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ live_sync_pct: value, live_sync_updated_at: new Date().toISOString() })
      .eq('id', uid);
    if (error) throw error;
    cache.set(uid, { pct: value, ts: Date.now() });
    dispatchTrustEvent();
    return { success: true, pct: value };
  } catch (e) {
    logger.warn('setLiveSyncPctSupabase 실패:', e?.message || e);
    return { success: false };
  }
}

// 동시 다발 bump가 서로 덮어쓰지 않도록 사용자별 직렬화
const bumpQueue = new Map(); // uid -> Promise

/**
 * 사용자의 live_sync_pct를 delta(±정수)만큼 변경한다.
 * - 현재 값을 읽어와 clamp(0,100) 후 즉시 update
 * - RLS상 본인 행만 수정 가능 (다른 유저용 변동은 서버 트리거가 담당)
 * - 성공 시 trustIndexUpdated 이벤트를 발행하여 화면이 즉시 갱신되도록 함
 */
export async function bumpLiveSyncPctSupabase(userId, delta) {
  const uid = userId != null ? String(userId).trim() : '';
  const d = Number(delta);
  if (!uid || !Number.isFinite(d) || d === 0) return { success: false };

  const prev = bumpQueue.get(uid) || Promise.resolve();
  const next = prev.then(async () => {
    try {
      const current = await fetchLiveSyncPctSupabase(uid, { bypassCache: true });
      const target = clampPct(current + d);
      if (target === current) {
        // 이미 0/100 경계라 변동 없음 — 굳이 update 하지 않는다
        return { success: true, pct: current, unchanged: true };
      }
      const { error } = await supabase
        .from('profiles')
        .update({ live_sync_pct: target, live_sync_updated_at: new Date().toISOString() })
        .eq('id', uid);
      if (error) throw error;
      cache.set(uid, { pct: target, ts: Date.now() });
      dispatchTrustEvent();
      return { success: true, pct: target };
    } catch (e) {
      logger.warn('bumpLiveSyncPctSupabase 실패:', e?.message || e);
      return { success: false };
    }
  });
  bumpQueue.set(uid, next.catch(() => {}));
  return next;
}

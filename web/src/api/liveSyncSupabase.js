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
    return { success: true, pct: value };
  } catch (e) {
    logger.warn('setLiveSyncPctSupabase 실패:', e?.message || e);
    return { success: false };
  }
}


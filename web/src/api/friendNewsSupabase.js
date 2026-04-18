import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/**
 * @returns {{ last_seen_ms: number, read_map: Record<string, boolean> }}
 */
export async function fetchFriendNewsStateSupabase(userId) {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) {
    return { last_seen_ms: 0, read_map: {} };
  }
  try {
    const { data, error } = await supabase
      .from('friend_news_state')
      .select('last_seen_ms, read_map')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { last_seen_ms: 0, read_map: {} };
    const rm = data.read_map && typeof data.read_map === 'object' && !Array.isArray(data.read_map) ? data.read_map : {};
    return {
      last_seen_ms: Number(data.last_seen_ms) || 0,
      read_map: rm,
    };
  } catch (e) {
    logger.warn('fetchFriendNewsStateSupabase 실패:', e?.message);
    return { last_seen_ms: 0, read_map: {} };
  }
}

/**
 * @param {{ last_seen_ms?: number, read_map?: Record<string, boolean> }} patch
 */
export async function upsertFriendNewsStateSupabase(userId, patch) {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return { success: false };
  const last_seen_ms = patch.last_seen_ms != null ? Number(patch.last_seen_ms) : 0;
  const read_map =
    patch.read_map && typeof patch.read_map === 'object' && !Array.isArray(patch.read_map) ? patch.read_map : {};
  try {
    const { error } = await supabase.from('friend_news_state').upsert(
      {
        user_id: uid,
        last_seen_ms,
        read_map,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('upsertFriendNewsStateSupabase 실패:', e?.message);
    return { success: false };
  }
}

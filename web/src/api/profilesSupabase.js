import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

export const fetchProfilesByIdsSupabase = async (ids = []) => {
  const list = (Array.isArray(ids) ? ids : [])
    .map((x) => (x != null ? String(x).trim() : ''))
    .filter((x) => isValidUuid(x));

  if (list.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,avatar_url,bio,updated_at')
      .in('id', list);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchProfilesByIdsSupabase 실패:', e?.message);
    return [];
  }
};

export const fetchProfileByIdSupabase = async (id) => {
  const uid = id != null ? String(id).trim() : '';
  if (!isValidUuid(uid)) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,avatar_url,bio,updated_at')
      .eq('id', uid)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) {
    logger.warn('fetchProfileByIdSupabase 실패:', e?.message);
    return null;
  }
};

export const searchProfilesSupabase = async (query, { limit = 20 } = {}) => {
  const q = String(query || '').trim();
  if (q.length < 1) return [];

  try {
    const like = q.replace(/[%_]/g, '\\$&');
    const lim = Math.max(1, Math.min(50, Number(limit) || 20));
    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,avatar_url,bio,updated_at')
      // prefix + contains 모두(예: "도" → "도..." + "...도...")
      .or(`username.ilike.${like}%,username.ilike.%${like}%`)
      .limit(lim);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('searchProfilesSupabase 실패:', e?.message);
    return [];
  }
};


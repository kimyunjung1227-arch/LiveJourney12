import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import { getSessionOnce } from '../utils/supabaseAuthCache';

// 저장한 장소(interest_places) read/write.
// - interest_places.user_id 는 public.users.id(= auth.uid())를 가리킨다.
// - RLS: 본인 행만 select/insert/delete (마이그레이션 20260529150000)
// - 중복 저장은 (user_id, lower(name)) unique 인덱스로 막혀 23505가 날 수 있어 무시한다.

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

async function getSessionUserId() {
  try {
    const { data } = await getSessionOnce();
    const sid = data?.session?.user?.id ? String(data.session.user.id) : null;
    return sid;
  } catch {
    return null;
  }
}

/**
 * 내가 저장한 장소 목록. 최신순.
 * @returns {Promise<Array<{id, name, region, created_at}>>}
 */
export async function fetchSavedPlaces(userId) {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return [];
  try {
    const { data, error } = await supabase
      .from('interest_places')
      .select('id, name, region, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchSavedPlaces 실패:', e?.message);
    return [];
  }
}

/**
 * 특정 장소가 저장돼 있는지 여부.
 */
export async function isPlaceSaved(userId, placeName) {
  const uid = String(userId || '').trim();
  const name = String(placeName || '').trim();
  if (!isValidUuid(uid) || !name) return false;
  try {
    const { data, error } = await supabase
      .from('interest_places')
      .select('id')
      .eq('user_id', uid)
      .ilike('name', name)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) {
    logger.warn('isPlaceSaved 실패:', e?.message);
    return false;
  }
}

/**
 * 장소 저장.
 * @returns {Promise<{success:boolean, alreadySaved?:boolean, error?:string}>}
 */
export async function savePlace(userId, placeName, region = '') {
  const uid = String(userId || '').trim();
  const name = String(placeName || '').trim();
  if (!isValidUuid(uid) || !name) return { success: false, error: 'invalid_args' };

  const sid = await getSessionUserId();
  if (!sid || sid !== uid) return { success: false, error: 'no_session' };

  try {
    const { error } = await supabase
      .from('interest_places')
      .insert({ user_id: uid, name, region: region || null });
    // 23505: 이미 저장됨(unique 위반) → 성공으로 간주
    if (error && error.code !== '23505') throw error;
    return { success: true, alreadySaved: error?.code === '23505' };
  } catch (e) {
    logger.warn('savePlace 실패:', e?.message);
    return { success: false, error: 'server_write_failed' };
  }
}

/**
 * 장소 저장 해제 (대소문자 무시 매칭).
 */
export async function unsavePlace(userId, placeName) {
  const uid = String(userId || '').trim();
  const name = String(placeName || '').trim();
  if (!isValidUuid(uid) || !name) return { success: false, error: 'invalid_args' };

  const sid = await getSessionUserId();
  if (!sid || sid !== uid) return { success: false, error: 'no_session' };

  try {
    const { error } = await supabase
      .from('interest_places')
      .delete()
      .eq('user_id', uid)
      .ilike('name', name);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('unsavePlace 실패:', e?.message);
    return { success: false, error: 'server_write_failed' };
  }
}

/**
 * 저장 토글. savedBefore 기준으로 반대 동작.
 * @returns {Promise<{success:boolean, saved:boolean, error?:string}>}
 */
export async function toggleSavedPlace({ userId, placeName, region = '', savedBefore = false }) {
  if (savedBefore) {
    const res = await unsavePlace(userId, placeName);
    return { success: res.success, saved: res.success ? false : true, error: res.error };
  }
  const res = await savePlace(userId, placeName, region);
  return { success: res.success, saved: res.success ? true : false, error: res.error };
}

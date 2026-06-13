import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const rpcNotAvailable = (err) => {
  const c = err?.code;
  const m = String(err?.message || '').toLowerCase();
  return (
    c === 'PGRST202' ||
    c === '42883' ||
    (m.includes('function') && m.includes('does not exist')) ||
    m.includes('could not find the function')
  );
};

/**
 * 획득한 뱃지 키를 본인 프로필(earned_badges)에 "영구" 저장한다(합집합).
 * - 한번 얻은 뱃지는 활동이 줄어도 사라지지 않는다.
 * - add_earned_badges RPC 우선, 없으면 REST union 업데이트로 폴백.
 * - 본인 세션(auth.uid === userId)일 때만 동작.
 *
 * @param {string} userId
 * @param {string[]} keys 추가할 뱃지 키
 * @returns {Promise<string[]|null>} 저장 후 전체 보유 키 (실패 시 null)
 */
export async function persistEarnedBadges(userId, keys) {
  const uid = userId != null ? String(userId).trim() : '';
  const list = Array.isArray(keys) ? Array.from(new Set(keys.filter(Boolean))) : [];
  if (!uid || list.length === 0) return null;

  try {
    const { data: sess } = await supabase.auth.getSession();
    const authId = sess?.session?.user?.id;
    if (!authId || String(authId) !== uid) return null; // 본인만 저장

    const { data, error } = await supabase.rpc('add_earned_badges', { p_keys: list });
    if (!error) return Array.isArray(data) ? data : list;
    if (!rpcNotAvailable(error)) {
      logger.warn('add_earned_badges RPC 실패:', error?.message, { code: error?.code });
    }

    // REST 폴백: 현재 값을 읽어 합집합으로 업데이트
    const { data: row } = await supabase
      .from('profiles')
      .select('earned_badges')
      .eq('id', uid)
      .maybeSingle();
    const existing = Array.isArray(row?.earned_badges) ? row.earned_badges : [];
    const union = Array.from(new Set([...existing, ...list]));
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ earned_badges: union })
      .eq('id', uid);
    if (upErr) {
      logger.warn('earned_badges REST 업데이트 실패:', upErr?.message);
      return null;
    }
    return union;
  } catch (e) {
    logger.warn('persistEarnedBadges 예외:', e?.message);
    return null;
  }
}

// 하위호환용 스텁 (옛 import 호환)
export const fetchUserBadgesSupabase = async () => [];
export const saveUserBadgeSupabase = async () => ({ success: false });

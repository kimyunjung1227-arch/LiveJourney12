import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/** Supabase에서 해당 사용자의 획득 뱃지 목록 조회 (로그아웃 후 재로그인해도 유지)
 *  현재는 베타 단계라, Supabase 스키마가 셋업되지 않은 환경에서는
 *  불필요한 400 에러가 발생하지 않도록 바로 빈 배열을 반환합니다.
 */
export const fetchUserBadgesSupabase = async (userId) => {
  // 백엔드 user_badges 테이블이 아직 셋업되지 않은 환경에서는 호출 자체를 막는다.
  return [];
  // 아래 코드는 향후 Supabase 셋업이 완료되면 다시 사용할 수 있습니다.
  /*
  if (!userId || !isValidUuid(userId)) return [];
  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_name, earned_at, region')
      .eq('user_id', userId.trim())
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e) {
    logger.warn('fetchUserBadgesSupabase 실패:', e?.message);
    return [];
  }
  */
};

/** Supabase에 뱃지 획득 저장 (동일 뱃지 중복 시 무시)
 *  현재는 Supabase 스키마가 없는 환경을 고려해, 저장 로직은 비활성화해 둡니다.
 */
export const saveUserBadgeSupabase = async (userId, badge) => {
  return { success: false };
  // 아래 로직은 향후 Supabase가 준비되면 다시 활성화할 수 있습니다.
  /*
  if (!userId || !isValidUuid(userId) || !badge?.name) return { success: false };
  try {
    const { error } = await supabase.from('user_badges').upsert(
      {
        user_id: userId.trim(),
        badge_name: badge.name,
        earned_at: badge.earnedAt ? new Date(badge.earnedAt).toISOString() : new Date().toISOString(),
        region: badge.region || null,
      },
      { onConflict: 'user_id,badge_name' }
    );
    if (error) throw error;
    logger.log('✅ Supabase 뱃지 저장:', badge.name);
    return { success: true };
  } catch (e) {
    logger.warn('saveUserBadgeSupabase 실패:', e?.message);
    return { success: false };
  }
  */
};

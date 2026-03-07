import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/** Supabase에서 해당 사용자의 획득 뱃지 목록 조회 (로그아웃 후 재로그인해도 유지) */
export const fetchUserBadgesSupabase = async (userId) => {
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
};

/** Supabase에 뱃지 획득 저장 (동일 뱃지 중복 시 무시) */
export const saveUserBadgeSupabase = async (userId, badge) => {
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
};

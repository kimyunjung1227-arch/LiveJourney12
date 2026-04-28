import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

/** Supabase에서 해당 사용자의 획득 뱃지 목록 조회 (로그아웃 후 재로그인해도 유지)
 *  현재는 베타 단계라, Supabase 스키마가 셋업되지 않은 환경에서는
 *  불필요한 400 에러가 발생하지 않도록 바로 빈 배열을 반환합니다.
 */
export const fetchUserBadgesSupabase = async (userId) => {
  if (!userId || !isValidUuid(userId)) return [];
  try {
    // schema (현재): user_badges(user_id, badge_id, earned_at) + badges(id, code, name, ...)
    // badgeSystem은 r.badge_name을 기대하므로 badge code를 badge_name으로 매핑해 반환
    const { data, error } = await supabase
      .from('user_badges')
      .select('earned_at,badges:badge_id(code,name)')
      .eq('user_id', userId.trim())
      .order('earned_at', { ascending: false });
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .map((r) => ({
        badge_name: r?.badges?.code || r?.badges?.name || null,
        earned_at: r?.earned_at || null,
        region: null,
      }))
      .filter((r) => !!r.badge_name);
  } catch (e) {
    logger.warn('fetchUserBadgesSupabase 실패:', e?.message);
    return [];
  }
};

/** Supabase에 뱃지 획득 저장 (동일 뱃지 중복 시 무시)
 *  현재는 Supabase 스키마가 없는 환경을 고려해, 저장 로직은 비활성화해 둡니다.
 */
export const saveUserBadgeSupabase = async (userId, badge) => {
  const uid = String(userId || '').trim();
  const code = String(badge?.name || '').trim();
  if (!isValidUuid(uid) || !code) return { success: false };
  try {
    const raffle_ticket_value = (() => {
      // dyn:*:*:tierN 패턴은 트랙 공통(장르별 활동 등급)으로 1/5/10 부여
      const m = code.match(/:tier(\d+)$/);
      const tier = m ? Number(m[1]) : 0;
      if (tier === 1) return 1;
      if (tier === 2) return 5;
      if (tier === 3) return 10;
      return 0;
    })();

    // 1) badges에 code가 없으면 생성 (badges 테이블이 비어있어도 자동 채움)
    const badgeRow = {
      code,
      name: String(badge?.title || badge?.label || badge?.name || code),
      description: badge?.description ? String(badge.description) : null,
      icon: badge?.icon ? String(badge.icon) : null,
      raffle_ticket_value,
    };

    const { data: badgeData, error: badgeErr } = await supabase
      .from('badges')
      .upsert(badgeRow, { onConflict: 'code' })
      .select('id,code')
      .single();
    if (badgeErr) throw badgeErr;
    const badgeId = badgeData?.id;
    if (!badgeId || !isValidUuid(String(badgeId))) throw new Error('badge_id_missing');

    // 2) user_badges에 저장 (중복은 무시)
    const { error: ubErr } = await supabase.from('user_badges').upsert(
      {
        user_id: uid,
        badge_id: badgeId,
        earned_at: badge?.earnedAt ? new Date(badge.earnedAt).toISOString() : new Date().toISOString(),
      },
      { onConflict: 'user_id,badge_id' }
    );
    if (ubErr) throw ubErr;

    logger.log('✅ Supabase 뱃지 저장:', code);
    return { success: true };
  } catch (e) {
    logger.warn('saveUserBadgeSupabase 실패:', e?.message);
    return { success: false };
  }
};

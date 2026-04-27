/**
 * 뱃지 획득 파이프라인 (Supabase 게시물 + tripSupport 누적)
 */
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { checkNewBadges, awardBadge, calculateUserStats } from './badgeSystem';
import { logger } from './logger';

export async function recheckUserBadgesAfterActivity(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  try {
    const posts = await getMergedMyPostsForStats(uid);
    const stats = calculateUserStats(posts, { id: uid });
    const newOnes = checkNewBadges(stats);
    for (const b of newOnes) {
      awardBadge(b, { userId: uid });
    }
  } catch (e) {
    logger.warn('recheckUserBadgesAfterActivity', e?.message);
  }
}

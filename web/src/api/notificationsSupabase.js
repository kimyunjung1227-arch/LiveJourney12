import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isValidUuid = (v) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

export const fetchNotificationsSupabase = async (userId, { limit = 100 } = {}) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return [];
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', uid)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchNotificationsSupabase 실패:', e?.message);
    return [];
  }
};

export const insertNotificationSupabase = async (payload) => {
  try {
    const { data, error } = await supabase.from('notifications').insert(payload).select('*').single();
    if (error) throw error;
    return { success: true, row: data };
  } catch (e) {
    logger.warn('insertNotificationSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const markNotificationReadSupabase = async (notificationId, read = true) => {
  const id = String(notificationId || '').trim();
  if (!id) return { success: false };
  try {
    const { error } = await supabase.from('notifications').update({ read: !!read }).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('markNotificationReadSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const markAllNotificationsReadSupabase = async (userId) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return { success: false };
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_user_id', uid)
      .eq('read', false);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('markAllNotificationsReadSupabase 실패:', e?.message);
    return { success: false };
  }
};

export const deleteNotificationSupabase = async (notificationId) => {
  const id = String(notificationId || '').trim();
  if (!id) return { success: false };
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('deleteNotificationSupabase 실패:', e?.message);
    return { success: false };
  }
};

/** 수신함 전체 비우기(계정 단위 — 모든 기기에서 동일하게 비움) */
export const deleteAllNotificationsSupabase = async (userId) => {
  const uid = String(userId || '').trim();
  if (!isValidUuid(uid)) return { success: false };
  try {
    const { error } = await supabase.from('notifications').delete().eq('recipient_user_id', uid);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('deleteAllNotificationsSupabase 실패:', e?.message);
    return { success: false };
  }
};


import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const sortRows = (rows) =>
  [...(rows || [])].sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

/**
 * @returns {Promise<Array>}
 */
export const fetchRaffles = async () => {
  try {
    const { data, error } = await supabase.from('raffles').select('*');
    if (error) throw error;
    return sortRows(data || []);
  } catch (e) {
    logger.warn('fetchRaffles 실패:', e?.message);
    return [];
  }
};

/** 앱 UI용: 진행 중 / 완료 분리 및 필드 매핑 */
export const fetchRafflesForUi = async () => {
  const rows = await fetchRaffles();
  const ongoing = sortRows(rows.filter((r) => r.kind === 'ongoing')).map((r) => ({
    id: r.id,
    title: r.title,
    desc: r.description || '',
    daysLeft: r.days_left || '진행 중',
    image: r.image_url,
  }));
  const completed = sortRows(rows.filter((r) => r.kind === 'completed')).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category || '',
    statusMessage: r.status_message || '',
    badge: r.badge || '미응모',
    image: r.image_url,
  }));
  return { ongoing, completed };
};

export const createRaffle = async (payload) => {
  try {
    const kind = payload.kind === 'completed' ? 'completed' : 'ongoing';
    const row = {
      kind,
      title: (payload.title || '').trim(),
      image_url: (payload.image_url || '').trim(),
      description: payload.description != null ? String(payload.description).trim() : '',
      sort_order: Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0,
    };
    if (kind === 'ongoing') {
      row.days_left = (payload.days_left || '').trim() || '진행 중';
      row.category = null;
      row.status_message = null;
      row.badge = null;
    } else {
      row.days_left = null;
      row.category = (payload.category || '').trim();
      row.status_message = (payload.status_message || '').trim();
      row.badge = (payload.badge || '미응모').trim();
    }
    if (!row.title) {
      return { success: false, error: '제목을 입력하세요.' };
    }
    if (!row.image_url) {
      return { success: false, error: '이미지 URL을 입력하세요.' };
    }
    if (kind === 'completed' && !row.badge) {
      return { success: false, error: '배지를 선택하세요.' };
    }

    const { data, error } = await supabase.from('raffles').insert(row).select('*').single();
    if (error) throw error;
    return { success: true, raffle: data };
  } catch (e) {
    logger.error('createRaffle 실패:', e?.message);
    return { success: false, error: e?.message || '등록에 실패했습니다.' };
  }
};

export const updateRaffle = async (id, payload) => {
  try {
    const updates = {};
    if (payload.title !== undefined) updates.title = String(payload.title).trim();
    if (payload.image_url !== undefined) updates.image_url = String(payload.image_url).trim();
    if (payload.description !== undefined) updates.description = String(payload.description ?? '').trim();
    if (payload.days_left !== undefined) {
      updates.days_left = payload.days_left == null || payload.days_left === '' ? null : String(payload.days_left).trim();
    }
    if (payload.category !== undefined) {
      updates.category = payload.category == null || payload.category === '' ? null : String(payload.category).trim();
    }
    if (payload.status_message !== undefined) {
      updates.status_message =
        payload.status_message == null || payload.status_message === '' ? null : String(payload.status_message).trim();
    }
    if (payload.badge !== undefined) {
      updates.badge = payload.badge == null || payload.badge === '' ? null : String(payload.badge).trim();
    }
    if (payload.sort_order !== undefined) updates.sort_order = Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0;

    const { data, error } = await supabase.from('raffles').update(updates).eq('id', id).select('*').single();
    if (error) throw error;
    return { success: true, raffle: data };
  } catch (e) {
    logger.error('updateRaffle 실패:', e?.message);
    return { success: false, error: e?.message || '수정에 실패했습니다.' };
  }
};

export const deleteRaffle = async (id) => {
  try {
    const { error } = await supabase.from('raffles').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.error('deleteRaffle 실패:', e?.message);
    return { success: false, error: e?.message };
  }
};

import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';
import {
  seoulTodayMidnight,
  computeEndsAt,
  computeEndsAtFromNow,
  formatDaysLeftKorean,
  seoulNextMidnightAfter,
} from '../utils/raffleSchedule';

export const RAFFLE_START_MIDNIGHT = 'midnight';
export const RAFFLE_START_IMMEDIATE = 'immediate';
export const RAFFLE_END_NOW = 'immediate';
export const RAFFLE_END_MIDNIGHT = 'midnight';

const sortRows = (rows) =>
  [...(rows || [])].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

const runCloseExpiredRaffles = async () => {
  try {
    const { error } = await supabase.rpc('close_expired_raffles');
    if (error) throw error;
  } catch (e) {
    logger.warn('close_expired_raffles RPC 실패(마이그레이션 미적용 가능):', e?.message);
  }
};

export const fetchRaffles = async () => {
  try {
    await runCloseExpiredRaffles();
    const { data, error } = await supabase.from('raffles').select('*');
    if (error) throw error;
    return sortRows(data || []);
  } catch (e) {
    logger.warn('fetchRaffles 실패:', e?.message);
    return [];
  }
};

export const fetchRaffleById = async (id) => {
  try {
    await runCloseExpiredRaffles();
    const { data, error } = await supabase.from('raffles').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return { raffle: data || null, error: null };
  } catch (e) {
    logger.warn('fetchRaffleById 실패:', e?.message);
    return { raffle: null, error: e?.message || '불러오기 실패' };
  }
};

const mapOngoingLike = (r) => ({
  id: r.id,
  title: r.title,
  desc: r.description || '',
  daysLeft:
    r.kind === 'ongoing' && r.ends_at
      ? formatDaysLeftKorean(r.ends_at)
      : r.days_left || (r.kind === 'ongoing' ? '진행 중' : '오픈 예정'),
  image: r.image_url,
});

export const fetchRafflesForUi = async () => {
  const rows = await fetchRaffles();
  const scheduled = sortRows(rows.filter((r) => r.kind === 'scheduled')).map(mapOngoingLike);
  const ongoing = sortRows(rows.filter((r) => r.kind === 'ongoing')).map(mapOngoingLike);
  const completed = sortRows(rows.filter((r) => r.kind === 'completed')).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category || '',
    statusMessage: r.status_message || '',
    badge: r.badge || '미응모',
    image: r.image_url,
  }));
  return { scheduled, ongoing, completed };
};

export const createRaffle = async (payload) => {
  try {
    const duration_days = Math.max(1, Math.floor(Number(payload.duration_days)) || 7);
    const row = {
      kind: 'scheduled',
      title: (payload.title || '').trim(),
      image_url: (payload.image_url || '').trim(),
      description: payload.description != null ? String(payload.description).trim() : '',
      duration_days,
      days_left: '오픈 예정',
      category: null,
      status_message: null,
      badge: null,
      starts_at: null,
      ends_at: null,
    };
    if (!row.title) {
      return { success: false, error: '제목을 입력하세요.' };
    }
    if (!row.image_url) {
      return { success: false, error: '이미지 URL을 입력하거나 PNG 등 파일을 업로드하세요.' };
    }

    const { data, error } = await supabase.from('raffles').insert(row).select('*').single();
    if (error) throw error;
    return { success: true, raffle: data };
  } catch (e) {
    logger.error('createRaffle 실패:', e?.message);
    return { success: false, error: e?.message || '등록에 실패했습니다.' };
  }
};

export const startScheduledRaffle = async (id, startMode = RAFFLE_START_MIDNIGHT) => {
  try {
    const { data: row, error: fetchErr } = await supabase.from('raffles').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row || row.kind !== 'scheduled') {
      return { success: false, error: '진행 예정 래플만 시작할 수 있습니다.' };
    }
    const duration = Math.max(1, Math.floor(Number(row.duration_days)) || 7);
    const mode = startMode === RAFFLE_START_IMMEDIATE ? RAFFLE_START_IMMEDIATE : RAFFLE_START_MIDNIGHT;
    const starts_at = mode === RAFFLE_START_IMMEDIATE ? new Date() : seoulTodayMidnight();
    const ends_at =
      mode === RAFFLE_START_IMMEDIATE ? computeEndsAtFromNow(starts_at, duration) : computeEndsAt(starts_at, duration);
    const days_left = formatDaysLeftKorean(ends_at);

    const { data, error } = await supabase
      .from('raffles')
      .update({
        kind: 'ongoing',
        starts_at: starts_at.toISOString(),
        ends_at: ends_at.toISOString(),
        days_left,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return { success: true, raffle: data };
  } catch (e) {
    logger.error('startScheduledRaffle 실패:', e?.message);
    return { success: false, error: e?.message || '시작 처리에 실패했습니다.' };
  }
};

export const completeRaffleNow = async (id) => {
  try {
    const { data: row, error: fetchErr } = await supabase.from('raffles').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row || row.kind !== 'ongoing') {
      return { success: false, error: '진행 중인 래플만 종료할 수 있습니다.' };
    }
    const category = (row.category && String(row.category).trim()) || '래플 종료';
    // 기본 문구 강제 삽입은 UX상 노이즈가 커서 제거(원하면 어드민에서 직접 입력)
    const status_message = (row.status_message && String(row.status_message).trim()) || null;
    const badge = (row.badge && String(row.badge).trim()) || '미응모';

    const { data, error } = await supabase
      .from('raffles')
      .update({
        kind: 'completed',
        days_left: null,
        category,
        status_message,
        badge,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return { success: true, raffle: data };
  } catch (e) {
    logger.error('completeRaffleNow 실패:', e?.message);
    return { success: false, error: e?.message || '종료 처리에 실패했습니다.' };
  }
};

/**
 * 종료: scheduled → 지금=삭제, 00시=ends_at 예약 후 자동 삭제(RPC)
 * ongoing → 지금=즉시 완료, 00시=다음 서울 0시에 맞춰 ends_at 연장
 */
export const endRaffleWithMode = async (id, endMode = RAFFLE_END_NOW) => {
  try {
    const { data: row, error: fetchErr } = await supabase.from('raffles').select('*').eq('id', id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) return { success: false, error: '래플을 찾을 수 없습니다.' };

    const useMidnight = endMode === RAFFLE_END_MIDNIGHT;

    if (row.kind === 'scheduled') {
      if (!useMidnight) return deleteRaffle(id);
      const ends_at = seoulNextMidnightAfter(new Date());
      return updateRaffle(id, { ends_at: ends_at.toISOString() });
    }
    if (row.kind === 'ongoing') {
      if (!useMidnight) return completeRaffleNow(id);
      const ends_at = seoulNextMidnightAfter(new Date());
      const days_left = formatDaysLeftKorean(ends_at);
      return updateRaffle(id, { ends_at: ends_at.toISOString(), days_left });
    }
    return { success: false, error: '진행 예정 또는 진행 중인 래플만 종료할 수 있습니다.' };
  } catch (e) {
    logger.error('endRaffleWithMode 실패:', e?.message);
    return { success: false, error: e?.message || '종료 처리에 실패했습니다.' };
  }
};

export const updateRaffle = async (id, payload) => {
  try {
    const updates = {};
    if (payload.kind !== undefined) {
      const k = ['scheduled', 'ongoing', 'completed'].includes(payload.kind) ? payload.kind : undefined;
      if (k) updates.kind = k;
    }
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
    if (payload.duration_days !== undefined) {
      updates.duration_days = Math.max(1, Math.floor(Number(payload.duration_days)) || 7);
    }
    if (payload.starts_at !== undefined) {
      updates.starts_at = payload.starts_at == null ? null : payload.starts_at;
    }
    if (payload.ends_at !== undefined) {
      updates.ends_at = payload.ends_at == null ? null : payload.ends_at;
    }

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

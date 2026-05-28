import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

/**
 * 매거진(seasonal_highlights) 전체 목록 (display_order 순).
 * RLS: SELECT 는 누구나.
 */
export async function fetchSeasonalHighlights() {
  try {
    const { data, error } = await supabase
      .from('seasonal_highlights')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn('fetchSeasonalHighlights 실패:', e?.message);
    return [];
  }
}

const sanitizePayload = (p) => ({
  title: String(p.title || '').trim(),
  period_label: String(p.period_label || '').trim(),
  category: p.category ? String(p.category).trim() : null,
  related_place_names: Array.isArray(p.related_place_names)
    ? p.related_place_names
        .map((s) => String(s).trim())
        .filter(Boolean)
    : null,
  cover_color_start: p.cover_color_start || null,
  cover_color_end: p.cover_color_end || null,
  starts_at: p.starts_at || null,
  ends_at: p.ends_at || null,
  display_order: Number.isFinite(Number(p.display_order)) ? Number(p.display_order) : 0,
  is_active: !!p.is_active,
  curation_body: p.curation_body ? String(p.curation_body) : null,
  peak_label: p.peak_label ? String(p.peak_label).trim() : null,
  peak_ends_at: p.peak_ends_at || null,
});

export async function createSeasonalHighlight(payload) {
  try {
    const { data, error } = await supabase
      .from('seasonal_highlights')
      .insert(sanitizePayload(payload))
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    logger.warn('createSeasonalHighlight 실패:', e?.message);
    return { success: false, error: e?.message || '저장 실패' };
  }
}

export async function updateSeasonalHighlight(id, payload) {
  try {
    const { data, error } = await supabase
      .from('seasonal_highlights')
      .update(sanitizePayload(payload))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (e) {
    logger.warn('updateSeasonalHighlight 실패:', e?.message);
    return { success: false, error: e?.message || '수정 실패' };
  }
}

export async function deleteSeasonalHighlight(id) {
  try {
    const { error } = await supabase
      .from('seasonal_highlights')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.warn('deleteSeasonalHighlight 실패:', e?.message);
    return { success: false, error: e?.message || '삭제 실패' };
  }
}

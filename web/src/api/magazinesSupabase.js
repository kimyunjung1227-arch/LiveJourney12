import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const isMissingTableError = (error) => {
  const code = error?.code;
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || msg.includes('relation') || msg.includes('does not exist');
};

export const fetchMagazinesSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('magazines')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, magazines: Array.isArray(data) ? data : [] };
  } catch (error) {
    logger.warn('Supabase magazines fetch 실패:', {
      code: error?.code,
      message: error?.message,
      status: error?.status ?? error?.statusCode,
    });
    return { success: false, error, missingTable: isMissingTableError(error) };
  }
};

export const upsertMagazineSupabase = async (magazine) => {
  try {
    if (!magazine?.id) return { success: false, error: 'no_id' };
    const now = new Date().toISOString();
    const payload = {
      id: magazine.id,
      title: magazine.title || '',
      subtitle: magazine.subtitle || magazine.summary || '',
      sections: magazine.sections || [],
      author: magazine.author || null,
      created_at: magazine.createdAt ? new Date(magazine.createdAt).toISOString() : now,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from('magazines')
      .upsert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return { success: true, magazine: data };
  } catch (error) {
    logger.warn('Supabase magazines upsert 실패:', {
      code: error?.code,
      message: error?.message,
      status: error?.status ?? error?.statusCode,
    });
    return { success: false, error, missingTable: isMissingTableError(error) };
  }
};

export const deleteMagazineSupabase = async (id) => {
  try {
    const { error } = await supabase.from('magazines').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    logger.warn('Supabase magazines delete 실패:', {
      code: error?.code,
      message: error?.message,
      status: error?.status ?? error?.statusCode,
    });
    return { success: false, error, missingTable: isMissingTableError(error) };
  }
};


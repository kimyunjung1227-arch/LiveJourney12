import { fetchMagazinesSupabase, upsertMagazineSupabase, deleteMagazineSupabase } from '../api/magazinesSupabase';
import { logger } from './logger';

const STORAGE_KEY = 'magazines';

const safeParse = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readLocal = () => safeParse(localStorage.getItem(STORAGE_KEY));
const writeLocal = (arr) => localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));

export const listPublishedMagazines = async () => {
  const res = await fetchMagazinesSupabase();
  if (res.success) return res.magazines;
  return readLocal();
};

export const getPublishedMagazineById = async (id) => {
  const all = await listPublishedMagazines();
  return all.find((m) => String(m?.id) === String(id)) || null;
};

export const publishMagazine = async (magazine) => {
  const base = {
    id: magazine?.id || `pub-${Date.now()}`,
    title: String(magazine?.title || '').trim(),
    subtitle: String(magazine?.subtitle || '').trim(),
    sections: Array.isArray(magazine?.sections) ? magazine.sections : [],
    author: magazine?.author || 'LiveJourney',
    createdAt: magazine?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const supa = await upsertMagazineSupabase(base);
  if (supa.success) {
    try {
      window.dispatchEvent(new Event('magazinesUpdated'));
    } catch {}
    return { success: true, magazine: supa.magazine };
  }

  try {
    const prev = readLocal();
    const next = [base, ...prev.filter((m) => String(m?.id) !== String(base.id))];
    writeLocal(next);
    try {
      window.dispatchEvent(new Event('magazinesUpdated'));
    } catch {}
    return { success: true, magazine: base, fallback: true, error: supa.error };
  } catch (e) {
    logger.warn('local magazines 저장 실패:', e);
    return { success: false, error: e };
  }
};

export const removePublishedMagazine = async (id) => {
  const supa = await deleteMagazineSupabase(id);
  if (supa.success) {
    try {
      window.dispatchEvent(new Event('magazinesUpdated'));
    } catch {}
    return { success: true };
  }

  try {
    const prev = readLocal();
    const next = prev.filter((m) => String(m?.id) !== String(id));
    writeLocal(next);
    try {
      window.dispatchEvent(new Event('magazinesUpdated'));
    } catch {}
    return { success: true, fallback: true, error: supa.error };
  } catch (e) {
    logger.warn('local magazines 삭제 실패:', e);
    return { success: false, error: e };
  }
};


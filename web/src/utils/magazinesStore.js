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

// 서버 운영 전환: localStorage 제거 → 세션 메모리 폴백
let magazinesMemory = [];
const readLocal = () => (Array.isArray(magazinesMemory) ? magazinesMemory : []);
const writeLocal = (arr) => {
  magazinesMemory = Array.isArray(arr) ? arr : [];
};

const normalizeSections = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeMagazine = (m) => {
  if (!m) return null;
  const createdAt = m.createdAt || m.created_at || null;
  const updatedAt = m.updatedAt || m.updated_at || null;
  return {
    ...m,
    sections: normalizeSections(m.sections),
    createdAt,
    updatedAt,
  };
};

export const listPublishedMagazines = async () => {
  const res = await fetchMagazinesSupabase();
  let list = [];
  if (res.success) list = (Array.isArray(res.magazines) ? res.magazines : []).map(normalizeMagazine).filter(Boolean);
  else list = readLocal().map(normalizeMagazine).filter(Boolean);
  return list;
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
    return { success: true, magazine: normalizeMagazine(supa.magazine) };
  }

  try {
    const prev = readLocal();
    const next = [base, ...prev.filter((m) => String(m?.id) !== String(base.id))];
    writeLocal(next);
    try {
      window.dispatchEvent(new Event('magazinesUpdated'));
    } catch {}
    return { success: true, magazine: normalizeMagazine(base), fallback: true, error: supa.error };
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


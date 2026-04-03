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

/** 데모·온보딩용 예시 매거진 (목록에 항상 포함, ID 중복 시 생략) */
export const EXAMPLE_MAGAZINE_ID = 'pub-lj-example-spring';

const getExampleMagazine = () =>
  normalizeMagazine({
    id: EXAMPLE_MAGAZINE_ID,
    title: '봄 여행, 지금 이 순간',
    subtitle: 'LiveJourney 예시 매거진',
    summary: '카페 산책부터 전통 골목까지, 발행 화면과 동일한 구조로 미리 보여 드려요.',
    author: 'LiveJourney',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        location: '제주 애월 카페거리',
        locationInfo: '제주특별자치도 애월읍',
        description:
          '해안 도로를 따라 카페와 소품샵이 이어져 드라이브와 산책을 함께 즐기기 좋습니다. 석양이 지는 시간에 맞춰 방문해 보세요.',
        around: [],
      },
      {
        location: '서울 북촌 한옥마을',
        locationInfo: '서울 종로구',
        description:
          '한옥과 골목이 어우러진 산책 코스입니다. 한복 체험이나 전통 찻집에서 여유로운 하루를 보내기 좋아요.',
        around: [],
      },
    ],
  });

const mergeExampleMagazine = (list) => {
  const arr = Array.isArray(list) ? list.map(normalizeMagazine).filter(Boolean) : [];
  if (arr.some((m) => String(m?.id) === EXAMPLE_MAGAZINE_ID)) return arr;
  return [getExampleMagazine(), ...arr];
};

export const listPublishedMagazines = async () => {
  const res = await fetchMagazinesSupabase();
  let list = [];
  if (res.success) list = (Array.isArray(res.magazines) ? res.magazines : []).map(normalizeMagazine).filter(Boolean);
  else list = readLocal().map(normalizeMagazine).filter(Boolean);
  return mergeExampleMagazine(list);
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


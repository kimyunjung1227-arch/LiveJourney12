/**
 * AI 기반 지역 대표명소 추천
 * - Supabase Edge Function 'region-landmarks' 호출 (Gemini)
 * - localStorage 7일 캐시 (region 단위)
 * - 실패 시 빈 배열 반환 (정적 명소만 사용)
 */
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const EDGE_FN_NAME = 'region-landmarks';
const CACHE_KEY = 'lj:regionLandmarksAi:v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const inFlight = new Map();

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const loadCache = () => {
  if (typeof localStorage === 'undefined') return {};
  const raw = localStorage.getItem(CACHE_KEY);
  const parsed = raw ? safeJsonParse(raw) : null;
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const saveCache = (obj) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* quota 초과 등 무시 */
  }
};

const cacheKeyFor = (regionName) => String(regionName || '').trim();

const slugifyId = (s) =>
  `ai-${String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9가-힣]/g, '')
    .slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * @param {string} regionName
 * @param {{ excludeNames?: string[], forceRefresh?: boolean, count?: number }} opts
 * @returns {Promise<Array<{id:string, name:string, keywords:string[]}>>}
 */
export async function fetchAiLandmarksForRegion(regionName, opts = {}) {
  const region = cacheKeyFor(regionName);
  if (!region) return [];

  const cache = loadCache();
  const entry = cache[region];
  if (!opts.forceRefresh && entry && Date.now() - (entry.ts || 0) < CACHE_TTL_MS) {
    return Array.isArray(entry.list) ? entry.list : [];
  }

  // 같은 region에 대한 동시 호출 합치기
  const dedupeKey = `${region}|${opts.forceRefresh ? 'force' : 'normal'}`;
  if (inFlight.has(dedupeKey)) return inFlight.get(dedupeKey);

  const task = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FN_NAME, {
        body: {
          regionName: region,
          excludeNames: Array.isArray(opts.excludeNames) ? opts.excludeNames : [],
          count: typeof opts.count === 'number' ? opts.count : 12,
        },
      });
      if (error) {
        logger.warn('region-landmarks 실패:', error?.message || error);
        return [];
      }
      const raw = Array.isArray(data?.landmarks) ? data.landmarks : [];
      const list = raw
        .map((it) => {
          const name = String(it?.name || '').trim();
          if (!name) return null;
          const keywords = Array.isArray(it?.keywords)
            ? it.keywords.map((k) => String(k || '').trim()).filter(Boolean)
            : [];
          // 매칭에 쓰일 키워드에 name 자체도 포함
          const kw = Array.from(new Set([name, ...keywords]));
          return { id: slugifyId(name), name, keywords: kw };
        })
        .filter(Boolean);

      const next = { ...loadCache(), [region]: { ts: Date.now(), list } };
      saveCache(next);
      return list;
    } catch (e) {
      logger.warn('fetchAiLandmarksForRegion 예외:', e?.message || e);
      return [];
    } finally {
      inFlight.delete(dedupeKey);
    }
  })();
  inFlight.set(dedupeKey, task);
  return task;
}

/** 캐시만 동기적으로 조회 (즉시 표시용) */
export function getCachedAiLandmarks(regionName) {
  const region = cacheKeyFor(regionName);
  if (!region) return [];
  const cache = loadCache();
  const entry = cache[region];
  if (!entry) return [];
  return Array.isArray(entry.list) ? entry.list : [];
}

export function clearAiLandmarksCache(regionName) {
  if (!regionName) {
    saveCache({});
    return;
  }
  const region = cacheKeyFor(regionName);
  const cache = loadCache();
  if (cache[region]) {
    delete cache[region];
    saveCache(cache);
  }
}

import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';

const CACHE_KEY = 'lj:placeDesc:v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d (쿼터 절약: 재방문 시 재호출 최소화)
const FAIL_BACKOFF_MS = 5 * 60 * 1000; // 5m (연속 실패 시 과호출 방지)

const now = () => Date.now();

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

const saveCache = (cache) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache || {}));
  } catch {
    /* ignore quota */
  }
};

const makeKey = (placeKey, salt = '') => {
  const k = String(placeKey || '').trim().toLowerCase();
  return `${k}::${String(salt || '').trim().slice(0, 80)}`;
};

const inFlight = new Map();

export async function fetchPlaceDescription({
  placeKey,
  regionHint = '',
  tier = '',
  tags = [],
  userCaptions = [],
  cacheSalt = '',
}) {
  const key = String(placeKey || '').trim();
  if (!key) return '';

  const cache = loadCache();
  const ck = makeKey(key, cacheSalt || regionHint || tier);
  const hit = cache?.[ck];
  if (hit && typeof hit === 'object' && hit.value && now() < Number(hit.expiresAt || 0)) {
    return String(hit.value || '').trim();
  }
  // 최근 실패 backoff: 렌더링/스크롤로 과호출 방지
  if (hit && typeof hit === 'object' && hit.failedAt && now() - Number(hit.failedAt || 0) < FAIL_BACKOFF_MS) {
    return '';
  }

  if (inFlight.has(ck)) {
    try {
      return await inFlight.get(ck);
    } catch {
      return '';
    }
  }

  const task = (async () => {
    if (!supabase) return '';
    const { data, error } = await supabase.functions.invoke('place-description', {
      body: {
        placeKey: key,
        regionHint,
        tier,
        tags,
        userCaptions,
      },
    });
    if (error) {
      logger.warn('장소 설명 Edge Function 오류:', error.message || error);
      cache[ck] = { ...(cache[ck] || {}), failedAt: now() };
      saveCache(cache);
      return '';
    }
    const desc = String(data?.description || '').trim();
    if (desc) {
      cache[ck] = { value: desc, expiresAt: now() + TTL_MS };
      saveCache(cache);
      return desc;
    }
    cache[ck] = { ...(cache[ck] || {}), failedAt: now() };
    saveCache(cache);
    return '';
  })();

  inFlight.set(ck, task);
  try {
    return await task;
  } catch (e) {
    logger.warn('장소 설명 Edge Function 호출 실패(무시하고 폴백):', e?.message || e);
    cache[ck] = { ...(cache[ck] || {}), failedAt: now() };
    saveCache(cache);
    return '';
  } finally {
    inFlight.delete(ck);
  }
}


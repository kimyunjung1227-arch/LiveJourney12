import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';

const CACHE_KEY = 'lj:placeDesc:v1';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

const now = () => Date.now();

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const loadCache = () => {
  if (typeof sessionStorage === 'undefined') return {};
  const raw = sessionStorage.getItem(CACHE_KEY);
  const parsed = raw ? safeJsonParse(raw) : null;
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const saveCache = (cache) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache || {}));
  } catch {
    /* ignore quota */
  }
};

const makeKey = (placeKey, salt = '') => {
  const k = String(placeKey || '').trim().toLowerCase();
  return `${k}::${String(salt || '').trim().slice(0, 80)}`;
};

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

  try {
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
      return '';
    }
    const desc = String(data?.description || '').trim();
    if (desc) {
      cache[ck] = { value: desc, expiresAt: now() + TTL_MS };
      saveCache(cache);
    }
    return desc;
  } catch (e) {
    logger.warn('장소 설명 Edge Function 호출 실패(무시하고 폴백):', e?.message || e);
    return '';
  }
}


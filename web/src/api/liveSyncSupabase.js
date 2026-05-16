import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { pct, ts }

const clampPct = (n, fallback = 35) => {
  // DB 값이 NULL이면 Number(null) === 0 이 되어 0%로 보이는 문제가 있어,
  // null/undefined/빈 문자열은 fallback(기본 35)로 처리한다.
  if (n == null) return fallback;
  if (typeof n === 'string' && n.trim() === '') return fallback;
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const dispatchTrustEvent = () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trustIndexUpdated'));
    }
  } catch {
    /* ignore */
  }
};

export function invalidateLiveSyncCache(userId) {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) {
    cache.clear();
    return;
  }
  cache.delete(uid);
}

export async function fetchLiveSyncPctSupabase(userId, { bypassCache = false } = {}) {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) return 35;

  const now = Date.now();
  const cached = cache.get(uid);
  if (!bypassCache && cached && now - cached.ts <= CACHE_TTL_MS) {
    return clampPct(cached.pct);
  }

  try {
    // DB에 live_sync_* 컬럼이 없으면 특정 컬럼만 select 할 때 400이 나므로 * 로 읽고 필드는 옵션 처리
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) throw error;
    const pct = clampPct(data?.live_sync_pct);
    cache.set(uid, { pct, ts: now });
    return pct;
  } catch (e) {
    logger.warn('fetchLiveSyncPctSupabase 실패:', e?.message || e);
    return cached ? clampPct(cached.pct) : 35;
  }
}

export async function setLiveSyncPctSupabase(userId, pct) {
  const uid = userId != null ? String(userId).trim() : '';
  if (!uid) return { success: false };
  const value = clampPct(pct);
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ live_sync_pct: value, live_sync_updated_at: new Date().toISOString() })
      .eq('id', uid);
    if (error) throw error;
    cache.set(uid, { pct: value, ts: Date.now() });
    dispatchTrustEvent();
    return { success: true, pct: value };
  } catch (e) {
    logger.warn('setLiveSyncPctSupabase 실패:', e?.message || e);
    return { success: false };
  }
}

// 동시 다발 bump가 서로 덮어쓰지 않도록 사용자별 직렬화
const bumpQueue = new Map(); // uid -> Promise

/**
 * 사용자의 live_sync_pct를 delta(±정수)만큼 변경한다.
 * - 현재 값을 읽어와 clamp(0,100) 후 즉시 update
 * - RLS상 본인 행만 수정 가능 (다른 유저용 변동은 서버 트리거가 담당)
 * - 성공 시 trustIndexUpdated 이벤트를 발행하여 화면이 즉시 갱신되도록 함
 */
export async function bumpLiveSyncPctSupabase(userId, delta) {
  const uid = userId != null ? String(userId).trim() : '';
  const d = Number(delta);
  if (!uid || !Number.isFinite(d) || d === 0) return { success: false };

  const prev = bumpQueue.get(uid) || Promise.resolve();
  const next = prev.then(async () => {
    try {
      const current = await fetchLiveSyncPctSupabase(uid, { bypassCache: true });
      const target = clampPct(current + d);
      if (target === current) {
        // 이미 0/100 경계라 변동 없음 — 굳이 update 하지 않는다
        return { success: true, pct: current, unchanged: true };
      }
      const { error } = await supabase
        .from('profiles')
        .update({ live_sync_pct: target, live_sync_updated_at: new Date().toISOString() })
        .eq('id', uid);
      if (error) throw error;
      cache.set(uid, { pct: target, ts: Date.now() });
      dispatchTrustEvent();
      return { success: true, pct: target };
    } catch (e) {
      logger.warn('bumpLiveSyncPctSupabase 실패:', e?.message || e);
      return { success: false };
    }
  });
  bumpQueue.set(uid, next.catch(() => {}));
  return next;
}

// 체온점수(당근)식 누적기 — fractional 부분을 보관해 천천히 1%씩 반영
const tempAccum = new Map(); // uid -> remainder

/**
 * 당근 매너온도 느낌의 점진적 가산:
 * - baseDelta는 의도된 강도(예: 0.6=좋아요, 1.2=댓글)
 * - 현재 점수가 100에 가까울수록 상승 폭이 둔해지고, 0에 가까울수록 하락 폭이 둔해짐
 * - 정수 미만의 변동은 메모리에 누적해 다음 호출과 합산 → 작은 활동이 모여 1%씩 움직임
 */
export async function bumpLiveSyncTempStyle(userId, baseDelta) {
  const uid = userId != null ? String(userId).trim() : '';
  const b = Number(baseDelta);
  if (!uid || !Number.isFinite(b) || b === 0) return { success: false };

  const current = await fetchLiveSyncPctSupabase(uid, { bypassCache: false });
  // 기준치(35)에서 멀어질수록 변동폭이 작아지도록 감속 계수
  const factor = b > 0
    ? Math.max(0.05, (100 - current) / 65)
    : Math.max(0.05, current / 65);
  const fractional = b * factor;
  const prevAcc = tempAccum.get(uid) || 0;
  const totalAcc = prevAcc + fractional;
  const intDelta = totalAcc >= 0 ? Math.floor(totalAcc) : Math.ceil(totalAcc);
  tempAccum.set(uid, totalAcc - intDelta);
  if (intDelta === 0) {
    // 이번엔 정수 변동이 없음 — 다음 호출에 합산
    return { success: true, pct: current, deferred: true };
  }
  return bumpLiveSyncPctSupabase(uid, intDelta);
}

/**
 * 새 게시물의 EXIF/촬영 신호에 따라 가산점을 결정한다.
 * - 앱 내 카메라: 가장 강한 현장감 → +12
 * - EXIF 촬영시각 + GPS: +10
 * - EXIF 촬영시각만: +6
 * - EXIF GPS만: +5
 * - EXIF는 있지만 핵심 신호 없음(기종 등): +3
 * - EXIF 자체가 없음: +1
 */
export function computeCreatePostExifDelta(post) {
  if (!post) return 1;
  if (post.isInAppCamera === true || post.is_in_app_camera === true) return 12;
  const ex = post.exifData || post.exif_data;
  if (ex && typeof ex === 'object') {
    const hasPhotoDate = !!(ex.photoDate || ex.dateTimeOriginalRaw);
    const g = ex.gpsCoordinates;
    const hasGps = !!(
      g && (g.lat != null || g.latitude != null) && (g.lng != null || g.longitude != null)
    );
    if (hasPhotoDate && hasGps) return 10;
    if (hasPhotoDate) return 6;
    if (hasGps) return 5;
    return 3;
  }
  return 1;
}

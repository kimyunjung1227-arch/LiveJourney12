import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow, bestCutScore, makePlaceId } from './ljPostsMapping';

const SELECT_COLUMNS = `
  id, user_id, content, images, videos, location, detailed_location, place_name, region,
  category, category_name, likes_count, comments_count, captured_at, created_at,
  exif_data,
  author_username, author_avatar_url, is_in_app_camera
`;

const RECENT_HOURS = 6;
const FETCH_LIMIT = 300; // 집계 대상 풀
// 실시간 핫플도 홈 피드와 동일한 48시간 시스템 — 업로드 48시간 지난 글은 집계 제외
const WINDOW_HOURS = 48;
// 동네(local) 필터 반경 (km)
const LOCAL_RADIUS_KM = 5;

/** exif_data 안에서 lat/lng 추출 (map_pin → 직접 lat/lng → gpsLatitude/Longitude 순) */
function pickPostCoords(row) {
  const e = row?.exif_data && typeof row.exif_data === 'object' ? row.exif_data : null;
  if (!e) return null;
  const mp = e.map_pin && typeof e.map_pin === 'object' ? e.map_pin : null;
  const lat = Number(mp?.lat ?? e.lat ?? e.gpsLatitude ?? e.gps?.lat);
  const lng = Number(mp?.lng ?? e.lng ?? e.gpsLongitude ?? e.gps?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Haversine 거리 (km) */
function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sa)));
}

/** 게시물 region 의 첫 토큰 (예: "서울 강남구 역삼동" → "서울") */
function firstRegionToken(region) {
  const s = String(region || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0] || '';
}

/**
 * posts를 place_name 단위로 그룹핑해 핫플 랭킹을 만든다.
 * - 베스트 컷 = 그 장소의 게시물 중 likes + saves*1.5 최고 점수
 * - postsCount = 최근 RECENT_HOURS시간 내 게시물 수
 * - growthRate = recent / (total - recent) 의 증가율 (없으면 0)
 * - 정렬: postsCount desc, bestCutScore desc 보조
 *
 * @param {object} opt
 * @param {number} [opt.limit=20]
 * @param {'national'|'region'|'local'} [opt.scope='national'] — 위치 기반 범위
 * @param {{lat:number, lng:number} | null} [opt.userCoords] — 사용자 좌표 (local 필터에 사용)
 * @param {string} [opt.userRegion1depth] — 사용자 1depth 지역명 (region 필터에 사용; 예: "서울")
 */
export function useHotplaceRanking({
  limit = 20,
  scope = 'national',
  userCoords = null,
  userRegion1depth = '',
} = {}) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 업로드 48시간 이내 게시물만 집계 — 시차 없는 실시간 핫플
        const windowStart = new Date(
          Date.now() - WINDOW_HOURS * 60 * 60 * 1000,
        ).toISOString();

        const { data, error: queryError } = await supabase
          .from('posts')
          .select(SELECT_COLUMNS)
          .gte('created_at', windowStart) // 48시간 지난 글은 핫플 집계에서 제외
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (cancelled) return;
        if (queryError) throw queryError;

        const normalized = (data || [])
          .map((row) => {
            const n = normalizePostRow(row);
            n.coords = pickPostCoords(row);
            return n;
          })
          .filter((p) => !!p.cover_url && !!p.place_id);

        const groups = new Map();
        const recentCutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000;

        for (const p of normalized) {
          const key = p.place_id;
          if (!groups.has(key)) {
            groups.set(key, {
              place_id: key,
              place_name: p.place_name,
              region: p.region,
              posts: [],
              recentCount: 0,
              coords: null,
            });
          }
          const g = groups.get(key);
          g.posts.push(p);
          if (!g.coords && p.coords) g.coords = p.coords;
          const createdAt = p.created_at ? new Date(p.created_at).getTime() : 0;
          if (createdAt >= recentCutoff) g.recentCount += 1;
        }

        const ranked = [];
        for (const g of groups.values()) {
          let best = g.posts[0];
          let bestScore = -Infinity;
          for (const p of g.posts) {
            const s = bestCutScore(p);
            if (s > bestScore) {
              best = p;
              bestScore = s;
            }
          }
          // 베스트컷 제외한 최근 사진 2장 (썸네일 리스트용)
          const recent = g.posts
            .filter((p) => p.id !== best.id)
            .slice(0, 2);

          const olderCount = Math.max(0, g.posts.length - g.recentCount);
          const growthRate =
            olderCount === 0
              ? g.recentCount > 0
                ? 100
                : 0
              : Math.round((g.recentCount / olderCount) * 100);

          ranked.push({
            place_id: g.place_id,
            place_name: g.place_name,
            region: g.region,
            postsCount: g.posts.length,
            recentCount: g.recentCount,
            growthRate,
            bestCutPost: best,
            recentPosts: recent,
            coords: g.coords,
            // 합산 점수: 최근 활동을 우선, 동률이면 베스트컷 점수
            _sortScore: g.recentCount * 100 + bestScore,
          });
        }

        ranked.sort((a, b) => b._sortScore - a._sortScore);

        // 범위(scope) 필터 적용
        let scoped = ranked;
        if (scope === 'region') {
          const me = String(userRegion1depth || '').trim();
          if (me) {
            scoped = ranked.filter(
              (r) => firstRegionToken(r.region) === me,
            );
          }
        } else if (scope === 'local') {
          if (userCoords && Number.isFinite(userCoords.lat) && Number.isFinite(userCoords.lng)) {
            scoped = ranked.filter(
              (r) => r.coords && haversineKm(userCoords, r.coords) <= LOCAL_RADIUS_KM,
            );
          } else {
            // 좌표가 없으면 동네 필터를 의미 있게 적용할 수 없으니 빈 결과
            scoped = [];
          }
        }

        setRanking(scoped.slice(0, limit));
      } catch (e) {
        setError(e);
        setRanking([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit, scope, userCoords?.lat, userCoords?.lng, userRegion1depth]);

  return { ranking, loading, error };
}

export { makePlaceId };

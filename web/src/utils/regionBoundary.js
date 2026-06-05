// 행정구역(시·도/시/시·군·구) 이름 검색 + 경계 폴리곤 로딩
// - 이름 인덱스: src/data/koreaRegions.json (빌드 시 포함, ~16KB)
//   t: 'p'=시·도, 'c'=구로 분할된 시 전체(수원시 등, 구 경계 합집합), 'm'=시·군·구
// - 경계 GeoJSON: public/geo/*.json (선택 시에만 lazy fetch, 단순화본)
import REGIONS from '../data/koreaRegions.json';
import { logger } from './logger';

// 사용자가 줄여 부르는 시·도 별칭
const PROVINCE_ALIASES = {
  충청북도: ['충북'],
  충청남도: ['충남'],
  전라북도: ['전북'],
  전라남도: ['전남'],
  경상북도: ['경북'],
  경상남도: ['경남'],
};

// "서울특별시"→"서울", "김천시"→"김천", "종로구"→"종로" (2글자 미만이 되면 유지: "중구"→"중구")
function shortName(name) {
  let s = String(name || '');
  for (const suffix of ['특별자치도', '특별자치시', '특별시', '광역시']) {
    if (s.endsWith(suffix)) return s.slice(0, -suffix.length);
  }
  if (/[시군구도]$/.test(s) && s.length > 2) return s.slice(0, -1);
  return s;
}

const TYPE_BY_KEY = { p: 'province', c: 'city', m: 'municipality' };
const TYPE_RANK = { p: 0, c: 1, m: 2 };

/**
 * 지역명 검색. "김천"→김천시, "서울"→서울특별시, "수원"→수원시(구 전체) 등.
 * @returns [{ name, code, type: 'province'|'city'|'municipality', province }]
 */
export function searchRegions(query, limit = 3) {
  const q = String(query || '').replace(/\s+/g, '').trim();
  if (q.length < 2) return [];

  const scored = [];
  for (const r of REGIONS) {
    const full = r.n;
    const fullNS = full.replace(/\s+/g, '');
    // "수원시 장안구" → 구 단위로도 매칭 ("장안", "장안구")
    const guPart = full.includes(' ') ? full.split(' ').pop() : '';
    const candidates = [
      fullNS,
      shortName(fullNS),
      guPart,
      guPart ? shortName(guPart) : '',
      ...(PROVINCE_ALIASES[full] || []),
    ].filter(Boolean);

    let score = -1;
    if (candidates.includes(q)) score = 0;
    else if (candidates.some((c) => c.startsWith(q))) score = 1;
    if (score < 0) continue;

    scored.push({
      name: full,
      code: r.c,
      type: TYPE_BY_KEY[r.t] || 'municipality',
      province: r.p || '',
      _score: score,
      _rank: TYPE_RANK[r.t] ?? 2,
    });
  }
  scored.sort(
    (a, b) =>
      a._score - b._score || a._rank - b._rank || a.name.length - b.name.length,
  );
  return scored.slice(0, limit).map(({ _score, _rank, ...rest }) => rest);
}

// GeoJSON 캐시 (페이지 수명 동안 1회만 fetch)
const geoCache = {};
async function loadGeoJson(type) {
  const file =
    type === 'province'
      ? '/geo/skorea-provinces-geo.json'
      : '/geo/skorea-municipalities-geo.json';
  if (!geoCache[file]) {
    geoCache[file] = fetch(file)
      .then((res) => {
        if (!res.ok) throw new Error(`${file} 로드 실패 (${res.status})`);
        return res.json();
      })
      .catch((e) => {
        delete geoCache[file];
        throw e;
      });
  }
  return geoCache[file];
}

function pushFeatureRings(feature, rings) {
  const { type, coordinates } = feature.geometry || {};
  const polys =
    type === 'MultiPolygon' ? coordinates : type === 'Polygon' ? [coordinates] : [];
  for (const poly of polys) {
    const outer = poly?.[0];
    if (!Array.isArray(outer) || outer.length < 3) continue;
    rings.push(outer.map(([lng, lat]) => ({ lat, lng })));
  }
}

/**
 * 지역 경계 외곽 링 목록 반환: [[{lat,lng}, ...], ...]
 * (Polygon/MultiPolygon 모두 외곽 링만 사용 — 지도 테두리 표시용)
 * type 'city'는 해당 시의 모든 구 경계를 합쳐서 반환.
 */
export async function loadRegionRings(region) {
  try {
    const geo = await loadGeoJson(region.type);
    const features = geo.features || [];
    const matched =
      region.type === 'city'
        ? features.filter((f) =>
            String(f?.properties?.name || '').startsWith(region.name),
          )
        : features.filter(
            (f) => String(f?.properties?.code) === String(region.code),
          );
    const rings = [];
    for (const f of matched) pushFeatureRings(f, rings);
    return rings.length > 0 ? rings : null;
  } catch (e) {
    logger.warn('지역 경계 로드 실패', e?.message || e);
    return null;
  }
}

/**
 * 지역 표기 통일 (예: 구미시 → 구미, 동일 지역 화면·필터에서 중복 노출 방지)
 * "경북 구미시" 처럼 시·도가 붙어 들어와도 시·군·구 이름 하나로 줄인다.
 */
import { bareDistrictName, toProvinceShort, resolveDistrict } from './koreanDistricts';

export function normalizeRegionName(name) {
  if (!name) return '';
  const t = String(name).trim();
  if (!t) return '';
  const tokens = t.split(/\s+/);
  // "경북 구미시" → 뒤쪽 시/군/구 기준
  const target = toProvinceShort(tokens[0]) && tokens[1] ? tokens[1] : tokens[0];
  // 표에 있는 지역이면 접미사를 뗀 이름으로 통일 (구미시 → 구미, 강남구 → 강남)
  if (resolveDistrict(target)) return bareDistrictName(target);
  return target;
}

/** 게시물이 해당 지역(정규화 이름)에 속하는지 — 위치·region·상세명에 구미/구미시 모두 허용 */
export function postMatchesCanonicalRegion(post, canonicalName) {
  const c = normalizeRegionName(canonicalName);
  if (!c) return false;
  const blob = [post?.location, post?.region, post?.detailedLocation, post?.placeName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const needle = c.toLowerCase();
  if (blob.includes(needle)) return true;
  if (needle.length >= 2 && blob.includes(`${needle}시`)) return true;
  return false;
}

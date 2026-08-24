/**
 * 최근 검색어 — 기기 로컬(localStorage)에만 남는 UI 편의 기록.
 *
 * 검색 화면은 제출 버튼 없이 입력하는 즉시 검색되기 때문에,
 * 그대로 저장하면 "서", "서울", "서울 카" 처럼 타이핑 중간 단계가 모두 쌓인다.
 * 그래서 새 검색어를 넣을 때 그것의 접두사인 기존 항목은 지워서
 * 마지막으로 완성된 단어 하나만 남게 한다.
 */

import { logger } from './logger';

const STORAGE_KEY = 'lj_recent_searches_v1';
const MAX_ITEMS = 10;
// 한 글자는 타이핑 중간 단계일 확률이 높아 저장하지 않는다.
const MIN_LENGTH = 2;

function normalize(raw) {
  // 비교용 정규화 — 앞뒤 공백 제거, 연속 공백 하나로, 대소문자 무시
  return String(raw || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getRecentSearches() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((s) => typeof s === 'string' && s.trim()).slice(0, MAX_ITEMS);
  } catch (error) {
    logger.warn('최근 검색어 불러오기 실패', error?.message || error);
    return [];
  }
}

function save(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    // 사파리 프라이빗 모드 등 저장 불가 환경 — 기능만 조용히 비활성
    logger.warn('최근 검색어 저장 실패', error?.message || error);
  }
  return list;
}

/** 검색어 추가 후 갱신된 목록을 반환. 저장할 값이 아니면 기존 목록 그대로. */
export function addRecentSearch(rawTerm) {
  const term = String(rawTerm || '').trim().replace(/\s+/g, ' ');
  if (term.length < MIN_LENGTH) return getRecentSearches();

  const key = normalize(term);
  const kept = getRecentSearches().filter((item) => {
    const k = normalize(item);
    // 같은 검색어이거나, 새 검색어를 타이핑하던 중간 단계면 제거
    return k !== key && !key.startsWith(k);
  });

  return save([term, ...kept].slice(0, MAX_ITEMS));
}

/** 검색어 하나 삭제 후 갱신된 목록을 반환. */
export function removeRecentSearch(term) {
  const key = normalize(term);
  return save(getRecentSearches().filter((item) => normalize(item) !== key));
}

/** 전체 삭제. */
export function clearRecentSearches() {
  return save([]);
}

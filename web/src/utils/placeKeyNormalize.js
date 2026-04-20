/**
 * 장소명 집계/매칭 — 띄어쓰기·NBSP·제로폭 등만 다른 경우 동일 장소로 취급
 * 예: "구미시 낙동강체육공원" ↔ "구미시 낙동강 체육공원"
 */

/** @param {unknown} text */
export function normalizePlaceIdentityKey(text) {
  const s = String(text || '')
    .trim()
    .replace(/[\s\u00A0\uFEFF\u3000\u200B-\u200D\u2060]+/g, '');
  if (!s) return '';
  return s.replace(/[A-Za-z]+/g, (m) => m.toLowerCase());
}

/**
 * 동일 정규화 키로 묶인 여러 표기 중, 카드·헤더에 쓸 한 줄
 * (공백이 있는 쪽·더 긴 쪽을 선호해 가독성 유지)
 * @param {string[]} candidates
 */
export function pickPreferredPlaceDisplayLabel(candidates) {
  const arr = [...new Set((candidates || []).map((x) => String(x || '').trim()).filter(Boolean))];
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  return [...arr].sort((a, b) => {
    const sa = (a.match(/\s/g) || []).length;
    const sb = (b.match(/\s/g) || []).length;
    if (sb !== sa) return sb - sa;
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b, 'ko');
  })[0];
}

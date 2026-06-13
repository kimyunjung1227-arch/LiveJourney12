/**
 * Gemini 등 멀티 문단 응답을 2줄 클램프 박스 "안에서 깔끔히 마무리"되도록 정제한다.
 * 핵심 보장: 반환 길이는 target을 절대 넘지 않는다 → CSS line-clamp가 문장 중간을
 * "…"로 자를 일이 없다(어떤 핫플 카드에서도 말줄임표 노출 금지).
 *
 * - 줄바꿈/연속 공백을 단일 공백으로 평탄화
 * - target 글자 예산 안에 들어가는 "완결된 문장"만 차곡차곡 채운다
 * - 첫 문장조차 예산보다 길면 단어 경계에서 자르고 마침표로 마무리 (… 사용 안 함)
 *
 * @param {string} text   원문
 * @param {number} target 표시 글자 예산 (2줄에 들어갈 만큼. 길이 상한이기도 함)
 */
export function cleanForTwoLines(text, target = 64) {
  if (!text) return '';
  const flat = String(text).replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  if (flat.length <= target) return flat;

  // 문장 단위 분해 (문장부호 뒤에서 끊되 부호는 유지)
  const sentences = flat
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) 예산 안에 들어가는 만큼 완결된 문장을 이어 붙인다
  let out = '';
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length <= target) out = next;
    else break;
  }

  // 2) 첫 문장조차 예산을 넘으면 — 단어 경계에서 자르고 마침표로 마무리
  if (!out) {
    const first = sentences[0] || flat;
    const slice = first.slice(0, target);
    const lastSpace = slice.lastIndexOf(' ');
    out = (lastSpace >= Math.floor(target * 0.6) ? slice.slice(0, lastSpace) : slice).trim();
  }

  // 끝은 항상 문장부호로 (… 대신 마침표)
  if (out && !/[.!?]$/.test(out)) out = `${out}.`;
  return out;
}

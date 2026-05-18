/**
 * Gemini 등 멀티 문단 응답을 깔끔한 2줄 클램프에 어울리도록 정제한다.
 * - 줄바꿈/연속 공백을 단일 공백으로 평탄화
 * - 가능하면 "다."/"요."/"!"/"?" 같은 문장 끝에서 마무리 (… 사용 안 함)
 * - 못 찾으면 다음 문장 끝까지 살짝 overflow 허용해서 마무리
 * - 최후: target 길이에서 그냥 컷 (이 경우만 끝이 매끄럽지 않을 수 있음)
 *
 * @param {string} text   원문
 * @param {number} target 목표 표시 길이 (대략. 문장 경계가 우선)
 */
export function cleanForTwoLines(text, target = 140) {
  if (!text) return '';
  const flat = String(text).replace(/\s+/g, ' ').trim();
  if (flat.length <= target) return flat;

  const markers = ['다.', '요.', '죠.', '니다.', '!', '?'];

  // 1) target 이전에 가장 가까운 문장 끝
  let bestBefore = -1;
  for (const m of markers) {
    const idx = flat.lastIndexOf(m, target);
    if (idx >= 30) {
      const end = idx + m.length;
      if (end > bestBefore) bestBefore = end;
    }
  }
  if (bestBefore > 30) return flat.slice(0, bestBefore);

  // 2) target 이후 가장 가까운 문장 끝까지는 약간 overflow 허용
  let bestAfter = Infinity;
  for (const m of markers) {
    const idx = flat.indexOf(m, target);
    if (idx !== -1) {
      const end = idx + m.length;
      if (end < bestAfter) bestAfter = end;
    }
  }
  if (bestAfter !== Infinity && bestAfter - target <= 60) {
    return flat.slice(0, bestAfter);
  }

  // 3) 마지막 보루: 문장 경계가 아예 없으면 그냥 컷
  return flat.slice(0, target);
}

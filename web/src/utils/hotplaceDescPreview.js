const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * 카드/피드용 장소 설명 미리보기
 * - 줄 클램프로 문장 중간이 잘려 보이지 않도록 "완결된 문장" 위주로 짧게 만든다.
 * - 마지막은 항상 마침표/물음표/느낌표로 끝나게 한다.
 */
export function toHotplaceDescPreview(text, { maxChars = 220, maxSentences = 2 } = {}) {
  const raw = normalizeSpace(text);
  if (!raw) return '';

  const cleaned = raw
    .replace(/좋아요[.!?]?\s*/g, '')
    .replace(/추천해요[.!?]?\s*/g, '')
    .replace(/가요[.!?]?\s*/g, '')
    .replace(/해요[.!?]?\s*/g, (m) => (m.includes('?') ? m : '입니다. '))
    .replace(/\.\s*\./g, '.')
    .trim();

  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) 문장 단위로 먼저 최대 N문장까지
  let out = parts.slice(0, Math.max(1, maxSentences)).join(' ');
  out = normalizeSpace(out);

  // 2) 너무 길면 글자수 제한 내에서 "완결된 문장"으로 자르기
  if (out.length > maxChars) {
    const within = out.slice(0, maxChars);
    const lastPunc = Math.max(within.lastIndexOf('.'), within.lastIndexOf('!'), within.lastIndexOf('?'));
    if (lastPunc >= 20) {
      out = within.slice(0, lastPunc + 1);
    } else {
      // 문장부호가 없으면 단어 경계에서 자르고 마침표로 끝낸다
      const lastSpace = within.lastIndexOf(' ');
      out = (lastSpace >= 40 ? within.slice(0, lastSpace) : within).trim();
      if (out && !/[.!?]$/.test(out)) out = `${out}.`;
    }
  }

  out = normalizeSpace(out);
  if (out && !/[.!?]$/.test(out)) out = `${out}.`;
  return out;
}


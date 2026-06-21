/**
 * 질문은 별도 title 컬럼 없이 body 한 칸에 "제목\n\n내용" 형태로 저장한다.
 * (장소 기반 구조 대신 제목+내용 구조로 변경하며, DB 스키마는 그대로 둠)
 * 이 헬퍼로 표시할 때 제목/내용을 분리한다. 구분자가 없으면 전체를 제목으로 본다.
 */
export function parseQuestionBody(raw) {
  const text = String(raw || '');
  const idx = text.indexOf('\n\n');
  if (idx === -1) return { title: text.trim(), content: '' };
  return {
    title: text.slice(0, idx).trim(),
    content: text.slice(idx + 2).trim(),
  };
}

/** 제목 + 내용 → 저장용 body 문자열 */
export function buildQuestionBody(title, content) {
  const t = String(title || '').trim();
  const c = String(content || '').trim();
  return c ? `${t}\n\n${c}` : t;
}

/**
 * 핫플 카드 진입 즉시(네트워크 0) 보여줄 장소 한 줄 소개.
 * Edge Function(Claude)·캐시 응답이 오기 전 "설명 칸이 비어 보이는" 구간을 없앤다.
 * 실제 AI 소개가 도착하면 카드가 이 문장을 대체한다.
 *
 * - 서버 buildLocalFallback 과 톤을 맞추되, 카드 클램프(92~110자)에 맞춰 짧게.
 * - 장소명/지역만으로 단정 가능한 안전한 표현만 사용(환각·과장 금지).
 *
 * @param {string} placeName 장소명
 * @param {string} region    지역(있으면 "~에 있는" 으로 자연스럽게)
 */
export function buildInstantPlaceBlurb(placeName, region = '') {
  const name = String(placeName || '').trim();
  if (!name) return '';
  const r = String(region || '').trim();
  const where = r ? `${r}에 있는 ` : '';
  // 실제 소개가 끝내 도착하지 않아도 그대로 두기에 자연스러운 '완결형' 문장만 쓴다
  // ("잠시 후 표시" 같은 약속 문구는 금지 — 실패 시 거짓이 된다).
  return `${name}은 ${where}지금 사람들이 찾는 장소예요. 가볍게 들러 분위기를 느끼고 사진을 남기기 좋습니다.`;
}

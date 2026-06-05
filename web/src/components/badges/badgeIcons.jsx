import React from 'react';

/**
 * 뱃지 모티프 → 커스텀 라인 아이콘.
 * - Tabler/외부 의존 없이 직접 그린 아웃라인 SVG (흰 배경 위 라인 톤).
 * - 색은 stroke={color} 로 주입 → 등급색이 자동 적용된다(currentColor 대용).
 * - 각 컴포넌트 시그니처: { size, color, stroke, style } (Tabler 아이콘과 호환)
 * - 지역은 대표 랜드마크/상징을 라인으로 단순화:
 *     서울=마천루, 부산=광안대교, 대구=83타워, 인천=공항, 광주=기념탑, 대전=과학(원자),
 *     울산=산업, 세종=정부청사, 경기=수원화성 성곽, 강원=설악산, 충북=내륙 호수,
 *     충남=서해 일출, 전북=한옥, 전남=다도해, 경북=경주 석탑, 경남=돛단배, 제주=한라산
 */

// 모티프별 아웃라인 path 묶음 (viewBox 0 0 24 24, stroke 상속)
const PATHS = {
  // ── 지역 (17개 시·도) ──
  seoul:
    '<rect x="3" y="12" width="4.5" height="9"/><rect x="9" y="6" width="4" height="15"/><rect x="14.5" y="9.5" width="4.5" height="11.5"/><path d="M11 6V3.5"/><path d="M2 21h20"/>',
  busan:
    '<path d="M2 17h20"/><path d="M6.5 17V6"/><path d="M17.5 17V6"/><path d="M6.5 6c4 4 7 4 11 0"/><path d="M9 17v-7M12 17V9M15 17v-7"/><path d="M18.5 4.5q1 1 2.2 0"/>',
  daegu:
    '<path d="M12 21V4"/><path d="M8.5 9.5c0-2 1.5-3.2 3.5-3.2s3.5 1.2 3.5 3.2"/><path d="M8.5 9.5h7"/><path d="M9 21l3-6 3 6"/>',
  incheon:
    '<path d="M21 11l-7.5-1V4.5a1.5 1.5 0 0 0-3 0V10L3 11v2l7.5-1.2v4.2l-2 1.5V19l3.5-1 3.5 1v-1.5l-2-1.5v-4.2L21 13z"/>',
  gwangju:
    '<path d="M10.6 17l1-13h.8l1 13"/><path d="M8.6 17h6.8"/><path d="M7.6 19h8.8"/><path d="M7 21h10"/>',
  daejeon:
    '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.4"/><ellipse cx="12" cy="12" rx="9" ry="3.4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.4" transform="rotate(120 12 12)"/>',
  ulsan:
    '<path d="M3 21V12l5 3v-3l5 3V9h6v12z"/><path d="M17 9V5h1.6v4"/><path d="M6 18h1.5M10.5 18H12M15 18h1.5"/>',
  sejong:
    '<path d="M12 3.5 3 8h18z"/><path d="M4 8v11M20 8v11"/><path d="M7 11v6M11 11v6M13 11v6M17 11v6"/><path d="M3 19h18"/>',
  gyeonggi:
    '<path d="M3 21V11h2V9h2v2h3V9h2v2h3V9h2v2h2v10"/><path d="M2.5 21h19"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  gangwon: '<path d="M2 20l7-13 4 7 2-3 7 9z"/><path d="M7.2 10.6q1.8-1.6 3.6 0"/>',
  chungbuk:
    '<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  chungnam:
    '<path d="M3 18h18"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0"/><path d="M12 5v2.5M5.5 8.5l1.5 1.5M18.5 8.5l-1.5 1.5M2.5 14H5M19 14h2.5"/>',
  jeonbuk:
    '<path d="M2 11c3-4 6-6 10-6s7 2 10 6"/><path d="M5 11c2-1 3 .4 3.6 1.3M19 11c-2-1-3 .4-3.6 1.3"/><path d="M6.5 12.5V20h11v-7.5"/><path d="M10.5 20v-4.5h3V20"/>',
  jeonnam:
    '<path d="M2 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/><path d="M5 14a3 3 0 0 1 6 0"/><path d="M13.5 13a3.5 3.5 0 0 1 7 0"/>',
  gyeongbuk:
    '<path d="M12 3.5 8.5 6h7z"/><path d="M9 6h6"/><path d="M7.5 9q4.5-2 9 0"/><path d="M8.5 9h7"/><path d="M6 12.5q6-2.2 12 0"/><path d="M7.5 15.5h9v3h-9z"/><path d="M5.5 20h13v-1.5h-13z"/><path d="M10.5 18.5v-3h3v3"/>',
  gyeongnam:
    '<path d="M11.6 4v10"/><path d="M11.6 6l5 8h-5z"/><path d="M11.6 7L8 14h3.6"/><path d="M4 16h16l-2.2 4H6.2z"/>',
  jeju: '<path d="M3 20l6.5-12c.8-1.5 2.2-1.5 3 0L19 20z"/><path d="M9.5 8.5h5"/><path d="M3 20h16"/>',

  // ── 영예 / 베스트컷 / 이타심(불꽃) ──
  honor:
    '<circle cx="12" cy="9" r="5.5"/><path d="M12 6.2l1 2 2.2.3-1.6 1.5.4 2.2L12 11.6l-2 1 .4-2.2-1.6-1.5 2.2-.3z"/><path d="M9 13.6l-1.2 6.4L12 18l4.2 2-1.2-6.4"/>',
  crown: '<path d="M3 8.5l4 4 5-7 5 7 4-4-1.6 10.5H4.6z"/><path d="M4.6 19h14.8"/>',
  flame:
    '<path d="M12 21c3.6 0 6.3-2.7 6.3-6.2 0-3-2-5-3.2-7.2-.4 1.4-1.3 2-2.3 2.6.2-2.8-1-5.4-3.4-7.2.4 3-1.7 4.6-3.2 6.6-1 1.4-1.6 3-1.6 5C6 18.3 8.6 21 12 21z"/><path d="M12 21c-2 0-3.4-1.5-3.4-3.4 0-1.7 1.2-2.7 2-4 .8 1.2 2 1.6 2.4 3 .5 1.7-1 4.4-1 4.4z"/>',

  // ── 시즌 & 테마 ──
  cherry:
    '<ellipse cx="12" cy="7" rx="2.2" ry="3.3"/><ellipse cx="12" cy="7" rx="2.2" ry="3.3" transform="rotate(72 12 12)"/><ellipse cx="12" cy="7" rx="2.2" ry="3.3" transform="rotate(144 12 12)"/><ellipse cx="12" cy="7" rx="2.2" ry="3.3" transform="rotate(216 12 12)"/><ellipse cx="12" cy="7" rx="2.2" ry="3.3" transform="rotate(288 12 12)"/><circle cx="12" cy="12" r="1.4"/>',
  sunset:
    '<path d="M3 17h18"/><path d="M7.5 17a4.5 4.5 0 0 1 9 0"/><path d="M5 20h14"/><path d="M12 4v2M5 8l1.4 1.4M19 8l-1.4 1.4"/>',
  weather:
    '<circle cx="17" cy="7" r="2.4"/><path d="M17 2.6v1.4M21.4 7H20M20.6 3.4l-1 1"/><path d="M7.5 19a4 4 0 0 1-.3-8 5 5 0 0 1 9.4 1.2A3.5 3.5 0 0 1 16.5 19z"/>',
  festival:
    '<circle cx="12" cy="12" r="2.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
  crowd:
    '<circle cx="8" cy="8" r="2.5"/><path d="M3.5 18v-1.5a4.5 4.5 0 0 1 9 0V18"/><circle cx="16" cy="8" r="2.5"/><path d="M14.2 11.3a4.5 4.5 0 0 1 6.3 4.2V18"/>',
  store:
    '<path d="M4 10l1.5-4h13L20 10"/><path d="M4 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5 11.5V20h14v-8.5"/><path d="M10 20v-5h4v5"/>',
};

/** path 묶음 → 라인 아이콘 컴포넌트. (전체 <svg>를 주입해 브라우저 HTML 파서가 처리) */
function makeIcon(inner) {
  return function Icon({ size = 24, color = '#2BA0DC', stroke = 1.8, style }) {
    const html =
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}"` +
      ` stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    return (
      <span
        style={{ display: 'inline-flex', lineHeight: 0, ...style }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };
}

export const ICONS = Object.fromEntries(
  Object.entries(PATHS).map(([key, inner]) => [key, makeIcon(inner)])
);

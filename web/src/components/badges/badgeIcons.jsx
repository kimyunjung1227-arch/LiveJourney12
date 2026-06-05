import React from 'react';

/**
 * 뱃지 모티프 → 플랫 듀오톤 면(fill) 아이콘.
 *
 * 디자인 (v8 — 당근/Lyft 활동배지 스타일)
 * - 라인이 아니라 단색 "면"으로 그린 플랫 도형. 그라디언트/질감 없음.
 * - 전 뱃지가 같은 팔레트를 공유: 메인 하늘(M) + 딥 하늘(D) + 서브 앰버(A)·코랄(C) + 흰 컷아웃(W).
 * - 색 토큰(__M__ 등)을 렌더 시 palette 로 치환 → 회색(미획득)/모노(칩) 변형이 자동.
 * - 각 컴포넌트 시그니처: { size, palette, style }
 * - 지역은 대표 랜드마크/상징을 면으로 단순화:
 *     서울=마천루, 부산=광안대교, 대구=83타워, 인천=공항, 광주=기념탑, 대전=과학(원자),
 *     울산=조선소 배, 세종=정부청사, 경기=수원화성 성문, 강원=설악산, 충북=내륙 호수,
 *     충남=서해 일출, 전북=한옥, 전남=다도해, 경북=경주 석탑, 경남=돛단배, 제주=한라산
 */

// 모티프별 면 도형 묶음 (viewBox 0 0 48 48, __M__/__D__/__A__/__C__/__W__ 토큰)
const PATHS = {
  // ── 지역 (17개 시·도) ──
  seoul:
    '<circle cx="39" cy="9" r="4.5" fill="__A__"/>' +
    '<rect x="5" y="24" width="9" height="19" rx="2" fill="__D__"/>' +
    '<rect x="16" y="11" width="11" height="32" rx="2" fill="__M__"/>' +
    '<rect x="29" y="20" width="9" height="23" rx="2" fill="__D__"/>' +
    '<rect x="19" y="16" width="5" height="4" rx="1" fill="__W__"/>' +
    '<rect x="19" y="23" width="5" height="4" rx="1" fill="__W__"/>',
  busan:
    '<circle cx="40" cy="9" r="4" fill="__A__"/>' +
    '<rect x="13" y="11" width="3.5" height="19" rx="1.75" fill="__D__"/>' +
    '<rect x="31.5" y="11" width="3.5" height="19" rx="1.75" fill="__D__"/>' +
    '<path d="M14.8 13.5q9.2 11 18.4 0" stroke="__M__" stroke-width="3" fill="none"/>' +
    '<rect x="4" y="29" width="40" height="4.5" rx="2.25" fill="__M__"/>' +
    '<path d="M10 41.5q4.7-4 9.3 0t9.3 0t9.3 0" stroke="__D__" stroke-width="3" fill="none"/>',
  daegu:
    '<circle cx="24" cy="5.5" r="2.5" fill="__A__"/>' +
    '<rect x="22.8" y="7" width="2.4" height="6" rx="1.2" fill="__D__"/>' +
    '<ellipse cx="24" cy="16" rx="9" ry="4.5" fill="__D__"/>' +
    '<path d="M20.5 19l-3.5 21h14l-3.5-21z" fill="__M__"/>' +
    '<rect x="12" y="40" width="24" height="3.5" rx="1.75" fill="__D__"/>',
  incheon:
    '<circle cx="40" cy="9" r="3.5" fill="__A__"/>' +
    '<path d="M24 4c1.6 0 2.6 1.3 2.6 3.2v9.3L42 25v4.8l-15.4-4.6v8.6l4.8 3.8V41l-7.4-2.2L16.6 41v-3.4l4.8-3.8v-8.6L6 29.8V25l15.4-8.5V7.2C21.4 5.3 22.4 4 24 4z" fill="__M__"/>' +
    '<circle cx="24" cy="9.5" r="1.7" fill="__W__"/>',
  gwangju:
    '<rect x="17.5" y="6" width="4.5" height="34" rx="2.2" fill="__M__"/>' +
    '<rect x="26" y="6" width="4.5" height="34" rx="2.2" fill="__D__"/>' +
    '<circle cx="24" cy="22" r="3.2" fill="__A__"/>' +
    '<rect x="11" y="40" width="26" height="3.5" rx="1.75" fill="__D__"/>',
  daejeon:
    '<ellipse cx="24" cy="24" rx="17" ry="7" fill="none" stroke="__M__" stroke-width="3"/>' +
    '<ellipse cx="24" cy="24" rx="17" ry="7" fill="none" stroke="__D__" stroke-width="3" transform="rotate(60 24 24)"/>' +
    '<ellipse cx="24" cy="24" rx="17" ry="7" fill="none" stroke="__M__" stroke-width="3" transform="rotate(120 24 24)"/>' +
    '<circle cx="24" cy="24" r="4.5" fill="__A__"/>' +
    '<circle cx="38" cy="17.5" r="2.5" fill="__C__"/>',
  ulsan:
    '<rect x="13" y="21" width="7" height="8" rx="1.2" fill="__A__"/>' +
    '<rect x="21.5" y="21" width="7" height="8" rx="1.2" fill="__C__"/>' +
    '<rect x="30" y="13" width="7" height="16" rx="1.2" fill="__D__"/>' +
    '<rect x="31.8" y="16" width="3.4" height="2.8" rx="0.8" fill="__W__"/>' +
    '<path d="M5 29h38l-5.5 9H10.5z" fill="__M__"/>' +
    '<rect x="9" y="41.5" width="11" height="3" rx="1.5" fill="__D__"/>' +
    '<rect x="27" y="41.5" width="11" height="3" rx="1.5" fill="__D__"/>',
  sejong:
    '<path d="M24 4L42 13H6z" fill="__D__"/>' +
    '<circle cx="24" cy="9.2" r="1.8" fill="__A__"/>' +
    '<rect x="7" y="14" width="34" height="28" rx="3" fill="__M__"/>' +
    '<rect x="12" y="19" width="3.5" height="16" rx="1.75" fill="__W__"/>' +
    '<rect x="19" y="19" width="3.5" height="16" rx="1.75" fill="__W__"/>' +
    '<rect x="25.5" y="19" width="3.5" height="16" rx="1.75" fill="__W__"/>' +
    '<rect x="32.5" y="19" width="3.5" height="16" rx="1.75" fill="__W__"/>' +
    '<rect x="20.5" y="35" width="7" height="7" rx="1.5" fill="__D__"/>',
  gyeonggi:
    '<circle cx="24" cy="11" r="2" fill="__A__"/>' +
    '<path d="M7 19c6-7 28-7 34 0l-2.5 4H9.5z" fill="__C__"/>' +
    '<rect x="8" y="23" width="32" height="19" rx="2" fill="__M__"/>' +
    '<path d="M17 42v-7.5a7 7 0 0 1 14 0V42z" fill="__W__"/>',
  gangwon:
    '<circle cx="39" cy="11" r="4.5" fill="__A__"/>' +
    '<path d="M21 41l10.5-17L44 41z" fill="__D__"/>' +
    '<path d="M4 41L17 15l13 26z" fill="__M__"/>' +
    '<path d="M17 15l4.6 9.2-2.3-1.6-2.3 2.4-2.3-2.4-2.3 1.6z" fill="__W__"/>',
  chungbuk:
    '<circle cx="24" cy="13" r="5.5" fill="__A__"/>' +
    '<path d="M5 26q4.75-4.5 9.5 0t9.5 0t9.5 0t9.5 0" stroke="__M__" stroke-width="3.5" fill="none"/>' +
    '<path d="M5 33.5q4.75-4.5 9.5 0t9.5 0t9.5 0t9.5 0" stroke="__D__" stroke-width="3.5" fill="none"/>' +
    '<path d="M5 41q4.75-4.5 9.5 0t9.5 0t9.5 0t9.5 0" stroke="__M__" stroke-width="3.5" fill="none"/>',
  chungnam:
    '<path d="M24 8v5M11.5 13.5l3.5 3.5M36.5 13.5L33 17" stroke="__A__" stroke-width="3" fill="none"/>' +
    '<path d="M13 29a11 11 0 0 1 22 0z" fill="__A__"/>' +
    '<path d="M5 35q4.75-4 9.5 0t9.5 0t9.5 0t9.5 0" stroke="__M__" stroke-width="3.5" fill="none"/>' +
    '<path d="M10 42q4.7-4 9.3 0t9.3 0t9.3 0" stroke="__D__" stroke-width="3.5" fill="none"/>',
  jeonbuk:
    '<path d="M5 20c6-9 32-9 38 0l-3 4H8z" fill="__D__"/>' +
    '<rect x="10" y="24" width="28" height="18" rx="2" fill="__M__"/>' +
    '<rect x="19.5" y="29" width="9" height="13" rx="1.5" fill="__W__"/>',
  jeonnam:
    '<circle cx="37" cy="10" r="4" fill="__A__"/>' +
    '<path d="M7 31a7.75 7.75 0 0 1 15.5 0z" fill="__M__"/>' +
    '<path d="M26 31a6.5 6.5 0 0 1 13 0z" fill="__D__"/>' +
    '<path d="M5 38.5q4.75-4 9.5 0t9.5 0t9.5 0t9.5 0" stroke="__M__" stroke-width="3.5" fill="none"/>',
  gyeongbuk:
    '<circle cx="24" cy="6" r="2.5" fill="__A__"/>' +
    '<rect x="16" y="9.5" width="16" height="4.5" rx="1.5" fill="__D__"/>' +
    '<rect x="19.5" y="14" width="9" height="5" fill="__M__"/>' +
    '<rect x="13" y="19" width="22" height="4.5" rx="1.5" fill="__D__"/>' +
    '<rect x="17.5" y="23.5" width="13" height="6" fill="__M__"/>' +
    '<rect x="10" y="29.5" width="28" height="4.5" rx="1.5" fill="__D__"/>' +
    '<rect x="20" y="34" width="8" height="4" fill="__M__"/>' +
    '<rect x="7" y="38" width="34" height="4" rx="2" fill="__M__"/>',
  gyeongnam:
    '<path d="M21.5 5v20H7.5c3.5-9 8.5-15.5 14-20z" fill="__M__"/>' +
    '<path d="M25.5 9v16h11c-2.5-7-6.5-12.5-11-16z" fill="__A__"/>' +
    '<path d="M6 29h36l-5 8.5H11z" fill="__D__"/>' +
    '<path d="M10 42.5q4.7-4 9.3 0t9.3 0t9.3 0" stroke="__M__" stroke-width="3" fill="none"/>',
  jeju:
    '<circle cx="40" cy="10" r="4" fill="__A__"/>' +
    '<path d="M5 39L17.5 15h13L43 39z" fill="__M__"/>' +
    '<path d="M20.5 15h7l-2.6 5h-1.8z" fill="__W__"/>',

  // ── 영예 / 베스트컷 / 이타심(불꽃) ──
  honor:
    '<path d="M14.5 4h8l3.5 10.5-8.5 4z" fill="__M__"/>' +
    '<path d="M33.5 4h-8l-3.5 10.5 8.5 4z" fill="__D__"/>' +
    '<circle cx="24" cy="29" r="12.5" fill="__A__"/>' +
    '<path d="M24 22.6l2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.2-3.1 4.4-.6z" fill="__W__"/>',
  crown:
    '<path d="M7 13.5l8.5 8L24 9.5l8.5 12 8.5-8L37.5 36h-27z" fill="__A__"/>' +
    '<circle cx="24" cy="27" r="2.8" fill="__C__"/>' +
    '<circle cx="15" cy="29.5" r="2" fill="__W__"/>' +
    '<circle cx="33" cy="29.5" r="2" fill="__W__"/>',
  flame:
    '<path d="M24 5c1.8 7 11 11.5 11 24.5a11 11 0 0 1-22 0c0-5.5 2-9.5 5-13.5.6 3.2 2.2 5 4.6 6.2C20.8 16 22.4 10 24 5z" fill="__C__"/>' +
    '<path d="M24 25c3.2 4 4.8 7 4.8 10.5a4.8 4.8 0 0 1-9.6 0c0-3.5 1.6-6.5 4.8-10.5z" fill="__A__"/>',

  // ── 시즌 & 테마 ──
  cherry:
    '<g fill="__C__">' +
    '<ellipse cx="24" cy="13.5" rx="5" ry="7.5"/>' +
    '<ellipse cx="24" cy="13.5" rx="5" ry="7.5" transform="rotate(72 24 24)"/>' +
    '<ellipse cx="24" cy="13.5" rx="5" ry="7.5" transform="rotate(144 24 24)"/>' +
    '<ellipse cx="24" cy="13.5" rx="5" ry="7.5" transform="rotate(216 24 24)"/>' +
    '<ellipse cx="24" cy="13.5" rx="5" ry="7.5" transform="rotate(288 24 24)"/>' +
    '</g>' +
    '<circle cx="24" cy="24" r="4.5" fill="__A__"/>',
  sunset:
    '<path d="M24 6v5M9 12l3.5 3.5M39 12l-3.5 3.5" stroke="__A__" stroke-width="3.2" fill="none"/>' +
    '<path d="M11.5 31a12.5 12.5 0 0 1 25 0z" fill="__A__"/>' +
    '<rect x="5" y="31" width="38" height="4" rx="2" fill="__D__"/>' +
    '<rect x="12" y="38.5" width="11" height="3.2" rx="1.6" fill="__M__"/>' +
    '<rect x="26" y="38.5" width="8" height="3.2" rx="1.6" fill="__M__"/>',
  weather:
    '<path d="M33 2.5v3.2M44.5 14h-3.2M41.4 5.6l-2.3 2.3" stroke="__A__" stroke-width="2.8" fill="none"/>' +
    '<circle cx="33" cy="14" r="7.5" fill="__A__"/>' +
    '<path d="M14 41h17a7 7 0 0 0 1.8-13.8 10 10 0 0 0-19.4-1.7A7.5 7.5 0 0 0 14 41z" fill="__M__"/>',
  festival:
    '<path d="M24 5v7M24 36v7M5 24h7M36 24h7" stroke="__C__" stroke-width="3.2" fill="none"/>' +
    '<path d="M10.6 10.6l5 5M32.4 32.4l5 5M37.4 10.6l-5 5M15.6 32.4l-5 5" stroke="__A__" stroke-width="3.2" fill="none"/>' +
    '<circle cx="24" cy="24" r="5.5" fill="__M__"/>' +
    '<circle cx="38" cy="7" r="2.2" fill="__M__"/>' +
    '<circle cx="9" cy="39" r="2.2" fill="__M__"/>',
  crowd:
    '<circle cx="13" cy="17" r="5" fill="__D__"/>' +
    '<path d="M4 35a9 9 0 0 1 18 0z" fill="__D__"/>' +
    '<circle cx="35" cy="17" r="5" fill="__M__"/>' +
    '<path d="M26 35a9 9 0 0 1 18 0z" fill="__M__"/>' +
    '<circle cx="24" cy="21" r="6" fill="__A__"/>' +
    '<path d="M12.5 43a11.5 11.5 0 0 1 23 0z" fill="__A__"/>',
  store:
    '<rect x="8" y="20" width="32" height="22" rx="2.5" fill="__M__"/>' +
    '<rect x="13" y="27" width="8.5" height="15" rx="1.5" fill="__W__"/>' +
    '<rect x="25.5" y="27" width="9.5" height="8" rx="1.5" fill="__W__"/>' +
    '<rect x="6" y="12" width="36" height="7" rx="2" fill="__C__"/>' +
    '<path d="M6 19a3 3 0 0 0 6 0z" fill="__C__"/>' +
    '<path d="M12 19a3 3 0 0 0 6 0z" fill="__W__"/>' +
    '<path d="M18 19a3 3 0 0 0 6 0z" fill="__C__"/>' +
    '<path d="M24 19a3 3 0 0 0 6 0z" fill="__W__"/>' +
    '<path d="M30 19a3 3 0 0 0 6 0z" fill="__C__"/>' +
    '<path d="M36 19a3 3 0 0 0 6 0z" fill="__W__"/>',
};

// 기본 팔레트 (badgeTheme.ICON_PALETTE 와 동일 — 순환 import 방지용 복제)
const DEFAULT_PALETTE = {
  M: '#2BA0DC',
  D: '#1A6EA8',
  A: '#FFB94E',
  C: '#FF8A70',
  W: '#FFFFFF',
};

/** 도형 묶음 → 플랫 아이콘 컴포넌트. 색 토큰을 palette 로 치환해 렌더. */
function makeIcon(inner) {
  return function Icon({ size = 48, palette = DEFAULT_PALETTE, style }) {
    const body = inner.replace(/__([MDACW])__/g, (_, k) => palette[k] || DEFAULT_PALETTE[k]);
    const html =
      `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none"` +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body +
      '</svg>';
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

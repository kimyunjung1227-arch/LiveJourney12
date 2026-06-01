import React from 'react';

/**
 * 뱃지 글리프 — 볼드 플랫(앱아이콘) 스타일.
 * - 컬러 스퀘르클 위에 올라가는 "흰색 볼드 실루엣".
 * - 시그니처: (w, bg)
 *     · w  : 흰색 (실루엣)
 *     · bg : 스퀘르클 배경색 (내부 컷아웃/디테일에 사용 → 깔끔한 앱아이콘 룩)
 * - 좌표계: viewBox 0 0 100 100, 글리프는 대략 x[24,76]·y[22,74], 중앙 (50,46).
 */

const SOFT = 'rgba(255,255,255,0.55)';

function starPath(cx, cy, outer, inner, points = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i + (rotDeg * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

/* ════════ 지역 (전국 17개 시·도) ════════ */

// 서울 — 빌딩 스카이라인 + 타워
const seoul = (w, bg) => (
  <g>
    <rect x="28" y="44" width="12" height="26" rx="2" fill={SOFT} />
    <rect x="60" y="50" width="12" height="20" rx="2" fill={SOFT} />
    <rect x="42" y="32" width="16" height="38" rx="2" fill={w} />
    <rect x="48.8" y="22" width="2.6" height="11" rx="1.3" fill={w} />
    <circle cx="50" cy="26" r="3" fill={w} />
    {[[45, 38], [51, 38], [45, 46], [51, 46], [45, 54], [51, 54]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="3" height="4" rx="0.6" fill={bg} />
    ))}
  </g>
);

// 부산 — 광안대교 + 갈매기
const busan = (w) => (
  <g fill="none" stroke={w} strokeLinecap="round" strokeLinejoin="round">
    <rect x="24" y="57" width="52" height="4.4" rx="2.2" fill={w} stroke="none" />
    <rect x="36.6" y="42" width="3.2" height="18" rx="1.6" fill={w} stroke="none" />
    <rect x="60.2" y="42" width="3.2" height="18" rx="1.6" fill={w} stroke="none" />
    <path d="M24 59 Q36 42 38.2 42 Q50 53 61.8 42 Q64 42 76 59" strokeWidth="3" />
    <path d="M54 32 Q59 28 63 32 Q67 28 72 32" strokeWidth="3" />
  </g>
);

// 대구 — 관측 타워(83타워)
const daegu = (w, bg) => (
  <g>
    <path d="M42 70 L45 62 L55 62 L58 70 Z" fill={w} />
    <rect x="47" y="40" width="6" height="22" fill={w} />
    <rect x="43" y="34" width="14" height="8" rx="3" fill={w} />
    <rect x="48.8" y="23" width="2.4" height="11" rx="1.2" fill={w} />
    <rect x="45" y="37" width="10" height="2.4" rx="1.2" fill={bg} />
  </g>
);

// 인천 — 등대 + 빛
const incheon = (w, bg) => (
  <g>
    <path d="M55 40 L78 33 L78 47 Z" fill={SOFT} />
    <path d="M43 70 L46 42 L54 42 L57 70 Z" fill={w} />
    <rect x="44" y="36" width="12" height="6.4" rx="1.5" fill={w} />
    <path d="M43 36 L50 28 L57 36 Z" fill={w} />
    <rect x="44" y="54" width="12" height="5.5" fill={bg} />
    <circle cx="50" cy="27" r="2" fill={w} />
  </g>
);

// 광주 — 무등산 주상절리
const gwangju = (w, bg) => (
  <g>
    <path d="M18 72 L40 40 L52 56 L64 38 L82 72 Z" fill={w} />
    {[46, 50, 54].map((x, i) => (
      <line key={i} x1={x} y1="56" x2={x} y2="72" stroke={bg} strokeWidth="2.4" />
    ))}
  </g>
);

// 대전 — 과학(원자)
const daejeon = (w) => (
  <g>
    {[0, 60, 120].map((rot) => (
      <ellipse key={rot} cx="50" cy="47" rx="25" ry="9.5" fill="none" stroke={w} strokeWidth="3" transform={`rotate(${rot} 50 47)`} />
    ))}
    <circle cx="50" cy="47" r="6.5" fill={w} />
    <circle cx="75" cy="47" r="3" fill={w} />
    <circle cx="34" cy="60" r="3" fill={w} />
  </g>
);

// 울산 — 고래
const ulsan = (w, bg) => (
  <g>
    <path d="M26 53 Q36 41 54 44 Q66 46 72 54 Q63 62 50 62 Q34 62 26 53 Z" fill={w} />
    <path d="M71 54 L81 47 Q78 54 81 62 Z" fill={w} />
    <path d="M54 44 Q51 35 57 30" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <circle cx="57" cy="30" r="2.4" fill={w} />
    <circle cx="40" cy="52" r="2" fill={bg} />
  </g>
);

// 세종 — 정부청사
const sejong = (w, bg) => (
  <g>
    <rect x="32" y="42" width="36" height="28" rx="2" fill={w} />
    <rect x="38" y="33" width="24" height="9" rx="2" fill={w} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <rect key={`${r}-${c}`} x={37 + c * 7.5} y={47 + r * 7} width="4.5" height="4.5" rx="0.6" fill={bg} />
      ))
    )}
  </g>
);

// 경기 — 수원화성 문루
const gyeonggi = (w, bg) => (
  <g>
    <rect x="32" y="54" width="36" height="16" rx="1.5" fill={w} />
    <path d="M44 70 L44 62 Q44 58 50 58 Q56 58 56 62 L56 70 Z" fill={bg} />
    <path d="M28 54 Q50 41 72 54 Q66 49 50 47 Q34 49 28 54 Z" fill={w} />
    <path d="M28 54 Q24 51 26 48" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <path d="M72 54 Q76 51 74 48" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 강원 — 설악 봉우리 + 눈
const gangwon = (w, bg) => (
  <g>
    <path d="M16 72 L34 38 L46 58 L58 34 L84 72 Z" fill={w} />
    <path d="M28 56 Q40 52 50 56 Q62 60 72 56" fill="none" stroke={bg} strokeWidth="2.4" strokeLinecap="round" />
  </g>
);

// 충북 — 호수 + 산
const chungbuk = (w) => (
  <g>
    <path d="M18 58 Q32 44 46 56 Q60 44 82 58 L82 60 L18 60 Z" fill={w} />
    <path d="M24 66 Q34 64 44 66" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <path d="M50 71 Q62 69 74 71" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 충남 — 서해 일출
const chungnam = (w) => (
  <g>
    <circle cx="50" cy="44" r="12" fill={w} />
    <path d="M22 64 Q34 60 46 64 Q58 68 78 64" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <path d="M28 72 Q38 70 48 72" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 전북 — 전주 한옥
const jeonbuk = (w, bg) => (
  <g>
    <rect x="32" y="52" width="36" height="18" rx="1.5" fill={w} />
    <path d="M22 52 Q50 34 78 52 Q70 47 50 45 Q30 47 22 52 Z" fill={w} />
    <path d="M22 52 Q18 49 20 46" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <path d="M78 52 Q82 49 80 46" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <rect x="45" y="56" width="10" height="14" rx="1" fill={bg} />
  </g>
);

// 전남 — 다도해(섬)
const jeonnam = (w) => (
  <g>
    <path d="M24 60 Q32 46 40 60 Z" fill={w} />
    <path d="M42 60 Q52 42 62 60 Z" fill={w} />
    <path d="M62 60 Q69 48 76 60 Z" fill={w} />
    <path d="M22 66 Q34 64 46 66" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
    <path d="M52 71 Q64 69 76 71" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 경북 — 경주 다보탑
const gyeongbuk = (w) => (
  <g>
    <rect x="40" y="68" width="20" height="6" rx="1.5" fill={w} />
    <rect x="44" y="60" width="12" height="8" fill={w} />
    <path d="M30 60 Q50 52 70 60 Z" fill={w} />
    <rect x="46" y="48" width="8" height="8" fill={w} />
    <path d="M36 48 Q50 42 64 48 Z" fill={w} />
    <rect x="48.8" y="33" width="2.4" height="9" rx="1.2" fill={w} />
    <circle cx="50" cy="32" r="2.4" fill={w} />
  </g>
);

// 경남 — 통영 돛단배
const gyeongnam = (w) => (
  <g>
    <rect x="48.8" y="30" width="2.4" height="36" rx="1.2" fill={w} />
    <path d="M52 32 L52 64 L72 64 Z" fill={w} />
    <path d="M48 38 L48 64 L34 64 Z" fill={SOFT} />
    <path d="M30 66 L70 66 L62 74 L38 74 Z" fill={w} />
    <path d="M20 72 Q34 70 48 72" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 제주 — 한라산
const jeju = (w, bg) => (
  <g>
    <path d="M16 72 Q36 44 50 43 Q64 44 82 72 Z" fill={w} />
    <path d="M42 50 Q50 46 58 50 Q50 53 42 50 Z" fill={bg} />
  </g>
);

/* ════════ 카테고리 / 공통 ════════ */

// 영예 — 별 + 리본
const honor = (w) => (
  <g>
    <path d="M42 56 L38 74 L46 68 L50 74 L54 68 L62 74 L58 56 Z" fill={SOFT} />
    <path d={starPath(50, 44, 22, 9)} fill={w} />
  </g>
);

// 베스트 컷 — 왕관
const crown = (w, bg) => (
  <g>
    <path d="M26 64 L26 39 L39 53 L50 33 L61 53 L74 39 L74 64 Z" fill={w} />
    <rect x="26" y="64" width="48" height="8" rx="2.5" fill={w} />
    <circle cx="50" cy="68" r="2" fill={bg} />
    <circle cx="38" cy="68" r="1.6" fill={bg} />
    <circle cx="62" cy="68" r="1.6" fill={bg} />
  </g>
);

// 도움 — 불꽃
const flame = (w, bg) => (
  <g>
    <path d="M50 22 C38 40 30 50 38 64 C43 73 50 79 50 79 C50 79 66 71 68 56 C70 45 60 40 50 22 Z" fill={w} />
    <path d="M50 52 C46 58 46 64 50 69 C55 64 55 58 50 52 Z" fill={bg} />
  </g>
);

// 벚꽃
const cherry = (w, bg) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = 50 + Math.cos(a) * 15;
      const py = 46 + Math.sin(a) * 15;
      return <ellipse key={i} cx={px} cy={py} rx="11" ry="8.5" fill={w} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />;
    })}
    <circle cx="50" cy="46" r="6" fill={bg} />
  </g>
);

// 노을 — 해 + 바다
const sunset = (w) => (
  <g>
    <circle cx="50" cy="42" r="13" fill={w} />
    <path d="M22 62 Q34 58 46 62 Q58 66 78 62" fill="none" stroke={w} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M28 71 Q38 69 48 71" fill="none" stroke={w} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 날씨 — 구름 + 해
const weather = (w, bg) => (
  <g>
    <circle cx="40" cy="38" r="9" fill={w} />
    {[-90, -45, 0, 45, 90].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return <line key={deg} x1={40 + Math.cos(a) * 11} y1={38 + Math.sin(a) * 11} x2={40 + Math.cos(a) * 16} y2={38 + Math.sin(a) * 16} stroke={w} strokeWidth="3" strokeLinecap="round" />;
    })}
    <path d="M34 66 Q28 54 42 53 Q46 43 60 50 Q74 48 73 60 Q80 62 75 68 Q71 70 60 68 L44 68 Q34 70 34 66 Z" fill={w} />
    <path d="M34 66 Q28 54 42 53 Q46 43 60 50 Q74 48 73 60" fill="none" stroke={bg} strokeWidth="0" />
  </g>
);

// 축제 — 불꽃놀이
const festival = (w) => {
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    items.push(<line key={`r${i}`} x1={50 + Math.cos(a) * 8} y1={46 + Math.sin(a) * 8} x2={50 + Math.cos(a) * 21} y2={46 + Math.sin(a) * 21} stroke={w} strokeWidth="3" strokeLinecap="round" />);
    items.push(<circle key={`d${i}`} cx={50 + Math.cos(a) * 25} cy={46 + Math.sin(a) * 25} r="2" fill={w} />);
  }
  return (
    <g>
      {items}
      <circle cx="50" cy="46" r="4.5" fill={w} />
    </g>
  );
};

// 인파 — 사람들
const crowd = (w) => (
  <g>
    <g fill={SOFT}>
      <circle cx="32" cy="42" r="8" />
      <path d="M18 72 Q18 54 32 54 Q46 54 46 72 Z" />
    </g>
    <g fill={SOFT}>
      <circle cx="68" cy="42" r="8" />
      <path d="M54 72 Q54 54 68 54 Q82 54 82 72 Z" />
    </g>
    <g fill={w}>
      <circle cx="50" cy="38" r="10" />
      <path d="M33 74 Q33 52 50 52 Q67 52 67 74 Z" />
    </g>
  </g>
);

// 단골 — 상점
const store = (w, bg) => (
  <g>
    <rect x="32" y="54" width="36" height="16" rx="1.5" fill={w} />
    <path d="M28 44 L72 44 L70 54 L30 54 Z" fill={w} />
    {[36, 44, 52, 60].map((x, i) => (
      <line key={i} x1={x} y1="45" x2={x - 1} y2="54" stroke={bg} strokeWidth="1.4" />
    ))}
    <rect x="46" y="58" width="10" height="12" rx="1" fill={bg} />
  </g>
);

export const MOTIFS = {
  seoul,
  busan,
  daegu,
  incheon,
  gwangju,
  daejeon,
  ulsan,
  sejong,
  gyeonggi,
  gangwon,
  chungbuk,
  chungnam,
  jeonbuk,
  jeonnam,
  gyeongbuk,
  gyeongnam,
  jeju,
  honor,
  crown,
  flame,
  cherry,
  sunset,
  weather,
  festival,
  crowd,
  store,
};

import React from 'react';

/**
 * 뱃지 모티프 — 라이브저니 톤(소프트 플랫 일러스트)에 맞춘 면-채움 그래픽.
 * - 좌표계: viewBox 0 0 100 100, 중앙 (50,50), 모티프는 대략 x[18,82]·y[18,82] 를 채운다.
 * - 시그니처: (P, uid, lv)
 *     · P  : 단계 팔레트 { c1(밝게), c2(짙게), deep(더 짙게), hi(하이라이트) }
 *            지역/영예/왕관/불꽃 등 성장형은 P로 채도가 단계별로 올라간다.
 *     · uid: 그라데이션 id 충돌 방지 prefix
 *     · lv : 1|2|3 (일부 모티프가 단계별 디테일 추가에 사용)
 * - 카테고리(벚꽃/노을 등)는 고유 색을 쓰고 P를 무시한다.
 */

// 세로 그라데이션 헬퍼
const LG = (id, a, b, horizontal) => (
  <linearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
    <stop offset="0%" stopColor={a} />
    <stop offset="100%" stopColor={b} />
  </linearGradient>
);

const W = '#FFFFFF';

function starPath(cx, cy, outer, inner, points = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i + (rotDeg * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

/* ════════ 지역 모티프 (전국 17개 시·도) ════════ */

// 서울 — 빌딩 스카이라인 + 타워
const seoul = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <rect x="24" y="50" width="14" height="30" rx="2.5" fill={`url(#${uid}-d)`} />
    <rect x="58" y="56" width="15" height="24" rx="2.5" fill={`url(#${uid}-d)`} />
    <rect x="40" y="34" width="17" height="46" rx="2.5" fill={`url(#${uid}-m)`} />
    <rect x="47.2" y="22" width="2.6" height="13" rx="1.3" fill={`url(#${uid}-d)`} />
    <circle cx="48.5" cy="26" r="3.4" fill={`url(#${uid}-m)`} />
    {[[44, 41], [50.5, 41], [44, 50], [50.5, 50], [44, 59], [50.5, 59]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="3" height="4.4" rx="0.7" fill={W} opacity="0.85" />
    ))}
    <rect x="28" y="56" width="3" height="4.4" rx="0.7" fill={W} opacity="0.7" />
    <rect x="28" y="65" width="3" height="4.4" rx="0.7" fill={W} opacity="0.7" />
    <rect x="62" y="62" width="3" height="4.4" rx="0.7" fill={W} opacity="0.7" />
  </g>
);

// 부산 — 광안대교 + 갈매기 + 파도
const busan = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M18 72 Q30 67 42 71 Q54 75 66 71 Q76 68 84 72 L84 82 L18 82 Z" fill={`url(#${uid}-d)`} opacity="0.85" />
    <path d="M22 60 Q33 42 38 41 Q50 53 62 41 Q67 42 78 60" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="2.6" strokeLinecap="round" />
    <rect x="36.4" y="40" width="3" height="22" rx="1.2" fill={`url(#${uid}-m)`} />
    <rect x="60.6" y="40" width="3" height="22" rx="1.2" fill={`url(#${uid}-m)`} />
    <rect x="22" y="60" width="56" height="4" rx="2" fill={`url(#${uid}-m)`} />
    {[30, 45, 55, 70].map((x, i) => (
      <line key={i} x1={x} y1="51" x2={x} y2="60" stroke={`url(#${uid}-m)`} strokeWidth="1.4" opacity="0.7" />
    ))}
    <path d="M55 30 Q60 25 64 30 Q68 25 73 30" fill="none" stroke={`url(#${uid}-d)`} strokeWidth="2.4" strokeLinecap="round" />
  </g>
);

// 대구 — 83타워(관측탑)
const daegu = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M40 80 L44 70 L56 70 L60 80 Z" fill={`url(#${uid}-d)`} />
    <path d="M46 72 L48 42 L52 42 L54 72 Z" fill={`url(#${uid}-m)`} />
    <rect x="43" y="35" width="14" height="9" rx="3.5" fill={`url(#${uid}-m)`} />
    <ellipse cx="50" cy="44" rx="9" ry="2.6" fill={`url(#${uid}-d)`} />
    <rect x="48.8" y="22" width="2.4" height="13" rx="1.2" fill={`url(#${uid}-d)`} />
    <rect x="45" y="38" width="10" height="2.4" rx="1.2" fill={W} opacity="0.7" />
  </g>
);

// 인천 — 등대 + 빛
const incheon = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M56 41 L74 35 L74 47 Z" fill={`url(#${uid}-m)`} opacity="0.45" />
    <path d="M44 41 L26 35 L26 47 Z" fill={`url(#${uid}-m)`} opacity="0.45" />
    <path d="M42 80 L45 46 L55 46 L58 80 Z" fill={`url(#${uid}-m)`} />
    <rect x="44" y="39" width="12" height="7" rx="1.5" fill={`url(#${uid}-d)`} />
    <path d="M43 39 L50 30 L57 39 Z" fill={`url(#${uid}-m)`} />
    <path d="M43.5 56 L56.5 56 L57 64 L43 64 Z" fill={W} opacity="0.8" />
    <circle cx="50" cy="28" r="2" fill={W} opacity="0.9" />
  </g>
);

// 광주 — 무등산
const gwangju = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M16 80 L40 42 L52 60 L64 38 L84 80 Z" fill={`url(#${uid}-m)`} />
    <path d="M40 42 L34 51 L46 51 Z" fill={W} opacity="0.35" />
    <path d="M64 38 L57 49 L71 49 Z" fill={W} opacity="0.35" />
    {[44, 48, 52].map((x, i) => (
      <line key={i} x1={x} y1="58" x2={x} y2="80" stroke={W} strokeWidth="1.4" opacity="0.3" />
    ))}
  </g>
);

// 대전 — 과학(원자)
const daejeon = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    {[0, 60, 120].map((rot) => (
      <ellipse key={rot} cx="50" cy="50" rx="26" ry="10" fill="none" stroke={`url(#${uid}-d)`} strokeWidth="2.6" transform={`rotate(${rot} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="7" fill={`url(#${uid}-m)`} />
    <circle cx="47.8" cy="47.8" r="2.2" fill={W} opacity="0.8" />
    <circle cx="76" cy="50" r="3" fill={`url(#${uid}-d)`} />
    <circle cx="37" cy="69" r="3" fill={`url(#${uid}-d)`} />
  </g>
);

// 울산 — 고래
const ulsan = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M24 56 Q34 43 52 46 Q66 48 72 57 Q63 65 50 65 Q34 65 24 56 Z" fill={`url(#${uid}-m)`} />
    <path d="M71 57 L82 49 Q79 57 82 66 Z" fill={`url(#${uid}-d)`} />
    <path d="M40 60 Q50 64 62 60" fill="none" stroke={W} strokeWidth="2" opacity="0.4" strokeLinecap="round" />
    <path d="M52 46 Q50 36 56 31" fill="none" stroke={`url(#${uid}-d)`} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="56" cy="31" r="2.4" fill={`url(#${uid}-m)`} opacity="0.7" />
    <circle cx="40" cy="55" r="2" fill={W} />
    <circle cx="40.5" cy="55" r="1" fill={P.deep} />
  </g>
);

// 세종 — 정부청사(모던 빌딩)
const sejong = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <rect x="30" y="46" width="40" height="34" rx="3" fill={`url(#${uid}-m)`} />
    <rect x="37" y="36" width="26" height="12" rx="3" fill={`url(#${uid}-d)`} />
    <rect x="49" y="24" width="2.4" height="12" rx="1.2" fill={`url(#${uid}-d)`} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <rect key={`${r}-${c}`} x={35 + c * 8.5} y={52 + r * 8} width="5" height="5" rx="0.8" fill={W} opacity="0.8" />
      ))
    )}
  </g>
);

// 경기 — 수원화성 문루
const gyeonggi = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <rect x="30" y="56" width="40" height="24" rx="2" fill={`url(#${uid}-m)`} />
    <path d="M44 80 L44 66 Q44 60 50 60 Q56 60 56 66 L56 80 Z" fill={`url(#${uid}-d)`} />
    <path d="M26 56 Q50 42 74 56 Q68 50 50 48 Q32 50 26 56 Z" fill={`url(#${uid}-m)`} />
    <path d="M26 56 Q22 53 24 50" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M74 56 Q78 53 76 50" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="2.4" strokeLinecap="round" />
    {[33, 39, 45, 51, 57, 63].map((x, i) => (
      <rect key={i} x={x} y="56" width="3.5" height="3" fill={W} opacity="0.45" />
    ))}
  </g>
);

// 강원 — 뾰족한 설악 봉우리 + 눈
const gangwon = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M14 80 L34 40 L46 62 L58 36 L86 80 Z" fill={`url(#${uid}-m)`} />
    <path d="M34 40 L28 52 L40 52 Z" fill={W} opacity="0.9" />
    <path d="M58 36 L51 50 L66 50 Z" fill={W} opacity="0.9" />
  </g>
);

// 충북 — 호수 + 산
const chungbuk = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M16 62 Q32 42 48 60 Q62 46 84 62 Z" fill={`url(#${uid}-m)`} />
    <rect x="16" y="62" width="68" height="18" fill={`url(#${uid}-d)`} opacity="0.85" />
    <path d="M24 68 Q34 66 44 68" stroke={W} strokeWidth="1.6" opacity="0.45" fill="none" strokeLinecap="round" />
    <path d="M50 73 Q62 71 74 73" stroke={W} strokeWidth="1.6" opacity="0.45" fill="none" strokeLinecap="round" />
  </g>
);

// 충남 — 서해 일출
const chungnam = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <circle cx="50" cy="48" r="14" fill={`url(#${uid}-m)`} />
    <circle cx="45" cy="43" r="4" fill={W} opacity="0.6" />
    <path d="M18 64 Q33 60 48 64 Q63 68 82 64 L82 82 L18 82 Z" fill={`url(#${uid}-d)`} opacity="0.9" />
    <path d="M26 72 Q36 70 46 72" stroke={W} strokeWidth="1.6" opacity="0.4" fill="none" strokeLinecap="round" />
  </g>
);

// 전북 — 전주 한옥
const jeonbuk = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <rect x="30" y="54" width="40" height="26" rx="1.5" fill={`url(#${uid}-m)`} />
    <path d="M22 54 Q50 34 78 54 Q70 47 50 44 Q30 47 22 54 Z" fill={`url(#${uid}-d)`} />
    <path d="M22 54 Q17 51 19 47" fill="none" stroke={`url(#${uid}-d)`} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M78 54 Q83 51 81 47" fill="none" stroke={`url(#${uid}-d)`} strokeWidth="2.6" strokeLinecap="round" />
    {[36, 46, 56, 64].map((x, i) => (
      <line key={i} x1={x} y1="56" x2={x} y2="80" stroke={W} strokeWidth="1.4" opacity="0.35" />
    ))}
    <rect x="45" y="62" width="10" height="18" rx="1" fill={`url(#${uid}-d)`} opacity="0.6" />
  </g>
);

// 전남 — 다도해(섬)
const jeonnam = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <rect x="16" y="58" width="68" height="22" fill={`url(#${uid}-d)`} opacity="0.85" />
    <path d="M24 60 Q32 44 40 60 Z" fill={`url(#${uid}-m)`} />
    <path d="M42 60 Q52 40 62 60 Z" fill={`url(#${uid}-m)`} />
    <path d="M62 60 Q69 48 76 60 Z" fill={`url(#${uid}-m)`} />
    <path d="M22 68 Q34 66 46 68" stroke={W} strokeWidth="1.6" opacity="0.4" fill="none" strokeLinecap="round" />
    <path d="M52 73 Q64 71 76 73" stroke={W} strokeWidth="1.6" opacity="0.4" fill="none" strokeLinecap="round" />
  </g>
);

// 경북 — 경주 다보탑
const gyeongbuk = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <rect x="38" y="72" width="24" height="8" rx="1.5" fill={`url(#${uid}-d)`} />
    <rect x="43" y="62" width="14" height="10" fill={`url(#${uid}-m)`} />
    <path d="M30 62 Q50 53 70 62 Q63 58 50 56 Q37 58 30 62 Z" fill={`url(#${uid}-d)`} />
    <rect x="45" y="48" width="10" height="9" fill={`url(#${uid}-m)`} />
    <path d="M36 48 Q50 41 64 48 Q58 45 50 44 Q42 45 36 48 Z" fill={`url(#${uid}-d)`} />
    <rect x="48.8" y="32" width="2.4" height="10" rx="1.2" fill={`url(#${uid}-d)`} />
    <circle cx="50" cy="31" r="2.4" fill={`url(#${uid}-m)`} />
  </g>
);

// 경남 — 통영 돛단배
const gyeongnam = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M18 70 Q33 66 48 70 Q63 74 82 70 L82 82 L18 82 Z" fill={`url(#${uid}-d)`} opacity="0.9" />
    <rect x="48.8" y="30" width="2.4" height="36" rx="1.2" fill={`url(#${uid}-d)`} />
    <path d="M52 32 L52 64 L72 64 Z" fill={`url(#${uid}-m)`} />
    <path d="M48 36 L48 64 L34 64 Z" fill={`url(#${uid}-m)`} opacity="0.8" />
    <path d="M32 64 L68 64 L62 72 L38 72 Z" fill={`url(#${uid}-d)`} />
  </g>
);

// 제주 — 한라산
const jeju = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M62 80 Q70 60 82 80 Z" fill={`url(#${uid}-d)`} />
    <path d="M16 80 Q34 48 50 47 Q66 48 80 80 Z" fill={`url(#${uid}-m)`} />
    <path d="M38 60 Q44 52 50 51 Q56 52 62 60 Q56 56 50 56 Q44 56 38 60 Z" fill={W} opacity="0.92" />
    <path d="M46 53 Q50 56 54 53" fill="none" stroke={`url(#${uid}-d)`} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
  </g>
);

/* ════════ 카테고리 / 공통 모티프 ════════ */

// 영예 — 별 + 리본 (성장형, P 사용)
const honor = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M42 56 L37 76 L46 70 L50 76 L54 70 L63 76 L58 56 Z" fill={`url(#${uid}-d)`} />
    <path d={starPath(50, 45, 24, 10)} fill={`url(#${uid}-m)`} />
    <path d={starPath(50, 43, 11, 4.6)} fill={W} opacity="0.55" />
  </g>
);

// 베스트 컷 — 왕관 (성장형)
const crown = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-d`, P.c2, P.deep)}
    </defs>
    <path d="M26 66 L26 40 L39 54 L50 34 L61 54 L74 40 L74 66 Z" fill={`url(#${uid}-m)`} />
    <rect x="26" y="66" width="48" height="8" rx="2.5" fill={`url(#${uid}-d)`} />
    <circle cx="50" cy="36" r="2.4" fill={W} opacity="0.85" />
    <circle cx="28.5" cy="42" r="2" fill={W} opacity="0.7" />
    <circle cx="71.5" cy="42" r="2" fill={W} opacity="0.7" />
    <circle cx="50" cy="70" r="2.2" fill={W} opacity="0.55" />
  </g>
);

// 도움 — 불꽃 (성장형, lv3 에서 따뜻한 불꽃 추가)
const flame = (P, uid, lv) => (
  <g>
    <defs>
      {LG(`${uid}-m`, P.c1, P.c2)}
      {LG(`${uid}-w`, '#FFD15A', '#FF7A3D')}
    </defs>
    <path d="M50 20 C37 38 29 49 37 63 C42 73 50 80 50 80 C50 80 66 72 68 57 C70 45 60 38 50 20 Z" fill={`url(#${uid}-m)`} />
    {lv >= 3 ? (
      <path d="M52 40 C46 50 43 56 47 64 C50 70 55 72 55 72 C55 72 63 67 63 58 C63 51 58 47 52 40 Z" fill={`url(#${uid}-w)`} />
    ) : (
      <path d="M50 50 C46 56 46 62 50 67 C55 62 55 56 50 50 Z" fill={W} opacity="0.5" />
    )}
  </g>
);

// 벚꽃 — 핑크 블라썸
const cherry = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-p`, '#FAC7DA', '#F291B5')}
    </defs>
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = 50 + Math.cos(a) * 16;
      const py = 50 + Math.sin(a) * 16;
      return (
        <ellipse key={i} cx={px} cy={py} rx="11" ry="8.5" fill={`url(#${uid}-p)`} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />
      );
    })}
    <circle cx="50" cy="50" r="6.5" fill="#FBD27E" />
    <circle cx="74" cy="68" r="3.5" fill="#F4A7C4" opacity="0.8" />
  </g>
);

// 노을 — 주황 해 + 바다
const sunset = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-s`, '#FFC65A', '#FF7A3D')}
      {LG(`${uid}-sea`, '#BFE6F8', '#8AD0EF')}
    </defs>
    <circle cx="50" cy="46" r="15" fill={`url(#${uid}-s)`} />
    <circle cx="44" cy="40" r="4.5" fill={W} opacity="0.5" />
    <path d="M18 62 Q34 57 50 62 Q66 67 82 62 L82 82 L18 82 Z" fill={`url(#${uid}-sea)`} />
    <path d="M40 70 Q50 68 60 70" stroke={W} strokeWidth="2" opacity="0.6" fill="none" strokeLinecap="round" />
    <path d="M28 76 Q38 74 48 76" stroke={W} strokeWidth="1.6" opacity="0.45" fill="none" strokeLinecap="round" />
  </g>
);

// 날씨 — 구름 + 해
const weather = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-c`, '#FFFFFF', '#DCEBF6')}
    </defs>
    <circle cx="40" cy="40" r="10" fill="#FFD256" />
    {[-90, -45, 0, 45, 90].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return <line key={deg} x1={40 + Math.cos(a) * 12} y1={40 + Math.sin(a) * 12} x2={40 + Math.cos(a) * 17} y2={40 + Math.sin(a) * 17} stroke="#FFD256" strokeWidth="2.6" strokeLinecap="round" />;
    })}
    <path d="M34 68 Q28 56 42 55 Q46 44 60 51 Q74 49 73 61 Q80 63 75 70 Q71 72 60 70 L44 70 Q34 72 34 68 Z" fill={`url(#${uid}-c)`} />
  </g>
);

// 축제 — 불꽃놀이(멀티컬러)
const festival = (P, uid) => {
  const colors = ['#F39BC0', '#FFD15A', '#5BBDEE', '#7FD89B', '#C9A0F0', '#FF9E6B'];
  const rays = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    const col = colors[i % colors.length];
    rays.push(<line key={`r${i}`} x1={50 + Math.cos(a) * 8} y1={50 + Math.sin(a) * 8} x2={50 + Math.cos(a) * 22} y2={50 + Math.sin(a) * 22} stroke={col} strokeWidth="3" strokeLinecap="round" />);
    rays.push(<circle key={`d${i}`} cx={50 + Math.cos(a) * 26} cy={50 + Math.sin(a) * 26} r="2.2" fill={col} />);
  }
  return (
    <g>
      {rays}
      <circle cx="50" cy="50" r="5" fill="#FFFFFF" />
      <circle cx="50" cy="50" r="2.4" fill="#FFD15A" />
    </g>
  );
};

// 인파 — 사람들 (파랑)
const crowd = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-m`, '#86D0F4', '#2E97D4')}
      {LG(`${uid}-l`, '#BFE3F5', '#86C7EC')}
    </defs>
    <g fill={`url(#${uid}-l)`}>
      <circle cx="32" cy="44" r="8" />
      <path d="M18 76 Q18 56 32 56 Q46 56 46 76 Z" />
    </g>
    <g fill={`url(#${uid}-l)`}>
      <circle cx="68" cy="44" r="8" />
      <path d="M54 76 Q54 56 68 56 Q82 56 82 76 Z" />
    </g>
    <g fill={`url(#${uid}-m)`}>
      <circle cx="50" cy="40" r="10" />
      <path d="M33 78 Q33 54 50 54 Q67 54 67 78 Z" />
    </g>
  </g>
);

// 단골 — 상점
const store = (P, uid) => (
  <g>
    <defs>
      {LG(`${uid}-b`, '#FFFFFF', '#E6F1FA')}
      {LG(`${uid}-m`, '#7CCBF1', '#3BA4E0')}
    </defs>
    <rect x="30" y="56" width="40" height="24" rx="2" fill={`url(#${uid}-b)`} />
    <path d="M28 44 L72 44 L70 56 L30 56 Z" fill={`url(#${uid}-m)`} />
    {[36, 44, 52, 60].map((x, i) => (
      <path key={i} d={`M${x} 44 L${x - 1.2} 56 L${x + 4} 56 L${x + 5.2} 44 Z`} fill={i % 2 ? W : 'none'} opacity="0.55" />
    ))}
    <rect x="48" y="62" width="10" height="18" rx="1" fill={`url(#${uid}-m)`} />
    <rect x="35" y="62" width="9" height="8" rx="1" fill={`url(#${uid}-m)`} opacity="0.6" />
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

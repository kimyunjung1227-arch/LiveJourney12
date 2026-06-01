import React from 'react';

/**
 * 뱃지 중앙 모티프 글리프.
 * - 좌표계: BadgeIcon viewBox(0 0 100 104), 패널 중앙 ≈ (50, 55).
 * - 각 모티프는 (c) => JSX. 부모 <g>가 stroke=c / strokeWidth=3 / fill=none /
 *   round cap 을 제공한다. 면으로 채울 요소만 fill={c} stroke="none" 으로 덮어쓴다.
 * - 글리프는 대략 x[34,66] · y[40,70] 안에 들어오도록 그린다.
 */

const fillC = (c) => ({ fill: c, stroke: 'none' });

// ── 지역 모티프 (전국 17개 시·도) ──────────────────────────────

// 서울 — N서울타워
const seoul = (c) => (
  <>
    <path d="M46 68 L47 62 L53 62 L54 68 Z" />
    <line x1="50" y1="62" x2="50" y2="46" />
    <ellipse cx="50" cy="47" rx="6" ry="2.6" />
    <line x1="50" y1="45" x2="50" y2="39" />
    <circle cx="50" cy="38.5" r="1.4" {...fillC(c)} />
  </>
);

// 부산 — 광안대교
const busan = (c) => (
  <>
    <line x1="34" y1="62" x2="66" y2="62" />
    <line x1="43" y1="62" x2="43" y2="46" />
    <line x1="57" y1="62" x2="57" y2="46" />
    <path d="M34 60 Q35 47 43 44 Q50 50 57 44 Q65 47 66 60" />
    <line x1="38" y1="55" x2="38" y2="62" strokeWidth="1.6" />
    <line x1="50" y1="48" x2="50" y2="62" strokeWidth="1.6" />
    <line x1="62" y1="55" x2="62" y2="62" strokeWidth="1.6" />
  </>
);

// 대구 — 사과
const daegu = (c) => (
  <>
    <path d="M50 50 C45 47 41 51 41 56 C41 64 47 68 50 68 C53 68 59 64 59 56 C59 51 55 47 50 50 Z" {...fillC(c)} />
    <path d="M50 50 L51 44" stroke="#125E8C" strokeWidth="2" />
    <path d="M51 45 Q57 42 56 48 Q51 49 51 45 Z" fill="#125E8C" stroke="none" />
  </>
);

// 인천 — 등대
const incheon = (c) => (
  <>
    <path d="M45 68 L47 49 L53 49 L55 68 Z" />
    <path d="M46 49 L54 49 L52 44 L48 44 Z" />
    <path d="M48 44 L50 40 L52 44" />
    <line x1="44" y1="58" x2="56" y2="58" strokeWidth="1.6" />
    <line x1="52" y1="42" x2="60" y2="39" strokeWidth="1.6" />
    <line x1="48" y1="42" x2="40" y2="39" strokeWidth="1.6" />
  </>
);

// 광주 — 무등산 주상절리
const gwangju = (c) => (
  <>
    <path d="M35 68 L48 46 L61 68 Z" />
    <line x1="44" y1="54" x2="44" y2="68" strokeWidth="1.8" />
    <line x1="48" y1="48" x2="48" y2="68" strokeWidth="1.8" />
    <line x1="52" y1="54" x2="52" y2="68" strokeWidth="1.8" />
  </>
);

// 대전 — 과학(원자)
const daejeon = (c) => (
  <>
    <circle cx="50" cy="55" r="3" {...fillC(c)} />
    <ellipse cx="50" cy="55" rx="14" ry="6" />
    <ellipse cx="50" cy="55" rx="14" ry="6" transform="rotate(60 50 55)" />
    <ellipse cx="50" cy="55" rx="14" ry="6" transform="rotate(-60 50 55)" />
  </>
);

// 울산 — 고래
const ulsan = (c) => (
  <>
    <path d="M37 58 Q44 50 54 53 Q61 55 63 59 Q56 63 49 62 Q42 62 37 58 Z" {...fillC(c)} />
    <path d="M63 59 L68 54 M63 60 L68 64" />
    <path d="M52 53 Q52 47 49 45 M52 53 Q52 48 55 46" strokeWidth="2" />
    <circle cx="44" cy="57" r="1.1" fill="#125E8C" stroke="none" />
  </>
);

// 세종 — 정부청사/한글
const sejong = (c) => (
  <>
    <path d="M40 51 L50 44 L60 51 Z" />
    <line x1="41" y1="51" x2="59" y2="51" />
    <line x1="44" y1="53" x2="44" y2="66" strokeWidth="2.4" />
    <line x1="50" y1="53" x2="50" y2="66" strokeWidth="2.4" />
    <line x1="56" y1="53" x2="56" y2="66" strokeWidth="2.4" />
    <line x1="39" y1="67" x2="61" y2="67" />
  </>
);

// 경기 — 수원화성 문루
const gyeonggi = (c) => (
  <>
    <path d="M36 55 Q50 47 64 55" />
    <line x1="40" y1="50" x2="60" y2="50" />
    <path d="M38 55 L38 68 L62 68 L62 55" />
    <path d="M46 68 L46 62 Q46 58 50 58 Q54 58 54 62 L54 68" />
    <path d="M38 55 L36 53 M62 55 L64 53" strokeWidth="1.6" />
  </>
);

// 강원 — 설악산 + 동해
const gangwon = (c) => (
  <>
    <path d="M34 60 L42 47 L48 56 L54 45 L62 60 Z" />
    <path d="M42 47 L44 50 L40 50 Z" fill="#ECFAFF" stroke="none" />
    <path d="M54 45 L56 49 L51 49 Z" fill="#ECFAFF" stroke="none" />
    <path d="M34 65 Q40 62 46 65 Q52 68 58 65 Q62 63 66 65" />
  </>
);

// 충북 — 호반(청풍호)
const chungbuk = (c) => (
  <>
    <path d="M36 59 L44 50 L51 59 Z" />
    <path d="M49 59 L57 52 L64 59 Z" />
    <path d="M34 64 Q40 62 46 64 Q52 66 58 64 Q62 63 66 64" />
    <path d="M36 68 Q42 66 48 68 Q54 70 60 68" />
  </>
);

// 충남 — 갯벌 위 일출
const chungnam = (c) => (
  <>
    <path d="M42 59 A8 8 0 0 1 58 59" />
    <line x1="34" y1="59" x2="66" y2="59" />
    <line x1="50" y1="46" x2="50" y2="42" strokeWidth="1.8" />
    <line x1="40" y1="49" x2="38" y2="46" strokeWidth="1.8" />
    <line x1="60" y1="49" x2="62" y2="46" strokeWidth="1.8" />
    <path d="M34 64 Q40 62 46 64 Q52 66 58 64 Q62 63 66 64" />
  </>
);

// 전북 — 전주 한옥
const jeonbuk = (c) => (
  <>
    <path d="M34 56 C40 48 60 48 66 56" />
    <path d="M34 56 L31 53 M66 56 L69 53" strokeWidth="1.8" />
    <line x1="41" y1="51" x2="59" y2="51" />
    <path d="M39 56 L39 67 L61 67 L61 56" />
    <path d="M47 67 L47 60 L53 60 L53 67" />
  </>
);

// 전남 — 다도해(섬)
const jeonnam = (c) => (
  <>
    <path d="M37 62 Q41 55 45 62 Z" {...fillC(c)} />
    <path d="M47 62 Q52 53 57 62 Z" {...fillC(c)} />
    <path d="M58 62 Q61 57 64 62 Z" {...fillC(c)} />
    <path d="M34 64 Q40 62 46 64 Q52 66 58 64 Q62 63 66 64" />
    <path d="M34 68 Q41 66 48 68 Q55 70 62 68" />
  </>
);

// 경북 — 경주 다보탑(석탑)
const gyeongbuk = (c) => (
  <>
    <line x1="50" y1="44" x2="50" y2="48" strokeWidth="1.8" />
    <path d="M41 50 Q50 46 59 50" />
    <path d="M44 50 L44 54 L56 54 L56 50" />
    <path d="M43 56 Q50 53 57 56" />
    <path d="M46 56 L46 60 L54 60 L54 56" />
    <path d="M43 62 L57 62 L57 67 L43 67 Z" />
  </>
);

// 경남 — 통영 앞바다(돛단배)
const gyeongnam = (c) => (
  <>
    <path d="M40 61 L60 61 L56 66 L44 66 Z" {...fillC(c)} />
    <line x1="50" y1="61" x2="50" y2="44" />
    <path d="M50 46 L50 59 L40 59 Z" {...fillC(c)} />
    <path d="M52 47 L60 57 L52 57 Z" />
    <path d="M34 69 Q40 67 46 69 Q52 71 58 69 Q62 68 66 69" />
  </>
);

// 제주 — 한라산
const jeju = (c) => (
  <>
    <path d="M34 65 Q42 50 50 49 Q58 50 66 65 Z" />
    <path d="M46 50 Q50 53 54 50" strokeWidth="2" />
  </>
);

// ── 카테고리/공통 모티프 ───────────────────────────────────────

// 영예 — 큰 별 + 리본
const honor = (c) => (
  <>
    <path d={star(50, 53, 12, 5)} {...fillC(c)} />
    <path d="M45 62 L42 70 L47 67 L50 71 L53 67 L58 70 L55 62 Z" fill="#125E8C" stroke="none" opacity="0.55" />
  </>
);

// 베스트 컷 — 왕관
const crown = (c) => (
  <>
    <path d="M38 64 L38 50 L46 57 L50 47 L54 57 L62 50 L62 64 Z" {...fillC(c)} />
    <line x1="38" y1="64" x2="62" y2="64" stroke="#125E8C" strokeWidth="2" />
    <circle cx="50" cy="52" r="1.5" fill="#125E8C" stroke="none" />
  </>
);

// 도움 — 불꽃
const flame = (c) => (
  <>
    <path d="M50 42 C44 50 41 54 44 61 C46 66 50 68 50 68 C50 68 56 66 56 60 C56 55 53 51 50 42 Z" {...fillC(c)} />
    <path d="M50 56 C48 59 48 62 50 64 C52 62 52 59 50 56 Z" fill="#125E8C" stroke="none" />
  </>
);

// 벚꽃
const cherry = (c) => {
  const petals = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = 50 + Math.cos(a) * 7.5;
    const py = 55 + Math.sin(a) * 7.5;
    petals.push(
      <ellipse key={i} cx={px} cy={py} rx="4.4" ry="3" {...fillC(c)} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />
    );
  }
  return (
    <>
      {petals}
      <circle cx="50" cy="55" r="2.6" fill="#125E8C" stroke="none" />
    </>
  );
};

// 노을
const sunset = (c) => (
  <>
    <circle cx="50" cy="58" r="7" {...fillC(c)} />
    <line x1="34" y1="63" x2="66" y2="63" />
    <line x1="50" y1="44" x2="50" y2="40" strokeWidth="1.8" />
    <line x1="38" y1="48" x2="35" y2="45" strokeWidth="1.8" />
    <line x1="62" y1="48" x2="65" y2="45" strokeWidth="1.8" />
    <path d="M36 67 Q42 65 48 67 Q54 69 60 67" />
  </>
);

// 날씨 — 구름+해
const weather = (c) => (
  <>
    <circle cx="44" cy="50" r="5" />
    <line x1="44" y1="42" x2="44" y2="39" strokeWidth="1.6" />
    <line x1="37" y1="45" x2="35" y2="43" strokeWidth="1.6" />
    <path d="M44 63 Q41 56 47 55 Q49 50 55 54 Q61 53 61 59 Q63 63 57 63 Z" {...fillC(c)} />
  </>
);

// 축제 — 불꽃놀이
const festival = (c) => {
  const rays = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    rays.push(
      <line key={i} x1={50 + Math.cos(a) * 5} y1={55 + Math.sin(a) * 5} x2={50 + Math.cos(a) * 13} y2={55 + Math.sin(a) * 13} />
    );
    rays.push(
      <circle key={`d${i}`} cx={50 + Math.cos(a) * 15} cy={55 + Math.sin(a) * 15} r="1.4" {...fillC(c)} />
    );
  }
  return (
    <>
      {rays}
      <circle cx="50" cy="55" r="2.4" {...fillC(c)} />
    </>
  );
};

// 인파 — 사람들
const crowd = (c) => (
  <>
    <Person cx={41} cy={56} c={c} />
    <Person cx={59} cy={56} c={c} />
    <Person cx={50} cy={52} c={c} front />
  </>
);

function Person({ cx, cy, c, front }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={front ? 4 : 3.4} {...(front ? fillC(c) : { fill: 'none' })} />
      <path
        d={`M${cx - (front ? 6 : 5)} ${cy + 13} Q${cx} ${cy + (front ? 4 : 5)} ${cx + (front ? 6 : 5)} ${cy + 13}`}
        {...(front ? fillC(c) : { fill: 'none' })}
      />
    </>
  );
}

// 단골 — 상점
const store = (c) => (
  <>
    <path d="M37 52 L63 52 L60 58 L40 58 Z" {...fillC(c)} />
    <line x1="44" y1="52" x2="43" y2="58" stroke="#125E8C" strokeWidth="1.4" />
    <line x1="50" y1="52" x2="50" y2="58" stroke="#125E8C" strokeWidth="1.4" />
    <line x1="56" y1="52" x2="57" y2="58" stroke="#125E8C" strokeWidth="1.4" />
    <path d="M40 58 L40 68 L60 68 L60 58" />
    <path d="M51 68 L51 61 L57 61 L57 68" />
  </>
);

function star(cx, cy, outer, inner, points = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i + (rotDeg * Math.PI) / 180;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}

export const MOTIFS = {
  // 지역
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
  // 카테고리/공통
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

import React from 'react';

/**
 * 뱃지 글리프 — 테두리 없는 플랫 듀오톤 아이콘.
 *
 * 디자인 원칙
 * - 컨테이너/배경 타일/테두리 없음. 흰 카드 위에 바로 얹히는 깔끔한 심볼.
 * - 신뢰감 = 단순·명료. 그림자/광택/장식 금지, 형태만으로 주제를 인식.
 * - 팔레트 P = { key, sub, accent } (키컬러 + 서브 2개로 제한)
 *     · key    : 키컬러(하늘색) — 메인 형태
 *     · sub    : 서브1(옅은 하늘) — 보조 형태/디테일
 *     · accent : 서브2(따뜻한 앰버) — 해·별·보석 등 자연스러운 포인트에만 절제 사용
 * - 좌표계: viewBox 0 0 100 100, 글리프는 대략 x[20,80]·y[24,76], 중앙 (50,48).
 */

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
const seoul = ({ key, sub }) => (
  <g>
    <rect x="26" y="46" width="13" height="26" rx="2.5" fill={sub} />
    <rect x="61" y="50" width="13" height="22" rx="2.5" fill={sub} />
    <rect x="42" y="34" width="16" height="38" rx="2.5" fill={key} />
    <rect x="48.7" y="22" width="2.6" height="12" rx="1.3" fill={key} />
    <circle cx="50" cy="26" r="3.2" fill={key} />
    {[[45, 40], [51, 40], [45, 48], [51, 48], [45, 56], [51, 56]].map(([x, y], i) => (
      <rect key={i} x={x} y={y} width="3" height="4" rx="0.6" fill={sub} />
    ))}
  </g>
);

// 부산 — 광안대교 + 갈매기
const busan = ({ key, sub }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="24" y="56" width="52" height="4.4" rx="2.2" fill={key} />
    <rect x="36.6" y="42" width="3.2" height="16" rx="1.6" fill={key} />
    <rect x="60.2" y="42" width="3.2" height="16" rx="1.6" fill={key} />
    <path d="M24 58 Q36 42 38.2 42 Q50 53 61.8 42 Q64 42 76 58" stroke={key} strokeWidth="3" />
    <path d="M22 67 Q34 64 46 67" stroke={sub} strokeWidth="3" />
    <path d="M54 32 Q59 28 63 32 Q67 28 72 32" stroke={sub} strokeWidth="3" />
  </g>
);

// 대구 — 관측 타워(83타워)
const daegu = ({ key, sub }) => (
  <g>
    <path d="M42 70 L45 62 L55 62 L58 70 Z" fill={key} />
    <rect x="47" y="40" width="6" height="22" fill={key} />
    <rect x="43" y="34" width="14" height="8" rx="3" fill={key} />
    <rect x="48.8" y="22" width="2.4" height="12" rx="1.2" fill={key} />
    <rect x="44.5" y="36.5" width="11" height="2.6" rx="1.3" fill={sub} />
  </g>
);

// 인천 — 등대 + 빛
const incheon = ({ key, sub, accent }) => (
  <g>
    <path d="M55 40 L80 32 L80 48 Z" fill={accent} opacity="0.9" />
    <path d="M43 70 L46 42 L54 42 L57 70 Z" fill={key} />
    <rect x="43.5" y="35" width="13" height="6.5" rx="1.5" fill={key} />
    <path d="M43 35 L50 27 L57 35 Z" fill={key} />
    <rect x="44" y="52" width="12" height="6" fill={sub} />
    <circle cx="50" cy="26" r="2.2" fill={accent} />
  </g>
);

// 광주 — 무등산 주상절리
const gwangju = ({ key, sub }) => (
  <g>
    <path d="M18 72 L40 40 L52 56 L64 38 L82 72 Z" fill={key} />
    {[46, 50, 54].map((x, i) => (
      <line key={i} x1={x} y1="57" x2={x} y2="72" stroke={sub} strokeWidth="2.6" />
    ))}
  </g>
);

// 대전 — 과학(원자)
const daejeon = ({ key, sub }) => (
  <g>
    {[0, 60, 120].map((rot) => (
      <ellipse key={rot} cx="50" cy="48" rx="25" ry="9.5" fill="none" stroke={key} strokeWidth="3" transform={`rotate(${rot} 50 48)`} />
    ))}
    <circle cx="50" cy="48" r="6.5" fill={key} />
    <circle cx="75" cy="48" r="3" fill={sub} />
    <circle cx="34" cy="61" r="3" fill={sub} />
  </g>
);

// 울산 — 고래
const ulsan = ({ key, sub }) => (
  <g>
    <path d="M26 53 Q36 41 54 44 Q66 46 72 54 Q63 62 50 62 Q34 62 26 53 Z" fill={key} />
    <path d="M71 54 L81 47 Q78 54 81 62 Z" fill={key} />
    <path d="M54 44 Q51 35 57 30" fill="none" stroke={sub} strokeWidth="3" strokeLinecap="round" />
    <circle cx="57" cy="30" r="2.6" fill={sub} />
    <circle cx="40" cy="52" r="2.2" fill={sub} />
  </g>
);

// 세종 — 정부청사
const sejong = ({ key, sub }) => (
  <g>
    <rect x="32" y="42" width="36" height="28" rx="2" fill={key} />
    <rect x="38" y="33" width="24" height="9" rx="2" fill={key} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <rect key={`${r}-${c}`} x={37 + c * 7.5} y={47 + r * 7} width="4.5" height="4.5" rx="0.6" fill={sub} />
      ))
    )}
  </g>
);

// 경기 — 수원화성 문루
const gyeonggi = ({ key, sub }) => (
  <g>
    <rect x="32" y="54" width="36" height="16" rx="1.5" fill={key} />
    <path d="M44 70 L44 62 Q44 58 50 58 Q56 58 56 62 L56 70 Z" fill={sub} />
    <path d="M28 54 Q50 41 72 54 Q66 49 50 47 Q34 49 28 54 Z" fill={key} />
    <path d="M28 54 Q24 51 26 48" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
    <path d="M72 54 Q76 51 74 48" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 강원 — 설악 봉우리 + 눈
const gangwon = ({ key, sub }) => (
  <g>
    <path d="M16 72 L34 38 L46 58 L58 34 L84 72 Z" fill={key} />
    <path d="M29.5 51 L34 38 L40.5 49.5 Z" fill={sub} />
    <path d="M52.5 47 L58 34 L64.5 48 Z" fill={sub} />
  </g>
);

// 충북 — 호수 + 산
const chungbuk = ({ key, sub }) => (
  <g>
    <path d="M18 56 Q32 42 46 54 Q60 42 82 56 L82 58 L18 58 Z" fill={key} />
    <path d="M22 65 Q34 63 46 65" fill="none" stroke={sub} strokeWidth="3" strokeLinecap="round" />
    <path d="M52 71 Q64 69 76 71" fill="none" stroke={sub} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 충남 — 서해 일출
const chungnam = ({ key, sub, accent }) => (
  <g>
    <circle cx="50" cy="44" r="12" fill={accent} />
    <path d="M22 62 Q34 58 46 62 Q58 66 78 62" fill="none" stroke={key} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M28 71 Q38 69 48 71" fill="none" stroke={sub} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 전북 — 전주 한옥
const jeonbuk = ({ key, sub }) => (
  <g>
    <rect x="32" y="52" width="36" height="18" rx="1.5" fill={key} />
    <path d="M22 52 Q50 34 78 52 Q70 47 50 45 Q30 47 22 52 Z" fill={key} />
    <path d="M22 52 Q18 49 20 46" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
    <path d="M78 52 Q82 49 80 46" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
    <rect x="45" y="56" width="10" height="14" rx="1" fill={sub} />
  </g>
);

// 전남 — 다도해(섬)
const jeonnam = ({ key, sub }) => (
  <g>
    <path d="M24 60 Q32 46 40 60 Z" fill={sub} />
    <path d="M42 60 Q52 42 62 60 Z" fill={key} />
    <path d="M62 60 Q69 48 76 60 Z" fill={sub} />
    <path d="M22 66 Q34 64 46 66" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
    <path d="M52 71 Q64 69 76 71" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 경북 — 경주 다보탑 (포항·경주·안동·구미 등)
const gyeongbuk = ({ key, sub }) => (
  <g>
    <rect x="40" y="68" width="20" height="6" rx="1.5" fill={key} />
    <rect x="44" y="60" width="12" height="8" fill={key} />
    <path d="M30 60 Q50 52 70 60 Z" fill={key} />
    <rect x="46" y="48" width="8" height="8" fill={key} />
    <path d="M36 48 Q50 42 64 48 Z" fill={key} />
    <rect x="48.8" y="33" width="2.4" height="9" rx="1.2" fill={key} />
    <circle cx="50" cy="32" r="2.4" fill={sub} />
  </g>
);

// 경남 — 통영 돛단배
const gyeongnam = ({ key, sub }) => (
  <g>
    <rect x="48.8" y="30" width="2.4" height="36" rx="1.2" fill={key} />
    <path d="M52 32 L52 64 L72 64 Z" fill={key} />
    <path d="M48 38 L48 64 L34 64 Z" fill={sub} />
    <path d="M30 66 L70 66 L62 74 L38 74 Z" fill={key} />
    <path d="M20 72 Q34 70 48 72" fill="none" stroke={sub} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 제주 — 한라산
const jeju = ({ key, sub }) => (
  <g>
    <path d="M16 72 Q36 44 50 43 Q64 44 82 72 Z" fill={key} />
    <path d="M42 50 Q50 46 58 50 Q50 53 42 50 Z" fill={sub} />
  </g>
);

/* ════════ 카테고리 / 공통 ════════ */

// 영예 — 메달(별 + 리본)
const honor = ({ key, sub, accent }) => (
  <g>
    <path d="M40 56 L35 76 L44 70 L50 76 L56 70 L65 76 L60 56 Z" fill={sub} />
    <circle cx="50" cy="42" r="20" fill={key} />
    <path d={starPath(50, 42, 11, 4.6)} fill={accent} />
  </g>
);

// 베스트 컷 — 왕관
const crown = ({ key, sub, accent }) => (
  <g>
    <path d="M26 64 L26 39 L39 53 L50 33 L61 53 L74 39 L74 64 Z" fill={key} />
    <rect x="26" y="64" width="48" height="8" rx="2.5" fill={key} />
    <circle cx="50" cy="43" r="3" fill={accent} />
    <circle cx="29.5" cy="42" r="2.2" fill={sub} />
    <circle cx="70.5" cy="42" r="2.2" fill={sub} />
  </g>
);

// 도움 — 불꽃
const flame = ({ key, sub }) => (
  <g>
    <path d="M50 22 C38 40 30 50 38 64 C43 73 50 79 50 79 C50 79 66 71 68 56 C70 45 60 40 50 22 Z" fill={key} />
    <path d="M50 50 C45 57 45 64 50 70 C56 64 56 57 50 50 Z" fill={sub} />
  </g>
);

// 벚꽃
const cherry = ({ key, sub, accent }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = 50 + Math.cos(a) * 15;
      const py = 46 + Math.sin(a) * 15;
      return <ellipse key={i} cx={px} cy={py} rx="11" ry="8.5" fill={key} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />;
    })}
    <circle cx="50" cy="46" r="6" fill={sub} />
    <circle cx="50" cy="46" r="2.4" fill={accent} />
  </g>
);

// 노을 — 해 + 바다
const sunset = ({ key, sub, accent }) => (
  <g>
    <circle cx="50" cy="42" r="13" fill={accent} />
    <path d="M22 62 Q34 58 46 62 Q58 66 78 62" fill="none" stroke={key} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M28 71 Q38 69 48 71" fill="none" stroke={sub} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 날씨 — 구름 + 해
const weather = ({ key, accent }) => (
  <g>
    <circle cx="40" cy="38" r="9" fill={accent} />
    {[-90, -45, 0, 45, 90].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return <line key={deg} x1={40 + Math.cos(a) * 11} y1={38 + Math.sin(a) * 11} x2={40 + Math.cos(a) * 16} y2={38 + Math.sin(a) * 16} stroke={accent} strokeWidth="3" strokeLinecap="round" />;
    })}
    <path d="M34 66 Q28 54 42 53 Q46 43 60 50 Q74 48 73 60 Q80 62 75 68 Q71 70 60 68 L44 68 Q34 70 34 66 Z" fill={key} />
  </g>
);

// 축제 — 불꽃놀이
const festival = ({ key, accent }) => {
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    items.push(<line key={`r${i}`} x1={50 + Math.cos(a) * 8} y1={46 + Math.sin(a) * 8} x2={50 + Math.cos(a) * 21} y2={46 + Math.sin(a) * 21} stroke={key} strokeWidth="3" strokeLinecap="round" />);
    items.push(<circle key={`d${i}`} cx={50 + Math.cos(a) * 25} cy={46 + Math.sin(a) * 25} r="2" fill={accent} />);
  }
  return (
    <g>
      {items}
      <circle cx="50" cy="46" r="4.5" fill={accent} />
    </g>
  );
};

// 인파 — 사람들
const crowd = ({ key, sub }) => (
  <g>
    <g fill={sub}>
      <circle cx="32" cy="42" r="8" />
      <path d="M18 72 Q18 54 32 54 Q46 54 46 72 Z" />
    </g>
    <g fill={sub}>
      <circle cx="68" cy="42" r="8" />
      <path d="M54 72 Q54 54 68 54 Q82 54 82 72 Z" />
    </g>
    <g fill={key}>
      <circle cx="50" cy="38" r="10" />
      <path d="M33 74 Q33 52 50 52 Q67 52 67 74 Z" />
    </g>
  </g>
);

// 단골 — 상점
const store = ({ key, sub }) => (
  <g>
    <rect x="32" y="54" width="36" height="16" rx="1.5" fill={key} />
    <path d="M28 44 L72 44 L70 54 L30 54 Z" fill={key} />
    {[36, 44, 52, 60].map((x, i) => (
      <line key={i} x1={x} y1="45" x2={x - 1} y2="54" stroke={sub} strokeWidth="1.6" />
    ))}
    <rect x="46" y="58" width="10" height="12" rx="1" fill={sub} />
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

import React from 'react';

/**
 * 뱃지 글리프 — 단색 솔리드 실루엣.
 *
 * 디자인 원칙
 * - 컨테이너/테두리 없음. 흰 카드/칩 위에 바로 얹히는 꽉 찬 단색 면.
 * - 키컬러(하늘색) 한 색으로 형태를 표현. 내부 디테일은 최소.
 * - 팔레트 P = { key, sub, accent }
 *     · key : 키컬러(하늘색) — 거의 모든 면
 *     · sub : 내부 "구멍"(문·꽃술·분화구 등) — 칩 배경색과 동일하게 받아 진짜 컷아웃처럼
 *     · accent : 마스터 표식 등 포인트(BadgeIcon 에서만 사용)
 * - 좌표계: viewBox 0 0 100 100, 글리프는 대략 x[16,84]·y[20,76], 중앙 (50,48).
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

// 서울 — 빌딩 스카이라인 + 타워 (사이 여백으로 분리)
const seoul = ({ key }) => (
  <g fill={key}>
    <rect x="24" y="46" width="14" height="26" rx="2" />
    <rect x="42" y="30" width="16" height="42" rx="2" />
    <rect x="62" y="50" width="14" height="22" rx="2" />
    <rect x="48.6" y="20" width="2.8" height="11" rx="1.4" />
    <circle cx="50" cy="24" r="3.4" />
  </g>
);

// 부산 — 광안대교
const busan = ({ key }) => (
  <g fill={key}>
    <rect x="22" y="56" width="56" height="5" rx="2.5" />
    <rect x="34.8" y="40" width="3.6" height="18" rx="1.8" />
    <rect x="61.6" y="40" width="3.6" height="18" rx="1.8" />
    <path d="M22 58 Q36 40 38.8 40 Q50 52 61.2 40 Q64 40 78 58" fill="none" stroke={key} strokeWidth="3.4" strokeLinecap="round" />
  </g>
);

// 대구 — 관측 타워(83타워)
const daegu = ({ key }) => (
  <g fill={key}>
    <path d="M41 72 L45 60 L55 60 L59 72 Z" />
    <rect x="46.5" y="38" width="7" height="22" />
    <rect x="42" y="32" width="16" height="8" rx="3" />
    <rect x="48.6" y="20" width="2.8" height="12" rx="1.4" />
  </g>
);

// 인천 — 등대
const incheon = ({ key }) => (
  <g fill={key}>
    <path d="M42 72 L45 40 L55 40 L58 72 Z" />
    <rect x="43" y="33" width="14" height="7" rx="1.5" />
    <path d="M42.5 33 L50 25 L57.5 33 Z" />
    <circle cx="50" cy="22.5" r="2.4" />
  </g>
);

// 광주 — 무등산
const gwangju = ({ key }) => (
  <g fill={key}>
    <path d="M16 72 L38 40 L50 56 L62 36 L84 72 Z" />
  </g>
);

// 대전 — 과학(원자)
const daejeon = ({ key }) => (
  <g>
    {[0, 60, 120].map((rot) => (
      <ellipse key={rot} cx="50" cy="48" rx="25" ry="9.5" fill="none" stroke={key} strokeWidth="3.4" transform={`rotate(${rot} 50 48)`} />
    ))}
    <circle cx="50" cy="48" r="7" fill={key} />
  </g>
);

// 울산 — 고래
const ulsan = ({ key }) => (
  <g fill={key}>
    <path d="M24 52 Q34 40 54 43 Q67 45 74 53 Q64 63 50 63 Q33 63 24 52 Z" />
    <path d="M73 53 L84 45 Q80 53 84 62 Z" />
    <path d="M54 43 Q50 33 57 28" fill="none" stroke={key} strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="57" cy="28" r="2.6" />
  </g>
);

// 세종 — 정부청사
const sejong = ({ key }) => (
  <g fill={key}>
    <path d="M30 44 L70 44 L70 70 L30 70 Z" />
    <path d="M36 32 L64 32 L67.5 44 L32.5 44 Z" />
  </g>
);

// 경기 — 수원화성 문루
const gyeonggi = ({ key, sub }) => (
  <g>
    <path d="M30 54 L70 54 L70 70 L30 70 Z" fill={key} />
    <path d="M26 54 Q50 39 74 54 Z" fill={key} />
    <path d="M44 70 L44 62 Q44 57 50 57 Q56 57 56 62 L56 70 Z" fill={sub} />
  </g>
);

// 강원 — 설악 봉우리
const gangwon = ({ key }) => (
  <g fill={key}>
    <path d="M14 72 L34 36 L46 56 L58 32 L86 72 Z" />
  </g>
);

// 충북 — 호수 + 산
const chungbuk = ({ key }) => (
  <g>
    <path d="M20 58 L40 38 L52 52 L66 36 L80 58 Z" fill={key} />
    <path d="M22 66 Q34 63 46 66 Q58 69 78 66" fill="none" stroke={key} strokeWidth="3.2" strokeLinecap="round" />
  </g>
);

// 충남 — 서해 일출
const chungnam = ({ key }) => (
  <g>
    <path d="M34 57 A16 16 0 0 1 66 57 Z" fill={key} />
    <path d="M20 63 Q34 59 46 63 Q58 67 80 63" fill="none" stroke={key} strokeWidth="3.2" strokeLinecap="round" />
    <path d="M26 71 Q38 68 50 71" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 전북 — 전주 한옥
const jeonbuk = ({ key, sub }) => (
  <g>
    <path d="M22 50 Q50 33 78 50 Q70 45 50 43 Q30 45 22 50 Z" fill={key} />
    <rect x="32" y="50" width="36" height="20" rx="1.5" fill={key} />
    <rect x="45" y="55" width="10" height="15" rx="1" fill={sub} />
  </g>
);

// 전남 — 다도해(섬)
const jeonnam = ({ key }) => (
  <g>
    <path d="M22 60 Q30 46 38 60 Z" fill={key} />
    <path d="M40 60 Q51 40 62 60 Z" fill={key} />
    <path d="M62 60 Q70 48 78 60 Z" fill={key} />
    <path d="M20 67 Q34 64 47 67 Q60 70 80 67" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 경북 — 경주 다보탑 (포항·경주·안동·구미 등)
const gyeongbuk = ({ key }) => (
  <g fill={key}>
    <rect x="38" y="68" width="24" height="6" rx="1.5" />
    <path d="M28 60 Q50 51 72 60 Z" />
    <rect x="44" y="55" width="12" height="6" />
    <path d="M34 49 Q50 42 66 49 Z" />
    <rect x="46" y="44" width="8" height="6" />
    <path d="M40 39 Q50 34 60 39 Z" />
    <rect x="48.6" y="28" width="2.8" height="11" rx="1.4" />
  </g>
);

// 경남 — 통영 돛단배
const gyeongnam = ({ key }) => (
  <g fill={key}>
    <rect x="48.6" y="28" width="2.8" height="38" rx="1.4" />
    <path d="M52 30 L52 64 L74 64 Z" />
    <path d="M47 36 L47 64 L32 64 Z" />
    <path d="M28 66 L72 66 L63 74 L37 74 Z" />
  </g>
);

// 제주 — 한라산 + 분화구
const jeju = ({ key, sub }) => (
  <g>
    <path d="M16 72 Q36 42 50 41 Q64 42 84 72 Z" fill={key} />
    <path d="M43 49 Q50 45 57 49 Q50 52 43 49 Z" fill={sub} />
  </g>
);

/* ════════ 카테고리 / 공통 ════════ */

// 영예 — 메달(별 컷아웃 + 리본)
const honor = ({ key, sub }) => (
  <g>
    <path d="M40 54 L35 76 L44 69 L50 76 L56 69 L65 76 L60 54 Z" fill={key} />
    <circle cx="50" cy="40" r="20" fill={key} />
    <path d={starPath(50, 40, 10, 4.2)} fill={sub} />
  </g>
);

// 베스트 컷 — 왕관
const crown = ({ key }) => (
  <g fill={key}>
    <path d="M24 64 L24 38 L38 52 L50 32 L62 52 L76 38 L76 64 Z" />
    <rect x="24" y="63" width="52" height="9" rx="3" />
  </g>
);

// 도움 — 불꽃
const flame = ({ key }) => (
  <g fill={key}>
    <path d="M50 20 C37 39 28 50 37 65 C43 74 50 80 50 80 C50 80 67 71 69 55 C71 44 60 39 50 20 Z" />
  </g>
);

// 벚꽃 — 5장 꽃잎 + 꽃술 컷아웃
const cherry = ({ key, sub }) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = 50 + Math.cos(a) * 16;
      const py = 46 + Math.sin(a) * 16;
      return <ellipse key={i} cx={px} cy={py} rx="12" ry="9" fill={key} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />;
    })}
    <circle cx="50" cy="46" r="5.5" fill={sub} />
  </g>
);

// 노을 — 해 + 바다
const sunset = ({ key }) => (
  <g>
    <circle cx="50" cy="42" r="13" fill={key} />
    <path d="M20 60 Q34 56 46 60 Q58 64 80 60" fill="none" stroke={key} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M26 70 Q38 67 50 70" fill="none" stroke={key} strokeWidth="3" strokeLinecap="round" />
  </g>
);

// 날씨 — 구름 + 빗방울
const weather = ({ key }) => (
  <g fill={key}>
    <path d="M32 58 Q25 46 39 45 Q44 34 58 42 Q73 40 72 53 Q80 55 75 62 Q70 64 58 62 L42 62 Q33 64 32 58 Z" />
    <circle cx="40" cy="70" r="2.6" />
    <circle cx="50" cy="72" r="2.6" />
    <circle cx="60" cy="70" r="2.6" />
  </g>
);

// 축제 — 불꽃놀이
const festival = ({ key }) => {
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    items.push(<line key={`r${i}`} x1={50 + Math.cos(a) * 9} y1={46 + Math.sin(a) * 9} x2={50 + Math.cos(a) * 22} y2={46 + Math.sin(a) * 22} stroke={key} strokeWidth="3.2" strokeLinecap="round" />);
    items.push(<circle key={`d${i}`} cx={50 + Math.cos(a) * 26} cy={46 + Math.sin(a) * 26} r="2.2" fill={key} />);
  }
  return (
    <g>
      {items}
      <circle cx="50" cy="46" r="5" fill={key} />
    </g>
  );
};

// 인파 — 사람들 (앞 사람은 배경색 분리선으로 떼어냄)
const crowd = ({ key, sub }) => (
  <g>
    {/* 뒤 두 사람 */}
    <g fill={key}>
      <circle cx="30" cy="42" r="8" />
      <path d="M16 72 Q16 54 30 54 Q44 54 44 72 Z" />
      <circle cx="70" cy="42" r="8" />
      <path d="M56 72 Q56 54 70 54 Q84 54 84 72 Z" />
    </g>
    {/* 분리선(배경색) */}
    <g fill={sub}>
      <circle cx="50" cy="37" r="12.5" />
      <path d="M30 74 Q30 50 50 50 Q70 50 70 74 Z" />
    </g>
    {/* 앞 사람 */}
    <g fill={key}>
      <circle cx="50" cy="37" r="10" />
      <path d="M33 74 Q33 53 50 53 Q67 53 67 74 Z" />
    </g>
  </g>
);

// 단골 — 상점
const store = ({ key, sub }) => (
  <g>
    <path d="M27 44 L73 44 L70 53 L30 53 Z" fill={key} />
    <rect x="31" y="53" width="38" height="17" rx="1.5" fill={key} />
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

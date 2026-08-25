import React from 'react';

/**
 * 기기(윈도우·아이폰·안드로이드)마다 다르게 그려지는 이모지 대신
 * 모든 기종에서 동일하게 보이는 플랫 SVG 날씨 아이콘.
 *
 * 기존 API가 내려주는 이모지(☀️ 🌤️ ☁️ …)나 한글 상태값(맑음·흐림·비 …)을
 * 그대로 넘기면 알아서 같은 그림으로 바꿔 그린다.
 */

const SUN = '#FBBF24';
const CLOUD = '#B9C6D4';
const CLOUD_LIGHT = '#D6E0EA';
const RAIN = '#38BDF8';
const SNOW = '#7DD3FC';
const BOLT = '#F59E0B';

// 이모지 → 아이콘 종류
const EMOJI_MAP = {
  '☀': 'sun',
  '🌞': 'sun',
  '🔆': 'sun',
  '🌤': 'partly',
  '⛅': 'partly',
  '🌥': 'partly',
  '☁': 'cloud',
  '🌧': 'rain',
  '🌦': 'rain',
  '💧': 'rain',
  '⛈': 'thunder',
  '🌩': 'thunder',
  '🌨': 'sleet',
  '❄': 'snow',
  '☃': 'snow',
  '⛄': 'snow',
  '🌫': 'fog',
  '🌙': 'night',
  '🌛': 'night',
  '🌜': 'night',
};

// 한글 상태값 → 아이콘 종류
const CONDITION_MAP = [
  ['천둥', 'thunder'],
  ['번개', 'thunder'],
  ['진눈깨비', 'sleet'],
  ['눈', 'snow'],
  ['비', 'rain'],
  ['소나기', 'rain'],
  ['안개', 'fog'],
  ['흐림', 'cloud'],
  ['구름많음', 'cloud'],
  ['구름', 'partly'],
  ['맑음', 'sun'],
];

const resolveType = (icon, condition) => {
  const raw = String(icon ?? '').replace(/[\uFE0F\uFE0E\s]/g, '');
  if (raw) {
    if (EMOJI_MAP[raw]) return EMOJI_MAP[raw];
    // 이모지가 결합 문자로 들어오는 경우 첫 글자만 다시 확인
    const first = Array.from(raw)[0];
    if (first && EMOJI_MAP[first]) return EMOJI_MAP[first];
  }
  const cond = String(condition ?? '').trim();
  if (cond) {
    const hit = CONDITION_MAP.find(([key]) => cond.includes(key));
    if (hit) return hit[1];
  }
  return raw || cond ? 'partly' : null;
};

// 구름 본체 (겹친 원 + 둥근 사각형 → 플랫한 한 덩어리)
const Cloud = ({ color, dy = 0 }) => (
  <g fill={color} transform={dy ? `translate(0 ${dy})` : undefined}>
    <circle cx="8.6" cy="14" r="4.1" />
    <circle cx="13" cy="11.9" r="5.1" />
    <circle cx="17.1" cy="14.4" r="3.6" />
    <rect x="8" y="14" width="9.4" height="4.1" rx="2.05" />
  </g>
);

const SunRays = ({ color }) => (
  <g stroke={color} strokeWidth="1.9" strokeLinecap="round">
    <line x1="12" y1="3.4" x2="12" y2="5.7" />
    <line x1="12" y1="18.3" x2="12" y2="20.6" />
    <line x1="3.4" y1="12" x2="5.7" y2="12" />
    <line x1="18.3" y1="12" x2="20.6" y2="12" />
    <line x1="5.92" y1="5.92" x2="7.55" y2="7.55" />
    <line x1="16.45" y1="16.45" x2="18.08" y2="18.08" />
    <line x1="5.92" y1="18.08" x2="7.55" y2="16.45" />
    <line x1="16.45" y1="7.55" x2="18.08" y2="5.92" />
  </g>
);

const SHAPES = {
  sun: (
    <>
      <SunRays color={SUN} />
      <circle cx="12" cy="12" r="4.4" fill={SUN} />
    </>
  ),
  partly: (
    <>
      <g stroke={SUN} strokeWidth="1.7" strokeLinecap="round">
        <line x1="15.6" y1="1.8" x2="15.6" y2="3.4" />
        <line x1="21.4" y1="7.6" x2="19.8" y2="7.6" />
        <line x1="11.4" y1="7.6" x2="9.8" y2="7.6" />
        <line x1="19.7" y1="3.5" x2="18.6" y2="4.6" />
        <line x1="11.5" y1="3.5" x2="12.6" y2="4.6" />
      </g>
      <circle cx="15.6" cy="7.6" r="3.3" fill={SUN} />
      <Cloud color={CLOUD} dy={1.4} />
    </>
  ),
  cloud: (
    <>
      <circle cx="16.4" cy="8.6" r="3.9" fill={CLOUD_LIGHT} />
      <Cloud color={CLOUD} dy={1.4} />
    </>
  ),
  rain: (
    <>
      <Cloud color={CLOUD} dy={-1.6} />
      <g stroke={RAIN} strokeWidth="1.9" strokeLinecap="round">
        <line x1="8.8" y1="18.2" x2="7.9" y2="21.2" />
        <line x1="12.6" y1="18.2" x2="11.7" y2="21.2" />
        <line x1="16.4" y1="18.2" x2="15.5" y2="21.2" />
      </g>
    </>
  ),
  sleet: (
    <>
      <Cloud color={CLOUD} dy={-1.6} />
      <g stroke={RAIN} strokeWidth="1.9" strokeLinecap="round">
        <line x1="9.4" y1="18.2" x2="8.5" y2="21.2" />
        <line x1="15.8" y1="18.2" x2="14.9" y2="21.2" />
      </g>
      <circle cx="12.6" cy="20" r="1.5" fill={SNOW} />
    </>
  ),
  snow: (
    <>
      <Cloud color={CLOUD} dy={-1.6} />
      <g fill={SNOW}>
        <circle cx="8.9" cy="19.9" r="1.5" />
        <circle cx="12.6" cy="21.2" r="1.5" />
        <circle cx="16.3" cy="19.9" r="1.5" />
      </g>
    </>
  ),
  thunder: (
    <>
      <Cloud color={CLOUD} dy={-2} />
      <path d="M13.8 14.8 9.6 20.2h2.6l-.8 3 4.2-5.6h-2.6l.8-2.8Z" fill={BOLT} />
    </>
  ),
  fog: (
    <>
      <Cloud color={CLOUD} dy={-2.4} />
      <g stroke={CLOUD_LIGHT} strokeWidth="1.9" strokeLinecap="round">
        <line x1="6.4" y1="18.4" x2="17.6" y2="18.4" />
        <line x1="8.4" y1="21.4" x2="15.6" y2="21.4" />
      </g>
    </>
  ),
  night: (
    <path
      d="M20.2 15.2A8.4 8.4 0 0 1 9.1 4.1a8.6 8.6 0 1 0 11.1 11.1Z"
      fill="#94A3B8"
    />
  ),
};

export default function WeatherIcon({
  icon,
  condition,
  size = 16,
  title,
  style,
  className,
}) {
  const type = resolveType(icon, condition);
  if (!type) return null;

  const label = title ?? condition ?? '';

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {label ? <title>{label}</title> : null}
      {SHAPES[type] || SHAPES.partly}
    </svg>
  );
}

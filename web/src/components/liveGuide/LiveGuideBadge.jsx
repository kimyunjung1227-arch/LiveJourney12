import React from 'react';

/**
 * 라이브가이드 인증 씰 — 이름 옆에 붙는 하늘색 블루체크.
 * 기존 뱃지(메달리온)와는 별개의 "활동 인증" 마크다.
 *
 * @param {object} props
 * @param {1|2|3} [props.level]  등급 (3 = 탑 라이브가이드 → 이중 링)
 * @param {boolean} [props.live] 48h 내 현장 정보 → 실시간 펄스
 * @param {number} [props.size]
 * @param {string} [props.title]
 */

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';

// 펄스 키프레임은 한 번만 주입 (전역 index.css 오염 방지)
let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.id = 'lj-liveguide-css';
  el.textContent =
    '@keyframes ljLgPulse{0%{transform:scale(.65);opacity:.5}70%{opacity:0}100%{transform:scale(1.85);opacity:0}}';
  document.head.appendChild(el);
}

export default function LiveGuideBadge({ level = 1, live = false, size = 18, title = '라이브가이드', style }) {
  ensureStyles();
  const top = level >= 3;
  const gid = `lj-lg-grad-${size}-${top ? 't' : 'n'}`;

  return (
    <span
      title={title}
      aria-label={title}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {live && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            border: `2px solid ${KEY}`,
            animation: 'ljLgPulse 1.9s ease-out infinite',
          }}
        />
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={gid} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={KEY} />
            <stop offset="1" stopColor={KEY_DARK} />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill={`url(#${gid})`} />
        {top && <circle cx="12" cy="12" r="8.6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />}
        <path
          d="M7.7 12.4 L10.6 15.2 L16.3 8.9"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

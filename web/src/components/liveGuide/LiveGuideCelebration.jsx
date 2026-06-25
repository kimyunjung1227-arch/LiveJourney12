import React from 'react';
import LiveGuideBadge from './LiveGuideBadge';

/**
 * "라이브가이드가 되었습니다" 축하 오버레이.
 * 활동으로 라이브가이드가 된 순간(또는 탑 등급 도달) 띄운다.
 *
 * @param {object} props
 * @param {number} props.level 1~3 (3이면 탑 라이브가이드)
 * @param {() => void} props.onClose
 */

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';

let injected = false;
function ensureKeyframes() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-liveguide-celebration', '');
  style.textContent = `
    @keyframes lj-lgc-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes lj-lgc-pop {
      0% { transform: scale(0.6) translateY(14px); opacity: 0; }
      60% { transform: scale(1.06) translateY(0); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes lj-lgc-seal {
      0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
      55% { transform: scale(1.12) rotate(4deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); opacity: 1; }
    }
    @keyframes lj-lgc-ring {
      0% { transform: scale(0.7); opacity: 0.5; }
      100% { transform: scale(1.9); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export default function LiveGuideCelebration({ level = 1, onClose }) {
  ensureKeyframes();
  const top = level >= 3;
  const title = top ? '탑 라이브가이드가 되었습니다!' : '라이브가이드가 되었습니다!';
  const desc = top
    ? '꾸준한 현장 기록으로 최고 등급에 올랐어요. 가장 살아있는 정보를 전하는 사람이에요.'
    : '활동이 쌓여 라이브가이드가 됐어요. 이제 이름 옆에 인증이 표시돼요.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="라이브가이드 달성"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'lj-lgc-fade 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 320,
          background: '#fff',
          borderRadius: 24,
          padding: '30px 22px 20px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.28)',
          animation: 'lj-lgc-pop 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 13px',
            borderRadius: 999,
            background: '#E3F3FB',
            color: '#1577B5',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: -0.2,
          }}
        >
          🎉 축하해요
        </div>

        {/* 큰 인증 씰 + 퍼지는 링 */}
        <div style={{ position: 'relative', width: 116, height: 116, margin: '20px auto 8px' }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              border: `3px solid ${KEY}`,
              animation: 'lj-lgc-ring 1.8s ease-out infinite',
            }}
          />
          <div style={{ animation: 'lj-lgc-seal 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both' }}>
            <LiveGuideBadge level={level} size={116} title={title} />
          </div>
        </div>

        <h3
          style={{
            margin: '12px 0 0',
            fontSize: 19,
            fontWeight: 800,
            color: '#1F1F1F',
            letterSpacing: -0.3,
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 13,
            lineHeight: 1.55,
            color: '#6B6B6B',
            wordBreak: 'keep-all',
          }}
        >
          {desc}
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 22,
            width: '100%',
            padding: '13px 0',
            border: 'none',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${KEY}, ${KEY_DARK})`,
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: -0.2,
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

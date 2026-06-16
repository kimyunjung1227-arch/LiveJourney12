import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BADGE_CATALOG } from '../components/profile/badgeData';
import BadgeMedallion from '../components/badges/BadgeMedallion';

/**
 * 뱃지 "달성 화면" 전역 컨텍스트.
 * - celebrateBadges(keys) 로 새로 획득한 뱃지를 큐에 넣으면 축하 오버레이가 순서대로 뜬다.
 * - 같은 세션에서 이미 보여준 키는 다시 띄우지 않는다(중복 방지).
 */
const BadgeAchievementContext = createContext({ celebrateBadges: () => {} });

export const useBadgeAchievement = () => useContext(BadgeAchievementContext);

let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-badge-achievement', '');
  style.textContent = `
    @keyframes lj-badge-pop {
      0% { transform: scale(0.6) translateY(12px); opacity: 0; }
      60% { transform: scale(1.06) translateY(0); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes lj-badge-fade { from { opacity: 0; } to { opacity: 1; } }
  `;
  document.head.appendChild(style);
}

export function BadgeAchievementProvider({ children }) {
  const [queue, setQueue] = useState([]); // 표시 대기 중인 뱃지 키
  const shownRef = useRef(new Set()); // 이 세션에서 이미 보여준 키

  const celebrateBadges = useCallback((keys) => {
    const incoming = (Array.isArray(keys) ? keys : [keys])
      .filter((k) => k && BADGE_CATALOG[k] && !shownRef.current.has(k));
    if (incoming.length === 0) return;
    incoming.forEach((k) => shownRef.current.add(k));
    ensureKeyframes();
    setQueue((prev) => [...prev, ...incoming]);
  }, []);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const value = useMemo(() => ({ celebrateBadges }), [celebrateBadges]);
  const currentKey = queue[0] || null;
  const meta = currentKey ? BADGE_CATALOG[currentKey] : null;

  return (
    <BadgeAchievementContext.Provider value={value}>
      {children}
      {meta && (
        <BadgeAchievementOverlay
          meta={meta}
          remaining={queue.length - 1}
          onClose={dismissCurrent}
        />
      )}
    </BadgeAchievementContext.Provider>
  );
}

const SKY = '#2BA0DC';

function BadgeAchievementOverlay({ meta, remaining, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="뱃지 달성"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'lj-badge-fade 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 320,
          background: '#fff',
          borderRadius: 24,
          padding: '28px 22px 20px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.28)',
          animation: 'lj-badge-pop 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
          position: 'relative',
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
          새 뱃지 획득
        </div>

        <div style={{ margin: '18px 0 6px', display: 'inline-block' }}>
          <BadgeMedallion meta={meta} state="earned" size={120} />
        </div>

        <h3
          style={{
            margin: '10px 0 0',
            fontSize: 19,
            fontWeight: 800,
            color: '#1F1F1F',
            letterSpacing: -0.3,
            wordBreak: 'keep-all',
          }}
        >
          {meta.name}
        </h3>
        {meta.description && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              lineHeight: 1.55,
              color: '#6B6B6B',
              wordBreak: 'keep-all',
            }}
          >
            {meta.description}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '13px 0',
            border: 'none',
            borderRadius: 14,
            background: SKY,
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: -0.2,
          }}
        >
          {remaining > 0 ? `다음 (${remaining})` : '확인'}
        </button>
      </div>
    </div>
  );
}

export default BadgeAchievementProvider;

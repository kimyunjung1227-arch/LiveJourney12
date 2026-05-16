import React from 'react';
import { resolveBadgeTone, resolveBadgeSymbol, hexToRgbTuple } from '../utils/badgeIcons';

function parseTierFromDynName(name) {
  const n = String(name || '');
  const m = n.match(/:tier(\d+)$/);
  const tier = m ? Number(m[1]) : 1;
  if (!Number.isFinite(tier)) return 1;
  return Math.max(1, Math.min(3, tier));
}

function normalizeTier(value, fallbackName) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(3, Math.round(value)));
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (s === '상') return 3;
    if (s === '중') return 2;
    if (s === '하') return 1;
    const n = Number(s);
    if (Number.isFinite(n)) return Math.max(1, Math.min(3, Math.round(n)));
  }
  return parseTierFromDynName(fallbackName);
}

/**
 * 라이브저니 뱃지 메달리온
 * - 티어가 오를수록 테두리·아이콘 컬러가 점진적으로 드러나는 성장형 디자인
 *   · tier 1: 옅은 톤(시작), 솔리드 아이콘
 *   · tier 2: 또렷한 테두리 + 그라데이션 아이콘
 *   · tier 3: 두꺼운 그라데이션 링 + 풀 그라데이션 아이콘 + 글로우
 * - unearned: 미획득(다음 뱃지 미리보기) — 흑백·반투명 처리
 */
export default function LiveBadgeMedallion({
  badgeName,
  tier: tierProp,
  icon,
  category,
  tone: toneProp,
  gradientCss,
  unearned = false,
  size = 64,
  className = '',
}) {
  const tier = normalizeTier(tierProp, badgeName);
  const badgeShape = { icon, category, tone: toneProp, name: badgeName };
  const tone = resolveBadgeTone(badgeShape);
  const gradient = gradientCss || `linear-gradient(135deg, ${tone.from}, ${tone.to})`;
  const fromRgb = hexToRgbTuple(tone.from);
  const toRgb = hexToRgbTuple(tone.to);
  const symbol = resolveBadgeSymbol(badgeShape);

  const styles = (() => {
    if (tier >= 3) {
      return {
        ringBg: gradient,
        ringPadding: Math.max(3, Math.round(size * 0.05)),
        innerBg: '#ffffff',
        iconGradient: gradient,
        iconColor: null,
        iconWeight: 700,
        shadow: `0 10px 24px -10px rgba(${toRgb}, 0.7), 0 0 0 1px rgba(${fromRgb}, 0.18)`,
      };
    }
    if (tier === 2) {
      return {
        ringBg: `rgba(${fromRgb}, 0.9)`,
        ringPadding: Math.max(2.5, Math.round(size * 0.04)),
        innerBg: '#ffffff',
        iconGradient: gradient,
        iconColor: null,
        iconWeight: 600,
        shadow: `0 5px 14px -8px rgba(${toRgb}, 0.45)`,
      };
    }
    return {
      ringBg: `rgba(${fromRgb}, 0.5)`,
      ringPadding: Math.max(1.5, Math.round(size * 0.03)),
      innerBg: `rgba(${fromRgb}, 0.07)`,
      iconGradient: null,
      iconColor: `rgba(${toRgb}, 0.72)`,
      iconWeight: 500,
      shadow: `0 2px 6px -4px rgba(${toRgb}, 0.22)`,
    };
  })();

  const ghostStyle = unearned
    ? { opacity: 0.42, filter: 'grayscale(55%)' }
    : null;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: styles.ringBg,
        padding: styles.ringPadding,
        boxShadow: unearned ? 'none' : styles.shadow,
        ...ghostStyle,
      }}
      aria-hidden
    >
      <div
        className="rounded-full flex items-center justify-center w-full h-full overflow-hidden"
        style={{ background: styles.innerBg }}
      >
        <span
          className="material-symbols-outlined select-none"
          style={{
            fontSize: Math.round(size * 0.46),
            lineHeight: 1,
            ...(styles.iconGradient
              ? {
                  background: styles.iconGradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                }
              : { color: styles.iconColor }),
            fontVariationSettings: `'FILL' 1, 'wght' ${styles.iconWeight}, 'GRAD' 0, 'opsz' 40`,
          }}
        >
          {symbol}
        </span>
      </div>
    </div>
  );
}

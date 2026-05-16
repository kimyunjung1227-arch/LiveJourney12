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

  // 티어별로 시각 차이를 극적으로 — "성장"이 한눈에 보이도록 설계
  const styles = (() => {
    if (tier >= 3) {
      // 풀 블룸: 외곽 헤일로 + 두꺼운 그라데이션 링 + 굵은 아이콘 + 강한 글로우
      return {
        ringBg: gradient,
        ringPadding: Math.max(4, Math.round(size * 0.07)),
        innerBg: '#ffffff',
        iconGradient: gradient,
        iconColor: null,
        iconWeight: 800,
        iconScale: 1,
        iconFontRatio: 0.5,
        shadow: [
          `0 0 0 3px rgba(${fromRgb}, 0.18)`,
          `0 0 0 1px rgba(${fromRgb}, 0.4)`,
          `0 14px 30px -10px rgba(${toRgb}, 0.75)`,
          `0 4px 12px -6px rgba(${fromRgb}, 0.5)`,
        ].join(', '),
      };
    }
    if (tier === 2) {
      // 완전 reveal: 또렷한 그라데이션 링 + 풀 그라데이션 아이콘
      return {
        ringBg: gradient,
        ringPadding: Math.max(3, Math.round(size * 0.05)),
        innerBg: '#ffffff',
        iconGradient: gradient,
        iconColor: null,
        iconWeight: 700,
        iconScale: 1,
        iconFontRatio: 0.46,
        shadow: `0 6px 16px -8px rgba(${toRgb}, 0.5)`,
      };
    }
    // 새싹 단계: 거의 보이지 않을 정도로 옅음, muted 아이콘
    return {
      ringBg: `rgba(${fromRgb}, 0.25)`,
      ringPadding: Math.max(1, Math.round(size * 0.02)),
      innerBg: '#ffffff',
      iconGradient: null,
      iconColor: `rgba(${toRgb}, 0.5)`,
      iconWeight: 400,
      iconScale: 0.88,
      iconFontRatio: 0.42,
      shadow: 'none',
    };
  })();

  // 미획득(다음 뱃지 미리보기): 채도는 유지하되 투명도만 낮춰 "이래서 얻고 싶다"는 느낌
  const ghostStyle = unearned
    ? { opacity: 0.55, filter: 'saturate(0.85)' }
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
            fontSize: Math.round(size * styles.iconFontRatio),
            lineHeight: 1,
            transform: styles.iconScale !== 1 ? `scale(${styles.iconScale})` : undefined,
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

      {/* 티어 3: 모서리 별 데코레이션 (성장 완성을 강조) */}
      {tier >= 3 && !unearned && size >= 56 ? (
        <span
          className="material-symbols-outlined absolute select-none"
          style={{
            top: -2,
            right: -2,
            fontSize: Math.round(size * 0.28),
            lineHeight: 1,
            color: tone.from,
            filter: `drop-shadow(0 1px 2px rgba(${toRgb}, 0.6))`,
            fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24",
          }}
        >
          star
        </span>
      ) : null}
    </div>
  );
}

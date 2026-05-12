import React from 'react';

const BRAND = {
  primary: '#26C6DA',
  primaryDark: '#00BCD4',
  accent: '#FFC107',
  cyan: '#00ACC1',
  muted: '#94A3B8',
};

function getLiveSyncMeta(pct) {
  const msg =
    pct >= 90 ? '실시간 동기화 완료' :
    pct >= 70 ? '높은 현장감' :
    pct >= 40 ? '일반 여행자' :
    '시차 주의';

  if (pct >= 90) {
    return {
      msg,
      chipClass: 'bg-accent/15 dark:bg-accent/20 border-accent/35 dark:border-accent/40 text-accent-dark dark:text-accent',
      barColor: BRAND.accent,
      barShadow: '0 0 18px rgba(255, 193, 7, 0.35)',
    };
  }

  if (pct >= 70) {
    return {
      msg,
      chipClass: 'bg-primary/15 dark:bg-primary/20 border-primary/30 dark:border-primary/35 text-primary-dark dark:text-primary',
      barColor: BRAND.primary,
      barShadow: '0 0 16px rgba(38, 198, 218, 0.28)',
    };
  }

  if (pct >= 40) {
    return {
      msg,
      chipClass: 'bg-primary/10 dark:bg-primary/15 border-primary/25 dark:border-primary/30 text-primary-dark dark:text-primary',
      barColor: BRAND.primaryDark,
      barShadow: 'none',
    };
  }

  if (pct >= 25) {
    return {
      msg,
      chipClass: 'bg-secondary-5-soft/80 dark:bg-secondary-5/15 border-secondary-5/25 dark:border-secondary-5/35 text-secondary-5-dark dark:text-secondary-5',
      barColor: BRAND.cyan,
      barShadow: 'none',
    };
  }

  return {
    msg,
    chipClass: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-text-secondary-light dark:text-text-secondary-dark',
    barColor: BRAND.muted,
    barShadow: 'none',
  };
}

export default function ProfileLiveSyncSection({
  liveSync,
  className = '',
  explainOpen = false,
  onToggleExplain,
  explainText,
  footerAction = null,
}) {
  const pct = typeof liveSync === 'number' ? liveSync : 50;
  const { msg, chipClass, barColor, barShadow } = getLiveSyncMeta(pct);

  return (
    <div className={`pt-2 pb-3 ${className}`.trim()}>
      <div className="flex items-center justify-start gap-2 mb-3">
        <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark shrink-0">
          라이브 싱크
        </h3>
        {onToggleExplain ? (
          <button
            type="button"
            onClick={onToggleExplain}
            className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shrink-0"
            aria-label="라이브 싱크 설명 보기"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              info
            </span>
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/60 px-3.5 py-3">
        <div className="flex w-full items-center justify-end">
          <span
            className={`inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap text-[11px] font-semibold px-2 py-1 rounded-full border ${chipClass}`}
          >
            <span>{pct}%</span>
            <span className="opacity-40" aria-hidden>
              ·
            </span>
            <span>{msg}</span>
          </span>
        </div>

        <div className="mt-2.5">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, Math.min(100, pct))}%`,
                backgroundColor: barColor,
                boxShadow: barShadow,
              }}
            />
          </div>

          {explainOpen && explainText ? (
            <div className="mt-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/30 px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 text-left">
              {explainText}
            </div>
          ) : null}
        </div>

        {footerAction}
      </div>
    </div>
  );
}

import React from 'react';

const BADGE_CHIP_CLASS =
  'text-[11px] font-semibold px-2 py-1 rounded-full border bg-primary/10 dark:bg-primary/15 border-primary/25 text-primary';

function getLiveSyncMeta(pct) {
  const msg =
    pct >= 90 ? '실시간 동기화 완료' :
    pct >= 70 ? '높은 현장감' :
    pct >= 40 ? '일반 여행자' :
    '시차 주의';

  if (pct >= 90) {
    return {
      msg,
      barGradient: 'linear-gradient(90deg, rgba(2,132,199,1), rgba(14,165,233,1))',
      barShadow: '0 0 18px rgba(14,165,233,0.35)',
    };
  }

  if (pct >= 70) {
    return {
      msg,
      barGradient: 'linear-gradient(90deg, rgba(14,165,233,1), rgba(56,189,248,1))',
      barShadow: 'none',
    };
  }

  if (pct >= 40) {
    return {
      msg,
      barGradient: 'linear-gradient(90deg, rgba(125,211,252,1), rgba(148,163,184,1))',
      barShadow: 'none',
    };
  }

  return {
    msg,
    barGradient: 'linear-gradient(90deg, rgba(251,146,60,1), rgba(253,186,116,1))',
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
  const { msg, barGradient, barShadow } = getLiveSyncMeta(pct);

  return (
    <div className={`px-6 pt-2 pb-3 ${className}`.trim()}>
      <div className="flex items-center gap-2 mb-3">
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
        <div className="flex items-center justify-start gap-2">
          <div
            className={`inline-flex items-center justify-start gap-1.5 min-w-0 max-w-full text-left ${BADGE_CHIP_CLASS}`}
          >
            <span className="shrink-0">{pct}%</span>
            <span className="opacity-40 shrink-0" aria-hidden>
              ·
            </span>
            <span className="truncate">{msg}</span>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, Math.min(100, pct))}%`,
                background: barGradient,
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

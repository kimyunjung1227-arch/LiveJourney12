import React from 'react';

function getLiveSyncMeta(pct) {
  const msg =
    pct >= 90 ? '실시간 동기화 완료' :
    pct >= 70 ? '높은 현장감' :
    pct >= 40 ? '일반 여행자' :
    '시차 주의';

  if (pct >= 90) {
    return {
      msg,
      chipClass: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
      barColor: '#EA580C',
      barShadow: '0 0 18px rgba(234, 88, 12, 0.35)',
    };
  }

  if (pct >= 70) {
    return {
      msg,
      chipClass: 'bg-green-50 dark:bg-green-950/35 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
      barColor: '#22C55E',
      barShadow: 'none',
    };
  }

  if (pct >= 40) {
    return {
      msg,
      chipClass: 'bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
      barColor: '#3B82F6',
      barShadow: 'none',
    };
  }

  if (pct >= 25) {
    return {
      msg,
      chipClass: 'bg-blue-50/80 dark:bg-blue-950/25 border-blue-300 dark:border-blue-900 text-blue-800 dark:text-blue-200',
      barColor: '#1D4ED8',
      barShadow: 'none',
    };
  }

  return {
    msg,
    chipClass: 'bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200',
    barColor: '#334155',
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

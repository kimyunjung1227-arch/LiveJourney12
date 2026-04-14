import React, { useMemo, useState } from 'react';
import { getBadgeDisplayName } from '../utils/badgeSystem';

function sortBadgesForDisplay(badges) {
  if (!Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => {
    const ta = Number(a?.earnedAt) || 0;
    const tb = Number(b?.earnedAt) || 0;
    if (tb !== ta) return tb - ta;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

/**
 * 프로필 상단 「인장」: 가로 스크롤 미리보기 + 모두보기
 */
export default function ProfileInjangSection({ badges, onViewAll, className = '' }) {
  const sorted = useMemo(() => sortBadgesForDisplay(badges), [badges]);
  const preview = sorted.slice(0, 12);
  const [selectedBadge, setSelectedBadge] = useState(null);

  return (
    <div className={`pt-2 pb-3 border-b border-gray-100 dark:border-gray-800 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark shrink-0">
          인장
        </h3>
        <button
          type="button"
          onClick={() => onViewAll?.()}
          className="text-sm font-semibold text-primary hover:underline shrink-0 py-1"
        >
          모두보기
        </button>
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          아직 획득한 인장이 없습니다.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-0.5 px-0.5 [scrollbar-width:thin]">
          {preview.map((badge, index) => {
            const label = getBadgeDisplayName(badge) || badge?.name || '인장';
            const icon = badge?.icon;
            const shortCondition = badge?.shortCondition || '';
            const progressCurrent =
              typeof badge?.progressCurrent === 'number' ? badge.progressCurrent : null;
            const progressTarget =
              typeof badge?.progressTarget === 'number' ? badge.progressTarget : null;
            const progressUnit = badge?.progressUnit || '';
            return (
              <button
                key={`${badge?.name || 'b'}-${index}`}
                type="button"
                onClick={() => setSelectedBadge(badge)}
                className="flex flex-col items-center shrink-0 w-[84px] text-left"
              >
                <div
                  className="w-[56px] h-[56px] rounded-full bg-white dark:bg-gray-950 border-[3px] border-primary flex items-center justify-center shadow-sm overflow-hidden"
                  aria-hidden
                >
                  {icon ? (
                    <span className="text-[26px] leading-none select-none">{icon}</span>
                  ) : (
                    <span className="text-[10px] font-bold text-primary text-center px-1 leading-tight line-clamp-2">
                      {label.slice(0, 8)}
                    </span>
                  )}
                </div>

                {/* 라이브 뱃지(칩) 스타일 */}
                <span
                  className="mt-1.5 w-full text-center text-[11px] font-semibold px-2 py-1 rounded-full border bg-primary/10 dark:bg-primary/15 border-primary/25 text-primary truncate"
                  title={label}
                >
                  {label}
                </span>

                {(shortCondition || (progressCurrent != null && progressTarget != null)) && (
                  <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 w-full text-center truncate">
                    {progressCurrent != null && progressTarget != null
                      ? `${progressCurrent}/${progressTarget}${progressUnit ? ` ${progressUnit}` : ''}`
                      : shortCondition}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 인장 조건/설명 모달 */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedBadge(null)}
          role="dialog"
          aria-modal="true"
          aria-label="인장 조건"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl leading-none" aria-hidden>
                  {selectedBadge.icon || '🏅'}
                </span>
                <h4 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark truncate">
                  {getBadgeDisplayName(selectedBadge) || selectedBadge?.name || '인장'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                aria-label="닫기"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {selectedBadge?.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed break-keep">
                  {selectedBadge.description}
                </p>
              )}

              {(selectedBadge?.shortCondition ||
                (typeof selectedBadge?.progressCurrent === 'number' &&
                  typeof selectedBadge?.progressTarget === 'number')) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3">
                  <p className="text-xs font-semibold text-primary mb-1">획득 조건</p>
                  {selectedBadge?.shortCondition && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-keep">
                      {selectedBadge.shortCondition}
                    </p>
                  )}
                  {typeof selectedBadge?.progressCurrent === 'number' &&
                    typeof selectedBadge?.progressTarget === 'number' && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        진행도: {selectedBadge.progressCurrent}/{selectedBadge.progressTarget}
                        {selectedBadge?.progressUnit ? ` ${selectedBadge.progressUnit}` : ''}
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

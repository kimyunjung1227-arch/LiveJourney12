import React, { useMemo } from 'react';
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

  return (
    <div className={`pt-2 pb-3 border-b border-gray-100 dark:border-gray-800 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark shrink-0">
          인장
        </h3>
        <button
          type="button"
          onClick={() => onViewAll?.()}
          className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0 py-1"
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
            return (
              <div
                key={`${badge?.name || 'b'}-${index}`}
                className="flex flex-col items-center shrink-0 w-[72px]"
              >
                <div
                  className="w-[56px] h-[56px] rounded-full bg-white dark:bg-gray-950 border-[3px] border-red-600 dark:border-red-500 flex items-center justify-center shadow-sm overflow-hidden"
                  aria-hidden
                >
                  {icon ? (
                    <span className="text-[26px] leading-none select-none">{icon}</span>
                  ) : (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 text-center px-1 leading-tight line-clamp-2">
                      {label.slice(0, 8)}
                    </span>
                  )}
                </div>
                <p
                  className="mt-1.5 text-[11px] font-medium text-center text-gray-900 dark:text-gray-100 line-clamp-2 break-keep w-full leading-snug"
                  title={label}
                >
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

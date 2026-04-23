import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * 프로필 상단 「라이브뱃지」: 가로 스크롤 미리보기 + 모두보기
 */
export default function ProfileInjangSection({ badges, onViewAll, onOpenBadge, className = '' }) {
  const navigate = useNavigate();
  const sorted = useMemo(() => sortBadgesForDisplay(badges), [badges]);
  const preview = sorted.slice(0, 12);

  const openBadge = (badge) => {
    if (onOpenBadge) {
      onOpenBadge(badge);
      return;
    }
    const name = String(badge?.name || '').trim();
    if (!name) return;
    navigate(`/badge/live/${encodeURIComponent(name)}`, { state: { badge } });
  };

  return (
    <div className={`pt-2 pb-3 border-b border-gray-100 dark:border-gray-800 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark shrink-0">
          라이브뱃지
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
          아직 획득한 라이브뱃지가 없습니다.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {preview.map((badge, index) => {
            const label = getBadgeDisplayName(badge) || badge?.name || '라이브뱃지';
            const icon = badge?.icon;
            return (
              <button
                key={`${badge?.name || 'b'}-${index}`}
                type="button"
                onClick={() => openBadge(badge)}
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

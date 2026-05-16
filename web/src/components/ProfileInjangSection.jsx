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

// 카테고리별 기본 톤 (badge.tone이 없을 때 fallback)
const CATEGORY_DEFAULT_TONE = {
  '자연·풍경': { from: '#7DD3FC', to: '#2563EB' },
  '숨은 명소': { from: '#A7F3D0', to: '#059669' },
  '심야 가이드': { from: '#818CF8', to: '#4338CA' },
  '여행 응원': { from: '#FBBF24', to: '#B45309' },
  '지역 테마': { from: '#A78BFA', to: '#5B21B6' },
};
const FALLBACK_TONE = { from: '#94A3B8', to: '#475569' };

// '#RRGGBB' → 'r, g, b'
const hexToRgbTuple = (hex) => {
  const s = String(hex || '').replace('#', '').trim();
  if (s.length !== 6) return '148, 163, 184';
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '148, 163, 184';
  return `${r}, ${g}, ${b}`;
};

const resolveBadgeTone = (badge) => {
  const t = badge?.tone;
  if (t?.from && t?.to) return t;
  const cat = String(badge?.category || '').trim();
  return CATEGORY_DEFAULT_TONE[cat] || FALLBACK_TONE;
};

/** 획득 뱃지가 이 개수 이상일 때만 「모두보기」 노출 */
const MIN_BADGES_FOR_VIEW_ALL = 5;

/**
 * 프로필 상단 「뱃지」: 가로 스크롤 미리보기 + 모두보기
 */
export default function ProfileInjangSection({ badges, onViewAll, onOpenBadge, className = '' }) {
  const navigate = useNavigate();
  const sorted = useMemo(() => sortBadgesForDisplay(badges), [badges]);
  const preview = sorted.slice(0, 12);
  const showViewAll = sorted.length >= MIN_BADGES_FOR_VIEW_ALL;

  const toSerializableBadge = (b) => ({
    name: b?.name,
    displayName: b?.displayName,
    icon: b?.icon,
    category: b?.category,
    earnedAt: b?.earnedAt,
    region: b?.region,
    description: b?.description,
    shortCondition: b?.shortCondition,
    progressCurrent: b?.progressCurrent,
    progressTarget: b?.progressTarget,
    progressUnit: b?.progressUnit,
    tone: b?.tone,
    gradientCss: b?.gradientCss,
    difficulty: b?.difficulty,
    dynamic: b?.dynamic,
  });

  const openBadge = (badge) => {
    const safeBadge = toSerializableBadge(badge);
    if (onOpenBadge) {
      onOpenBadge(safeBadge);
      return;
    }
    const name = String(safeBadge?.name || '').trim();
    if (!name) return;
    navigate(`/badge/live/${encodeURIComponent(name)}`, { state: { badge: safeBadge } });
  };

  return (
    <div className={`pt-2 pb-3 border-b border-gray-100 dark:border-gray-800 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark shrink-0">
          뱃지
        </h3>
        {showViewAll ? (
          <button
            type="button"
            onClick={() => onViewAll?.()}
            className="text-sm font-semibold text-primary hover:underline shrink-0 py-1"
          >
            모두보기
          </button>
        ) : null}
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          아직 획득한 뱃지가 없습니다.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {preview.map((badge, index) => {
            const label = getBadgeDisplayName(badge) || badge?.name || '뱃지';
            const icon = badge?.icon;
            const tone = resolveBadgeTone(badge);
            const gradient = `linear-gradient(135deg, ${tone.from}, ${tone.to})`;
            const fromRgb = hexToRgbTuple(tone.from);
            const toRgb = hexToRgbTuple(tone.to);
            return (
              <button
                key={`${badge?.name || 'b'}-${index}`}
                type="button"
                onClick={() => openBadge(badge)}
                className="flex flex-col items-center shrink-0 w-[84px] text-left"
              >
                {/* 그라데이션 링 + 흰 디스크 (뱃지 톤에 맞춤) */}
                <div
                  className="w-[58px] h-[58px] rounded-full flex items-center justify-center"
                  style={{
                    background: gradient,
                    padding: 2.5,
                    boxShadow: `0 4px 10px -4px rgba(${toRgb}, 0.5)`,
                  }}
                  aria-hidden
                >
                  <div
                    className="w-full h-full rounded-full bg-white dark:bg-gray-950 flex items-center justify-center overflow-hidden"
                  >
                    {icon ? (
                      <span className="text-[26px] leading-none select-none">{icon}</span>
                    ) : (
                      <span
                        className="text-[10px] font-bold text-center px-1 leading-tight line-clamp-2"
                        style={{ color: tone.to }}
                      >
                        {label.slice(0, 8)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 이름 칩 — 뱃지 톤에 맞춘 색 */}
                <span
                  className="mt-2 w-full text-center text-[11px] font-bold px-2 py-1 rounded-full truncate"
                  style={{
                    background: `rgba(${fromRgb}, 0.14)`,
                    border: `1px solid rgba(${fromRgb}, 0.35)`,
                    color: tone.to,
                  }}
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

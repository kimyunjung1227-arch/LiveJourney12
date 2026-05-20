import React from 'react';
import { useHorizontalDragScroll } from '../../hooks/useHorizontalDragScroll';

const KEY = '#4DB8E8';
const SURFACE = '#F5F7FA';
const TEXT_PRIMARY = '#1F1F1F';

/**
 * 공통 필터 칩 — 카테고리(도시 페이지) 또는 지역(카테고리 페이지) 필터.
 */
export default function FilterChips({ chips, selected, onChange }) {
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();

  const guardedClick = (id) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onChange(id);
  };

  return (
    <div style={{ padding: '12px 18px' }}>
      <div
        onMouseDown={handleDragStart}
        className="lj-no-scrollbar flex overflow-x-auto cursor-grab active:cursor-grabbing"
        style={{ gap: 6, WebkitOverflowScrolling: 'touch' }}
      >
        {chips.map((chip) => {
          const isActive = selected === chip.id;
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={guardedClick(chip.id)}
              className="flex-shrink-0 inline-flex items-center whitespace-nowrap"
              style={{
                gap: 4,
                padding: '7px 14px',
                borderRadius: 999,
                border: 'none',
                background: isActive ? KEY : SURFACE,
                color: isActive ? '#fff' : TEXT_PRIMARY,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.4,
                cursor: 'pointer',
              }}
            >
              {Icon && (
                <Icon size={12} stroke={1.8} color={isActive ? '#fff' : TEXT_PRIMARY} />
              )}
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

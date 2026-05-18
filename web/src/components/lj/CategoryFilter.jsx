import React, { useEffect, useState } from 'react';
import {
  IconPlus,
  IconChevronLeft,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import { LJ, LJ_CATEGORIES } from './tokens';
import { useHorizontalDragScroll } from '../../hooks/useHorizontalDragScroll';

const ICONS = {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
};

const VISIBLE = 3;

/**
 * 카테고리 필터.
 * - 가로 스크롤 + 마우스 드래그
 * - "전체" + 첫 3개 + "+N" 칩, "+N" 클릭 시 같은 행에 가로로 펼친다
 */
export function CategoryFilter({ selected = 'all', onChange = () => {} }) {
  const [expanded, setExpanded] = useState(false);
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();

  useEffect(() => {
    if (selected === 'all') return;
    const baseIds = LJ_CATEGORIES.slice(0, VISIBLE).map((c) => c.id);
    if (!baseIds.includes(selected)) setExpanded(true);
  }, [selected]);

  // 드래그 직후 칩 클릭이 잘못 발화하지 않도록 가드
  const guardedClick = (handler) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler();
  };

  const visibleList = expanded ? LJ_CATEGORIES : LJ_CATEGORIES.slice(0, VISIBLE);
  const hiddenCount = LJ_CATEGORIES.length - VISIBLE;

  return (
    <div
      className="lj-no-scrollbar"
      onMouseDown={handleDragStart}
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '12px 18px',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        cursor: 'grab',
      }}
    >
      <Chip label="전체" active={selected === 'all'} onClick={guardedClick(() => onChange('all'))} />
      {visibleList.map((c) => {
        const Icon = ICONS[c.iconName];
        return (
          <Chip
            key={c.id}
            icon={Icon ? <Icon size={14} stroke={1.8} /> : null}
            label={c.label}
            active={selected === c.id}
            onClick={guardedClick(() => onChange(c.id))}
          />
        );
      })}
      {hiddenCount > 0 &&
        (expanded ? (
          <CollapseChip onClick={guardedClick(() => setExpanded(false))} />
        ) : (
          <PlusChip count={hiddenCount} onClick={guardedClick(() => setExpanded(true))} />
        ))}
    </div>
  );
}

function Chip({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 12px',
        borderRadius: 999,
        border: active ? 'none' : `1px solid ${LJ.borderLight}`,
        background: active ? LJ.key : '#fff',
        color: active ? '#fff' : LJ.textPrimary,
        fontFamily: LJ.fontStack,
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        lineHeight: 1.4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PlusChip({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="카테고리 더보기"
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '7px 10px',
        borderRadius: 999,
        border: `1px solid ${LJ.borderLight}`,
        background: '#fff',
        color: LJ.textSecondary,
        fontFamily: LJ.fontStack,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <IconPlus size={13} stroke={2} />
      {count}
    </button>
  );
}

function CollapseChip({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="카테고리 접기"
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '7px 10px',
        borderRadius: 999,
        border: `1px solid ${LJ.borderLight}`,
        background: LJ.bgSurface,
        color: LJ.textSecondary,
        fontFamily: LJ.fontStack,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      <IconChevronLeft size={14} stroke={2} />
    </button>
  );
}

export default CategoryFilter;

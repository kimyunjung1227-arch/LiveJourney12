import React, { useEffect, useRef, useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { LJ, LJ_CATEGORIES } from './tokens';
import {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';

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
 * - 가로 스크롤 가능
 * - 기본은 "전체" + 첫 3개 카테고리 + "+N" 버튼
 * - "+N" 버튼 클릭 시 나머지 카테고리가 팝오버로 노출 (선택하면 칩 행에 합류)
 */
export function CategoryFilter({ selected = 'all', onChange = () => {} }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  // 화면에 항상 보이는 칩: 기본 첫 3개 + 사용자가 선택한 게 그 밖에 있으면 그 칩도 추가
  const baseVisible = LJ_CATEGORIES.slice(0, VISIBLE).map((c) => c.id);
  const selectedExtra =
    selected !== 'all' && !baseVisible.includes(selected) ? [selected] : [];
  const visibleIds = [...baseVisible, ...selectedExtra];
  const visible = LJ_CATEGORIES.filter((c) => visibleIds.includes(c.id));
  const hidden = LJ_CATEGORIES.filter((c) => !visibleIds.includes(c.id));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="lj-no-scrollbar"
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '12px 18px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Chip label="전체" active={selected === 'all'} onClick={() => onChange('all')} />
        {visible.map((c) => {
          const Icon = ICONS[c.iconName];
          return (
            <Chip
              key={c.id}
              icon={Icon ? <Icon size={14} stroke={1.8} /> : null}
              label={c.label}
              active={selected === c.id}
              onClick={() => onChange(c.id)}
            />
          );
        })}
        {hidden.length > 0 && (
          <PlusChip
            count={hidden.length}
            active={open}
            onClick={() => setOpen((v) => !v)}
          />
        )}
      </div>

      {open && hidden.length > 0 && (
        <div
          ref={popoverRef}
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% - 6px)',
            right: 14,
            background: '#fff',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 6,
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 160,
          }}
        >
          {hidden.map((c) => {
            const Icon = ICONS[c.iconName];
            return (
              <button
                key={c.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: LJ.textPrimary,
                  fontFamily: LJ.fontStack,
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = LJ.bgSurface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {Icon ? <Icon size={15} stroke={1.8} /> : null}
                {c.label}
              </button>
            );
          })}
        </div>
      )}
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

function PlusChip({ count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="카테고리 더보기"
      aria-expanded={active}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '7px 10px',
        borderRadius: 999,
        border: `1px solid ${LJ.borderLight}`,
        background: active ? LJ.bgSurface : '#fff',
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

export default CategoryFilter;

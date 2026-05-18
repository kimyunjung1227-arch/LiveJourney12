import React from 'react';
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

/**
 * 홈/도시/장소 페이지 공용 카테고리 필터.
 * - "전체" + 카테고리 3개 + "+3" 더보기 칩.
 * - 활성 칩만 키컬러 채움 (디자인 원칙: 키컬러는 행동에만).
 */
export function CategoryFilter({ selected = 'all', onChange = () => {} }) {
  const visible = LJ_CATEGORIES.slice(0, 3);
  const hiddenCount = LJ_CATEGORIES.length - visible.length;
  const [showAll, setShowAll] = React.useState(false);
  const list = showAll ? LJ_CATEGORIES : visible;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '12px 18px',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
      className="lj-no-scrollbar"
    >
      <Chip
        label="전체"
        active={selected === 'all'}
        onClick={() => onChange('all')}
      />
      {list.map((c) => {
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
      {!showAll && hiddenCount > 0 && (
        <Chip label={`+${hiddenCount}`} active={false} onClick={() => setShowAll(true)} />
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

export default CategoryFilter;

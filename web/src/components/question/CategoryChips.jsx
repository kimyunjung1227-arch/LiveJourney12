import React from 'react';
import {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';

export const QUESTION_CATEGORIES = [
  { id: 'all', label: '전체', Icon: null },
  { id: 'nature', label: '개화·자연', Icon: IconFlower },
  { id: 'weather', label: '날씨·체감', Icon: IconCloud },
  { id: 'event', label: '이벤트·축제', Icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', Icon: IconUsers },
  { id: 'sunset', label: '노을·야경', Icon: IconMoon },
  { id: 'business', label: '영업·운영', Icon: IconBuildingStore },
];

export default function CategoryChips({ selected, onChange, hideAll = false }) {
  const items = hideAll ? QUESTION_CATEGORIES.filter((c) => c.id !== 'all') : QUESTION_CATEGORIES;

  return (
    <div
      className="flex gap-1.5 overflow-x-auto scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {items.map((cat) => {
        const isActive = selected === cat.id;
        const Icon = cat.Icon;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className="whitespace-nowrap flex items-center gap-1 flex-shrink-0"
            style={{
              padding: '6px 14px',
              borderRadius: 18,
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
              background: isActive ? '#4DB8E8' : '#F5F7FA',
              color: isActive ? 'white' : '#1F1F1F',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {Icon && <Icon size={11} />}
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

import React from 'react';
import {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import { useHorizontalDragScroll } from '../../hooks/useHorizontalDragScroll';

export const QUESTION_CATEGORIES = [
  { id: 'all', label: '전체', Icon: null },
  { id: 'nature', label: '개화·자연', Icon: IconFlower },
  { id: 'weather', label: '날씨·체감', Icon: IconCloud },
  { id: 'event', label: '이벤트·축제', Icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', Icon: IconUsers },
  { id: 'sunset', label: '노을·야경', Icon: IconMoon },
  { id: 'business', label: '영업·운영', Icon: IconBuildingStore },
];

export default function CategoryChips({ selected, onChange, hideAll = false, bleed = 18 }) {
  const items = hideAll ? QUESTION_CATEGORIES.filter((c) => c.id !== 'all') : QUESTION_CATEGORIES;
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();

  // 드래그 직후 칩 클릭으로 잘못 발화되는 걸 막는 가드
  const guardedClick = (id) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onChange(id);
  };

  return (
    <div
      onMouseDown={handleDragStart}
      style={{
        // 부모 좌우 패딩을 벗어나 화면 끝까지 스크롤되게 (bleed = 부모 padding 값)
        marginLeft: -bleed,
        marginRight: -bleed,
        paddingLeft: bleed,
        paddingRight: bleed,
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 6,
        overflowX: 'auto',
        overflowY: 'hidden',
        // 가로 스와이프 제스처에 우선권 — 모바일에서 세로 스크롤에 먹히지 않게
        touchAction: 'pan-x',
        WebkitOverflowScrolling: 'touch',
        // 스크롤바 시각적 숨김 (Webkit + Firefox)
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        cursor: 'grab',
      }}
      className="hide-scrollbar"
    >
      {items.map((cat) => {
        const isActive = selected === cat.id;
        const Icon = cat.Icon;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={guardedClick(cat.id)}
            style={{
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
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

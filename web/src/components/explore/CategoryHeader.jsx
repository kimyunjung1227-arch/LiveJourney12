import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconSearch,
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';

const CATEGORY_META = {
  nature: { icon: IconFlower, label: '개화·자연' },
  weather: { icon: IconCloud, label: '날씨·체감' },
  event: { icon: IconCalendarEvent, label: '이벤트·축제' },
  crowd: { icon: IconUsers, label: '혼잡도·대기' },
  sunset: { icon: IconMoon, label: '노을·야경' },
  business: { icon: IconBuildingStore, label: '영업·운영' },
};

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

export default function CategoryHeader({ category }) {
  const navigate = useNavigate();
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <div
      style={{
        height: 52,
        padding: '0 12px',
        borderBottom: `1px solid ${BORDER_LIGHT}`,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로가기"
        style={{
          width: 36,
          height: 36,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconArrowLeft size={22} color={TEXT_PRIMARY} />
      </button>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        <Icon size={18} color={TEXT_PRIMARY} stroke={1.8} />
        <span style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}>
          {meta.label}
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/search?context=category&category=${encodeURIComponent(category)}`)}
        aria-label="검색"
        style={{
          width: 36,
          height: 36,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconSearch size={20} color={TEXT_SECONDARY} />
      </button>
    </div>
  );
}

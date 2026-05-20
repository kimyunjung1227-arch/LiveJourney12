import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconSearch } from '@tabler/icons-react';

const CITY_GRADIENTS = {
  서울: ['#FFB6C1', '#FF8FAB'],
  부산: ['#87CEEB', '#4DB8E8'],
  제주: ['#FFD89B', '#FFA07A'],
  강릉: ['#B0E0E6', '#87CEEB'],
  경주: ['#FF9FB8', '#E07A99'],
  전주: ['#FFE0B0', '#FFC78B'],
  대구: ['#FFC1B6', '#FF8F73'],
  인천: ['#A0D8EF', '#4DB8E8'],
  구미: ['#C8E6C9', '#7CB97F'],
  여수: ['#B3E5FC', '#4DB8E8'],
};
const DEFAULT_GRADIENT = ['#87CEEB', '#4DB8E8'];

const KEY = '#4DB8E8';

export default function CityHero({ cityName, liveCount }) {
  const navigate = useNavigate();
  const [start, end] = CITY_GRADIENTS[cityName] || DEFAULT_GRADIENT;

  return (
    <div
      className="relative"
      style={{
        height: 150,
        background: `linear-gradient(135deg, ${start}, ${end})`,
      }}
    >
      <div className="absolute left-3.5 right-3.5 flex items-center justify-between" style={{ top: 14 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <IconArrowLeft size={20} color="white" />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/search?context=city&city=${encodeURIComponent(cityName)}`)}
          aria-label="검색"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <IconSearch size={18} color="white" />
        </button>
      </div>

      <div className="absolute left-4 right-4" style={{ bottom: 16 }}>
        <div className="flex items-center gap-2">
          <h1
            className="m-0"
            style={{ fontSize: 26, fontWeight: 700, color: 'white', letterSpacing: -0.4 }}
          >
            {cityName}
          </h1>
          <div
            className="inline-flex items-center gap-1.5"
            style={{
              padding: '4px 10px',
              borderRadius: 7,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                background: KEY,
                borderRadius: 999,
                boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.4)',
              }}
            />
            <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
              {liveCount || 0}장 라이브
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

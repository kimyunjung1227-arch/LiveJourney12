import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconSearch } from '@tabler/icons-react';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const KEY_LIGHT = '#E8F4FB';
const TEXT_PRIMARY = '#1F1F1F';

// 큰 배너(메인 사진) 없이 상단에 도시명 문구 + 라이브 수만 노출하는 컴팩트 헤더
export default function CityHero({ cityName, liveCount }) {
  const navigate = useNavigate();

  return (
    <div
      className="sticky top-0 z-20 flex items-center bg-white"
      style={{ height: 56, padding: '0 6px', borderBottom: '1px solid #F0F0F0' }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로가기"
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 40, height: 40, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <IconArrowLeft size={22} color={TEXT_PRIMARY} />
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0" style={{ paddingLeft: 2 }}>
        <h1
          className="m-0 truncate"
          style={{ fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}
        >
          {cityName}
        </h1>
        <div
          className="inline-flex items-center gap-1.5 flex-shrink-0"
          style={{ padding: '3px 9px', borderRadius: 7, background: KEY_LIGHT }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              background: KEY,
              borderRadius: 999,
              boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.25)',
            }}
          />
          <span style={{ fontSize: 11, color: KEY_DARK, fontWeight: 600 }}>
            {liveCount || 0}장 라이브
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/search?context=city&city=${encodeURIComponent(cityName)}`)}
        aria-label="검색"
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 40, height: 40, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <IconSearch size={20} color={TEXT_PRIMARY} />
      </button>
    </div>
  );
}

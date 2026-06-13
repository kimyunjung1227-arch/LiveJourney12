import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';

const TEXT_PRIMARY = '#1F1F1F';

// 큰 배너(메인 사진) 없이 상단에 도시명 문구만 노출하는 컴팩트 헤더
export default function CityHero({ cityName }) {
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

      <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: 2 }}>
        <h1
          className="m-0 truncate"
          style={{ fontSize: 19, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}
        >
          {cityName}
        </h1>
      </div>
    </div>
  );
}

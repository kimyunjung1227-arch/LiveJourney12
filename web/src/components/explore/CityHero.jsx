import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { getWeatherByRegion } from '../../api/weather';
import WeatherIcon from '../WeatherIcon';

const TEXT_PRIMARY = '#1F1F1F';

// 큰 배너(메인 사진) 없이 상단에 도시명 문구만 노출하는 컴팩트 헤더
export default function CityHero({ cityName }) {
  const navigate = useNavigate();
  const [weather, setWeather] = useState({ icon: '☀️', temperature: '', condition: '' });

  // 도시명 옆 실시간 기온 — 기상청 초단기실황
  useEffect(() => {
    const region = (cityName || '').trim();
    if (!region) return undefined;
    let alive = true;
    getWeatherByRegion(region)
      .then((res) => {
        if (!alive || !res?.weather) return;
        setWeather({
          icon: res.weather.icon,
          temperature: res.weather.temperature,
          condition: res.weather.condition,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cityName]);

  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-center bg-white"
      style={{ height: 56, padding: '0 6px', borderBottom: '1px solid #F0F0F0' }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="뒤로가기"
        className="flex items-center justify-center"
        style={{
          position: 'absolute',
          left: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 40,
          height: 40,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <IconArrowLeft size={22} color={TEXT_PRIMARY} />
      </button>

      <h1
        className="m-0 truncate"
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: TEXT_PRIMARY,
          letterSpacing: -0.2,
          padding: '0 92px',
        }}
      >
        {cityName}
      </h1>

      {/* 실시간 기온 — 헤더 우측 정렬 */}
      {weather.temperature && weather.temperature !== '-' && (
        <span
          title={weather.condition}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#F1F5F9',
            borderRadius: 999,
            padding: '3px 9px',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          <WeatherIcon icon={weather.icon} condition={weather.condition} size={15} />
          <span style={{ color: '#334155' }}>{weather.temperature}</span>
        </span>
      )}
    </div>
  );
}

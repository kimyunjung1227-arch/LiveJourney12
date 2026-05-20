import React from 'react';
import {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';

const CATEGORY_ICON = {
  nature: IconFlower,
  weather: IconCloud,
  event: IconCalendarEvent,
  crowd: IconUsers,
  sunset: IconMoon,
  business: IconBuildingStore,
};
const CATEGORY_LABEL = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const KEY_LIGHT = '#E8F4FB';
const TEXT_TERTIARY = '#B8B8B8';

const LEVEL_CONFIG = {
  quiet: { label: '조용해요', bars: 1, barColor: TEXT_TERTIARY, isGradient: false, badgeColor: TEXT_TERTIARY },
  some: { label: '제보 있음', bars: 3, barColor: '#A8D8F0', isGradient: false, badgeColor: KEY_DARK },
  active: { label: '활발해요', bars: 6, barColor: KEY, isGradient: false, badgeColor: KEY_DARK },
  hot: { label: '지금 핫해요 🔥', bars: 8, barColor: '', isGradient: true, badgeColor: KEY_DARK },
};

/**
 * 카테고리 활동 지표 모듈.
 */
export default function ActivityModule({ category, activity }) {
  const Icon = CATEGORY_ICON[category];
  const label = CATEGORY_LABEL[category] || category;
  const level = activity?.level || 'quiet';
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.quiet;

  return (
    <div style={{ background: KEY_LIGHT, padding: '16px 18px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={15} color={KEY} stroke={2} />}
          <span style={{ fontSize: 12, fontWeight: 700, color: KEY_DARK }}>
            지금 {label}
          </span>
        </div>
        {config.isGradient ? (
          <span
            style={{
              fontSize: 10,
              padding: '3px 9px',
              borderRadius: 6,
              fontWeight: 700,
              color: 'white',
              background: 'linear-gradient(135deg, #4DB8E8, #1A6EA8)',
            }}
          >
            {config.label}
          </span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: config.badgeColor }}>
            {config.label}
          </span>
        )}
      </div>

      <div className="flex items-center" style={{ gap: 10, marginBottom: 6 }}>
        <div className="flex flex-1" style={{ gap: 4 }}>
          {Array.from({ length: 8 }).map((_, i) => {
            const filled = i < config.bars;
            return (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: 8,
                  borderRadius: 2,
                  background: filled
                    ? config.isGradient
                      ? 'linear-gradient(90deg, #4DB8E8, #1A6EA8)'
                      : config.barColor
                    : '#FFFFFF',
                }}
              />
            );
          })}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: KEY_DARK,
            flexShrink: 0,
          }}
        >
          최근 1시간 {activity?.recent_hour || 0}장
        </span>
      </div>

      <p className="m-0" style={{ fontSize: 11, color: '#4A7DA8' }}>
        오늘 {activity?.today || 0}장 제보
      </p>
    </div>
  );
}

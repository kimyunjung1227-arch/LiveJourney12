import React from 'react';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

const TABS = [
  { id: 'all', label: '전체 활동' },
  { id: 'city', label: '지역별' },
  { id: 'map', label: '여행 지도' },
];

/**
 * 프로필 탭. 활성 탭 하단에 키컬러 보더.
 */
export default function ProfileTabs({ value, onChange }) {
  return (
    <div
      className="flex items-stretch"
      style={{
        borderBottom: `1px solid ${BORDER_LIGHT}`,
        marginBottom: 18,
      }}
    >
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex-1"
            style={{
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: active ? `2px solid ${KEY}` : '2px solid transparent',
              marginBottom: -1,
              color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

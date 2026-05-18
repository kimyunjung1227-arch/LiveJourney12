import React from 'react';
import { IconFlame } from '@tabler/icons-react';
import { LJ } from './tokens';

/**
 * 장소 페이지 상단 상태 박스 (#E8F4FB 배경).
 * 좌: 라이브 점 + 활동 텍스트, 우: HOT 뱃지(검정)
 */
export function PlaceStatusBox({ recentCount = 0, viewingCount = 0, hot = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 18px',
        background: LJ.keyBgLight,
        fontFamily: LJ.fontStack,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: LJ.key,
              boxShadow: '0 0 0 4px rgba(77,184,232,0.2)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: LJ.keyTextDark }}>
            지금 활동 활발
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: LJ.keyTextDark, opacity: 0.85 }}>
          최근 6시간 {recentCount}장
          {viewingCount > 0 ? ` · ${viewingCount}명이 보는 중` : ''}
        </div>
      </div>
      {hot && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 11px',
            background: '#1F1F1F',
            borderRadius: 7,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          <IconFlame size={12} stroke={2} color={LJ.key} />
          HOT
        </div>
      )}
    </div>
  );
}

export default PlaceStatusBox;

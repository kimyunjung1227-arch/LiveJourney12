import React from 'react';
import { IconCamera, IconChevronRight } from '@tabler/icons-react';
import { LJ } from './tokens';

/**
 * 장소 페이지 하단 CTA — "여기 계신가요?"
 */
export function PlaceCTA({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 'calc(100% - 36px)',
        margin: '18px',
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: LJ.keyBgLight,
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: LJ.fontStack,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          borderRadius: 10,
          background: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: LJ.key,
        }}
      >
        <IconCamera size={20} stroke={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: LJ.keyTextDark }}>
          여기 계신가요?
        </div>
        <div style={{ fontSize: 11, color: LJ.keyTextDark, opacity: 0.85, marginTop: 2 }}>
          당신의 한 장이 새 베스트 컷이 될 수도
        </div>
      </div>
      <IconChevronRight size={18} stroke={1.8} color={LJ.keyTextDark} />
    </button>
  );
}

export default PlaceCTA;

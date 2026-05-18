import React, { useEffect, useRef, useState } from 'react';
import { IconDots, IconShare3, IconFlag } from '@tabler/icons-react';
import { LJ } from './tokens';

/**
 * 점 세개 메뉴: 공유 / 신고.
 * - 외부 클릭 닫힘, 상위로 이벤트 전파 차단
 */
export function MoreMenuDropdown({ postId, onShare, onReport, size = 18 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handle = (action) => {
    setOpen(false);
    if (action === 'share' && onShare) return onShare(postId);
    if (action === 'report' && onReport) return onReport(postId);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="더보기"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 6,
          borderRadius: 6,
          color: LJ.textSecondary,
          cursor: 'pointer',
          display: 'inline-flex',
        }}
      >
        <IconDots size={size} stroke={1.8} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            minWidth: 140,
            background: '#fff',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 6,
            zIndex: 20,
          }}
        >
          <MenuItem
            icon={<IconShare3 size={15} stroke={1.8} />}
            label="공유"
            onClick={() => handle('share')}
          />
          <MenuItem
            icon={<IconFlag size={15} stroke={1.8} />}
            label="신고"
            onClick={() => handle('report')}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger ? LJ.error : LJ.textPrimary,
        fontFamily: LJ.fontStack,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = LJ.bgSurface)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  );
}

export default MoreMenuDropdown;

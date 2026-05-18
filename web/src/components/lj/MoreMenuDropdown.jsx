import React, { useEffect, useRef, useState } from 'react';
import { IconDots, IconShare3, IconFlag, IconEdit, IconTrash } from '@tabler/icons-react';
import { LJ } from './tokens';

/**
 * 점 세개 메뉴.
 * - 작성자: 수정 / 삭제 / 공유
 * - 비작성자: 공유 / 신고
 */
export function MoreMenuDropdown({
  postId,
  isAuthor = false,
  onShare,
  onReport,
  onEdit,
  onDelete,
  size = 18,
}) {
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
    if (action === 'edit' && onEdit) return onEdit(postId);
    if (action === 'delete' && onDelete) return onDelete(postId);
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
          width: 32,
          height: 32,
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 8,
          color: LJ.textSecondary,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
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
          {isAuthor ? (
            <>
              <MenuItem
                icon={<IconEdit size={15} stroke={1.8} />}
                label="수정"
                onClick={() => handle('edit')}
              />
              <MenuItem
                icon={<IconTrash size={15} stroke={1.8} />}
                label="삭제"
                onClick={() => handle('delete')}
                danger
              />
              <MenuItem
                icon={<IconShare3 size={15} stroke={1.8} />}
                label="공유"
                onClick={() => handle('share')}
              />
            </>
          ) : (
            <>
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
            </>
          )}
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

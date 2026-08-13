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
  // 위로 펼칠지 아래로 펼칠지 — 버튼이 화면 어디에 있느냐에 따라 매번 다시 정한다
  const [dropUp, setDropUp] = useState(true);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  // 메뉴 높이 어림값 (항목은 전역 button min-height 44px + 패딩 12px)
  const menuHeight = (isAuthor ? 3 : 2) * 44 + 12;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    // 터치 기기에서는 mousedown 이 늦게(또는 안) 오므로 touchstart 도 함께 본다
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      // 상단 헤더처럼 위쪽 공간이 없는 자리에서는 위로 펼치면 화면 밖으로 나가
      // 눌러도 아무 일도 안 일어난 것처럼 보인다 → 그럴 땐 아래로 펼친다
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropUp(rect.top >= menuHeight + 12);
    }
    setOpen((v) => !v);
  };

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
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label="더보기"
        aria-haspopup="menu"
        aria-expanded={open}
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
        <IconDots size={size} stroke={2} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            // 기본은 위로(카드 액션바에서 아래로 펼치면 다음 카드에 가린다).
            // 위쪽 공간이 부족하면(예: 게시물 상세 상단 헤더) 아래로 펼친다.
            position: 'absolute',
            ...(dropUp
              ? { bottom: '100%', marginBottom: 6 }
              : { top: '100%', marginTop: 6 }),
            right: 0,
            minWidth: 140,
            background: '#fff',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 6,
            zIndex: 50,
          }}
        >
          {isAuthor ? (
            <>
              <MenuItem
                icon={<IconEdit size={15} stroke={2} />}
                label="수정"
                onClick={() => handle('edit')}
              />
              <MenuItem
                icon={<IconTrash size={15} stroke={2} />}
                label="삭제"
                onClick={() => handle('delete')}
                danger
              />
              <MenuItem
                icon={<IconShare3 size={15} stroke={2} />}
                label="공유"
                onClick={() => handle('share')}
              />
            </>
          ) : (
            <>
              <MenuItem
                icon={<IconShare3 size={15} stroke={2} />}
                label="공유"
                onClick={() => handle('share')}
              />
              <MenuItem
                icon={<IconFlag size={15} stroke={2} />}
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

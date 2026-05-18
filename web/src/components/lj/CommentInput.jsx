import React, { useState, useRef, useEffect } from 'react';
import { IconX, IconSend2 } from '@tabler/icons-react';
import { LJ } from './tokens';

/**
 * 하단 고정 댓글 입력창. 답글 모드면 상단에 "@닉네임에게 답글" + X.
 */
export function CommentInput({ replyingTo, onCancelReply, onSubmit, disabled = false }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.({ body: trimmed, parent_id: replyingTo?.id || null });
    setValue('');
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: `1px solid ${LJ.borderLight}`,
        fontFamily: LJ.fontStack,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.04)',
        zIndex: 10,
      }}
    >
      {replyingTo && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 18px',
            background: LJ.keyBgLight,
            fontSize: 12,
            color: LJ.keyTextDark,
            fontWeight: 600,
          }}
        >
          <span>@{replyingTo.author?.nickname || '익명'}님에게 답글</span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="답글 취소"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: LJ.keyTextDark,
              display: 'inline-flex',
            }}
          >
            <IconX size={15} stroke={2} />
          </button>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={replyingTo ? '답글 남기기' : '댓글 남기기'}
          disabled={disabled}
          style={{
            flex: 1,
            minHeight: 38,
            padding: '8px 14px',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 999,
            background: LJ.bgSurface,
            fontFamily: LJ.fontStack,
            fontSize: 13,
            color: LJ.textPrimary,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="등록"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: 'none',
            background: value.trim() ? LJ.key : LJ.borderLight,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: value.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <IconSend2 size={16} stroke={2} />
        </button>
      </form>
    </div>
  );
}

export default CommentInput;

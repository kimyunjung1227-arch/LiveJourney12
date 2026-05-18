import React, { useState, useRef, useEffect } from 'react';
import { IconX } from '@tabler/icons-react';
import { LJ } from './tokens';

/**
 * 하단 고정 댓글 입력창.
 * - 기본 상태: 인풋만 (전송 버튼 없음)
 * - 사용자가 글자 입력 시작 → 우측에 [취소] [작성] 두 버튼 노출
 * - 답글 모드: 인풋 위에 "@닉네임에게 답글" + X 표시 (기존과 동일)
 */
export function CommentInput({ replyingTo, onCancelReply, onSubmit, disabled = false }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const hasContent = value.trim().length > 0;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.({ body: trimmed, parent_id: replyingTo?.id || null });
    setValue('');
  };

  const handleCancel = () => {
    setValue('');
    onCancelReply?.();
    inputRef.current?.blur();
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
        {hasContent && (
          <>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: 999,
                background: 'transparent',
                color: LJ.textSecondary,
                fontFamily: LJ.fontStack,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={disabled}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderRadius: 999,
                background: LJ.key,
                color: '#fff',
                fontFamily: LJ.fontStack,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              작성
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default CommentInput;

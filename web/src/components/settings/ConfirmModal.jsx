import React from 'react';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SURFACE = '#F5F7FA';
const DANGER = '#E05555';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        padding: '0 32px',
      }}
      onClick={onCancel}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 300,
          background: '#fff',
          borderRadius: 16,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p
          className="m-0"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            marginBottom: 8,
          }}
        >
          {title}
        </p>
        <p
          className="m-0"
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {message}
        </p>
        <div className="flex" style={{ gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1"
            style={{
              padding: '12px 0',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              background: SURFACE,
              color: TEXT_PRIMARY,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1"
            style={{
              padding: '12px 0',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              background: danger ? DANGER : KEY,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

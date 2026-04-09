import React from 'react';
import type { PhotoStatus } from '../hooks/usePhotoValidation';

type Props = {
  status: PhotoStatus;
  className?: string;
};

export default function StatusBadge({ status, className = '' }: Props) {
  if (status === 'NONE') return null;

  if (status === 'LIVE') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${className}`}
        style={{ backgroundColor: '#FF3B30' }}
      >
        <span className="animate-pulse" aria-hidden>
          🔴
        </span>
        <span>현장 LIVE</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${className}`}
      style={{ backgroundColor: '#34C759' }}
    >
      <span aria-hidden>✅</span>
      <span>최근 인증</span>
    </span>
  );
}


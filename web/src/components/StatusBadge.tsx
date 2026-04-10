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
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/5 backdrop-blur ${className}`}
        style={{ backgroundColor: 'rgba(255, 59, 48, 0.92)' }}
      >
        <span className="animate-pulse text-[10px] leading-none" aria-hidden>
          🔴
        </span>
        <span>현장 LIVE</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/5 backdrop-blur ${className}`}
      style={{ backgroundColor: 'rgba(52, 199, 89, 0.92)' }}
    >
      <span className="text-[10px] leading-none" aria-hidden>✅</span>
      <span>최근 인증</span>
    </span>
  );
}


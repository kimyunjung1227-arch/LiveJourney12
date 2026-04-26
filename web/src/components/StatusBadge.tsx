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
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/10 backdrop-blur ${className}`}
        style={{ backgroundColor: '#DC2626' }}
        title="촬영 후 3시간 이내 게시물"
      >
        <span className="animate-pulse text-[10px] leading-none" aria-hidden>
          ●
        </span>
        <span>실시간 촬영</span>
      </span>
    );
  }

  if (status === 'VERIFIED') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-1 ring-black/10 backdrop-blur ${className}`}
        style={{ backgroundColor: '#00BCD4' }}
        title="촬영 후 30시간 이내 게시물"
      >
        <span className="text-[10px] leading-none opacity-95" aria-hidden>
          ✓
        </span>
        <span>30시간 이내 인증</span>
      </span>
    );
  }

  return null;
}


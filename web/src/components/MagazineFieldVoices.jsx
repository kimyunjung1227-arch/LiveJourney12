import React, { memo } from 'react';

/**
 * 매거진 장소별 — 현장 사용자가 올린 사진·짧은 글
 * @param {{ id: string, text: string, author: string, timeLabel: string, thumbUrl?: string }[]} voices
 */
const MagazineFieldVoices = memo(function MagazineFieldVoices({ voices = [], className = '' }) {
  const list = Array.isArray(voices) ? voices.filter((v) => v && String(v.text || '').trim()) : [];
  if (list.length === 0) return null;

  return (
    <div className={className || undefined}>
      <div className="mb-2 flex items-center gap-1.5">
        <span
          className="material-symbols-outlined text-[17px] text-zinc-500 dark:text-zinc-400"
          style={{ fontVariationSettings: '"FILL" 0' }}
          aria-hidden
        >
          photo_camera
        </span>
        <h4 className="m-0 text-[12px] font-bold tracking-tight text-gray-900 dark:text-gray-50">
          지금 현장에서 올라온 기록
        </h4>
      </div>
      <div
        className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mt-1"
        role="list"
        aria-label="현장 기록"
      >
        {list.map((v) => (
          <blockquote
            key={v.id}
            role="listitem"
            className="w-[min(100%,300px)] shrink-0 overflow-hidden rounded-lg border border-zinc-200/90 bg-zinc-50/80 shadow-sm dark:border-zinc-600/80 dark:bg-zinc-900/60"
          >
            {v.thumbUrl ? (
              <div className="aspect-[16/10] w-full bg-zinc-200 dark:bg-zinc-800">
                <img src={v.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ) : null}
            <div className="px-3 py-2.5">
              <p className="m-0 text-[13px] font-medium leading-snug text-gray-800 dark:text-gray-100 line-clamp-4">
                “{v.text}”
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-100 pt-1.5 dark:border-zinc-700/80">
                <span className="min-w-0 truncate text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  {v.author}
                </span>
                {v.timeLabel ? (
                  <span className="shrink-0 text-[10px] font-medium text-gray-400 dark:text-gray-500">{v.timeLabel}</span>
                ) : null}
              </div>
            </div>
          </blockquote>
        ))}
      </div>
    </div>
  );
});

export default MagazineFieldVoices;

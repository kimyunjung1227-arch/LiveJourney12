import React from 'react';

/**
 * 메인 화면 하단용 EXIF 동의 — 전역 모달보다 부담이 적은 시트 UI
 */
export default function ExifConsentSheet({ onGrant, onDecline }) {
  const navOffset = 'calc(64px + env(safe-area-inset-bottom, 0px))';

  return (
    <div
      className="fixed inset-x-0 z-[55] flex justify-center pointer-events-none"
      style={{ bottom: navOffset, maxWidth: 414, marginLeft: 'auto', marginRight: 'auto' }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="exif-consent-sheet-title"
      aria-describedby="exif-consent-sheet-desc"
    >
      <div
        className="pointer-events-auto mx-3 w-full max-w-md rounded-2xl border border-gray-200/90 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 px-4 py-3.5 space-y-3"
        style={{ boxShadow: '0 -4px 24px rgba(15,23,42,0.12)' }}
      >
        <div>
          <h2 id="exif-consent-sheet-title" className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            사진 EXIF(촬영 정보) 활용
          </h2>
          <p id="exif-consent-sheet-desc" className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            촬영 시각·위치 등 메타데이터는 시간 표시·위치 안내·콘텐츠 품질 개선에만 씁니다. 거부해도 업로드는 가능하며, 해당 정보는 읽지 않아요.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            거부
          </button>
          <button
            type="button"
            onClick={onGrant}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-semibold transition-colors"
          >
            동의하기
          </button>
        </div>
      </div>
    </div>
  );
}

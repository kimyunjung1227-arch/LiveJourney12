import React from 'react';

/**
 * 첫 방문 시 사진 메타데이터(EXIF) 활용 동의 — 로컬에서만 저장되며 서버로 전송되지 않습니다.
 */
export default function ExifConsentModal({ onGrant, onDecline }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exif-consent-title"
      aria-describedby="exif-consent-desc"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 id="exif-consent-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          사진 촬영 정보(EXIF) 활용 동의
        </h2>
        <p id="exif-consent-desc" className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          업로드하신 사진에 포함된 메타데이터(촬영 시각, 위치 등)를 읽어, 촬영 시간 표시·위치 안내·콘텐츠
          품질 향상에만 사용합니다. 동의하지 않으면 해당 정보는 읽지 않으며, 사진 업로드는 그대로 가능합니다.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          선택 내용은 이 기기 브라우저에만 저장됩니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            거부
          </button>
          <button
            type="button"
            onClick={onGrant}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-medium transition-colors"
          >
            동의하고 계속하기
          </button>
        </div>
      </div>
    </div>
  );
}

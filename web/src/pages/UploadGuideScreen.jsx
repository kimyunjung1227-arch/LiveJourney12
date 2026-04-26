import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UploadGuideBody from '../components/UploadGuideBody';

const UploadGuideScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location?.state?.returnTo || '/upload';

  return (
    <div className="screen-layout fixed inset-0 z-[300] flex min-h-[100dvh] flex-col bg-background-light dark:bg-background-dark">
      <header className="screen-header shrink-0 flex items-center justify-between gap-2 border-b border-border-light bg-white px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] dark:border-border-dark dark:bg-gray-900">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex size-12 shrink-0 items-center justify-center text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="뒤로가기"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <div className="flex-1 text-center text-base font-bold text-text-primary-light dark:text-text-primary-dark">
          업로드 가이드
        </div>
        <div className="w-12" aria-hidden />
      </header>

      <main className="screen-content min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background-light px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-4 dark:bg-background-dark">
        <div className="mx-auto w-full max-w-[560px]">
          <UploadGuideBody />

          <div className="mt-6 px-1 pb-4">
            <button
              type="button"
              onClick={() => {
                navigate(returnTo, { replace: true, state: { fromUploadGuide: true } });
              }}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
            >
              가이드 확인하고 업로드하기
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              나중에 할게요
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UploadGuideScreen;

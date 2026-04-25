import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UploadGuideBody from '../components/UploadGuideBody';

const UploadGuideScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location?.state?.returnTo || '/upload';

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
      <header className="screen-header sticky top-0 z-[100] flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-white px-4 py-2.5 dark:border-border-dark dark:bg-gray-900">
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

      <main className="screen-content flex-1 overflow-auto px-4 pb-24 pt-4 bg-background-light dark:bg-background-dark">
        <div className="mx-auto w-full max-w-[520px]">
          <UploadGuideBody />

          <div className="mt-6 px-1">
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

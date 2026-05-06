import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';

const WelcomeScreen = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('🏠 LiveJourney 시작화면 표시');
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [navigate]);


  return (
    <div className="min-h-[100dvh] w-full bg-white dark:bg-zinc-900 font-display">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.06em] text-black dark:text-white">
          라이브저니
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
          여행지의 <span className="font-bold text-gray-900 dark:text-white">지금</span> 날씨·현장·인파를 실시간 제보로 확인하는 여행 커뮤니티.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200">
            <div className="font-extrabold text-gray-900 dark:text-white">실시간 핫플</div>
            <div className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              급상승 장소와 현장 분위기를 빠르게 확인해요.
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200">
            <div className="font-extrabold text-gray-900 dark:text-white">지도</div>
            <div className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              핀·사진으로 주변 상황을 한눈에 봐요.
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200">
            <div className="font-extrabold text-gray-900 dark:text-white">검색</div>
            <div className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              장소/해시태그별 최신 제보를 탐색해요.
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/main')}
            className="rounded-full bg-gray-900 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-black active:bg-black/90"
          >
            바로 시작하기
          </button>
          <button
            type="button"
            onClick={() => navigate('/realtime-feed')}
            className="rounded-full bg-blue-50 px-5 py-3 text-sm font-extrabold text-gray-900 shadow-sm hover:bg-blue-100 active:bg-blue-200 dark:bg-blue-950/40 dark:text-white dark:hover:bg-blue-950/60"
          >
            실시간 피드
          </button>
          <button
            type="button"
            onClick={() => navigate('/map')}
            className="rounded-full bg-cyan-50 px-5 py-3 text-sm font-extrabold text-gray-900 shadow-sm hover:bg-cyan-100 active:bg-cyan-200 dark:bg-cyan-950/40 dark:text-white dark:hover:bg-cyan-950/60"
          >
            지도 보기
          </button>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="rounded-full bg-gray-100 px-5 py-3 text-sm font-extrabold text-gray-900 shadow-sm hover:bg-gray-200 active:bg-gray-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
          >
            검색
          </button>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          검색엔진/크롤러가 내용을 잘 수집할 수 있도록 이 페이지는 소개 텍스트를 포함합니다.
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;


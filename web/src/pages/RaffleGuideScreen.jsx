import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RAFFLE_GUIDE_ITEMS } from '../data/raffleGuideItems';

const RaffleGuideScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh] flex flex-col">
      <header className="screen-header sticky top-0 z-[100] flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-white px-2 py-2 dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => navigate('/raffle')}
          className="flex size-12 shrink-0 items-center justify-center rounded-lg text-text-primary-light transition-colors hover:bg-gray-100 dark:text-text-primary-dark dark:hover:bg-gray-800"
          aria-label="래플로 돌아가기"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h1 className="flex-1 pr-12 text-center text-base font-bold text-text-primary-light dark:text-text-primary-dark">
          래플 가이드 (참여 방법)
        </h1>
      </header>

      <main className="screen-content flex-1 overflow-y-auto px-4 pb-10 pt-4 bg-background-light dark:bg-background-dark">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80">
            <div className="space-y-5 px-4 py-5">
              {RAFFLE_GUIDE_ITEMS.map((g, idx) => (
                <section key={g.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{g.title}</h2>
                    {idx === 0 && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        전체 안내
                      </span>
                    )}
                  </div>
                  <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {g.body}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/raffle')}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
          >
            래플 화면으로
          </button>
        </div>
      </main>
    </div>
  );
};

export default RaffleGuideScreen;

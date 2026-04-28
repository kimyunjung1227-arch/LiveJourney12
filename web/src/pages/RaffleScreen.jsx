import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { fetchRafflesForUi } from '../api/rafflesSupabase';

const INITIAL_COUNT = 3;

/** 진행 예정 래플: 작은 카드(사진+제목) 4개/1줄 + 가로 스크롤 */
function ScheduledRaffleStrip({ loading, list, emptyText }) {
  if (loading) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        불러오는 중...
      </p>
    );
  }
  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {emptyText}
      </p>
    );
  }

  return (
    <div
      className="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {list.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled
          className="box-border shrink-0 snap-start text-left"
          style={{
            width: 'calc((100% - 24px) / 4)', // gap(8px)*3 = 24px
            minWidth: 76,
          }}
          aria-label="진행 예정 래플"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800" style={{ borderRadius: 8 }}>
            <img
              src={item.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              style={{ borderRadius: 8 }}
            />
          </div>
          <div className="mt-1.5 text-[11px] font-bold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2">
            {item.title}
          </div>
        </button>
      ))}
    </div>
  );
}

/** 진행 예정·진행 중 공통 카드 (가로 스와이프) */
function OngoingStyleRaffleBlock({ loading, list, emptyText, ctaMode }) {
  if (loading) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        불러오는 중...
      </p>
    );
  }
  if (list.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {emptyText}
      </p>
    );
  }
  const isScheduled = ctaMode === 'scheduled';
  return (
    <div className="relative">
      <div
        className="flex w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {list.map((item) => (
          <div
            key={item.id}
            className="box-border w-full shrink-0 snap-center px-0"
            style={{ flex: '0 0 100%' }}
          >
            <div className="mx-auto flex max-w-[280px] flex-col gap-2.5 sm:max-w-[320px]">
              <div className="relative w-full overflow-hidden rounded-md border border-gray-200/90 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                <div className="relative aspect-[3/4] max-h-[min(36vh,232px)] w-full">
                  <img
                    src={item.image}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-md object-cover"
                  />
                </div>
                <div className="absolute top-2.5 right-2.5 z-[1]">
                  <span className="inline-block rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-sm backdrop-blur-sm dark:bg-gray-800/95 dark:text-sky-200">
                    {item.daysLeft}
                  </span>
                </div>
              </div>
              <div className="px-0.5">
                <h3 className="text-[15px] font-bold leading-snug text-gray-900 dark:text-gray-100 sm:text-base">
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 sm:text-sm"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}
                >
                  {item.desc}
                </p>
              </div>
              {isScheduled ? (
                <button
                  type="button"
                  disabled
                  className="w-full shrink-0 cursor-not-allowed rounded-xl bg-gray-200 py-2.5 text-sm font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                >
                  오픈 예정
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98] dark:from-[#00a8cc] dark:to-[#00bdfd]"
                >
                  응모하기
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RaffleScreen = () => {
  const navigate = useNavigate();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduledList, setScheduledList] = useState([]);
  const [ongoingList, setOngoingList] = useState([]);
  const [completedSource, setCompletedSource] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { scheduled, ongoing, completed } = await fetchRafflesForUi();
      if (cancelled) return;
      setScheduledList(scheduled);
      setOngoingList(ongoing);
      setCompletedSource(completed);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completedList = useMemo(
    () => (completedExpanded ? completedSource : completedSource.slice(0, INITIAL_COUNT)),
    [completedExpanded, completedSource]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
      <div className="screen-content">
        <header className="screen-header flex items-center justify-between gap-2 bg-white dark:bg-gray-900 px-2 border-b border-gray-100 dark:border-gray-800">
          <BackButton onClick={() => navigate('/main')} ariaLabel="홈으로" />
          <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark flex-1 text-center pr-10">
            래플
          </h1>
        </header>

        <div className="screen-body pb-6">
          <section className="relative w-full overflow-hidden">
            <div className="relative w-full min-h-[88px] max-h-[min(28vh,176px)] aspect-[5/2] sm:aspect-[21/9] sm:max-h-[min(30vh,192px)] bg-gradient-to-br from-sky-700 via-cyan-800 to-slate-900" />
          </section>

          <div className="px-3 pt-3 space-y-4 text-[14px] sm:px-4 sm:text-[15px]">
            <section>
              <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 sm:text-base">
                래플은 실시간으로 업로드한 여행 기록이 쌓일수록 응모 기회가 늘어나고, 그 결과가 리워드로 돌아오는 이벤트예요.
                참여 방법과 당첨 안내는 아래 문서에서 한 번에 확인할 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => navigate('/raffle/guide')}
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:hover:bg-gray-900"
              >
                <span className="material-symbols-outlined text-[18px] text-sky-500" aria-hidden>
                  description
                </span>
                <span>래플 가이드 (참여 방법)</span>
                <span className="material-symbols-outlined ml-0.5 text-[18px] text-sky-400" aria-hidden>
                  chevron_right
                </span>
              </button>
            </section>

            <section aria-roledescription="carousel" aria-label="진행 예정 래플">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:text-[15px]">
                진행 예정 래플
              </h2>
              <ScheduledRaffleStrip
                loading={loading}
                list={scheduledList}
                emptyText="진행 예정인 래플이 없습니다."
              />
            </section>

            <section aria-roledescription="carousel" aria-label="진행 중인 래플">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:text-[15px]">
                진행 중 래플
              </h2>
              <OngoingStyleRaffleBlock
                loading={loading}
                list={ongoingList}
                emptyText="진행 중인 래플이 없습니다."
                ctaMode="ongoing"
              />
            </section>

            <section className="pb-6">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:text-[15px]">
                  완료된 래플
                </h2>
                {!loading && completedSource.length > INITIAL_COUNT && (
                  <button
                    type="button"
                    onClick={() => setCompletedExpanded((v) => !v)}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    {completedExpanded ? '접기' : '더보기'}
                  </button>
                )}
              </div>
              {loading ? (
                <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  불러오는 중...
                </p>
              ) : completedSource.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  완료된 래플이 없습니다.
                </p>
              ) : (
                <ul className="flex flex-col gap-0 divide-y divide-gray-100 dark:divide-gray-800">
                  {completedList.map((row) => (
                    <li key={row.id} className="flex gap-3 py-3 first:pt-0">
                      <div className="h-[3.5rem] w-[3.5rem] shrink-0 overflow-hidden rounded-md border border-gray-200/80 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                        <img src={row.image} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="relative min-w-0 flex-1 pr-[4.25rem]">
                        <h3 className="text-sm font-bold leading-tight text-gray-900 dark:text-gray-100 sm:text-[15px]">
                          {row.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:text-[13px]">
                          {row.category}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-gray-400 dark:text-gray-500 sm:text-[13px]">
                          {row.statusMessage}
                        </p>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-0.5 text-sm font-bold text-gray-900 dark:text-gray-100 sm:text-[15px]"
                        >
                          당첨 리뷰
                          <span className="material-symbols-outlined text-lg" aria-hidden>
                            chevron_right
                          </span>
                        </button>
                        <span className="absolute right-0 top-0 inline-flex rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400">
                          {row.badge}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default RaffleScreen;

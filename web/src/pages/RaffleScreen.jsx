import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { fetchRafflesForUi } from '../api/rafflesSupabase';

const GUIDE_ITEMS = [
  {
    id: 'how',
    title: '참여 방법',
    body:
      '래플 카드의 「응모하기」를 누르면 참여가 완료됩니다. 로그인이 필요할 수 있으며, 이벤트마다 응모 조건·기간이 다를 수 있으니 카드 하단 설명을 꼭 확인해 주세요.',
  },
  {
    id: 'fair',
    title: '공정한 추첨',
    body:
      '당첨자 선정은 라이브저니 이벤트 운영 정책에 따라 진행됩니다. 부정 응모·중복 계정은 제외될 수 있습니다.',
  },
  {
    id: 'notice',
    title: '꼭 확인해 주세요',
    body:
      '경품 수령을 위해 연락처·배송지 정보가 정확해야 합니다. 미성년자·해외 거주자 등 일부 이벤트는 참여 대상이 제한될 수 있습니다. 세부 내용은 각 래플 상세 및 공지사항을 참고해 주세요.',
  },
  {
    id: 'support',
    title: '문의하기',
    body:
      '설정의 「문의하기」 또는 고객센터를 통해 래플 관련 문의를 남겨 주세요. 이벤트명과 응모 일시를 함께 적어 주시면 더 빠르게 도와드릴 수 있습니다.',
  },
];

const INITIAL_COUNT = 3;

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
            <div className="mx-auto flex max-w-[300px] flex-col gap-3 sm:max-w-sm">
              <div className="relative w-full overflow-hidden rounded-sm border border-gray-200/90 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                <div className="relative aspect-[3/4] max-h-[min(40vh,260px)] w-full">
                  <img
                    src={item.image}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-sm object-cover"
                  />
                </div>
                <div className="absolute top-2.5 right-2.5 z-[1]">
                  <span className="inline-block rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-sky-800 shadow-sm backdrop-blur-sm dark:bg-gray-800/95 dark:text-sky-200">
                    {item.daysLeft}
                  </span>
                </div>
              </div>
              <div className="px-0.5">
                <h3 className="text-base font-bold leading-snug text-gray-900 dark:text-gray-100 sm:text-[17px]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400 sm:text-[15px]">
                  {item.desc}
                </p>
              </div>
              {isScheduled ? (
                <button
                  type="button"
                  disabled
                  className="w-full shrink-0 cursor-not-allowed rounded-xl bg-gray-200 py-3 text-sm font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400 sm:text-[15px]"
                >
                  오픈 예정
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98] dark:from-[#00a8cc] dark:to-[#00bdfd] sm:text-[15px]"
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

          <div className="px-3 pt-3 space-y-5 text-[15px] sm:px-4 sm:pt-4 sm:text-base">
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:text-[15px]">
                라이브저니의 래플
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark sm:text-[15px]">
                라이브저니 래플은 지금 이 순간의 여행 정보를 나누는 커뮤니티를 위한 이벤트입니다. 라이브저니
                래플을 통해 지금 이 순간의 생생한 기록이 행운으로 돌아오는 즐거움을 경험하고, 더 가치 있는
                여행의 주인공이 되어보세요.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:text-[15px]">
                라이브저니 래플 가이드
              </h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {GUIDE_ITEMS.map((g) => (
                    <details key={g.id} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
                        <span>{g.title}</span>
                        <span
                          className="material-symbols-outlined shrink-0 text-xl text-gray-500 transition-transform group-open:rotate-180 dark:text-gray-400"
                          aria-hidden
                        >
                          expand_more
                        </span>
                      </summary>
                      <div className="border-t border-gray-100 bg-gray-50/80 px-3 py-3 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300">
                        {g.body}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </section>

            <section aria-roledescription="carousel" aria-label="진행 예정 래플">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100 sm:text-[15px]">
                진행 예정 래플
              </h2>
              <OngoingStyleRaffleBlock
                loading={loading}
                list={scheduledList}
                emptyText="진행 예정인 래플이 없습니다."
                ctaMode="scheduled"
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

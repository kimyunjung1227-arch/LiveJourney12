import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';
import { fetchRafflesForUi } from '../api/rafflesSupabase';

const GUIDE_ITEMS = [
  {
    id: 'overview',
    title: '1. 개요 (Overview)',
    body:
      "라이브저니 래플은 현장에서 직접 발로 뛰며 실시간 정보를 나누는 커뮤니티 멤버들을 위해 마련된 이벤트입니다.\n우리가 나누는 정보의 시차가 줄어들수록 여행의 가치는 커집니다.\n여러분이 기록한 '지금 이 순간'의 데이터는 래플 응모권으로 전환되어 다양한 여행 굿즈와 혜택으로 돌아옵니다.",
  },
  {
    id: 'probability',
    title: '2. 당첨 확률 설명 (Winning Probability)',
    body:
      "라이브저니는 정직하고 생생한 정보를 공유하는 분들을 우대합니다.\n\n기본 확률: 모든 응모자에게는 공정한 기회가 부여됩니다.\n\n가중치 시스템: 다음과 같은 활동이 많을수록 당첨 확률(가중치)이 높아집니다.\n- 신뢰 지수(Trust Index): GPS 인증 및 EXIF 데이터가 포함된 '진짜' 실시간 포스트 작성 시.\n- 도움 지수: 내 포스트를 보고 다른 여행자가 \"도움됐어요\"를 눌러 여행 실패를 줄였을 때.\n- 연속성: 꾸준히 지역의 실시간 상황을 업데이트하는 '리얼 타임 마스터' 활동 시.",
  },
  {
    id: 'steps',
    title: '3. 래플 진행 가이드 (Step-by-Step)',
    body:
      "정보 공유: 여행지에서 실시간 포스트를 업로드합니다.\n\n티켓 획득: 포스트의 퀄리티와 신뢰도에 따라 '래플 티켓'이 자동 지급됩니다.\n\n응모하기: 앱 내 [래플] 탭에서 원하는 리워드를 선택하고 티켓을 사용해 응모합니다.\n\n발표 확인: 진행 기간 종료 후, 앱 알림 및 공지사항을 통해 당첨 여부를 확인합니다.",
  },
  {
    id: 'winner',
    title: '4. 당첨된 경우 (Winner’s Journey)',
    body:
      '알림: 당첨 즉시 앱 푸시 알림과 개별 메시지(DM)가 발송됩니다.\n\n정보 입력: 리워드 배송 또는 지급을 위해 정해진 기간(발표 후 7일 이내) 내에 필요한 정보를 입력해야 합니다.\n\n인증하기: 리워드 수령 후, 커뮤니티에 \'행운 인증샷\'을 남겨주시면 다음 래플 응모 시 가산점이 부여됩니다.',
  },
  {
    id: 'waitlist',
    title: '5. 예비 당첨의 경우 (Waitlist)',
    body:
      '라이브저니는 공정한 기회를 위해 예비 당첨자 제도를 운영합니다.\n\n기존 당첨자가 기간 내 정보를 입력하지 않거나, 부정확한 정보 공유(허위 정보 등)로 인해 자격이 박탈될 경우 예비 순번에게 행운이 돌아갑니다.\n\n예비 당첨자는 공식 발표 시 순번이 함께 안내됩니다.',
  },
  {
    id: 'checklist',
    title: '6. 확인 사항 (Checklist)',
    body:
      "진실성 확인: 당첨 후라도 해당 유저가 올린 정보가 허위(과거 사진 재사용, 타인 사진 도용 등)로 판명될 경우 당첨이 취소됩니다.\n\n양도 불가: 래플 리워드는 타인에게 판매하거나 양도할 수 없으며, 적발 시 향후 래플 참여가 제한됩니다.\n\n알림 설정: 당첨 소식을 놓치지 않도록 반드시 앱 알림 설정을 켜두시길 권장합니다.\n\n\"라이브저니와 함께라면, 당신의 모든 발걸음은 이미 가치 있습니다. 이제 그 가치를 행운으로 바꿔보세요!\"",
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
  const [guideOpen, setGuideOpen] = useState(false);
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
          <div className="px-3 pt-4 sm:px-4">
            <h2 className="text-[34px] font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              LiveJourney raffle
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[15px]">
              현장의 실시간 기록이 쌓일수록 여행은 더 쉬워지고, 그 가치가 작은 행운으로 돌아옵니다.
            </p>
          </div>

          <div className="px-3 pt-4 space-y-5 text-[15px] sm:px-4 sm:text-base">
            <section>
              <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">연관 위키</div>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:hover:bg-gray-900"
              >
                <span className="material-symbols-outlined text-[18px] text-rose-500" aria-hidden>
                  description
                </span>
                <span>래플 가이드 (참여 방법)</span>
                <span className="material-symbols-outlined ml-0.5 text-[18px] text-gray-400" aria-hidden>
                  chevron_right
                </span>
              </button>
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

      {/* 래플 가이드: 문서형 모달 (업로드 가이드처럼 열고 닫기) */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/50"
          onMouseDown={() => setGuideOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="래플가이드(참여방법)"
        >
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[520px] rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">래플가이드(참여방법)</div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                aria-label="닫기"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="max-h-[78dvh] overflow-y-auto px-4 py-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80">
                <div className="space-y-4 px-4 py-4">
                  {GUIDE_ITEMS.map((g, idx) => (
                    <div key={g.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {g.title}
                        </h3>
                        {idx === 0 && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            전체 안내
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                        {g.body}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 pt-0">
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaffleScreen;

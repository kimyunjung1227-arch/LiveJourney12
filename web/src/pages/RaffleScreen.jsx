import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import BottomNavigation from '../components/BottomNavigation';

const GUIDE_ITEMS = [
  {
    id: 'how',
    icon: 'how_to_reg',
    title: '참여 방법',
    summary: '앱에서 응모하고 당첨까지 한눈에.',
    body:
      '래플 카드의 「응모하기」를 누르면 참여가 완료됩니다. 로그인이 필요할 수 있으며, 이벤트마다 응모 조건·기간이 다를 수 있으니 카드 하단 설명을 꼭 확인해 주세요.',
  },
  {
    id: 'fair',
    icon: 'verified',
    title: '공정한 추첨',
    summary: '라이브저니 운영 기준에 따른 투명한 당첨.',
    body:
      '당첨자 선정은 라이브저니 이벤트 운영 정책에 따라 진행됩니다. 부정 응모·중복 계정은 제외될 수 있습니다.',
  },
  {
    id: 'notice',
    icon: 'campaign',
    title: '꼭 확인해 주세요',
    summary: '기간·대상·제세공과금 안내.',
    body:
      '경품 수령을 위해 연락처·배송지 정보가 정확해야 합니다. 미성년자·해외 거주자 등 일부 이벤트는 참여 대상이 제한될 수 있습니다. 세부 내용은 각 래플 상세 및 공지사항을 참고해 주세요.',
  },
  {
    id: 'support',
    icon: 'support_agent',
    title: '문의하기',
    summary: '앱 문의·고객센터로 연결.',
    body:
      '설정의 「문의하기」 또는 고객센터를 통해 래플 관련 문의를 남겨 주세요. 이벤트명과 응모 일시를 함께 적어 주시면 더 빠르게 도와드릴 수 있습니다.',
  },
];

const ONGOING_ALL = [
  {
    id: 'o1',
    title: '제주 실시간 여행 굿즈 패키지',
    desc: '라이브저니와 함께하는 제주 감성 굿즈·쿠폰을 응모해 보세요.',
    daysLeft: '5일 남음',
    image:
      'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&h=800&fit=crop&q=80',
  },
  {
    id: 'o2',
    title: '동해안 드라이브 스페셜 기프티콘',
    desc: '해안도로 추천 스팟과 함께하는 커피·디저트 쿠폰 래플입니다.',
    daysLeft: '12일 남음',
    image:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=800&fit=crop&q=80',
  },
  {
    id: 'o3',
    title: '야경 명소 포토 투어 응모권',
    desc: '야경 촬영 명소 코스 안내와 함께 소정의 여행 지원금이 제공됩니다.',
    daysLeft: '2일 남음',
    image:
      'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=600&h=800&fit=crop&q=80',
  },
  {
    id: 'o4',
    title: '도심 속 피크닉 키트',
    desc: '한강·숲길 피크닉에 어울리는 휴대용 매트·에코백을 드립니다.',
    daysLeft: '8일 남음',
    image:
      'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=600&h=800&fit=crop&q=80',
  },
  {
    id: 'o5',
    title: '역사 탐방 스탬프 투어',
    desc: '보물급 유적 코스 안내 스탬프북과 기념품 세트.',
    daysLeft: '20일 남음',
    image:
      'https://images.unsplash.com/photo-1570077188670-e3a318d66009?w=600&h=800&fit=crop&q=80',
  },
];

const COMPLETED_ALL = [
  {
    id: 'c1',
    title: '서울 근교 당일치기 패스',
    winner: 'journey_seoul_07',
    periodLabel: '2025. 3월',
    image:
      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=200&h=200&fit=crop&q=80',
  },
  {
    id: 'c2',
    title: '겨울 스키 리조트 숙박권',
    winner: 'snow_travel_kr',
    periodLabel: '2025. 2월',
    image:
      'https://images.unsplash.com/photo-1551524160-587fd5c115f9?w=200&h=200&fit=crop&q=80',
  },
  {
    id: 'c3',
    title: '전통시장 먹거리 세트',
    winner: 'market_lover',
    periodLabel: '2025. 1월',
    image:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop&q=80',
  },
  {
    id: 'c4',
    title: '남해 섬 루트 가이드북',
    winner: 'island_walk',
    periodLabel: '2024. 12월',
    image:
      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=200&h=200&fit=crop&q=80',
  },
];

const INITIAL_COUNT = 3;

const RaffleScreen = () => {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(null);
  const [ongoingExpanded, setOngoingExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const ongoingList = useMemo(
    () => (ongoingExpanded ? ONGOING_ALL : ONGOING_ALL.slice(0, INITIAL_COUNT)),
    [ongoingExpanded]
  );
  const completedList = useMemo(
    () => (completedExpanded ? COMPLETED_ALL : COMPLETED_ALL.slice(0, INITIAL_COUNT)),
    [completedExpanded]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-[100dvh]">
      <div className="screen-content">
        <header className="screen-header flex items-center justify-between gap-2 bg-white dark:bg-gray-900 px-2 border-b border-gray-100 dark:border-gray-800">
          <BackButton onClick={() => navigate('/main')} ariaLabel="홈으로" />
          <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark flex-1 text-center pr-10">
            래플
          </h1>
        </header>

        <div className="screen-body pb-6">
          {/* 배너 */}
          <section className="relative w-full overflow-hidden">
            <div className="relative aspect-[21/9] min-h-[140px] max-h-[200px] sm:max-h-[220px]">
              <img
                src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&h=400&fit=crop&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
                aria-hidden
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5 pt-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/85 mb-1">
                LiveJourney
              </p>
              <p className="text-xl font-bold text-white leading-snug drop-shadow-sm">
                실시간 여행을 즐기는 분들을 위한 이벤트
              </p>
            </div>
          </section>

          <div className="px-4 pt-6 space-y-8">
            {/* 소개 */}
            <section>
              <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                라이브저니의 래플
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                라이브저니 래플은 지금 이 순간의 여행 정보를 나누는 커뮤니티를 위한 이벤트입니다. 응모를
                통해 여행지 굿즈·쿠폰·소규모 지원 등 다양한 혜택에 도전해 보세요. 진행 일정과 당첨
                안내는 앱 알림과 공지사항으로 안내드립니다.
              </p>
            </section>

            {/* 가이드 버튼 */}
            <section>
              <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-3">
                라이브저니 래플 가이드
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {GUIDE_ITEMS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGuideOpen(g)}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-left shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[22px]">{g.icon}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-sm text-text-primary-light dark:text-text-primary-dark">
                          {g.title}
                        </span>
                        <span className="mt-1 block text-xs text-text-secondary-light dark:text-text-secondary-dark leading-snug line-clamp-2">
                          {g.summary}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* 진행 중 — 참고: 카드 래퍼 + 3:4 이미지 + 우상단 D-day + p-5 본문 + 전폭 그라데이션 버튼 */}
            <section>
              <div className="flex items-center justify-between gap-2 mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
                  현재 진행 중인 래플
                </h2>
                {ONGOING_ALL.length > INITIAL_COUNT && (
                  <button
                    type="button"
                    onClick={() => setOngoingExpanded((v) => !v)}
                    className="text-sm font-bold text-primary hover:underline shrink-0"
                  >
                    {ongoingExpanded ? '접기' : '더보기'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {ongoingList.map((item) => (
                  <article
                    key={item.id}
                    className="group overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900/90"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute top-3 right-3 z-[1]">
                        <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-primary shadow-sm backdrop-blur-md dark:bg-gray-900/85 dark:text-primary">
                          {item.daysLeft}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="mb-2 text-lg font-bold text-sky-900 dark:text-sky-100">
                        {item.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                        {item.desc}
                      </p>
                      <button
                        type="button"
                        className="w-full rounded-lg bg-gradient-to-r from-primary to-cyan-400 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 dark:from-[#00668b] dark:to-[#00bdfd]"
                      >
                        응모하기
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* 완료 — 참고: 가로 스크롤 + w-72 카드 + 16×16 썸네일 + 트로피 + 기간 */}
            <section className="pb-4">
              <div className="flex items-center justify-between gap-2 mb-6">
                <h2 className="text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
                  완료된 래플
                </h2>
                {COMPLETED_ALL.length > INITIAL_COUNT && (
                  <button
                    type="button"
                    onClick={() => setCompletedExpanded((v) => !v)}
                    className="text-sm font-bold text-primary hover:underline shrink-0"
                  >
                    {completedExpanded ? '접기' : '더보기'}
                  </button>
                )}
              </div>
              <div
                className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {completedList.map((row) => (
                  <div
                    key={row.id}
                    className="flex w-72 max-w-[85vw] shrink-0 items-center gap-4 rounded-xl bg-gray-100 p-3 dark:bg-gray-800"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
                      <img src={row.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                        {row.title}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                        <span
                          className="material-symbols-outlined text-[14px] text-primary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                          aria-hidden
                        >
                          emoji_events
                        </span>
                        <span>당첨자 {row.winner}</span>
                      </p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {row.periodLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* 가이드 상세 */}
        {guideOpen && (
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center bg-black/50 p-0 sm:p-4"
            onClick={() => setGuideOpen(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="raffle-guide-title"
          >
            <div
              className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 id="raffle-guide-title" className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark pr-2">
                  {guideOpen.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setGuideOpen(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  aria-label="닫기"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark whitespace-pre-wrap">
                {guideOpen.body}
              </p>
            </div>
          </div>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
};

export default RaffleScreen;

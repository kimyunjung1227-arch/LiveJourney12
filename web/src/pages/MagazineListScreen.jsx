import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';

const STORAGE_KEY = 'magazines';

const loadMagazines = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

const MagazineListScreen = () => {
  const navigate = useNavigate();
  const [magazines, setMagazines] = useState([]);

  useEffect(() => {
    const existing = loadMagazines();

    // 기존 매거진이 없으면 가벼운 목업 데이터 3개 생성
    if (!existing || existing.length === 0) {
      const now = new Date();
      const iso = now.toISOString();

      const mockMagazines = [
        {
          id: 'mag-airport-checklist',
          title: '여행 전 반드시 확인해야 할 공항 준비 체크 리스트',
          summary: '출국 전, 공항에서 헛걸음하지 않도록 꼭 챙겨야 할 준비물과 꿀팁을 정리했어요.',
          regionName: '해외여행 공통',
          coverImage:
            'https://images.unsplash.com/photo-1534448244013-9e3fe584e8e9?w=900&q=80&auto=format&fit=crop',
          createdAt: iso,
          updatedAt: iso,
          author: 'LiveJourney 매거진',
          content: [
            {
              type: 'text',
              title: '여권과 비자, 유효기간 다시 한 번 체크하기',
              body:
                '여행의 시작은 여권입니다. 최소 6개월 이상 유효기간이 남아 있는지, 방문하는 국가에 비자가 필요한지 다시 한 번 확인해 주세요.\n\n' +
                '· 여권 유효기간 6개월 이상 남았는지 확인\n' +
                '· 전자여권인지, 사진이 오래되진 않았는지 확인\n' +
                '· ESTA, eTA 등 전자비자가 필요한 국가인지 체크',
            },
          ],
        },
        {
          id: 'mag-best-time',
          title: '여행 예약의 최적기, 언제가 좋을까?',
          summary: '항공권·숙소 가격이 가장 합리적인 시점은 언제인지, 출발 시기별로 정리했어요.',
          regionName: '국내·해외 공통',
          coverImage:
            'https://images.unsplash.com/photo-1513628253939-010e64ac66cd?w=900&q=80&auto=format&fit=crop',
          createdAt: iso,
          updatedAt: iso,
          author: 'LiveJourney 매거진',
          content: [
            {
              type: 'text',
              title: '항공권은 보통 출발 6~8주 전에',
              body:
                '성수기를 제외하면 대부분의 노선에서 출발 6~8주 전에 가격이 가장 안정되는 경향이 있습니다.\n\n' +
                '· 주말·휴일 출발은 최소 2달 전부터 가격 추이 체크\n' +
                '· 새벽·심야 편은 상대적으로 저렴한 경우가 많아요.',
            },
          ],
        },
        {
          id: 'mag-visa-tips',
          title: '장거리 비행을 조금 더 편하게 만드는 작은 습관들',
          summary: '10시간이 넘는 비행도 견딜 만하게 만들어 주는 좌석 선택·짐 꾸리기 팁을 모았습니다.',
          regionName: '장거리 여행',
          coverImage:
            'https://images.unsplash.com/photo-1527010154944-f2241763d806?w=900&q=80&auto=format&fit=crop',
          createdAt: iso,
          updatedAt: iso,
          author: 'LiveJourney 매거진',
          content: [
            {
              type: 'text',
              title: '몸이 덜 붓는 좌석과 기내 루틴',
              body:
                '통로 쪽 좌석을 선택하면 기내에서 일어나 움직이기 훨씬 편합니다. 비행 중 2~3시간에 한 번씩 가볍게 스트레칭을 해 주세요.\n\n' +
                '· 자주 움직일 수 있는 통로 좌석 추천\n' +
                '· 작은 텀블러에 물을 자주 마시기\n' +
                '· 목배게·얇은 담요를 챙기면 훨씬 편해요.',
            },
          ],
        },
      ];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockMagazines));
      } catch {
        // ignore
      }
      setMagazines(mockMagazines);
      return;
    }

    setMagazines(existing);
  }, []);

  const handleCardClick = useCallback(
    (mag) => {
      navigate(`/magazine/${mag.id}`, { state: { magazine: mag } });
    },
    [navigate]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        {/* 헤더 */}
        <header className="screen-header flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
          <button
            type="button"
            onClick={() => navigate('/main')}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-[18px] font-bold text-text-primary-light dark:text-text-primary-dark m-0">
            여행 매거진
          </h1>
          <div className="w-10" />
        </header>

        {/* 리스트 */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-20">
          {magazines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-5xl mb-3 text-gray-300 dark:text-gray-600">
                menu_book
              </span>
              <p className="text-[15px] font-medium mb-1">아직 등록된 매거진이 없어요</p>
              <p className="text-[13px] mb-3">
                곧 여행 준비에 도움이 되는 매거진이 업데이트될 예정이에요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {magazines.map((mag) => {
                const createdDate = mag.createdAt
                  ? new Date(mag.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : null;
                return (
                  <button
                    key={mag.id}
                    type="button"
                    onClick={() => handleCardClick(mag)}
                    className="w-full flex text-left bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative">
                      {mag.coverImage ? (
                        <img
                          src={mag.coverImage}
                          alt={mag.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          📚
                        </div>
                      )}
                    </div>
                    <div className="flex-1 px-3 py-2 flex flex-col justify-between min-w-0">
                      <div>
                        <p className="text-[13px] text-primary font-semibold mb-0.5">
                          {mag.regionName ? `${mag.regionName} 여행 매거진` : '여행 매거진'}
                        </p>
                        <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-50 leading-snug truncate mb-1">
                          {mag.title}
                        </h2>
                        {mag.summary && (
                          <p className="text-[12px] text-gray-600 dark:text-gray-300 line-clamp-2">
                            {mag.summary}
                          </p>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                        <span>{mag.author || 'LiveJourney'}</span>
                        {createdDate && <span>{createdDate}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default MagazineListScreen;


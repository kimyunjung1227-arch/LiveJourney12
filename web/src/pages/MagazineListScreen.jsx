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
    setMagazines(loadMagazines());
  }, []);

  const handleWriteClick = useCallback(() => {
    navigate('/magazine/write');
  }, [navigate]);

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
          <button
            type="button"
            onClick={handleWriteClick}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            <span>글 쓰기</span>
          </button>
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
                첫 여행 매거진을 직접 작성해 보세요.
              </p>
              <button
                type="button"
                onClick={handleWriteClick}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>매거진 쓰기</span>
              </button>
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


import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { loadMagazineTopics } from '../utils/magazinesConfig';
import { listPublishedMagazines } from '../utils/magazinesStore';
import { useAuth } from '../contexts/AuthContext';
import { useAdminState } from '../utils/admin';

const MagazineListScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminState(user);
  const [topics, setTopics] = useState([]);
  const [published, setPublished] = useState([]);

  useEffect(() => {
    const load = async () => {
      setTopics(loadMagazineTopics());
      setPublished(await listPublishedMagazines());
    };
    load();
    const onUpdated = () => load();
    window.addEventListener('magazinesUpdated', onUpdated);
    window.addEventListener('magazineTopicsUpdated', onUpdated);
    return () => {
      window.removeEventListener('magazinesUpdated', onUpdated);
      window.removeEventListener('magazineTopicsUpdated', onUpdated);
    };
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-gray-900 dark:text-gray-50 m-0">발행 매거진</h2>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/magazine/write')}
                className="inline-flex items-center gap-1 rounded-full bg-gray-900 text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-black"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                발행
              </button>
            )}
          </div>

          {published.length === 0 ? (
            <div className="mb-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-gray-500 dark:text-gray-400">
              <p className="text-[13px] font-medium mb-1">아직 발행된 매거진이 없어요</p>
              <p className="text-[12px] m-0">위치 정보를 입력해서 첫 매거진을 발행해 보세요.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {published.map((mag) => {
                const createdDate = mag.created_at || mag.createdAt
                  ? new Date(mag.created_at || mag.createdAt).toLocaleDateString('ko-KR', {
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
                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center text-2xl">
                      📚
                    </div>
                    <div className="flex-1 px-3 py-2 flex flex-col justify-between min-w-0">
                      <div>
                        <p className="text-[13px] text-primary font-semibold mb-0.5">발행 매거진</p>
                        <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-50 leading-snug truncate mb-1">
                          {mag.title}
                        </h2>
                        {(mag.subtitle || mag.summary) && (
                          <p className="text-[12px] text-gray-600 dark:text-gray-300 line-clamp-2">
                            {mag.subtitle || mag.summary}
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

          <h2 className="text-[14px] font-extrabold text-gray-900 dark:text-gray-50 m-0 mb-3">테마 매거진</h2>
          {topics.length === 0 ? (
            <div className="h-[40vh] flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-5xl mb-3 text-gray-300 dark:text-gray-600">menu_book</span>
              <p className="text-[15px] font-medium mb-1">아직 등록된 매거진이 없어요</p>
              <p className="text-[13px] mb-3">곧 여행 준비에 도움이 되는 매거진이 업데이트될 예정이에요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((mag) => (
                <button
                  key={mag.id}
                  type="button"
                  onClick={() => handleCardClick(mag)}
                  className="w-full flex text-left bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="w-24 h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative flex items-center justify-center text-2xl">
                    {mag.emoji || '📚'}
                  </div>
                  <div className="flex-1 px-3 py-2 flex flex-col justify-between min-w-0">
                    <div>
                      <p className="text-[13px] text-primary font-semibold mb-0.5">테마 매거진</p>
                      <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-50 leading-snug truncate mb-1">
                        {mag.title}
                      </h2>
                      {mag.description && (
                        <p className="text-[12px] text-gray-600 dark:text-gray-300 line-clamp-2">{mag.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default MagazineListScreen;


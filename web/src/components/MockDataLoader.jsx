import React, { useEffect, useState, useCallback } from 'react';
import { seedMockData, clearMockData, getMockDataStats } from '../utils/mockUploadData';

const MockDataLoader = () => {
  const [stats, setStats] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  // 통계 업데이트 (useCallback)
  const handleNewPosts = useCallback(() => {
    const currentStats = getMockDataStats();
    setStats(currentStats);
  }, []);

  // Mock 데이터 생성 (useCallback)
  const handleSeedData = useCallback(() => {
    const count = prompt('생성할 Mock 데이터 개수를 입력하세요 (기본: 50)', '50');
    if (count && !isNaN(count)) {
      const result = seedMockData(parseInt(count));
      setStats(result);
      alert(`✅ ${count}개의 Mock 데이터가 생성되었습니다!`);
      window.location.reload();
    }
  }, []);

  // Mock 데이터 삭제 (useCallback)
  const handleClearData = useCallback(() => {
    if (confirm('⚠️ 모든 Mock 데이터를 삭제하시겠습니까?\n\n실제 업로드한 데이터도 함께 삭제됩니다!')) {
      clearMockData();
      setStats(null);
      alert('🗑️ 모든 데이터가 삭제되었습니다.');
      window.location.reload();
    }
  }, []);

  // Mock 데이터 전체 재생성 (useCallback)
  const handleRegenerateAll = useCallback(() => {
    if (confirm('🔄 전체 Mock 데이터를 재생성하시겠습니까?\n\n기존 데이터가 모두 삭제되고 50개의 새 데이터가 생성됩니다.')) {
      clearMockData();
      const result = seedMockData(50); // 50개만 생성!
      setStats(result);
      alert('✅ 50개의 Mock 데이터가 생성되었습니다!');
      window.location.reload();
    }
  }, []);

  // 통계 새로고침 (useCallback)
  const handleRefreshStats = useCallback(() => {
    const currentStats = getMockDataStats();
    setStats(currentStats);
  }, []);

  useEffect(() => {
    const existingPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    console.log(`📊 현재 게시물: ${existingPosts.length}개`);
    
    // 프로덕션(배포) 환경에서는 첫 접속 시 데모용 Mock 데이터 자동 생성
    if (import.meta.env.MODE === 'production' && existingPosts.length === 0) {
      console.log('🌱 프로덕션 최초 접속 - 데모용 Mock 데이터 자동 생성');
      const result = seedMockData(200); // 한국 전역 사진 + 여러 사용자
      setStats(result);
    } else if (existingPosts.length > 0) {
      const currentStats = getMockDataStats();
      setStats(currentStats);
    }

    // 개발 모드에서 window 객체에 유틸리티 함수 추가 (수동 제어용)
    if (import.meta.env.MODE === 'development') {
      window.mockData = {
        seed: (count = 50) => {
          const result = seedMockData(count);
          console.log(`✅ ${count}개의 Mock 데이터가 생성되었습니다!`);
          window.location.reload();
          return result;
        },
        clear: () => {
          clearMockData();
          console.log('🗑️ Mock 데이터가 삭제되었습니다.');
          window.location.reload();
        },
        stats: () => {
          const stats = getMockDataStats();
          console.log('📊 Mock 데이터 통계:', stats);
          return stats;
        }
      };
      
      console.log('💡 콘솔에서 수동 제어: window.mockData.seed(개수), window.mockData.clear()');
    }

    window.addEventListener('newPostsAdded', handleNewPosts);

    return () => {
      window.removeEventListener('newPostsAdded', handleNewPosts);
    };
  }, [handleNewPosts]);

  // 개발 모드에서만 표시
  if (import.meta.env.MODE !== 'development') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed bottom-24 right-4 z-50 bg-purple-600 text-white rounded-full p-3 shadow-lg hover:bg-purple-700 transition-all"
        title="Mock 데이터 관리"
      >
        <span className="material-symbols-outlined">
          {showPanel ? 'close' : 'science'}
        </span>
      </button>

      {showPanel && (
        <div className="fixed bottom-40 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 w-80 border-2 border-purple-600 max-h-[70vh] overflow-y-auto">
          <h3 className="text-lg font-bold mb-3 text-purple-600 dark:text-purple-400 flex items-center gap-2">
            <span className="material-symbols-outlined">science</span>
            Mock 데이터 관리
          </h3>

          {/* 통계 */}
          {stats && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">📊 현재 통계</h4>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>전체:</span>
                  <span className="font-bold">{stats.total}개</span>
                </div>
                <div className="flex justify-between">
                  <span>🌸 개화 상황:</span>
                  <span className="font-bold">{stats.bloom}개</span>
                </div>
                <div className="flex justify-between">
                  <span>🏞️ 가볼만한곳:</span>
                  <span className="font-bold">{stats.landmark}개</span>
                </div>
                <div className="flex justify-between">
                  <span>🍜 맛집 정보:</span>
                  <span className="font-bold">{stats.food}개</span>
                </div>
                {stats.general > 0 && (
                  <div className="flex justify-between">
                    <span>일반:</span>
                    <span className="font-bold">{stats.general}개</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 버튼들 */}
          <div className="space-y-2">
            <button
              onClick={handleRegenerateAll}
              className="w-full bg-gradient-to-r from-primary to-accent text-white py-2 px-4 rounded-lg hover:from-primary-dark hover:to-accent-dark transition-colors text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              <span className="material-symbols-outlined text-sm">autorenew</span>
              Mock 데이터 재생성 (1000개)
            </button>

            <button
              onClick={handleSeedData}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Mock 데이터 추가
            </button>

            <button
              onClick={handleRefreshStats}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              통계 새로고침
            </button>

            <button
              onClick={handleClearData}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              전체 삭제
            </button>
          </div>

          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
            <p className="font-semibold mb-1">💡 개발 모드 전용</p>
            <p>프로덕션에서는 자동으로 숨겨집니다.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default MockDataLoader;























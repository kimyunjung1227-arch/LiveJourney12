import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import {
  getUploadedPostsSafe,
  getLocalStorageSizeMB,
  cleanOldUserPosts,
  limitPostsCount,
  logLocalStorageStatus,
  removeAllImageData
} from '../utils/localStorageManager';

const StorageManagementScreen = () => {
  const navigate = useNavigate();
  const [storageInfo, setStorageInfo] = useState({
    totalSize: '0',
    userCount: 0,
    totalPosts: 0
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = () => {
    const sizeMB = getLocalStorageSizeMB();
    const posts = getUploadedPostsSafe();

    setStorageInfo({
      totalSize: sizeMB,
      userCount: posts.length,
      totalPosts: posts.length
    });

    logLocalStorageStatus();
  };

  const handleCleanOldPosts = () => {
    setConfirmAction({
      title: '오래된 게시물 정리',
      message: '30일 이상 지난 게시물을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.',
      action: () => {
        cleanOldUserPosts(30);
        loadStorageInfo();
        alert('오래된 게시물이 정리되었습니다.');
      }
    });
    setShowConfirmModal(true);
  };

  const handleLimitPosts = () => {
    setConfirmAction({
      title: '게시물 수 제한',
      message: '게시물을 최대 100개로 제한하시겠습니까?\n\n최신 100개의 게시물만 유지되고 나머지는 삭제됩니다.',
      action: () => {
        limitPostsCount(100);
        loadStorageInfo();
        alert('게시물 수가 제한되었습니다.');
      }
    });
    setShowConfirmModal(true);
  };

  const handleRemoveAllImages = () => {
    setConfirmAction({
      title: '모든 사진 데이터 삭제',
      message: '모든 게시물에서 사진과 동영상 데이터를 완전히 삭제하시겠습니까?\n\n이미지 URL, base64 데이터 등 모든 사진 데이터가 제거되고 메타데이터만 남습니다.\n\n이 작업은 되돌릴 수 없습니다.',
      action: () => {
        const result = removeAllImageData();
        if (result.success) {
          loadStorageInfo();
          alert(`모든 사진 데이터가 삭제되었습니다.\n\n${result.postsCleaned}개 게시물에서 ${result.imagesRemoved}개의 이미지/동영상이 제거되었습니다.`);
        } else {
          alert('사진 데이터 삭제에 실패했습니다.');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleClearAllData = () => {
    setConfirmAction({
      title: '모든 데이터 삭제',
      message: '모든 게시물 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 게시물이 삭제됩니다.',
      action: () => {
        // 서버 운영 전환: localStorage 제거
        loadStorageInfo();
        alert('모든 데이터가 삭제되었습니다.');
      }
    });
    setShowConfirmModal(true);
  };

  const executeAction = () => {
    if (confirmAction && confirmAction.action) {
      confirmAction.action();
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const cancelAction = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark relative overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-light bg-surface-light/80 dark:border-border-dark dark:bg-surface-dark/80 backdrop-blur-sm px-4">
          <button
            onClick={() => navigate('/settings')}
            className="flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-black dark:text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-black dark:text-white">
            저장소 관리
          </h1>
          <div className="flex size-12 shrink-0 items-center justify-end"></div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-grow pb-4">
          {/* 저장소 현황 */}
          <div className="bg-surface-light dark:bg-surface-dark">
            <div className="px-4 pt-6 pb-3">
              <h2 className="text-lg font-bold leading-normal text-black dark:text-white">
                저장소 현황
              </h2>
            </div>
            <div className="flex flex-col px-4 pb-6 space-y-3">
              <div className="flex items-center justify-between p-4 bg-surface-subtle-light dark:bg-surface-subtle-dark rounded-lg">
                <span className="text-sm font-medium text-black dark:text-white">사용 중인 용량</span>
                <span className="text-base font-bold text-black dark:text-white">{storageInfo.totalSize} MB</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-subtle-light dark:bg-surface-subtle-dark rounded-lg">
                <span className="text-sm font-medium text-black dark:text-white">전체 게시물</span>
                <span className="text-base font-bold text-black dark:text-white">{storageInfo.totalPosts}개</span>
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <div className="h-2 bg-background-light dark:bg-background-dark"></div>

          {/* 데이터 정리 */}
          <div className="bg-surface-light dark:bg-surface-dark">
            <div className="px-4 pt-6 pb-3">
              <h2 className="text-lg font-bold leading-normal text-black dark:text-white">
                데이터 정리
              </h2>
              <p className="mt-1 text-xs text-black/70 dark:text-white/70">
                저장소 용량이 부족할 때 데이터를 정리할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-col">
              <button
                onClick={handleCleanOldPosts}
                className="flex h-auto items-start justify-between px-4 py-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors border-t border-border-light dark:border-border-dark"
              >
                <div className="flex flex-col text-left">
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">
                    오래된 게시물 정리
                  </p>
                  <p className="text-sm font-normal leading-normal text-black/70 dark:text-white/70 mt-1">
                    30일 이상 지난 게시물을 삭제합니다
                  </p>
                </div>
                <span className="material-symbols-outlined text-black/70 dark:text-white/70 mt-1">
                  chevron_right
                </span>
              </button>

              <button
                onClick={handleLimitPosts}
                className="flex h-auto items-start justify-between px-4 py-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors border-t border-border-light dark:border-border-dark"
              >
                <div className="flex flex-col text-left">
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">
                    게시물 수 제한
                  </p>
                  <p className="text-sm font-normal leading-normal text-black/70 dark:text-white/70 mt-1">
                    최신 100개의 게시물만 유지합니다
                  </p>
                </div>
                <span className="material-symbols-outlined text-black/70 dark:text-white/70 mt-1">
                  chevron_right
                </span>
              </button>
            </div>
          </div>

          {/* 구분선 */}
          <div className="h-2 bg-background-light dark:bg-background-dark"></div>

          {/* 위험 영역 */}
          <div className="bg-surface-light dark:bg-surface-dark">
            <div className="px-4 pt-6 pb-3">
              <h2 className="text-lg font-bold leading-normal text-black dark:text-white">
                위험 영역
              </h2>
              <p className="mt-1 text-xs text-black/70 dark:text-white/70">
                아래 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex flex-col">
              <button
                onClick={handleRemoveAllImages}
                className="flex h-auto items-start justify-between px-4 py-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
              >
                <div className="flex flex-col text-left">
                  <p className="text-base font-semibold leading-normal text-red-600 dark:text-red-400">
                    모든 사진 데이터 삭제
                  </p>
                  <p className="text-sm font-normal leading-normal text-black/70 dark:text-white/70 mt-1">
                    모든 게시물에서 이미지/동영상 데이터를 완전히 제거합니다
                  </p>
                </div>
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-1">
                  chevron_right
                </span>
              </button>

              <button
                onClick={handleClearAllData}
                className="flex h-auto items-start justify-between px-4 py-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors border-t border-border-light dark:border-border-dark"
              >
                <div className="flex flex-col text-left">
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">
                    모든 데이터 삭제
                  </p>
                  <p className="text-sm font-normal leading-normal text-black/70 dark:text-white/70 mt-1">
                    모든 게시물 데이터를 완전히 삭제합니다
                  </p>
                </div>
                <span className="material-symbols-outlined text-black/70 dark:text-white/70 mt-1">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </main>
      </div>

      <BottomNavigation />

      {/* 확인 모달 */}
      {showConfirmModal && confirmAction && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-light dark:bg-surface-dark p-6 text-center shadow-2xl">
            <h3 className="text-lg font-bold text-black dark:text-white">
              {confirmAction.title}
            </h3>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70 whitespace-pre-line">
              {confirmAction.message}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={cancelAction}
                className="h-12 w-full rounded-lg bg-surface-subtle-light dark:bg-surface-subtle-dark text-base font-bold text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeAction}
                className="h-12 w-full rounded-lg bg-black dark:bg-white text-base font-bold text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageManagementScreen;






























































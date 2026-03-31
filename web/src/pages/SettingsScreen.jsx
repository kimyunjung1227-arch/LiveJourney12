import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import { logger } from '../utils/logger';

const SettingsScreen = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // 토글 상태
  const [activityNotification, setActivityNotification] = useState(true);
  const [locationNotification, setLocationNotification] = useState(false);
  const [locationPermission, setLocationPermission] = useState(true);
  const [cameraPermission, setCameraPermission] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 토글 핸들러
  const toggleActivityNotification = () => setActivityNotification(!activityNotification);
  const toggleLocationNotification = () => setLocationNotification(!locationNotification);
  const toggleLocationPermission = () => setLocationPermission(!locationPermission);
  const toggleCameraPermission = () => setCameraPermission(!cameraPermission);

  // 메뉴 핸들러
  const handleAccountConnection = () => {
    navigate('/account-connection');
  };

  const handleDeleteAccount = () => {
    navigate('/account-delete');
  };

  const handleFeedUpdate = () => {
    navigate('/feed-update-frequency');
  };

  const handleNotice = () => {
    navigate('/notices');
  };

  const handleFAQ = () => {
    navigate('/faq');
  };

  const handleInquiry = () => {
    navigate('/inquiry');
  };

  const handleTerms = () => {
    navigate('/terms-and-policies');
  };


  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('👋 로그아웃 & 완전 초기화 시작...');
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 로그아웃 (내부에서 완전 초기화 수행)
    logout();

    // 모달 닫기
    setShowLogoutModal(false);

    logger.log('🏠 시작 화면으로 이동');
    navigate('/', { replace: true });
  };

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark relative" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="screen-content" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* 헤더 */}
        <header className="screen-header flex h-16 items-center justify-between border-b border-border-light bg-white dark:border-border-dark dark:bg-gray-900 px-4 shadow-sm" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
          <button
            onClick={() => navigate('/profile')}
            className="flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-black dark:text-white">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-black dark:text-white">
            설정
          </h1>
          <div className="flex size-12 shrink-0 items-center justify-end"></div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="pb-28" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="flex flex-col">
            {/* 계정 관리 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-6 pb-3">
                <h2 className="text-base font-bold leading-normal text-black dark:text-white">
                  계정 관리
                </h2>
              </div>
              <div className="flex flex-col">
                <button
                  onClick={handleAccountConnection}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    계정 연결 관리
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    계정 삭제
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-2 bg-background-light dark:bg-background-dark"></div>

            {/* 알림 설정 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-6 pb-3">
                <h2 className="text-base font-bold leading-normal text-black dark:text-white">
                  알림 설정
                </h2>
              </div>
              <div className="flex flex-col">
                <div className="flex h-14 items-center justify-between px-4">
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    활동 알림
                  </p>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={activityNotification}
                      onChange={toggleActivityNotification}
                    />
                    <span className="settings-slider" />
                  </label>
                </div>
                <button
                  onClick={handleFeedUpdate}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    실시간 피드 업데이트 주기
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-2 bg-background-light dark:bg-background-dark"></div>

            {/* 정보 공유 및 권한 설정 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-6 pb-3">
                <h2 className="text-base font-bold leading-normal text-black dark:text-white">
                  정보 공유 및 권한 설정
                </h2>
              </div>
              <div className="flex flex-col">
                <div className="flex h-14 items-center justify-between px-4">
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    위치 정보 접근 권한
                  </p>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={locationPermission}
                      onChange={toggleLocationPermission}
                    />
                    <span className="settings-slider" />
                  </label>
                </div>
                <div className="flex h-14 items-center justify-between px-4">
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    사진/카메라 접근 권한
                  </p>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      checked={cameraPermission}
                      onChange={toggleCameraPermission}
                    />
                    <span className="settings-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-2 bg-background-light dark:bg-background-dark"></div>

            {/* 서비스 정보 및 지원 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-6 pb-3">
                <h2 className="text-base font-bold leading-normal text-black dark:text-white">
                  서비스 정보 및 지원
                </h2>
              </div>
              <div className="flex flex-col">
                <button
                  onClick={handleNotice}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    공지사항
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={handleFAQ}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    자주 묻는 질문 (FAQ)
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={handleInquiry}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    문의하기
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={handleTerms}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    서비스 약관 및 정책
                  </p>
                  <span className="material-symbols-outlined text-black dark:text-white">
                    chevron_right
                  </span>
                </button>
                <div className="flex h-14 items-center justify-between px-4">
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    버전 정보
                  </p>
                  <p className="text-base font-normal leading-normal text-black dark:text-white">
                    1.0.0
                  </p>
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-2 bg-background-light dark:bg-background-dark"></div>

            {/* 로그아웃 버튼 */}
            <div className="bg-surface-light dark:bg-surface-dark px-4 py-6">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined">logout</span>
                <span>로그아웃</span>
              </button>
            </div>

            {/* 하단 여백 */}
            <div className="h-24"></div>
          </div>
        </main>
      </div>

      <BottomNavigation />

      {/* 로그아웃 확인 모달 */}
      {showLogoutModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800">
                <span className="material-symbols-outlined text-black dark:text-white text-4xl">
                  logout
                </span>
              </div>
            </div>

            {/* 메시지 */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                로그아웃 하시겠습니까?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                다시 로그인하시려면 계정 정보를 입력해야 합니다
              </p>
            </div>

            {/* 버튼들 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsScreen;



















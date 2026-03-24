import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getAvailableBadges, getEarnedBadgesForDisplay, calculateUserStats, getBadgeDisplayName } from '../utils/badgeSystem';
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { logger } from '../utils/logger';

const BadgeListScreen = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all'); // 'acquired' or 'all'
  const [selectedBadge, setSelectedBadge] = useState(null); // 선택된 뱃지
  const [badges, setBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);

  // 뱃지 데이터 로드 (Supabase+로컬 병합 게시물로 통계 계산 → 로그아웃 후 재로그인해도 진행률 유지)
  const loadBadges = async () => {
    logger.log('🔄 뱃지 목록 로드 시작');
    const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = savedUser?.id || 'test_user_001';
    const myPosts = await getMergedMyPostsForStats(currentUserId);
    const stats = calculateUserStats(myPosts, savedUser);
    const allBadges = getAvailableBadges(stats);
    const earned = getEarnedBadgesForDisplay();
    logger.log('📋 로드된 뱃지:', {
      전체: allBadges.length,
      획득: earned.length,
      게시물수: myPosts.length,
      진행률있는뱃지: allBadges.filter(b => b.progress > 0 && !b.isEarned).length
    });
    setBadges(allBadges);
    setEarnedBadges(earned);
  };

  useEffect(() => {
    loadBadges();

    // 게시물 업데이트 이벤트 리스너 (사진 업로드 시 뱃지 진행률 업데이트)
    const handlePostsUpdate = () => {
      logger.log('📊 게시물 업데이트 감지 - 뱃지 진행률 갱신');
      loadBadges();
    };

    // 뱃지 진행률 업데이트 이벤트 리스너
    const handleBadgeProgressUpdate = () => {
      logger.log('🏆 뱃지 진행률 업데이트 감지');
      loadBadges();
    };

    // 뱃지 획득 이벤트 리스너
    const handleBadgeEarned = () => {
      logger.log('🎉 뱃지 획득 감지');
      loadBadges();
    };

    // 화면 포커스 시 뱃지 목록 새로고침
    const handleFocus = () => {
      logger.log('👁️ 화면 포커스 - 뱃지 목록 새로고침');
      loadBadges();
    };

    window.addEventListener('postsUpdated', handlePostsUpdate);
    window.addEventListener('badgeProgressUpdated', handleBadgeProgressUpdate);
    window.addEventListener('badgeEarned', handleBadgeEarned);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        handleFocus();
      }
    });

    return () => {
      window.removeEventListener('postsUpdated', handlePostsUpdate);
      window.removeEventListener('badgeProgressUpdated', handleBadgeProgressUpdate);
      window.removeEventListener('badgeEarned', handleBadgeEarned);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 필터링된 뱃지 목록 (간단하게!)
  const filteredBadges = badges
    .filter(badge => {
      // 획득 여부 필터만
      if (filter === 'acquired') return badge.isEarned;
      return true;
    })
    .filter(badge => !badge.hidden) // 히든 뱃지는 기본적으로 숨김
    .sort((a, b) => {
      // 1) 획득한 뱃지를 항상 위에 배치
      if (a.isEarned !== b.isEarned) {
        return a.isEarned ? -1 : 1;
      }

      // 2) 카테고리 순서
      const categoryOrder = {
        '온보딩': 1,
        '지역 가이드': 2,
        '실시간 정보': 3,
        '도움 지수': 4,
        '정확한 정보': 5,
        '친절한 여행자': 6,
        '기여도': 7,
        '신뢰지수': 8
      };
      const orderA = categoryOrder[a.category] || 999;
      const orderB = categoryOrder[b.category] || 999;
      if (orderA !== orderB) return orderA - orderB;

      // 3) 난이도 순
      return (a.difficulty || 1) - (b.difficulty || 1);
    });

  // 삭제된 긴 badgeDefinitions 배열
  /* const badgeDefinitions = [
    {
      id: 1,
      name: '첫 여행 기록',
      description: '첫 번째 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 1개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 1 },
      icon: 'photo_camera',
      color: 'from-green-400 to-emerald-500'
    },
    {
      id: 2,
      name: '여행 입문자',
      description: '5개의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 5개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 5 },
      icon: 'hiking',
      color: 'from-lime-400 to-green-500'
    },
    {
      id: 3,
      name: '여행 탐험가',
      description: '10개의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 10개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'explore',
      color: 'from-blue-400 to-cyan-500'
    },
    {
      id: 4,
      name: '활동적인 여행자',
      description: '25개의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 25개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 25 },
      icon: 'directions_run',
      color: 'from-cyan-400 to-blue-500'
    },
    {
      id: 5,
      name: '여행 마스터',
      description: '50개의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 50개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 50 },
      icon: 'emoji_events',
      color: 'from-primary to-accent'
    },
    {
      id: 6,
      name: '여행 전문가',
      description: '100개의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 100개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 100 },
      icon: 'workspace_premium',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      id: 7,
      name: '여행 레전드',
      description: '200개의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '사진 200개 업로드',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 200 },
      icon: 'military_tech',
      color: 'from-amber-400 to-orange-600'
    },
    {
      id: 8,
      name: '서울 탐험가',
      description: '서울 지역에 10개 이상의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '서울 10개 명소',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'location_city',
      color: 'from-red-400 to-rose-500'
    },
    {
      id: 9,
      name: '부산 탐험가',
      description: '부산 지역에 10개 이상의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '부산 10개 명소',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'beach_access',
      color: 'from-blue-400 to-indigo-500'
    },
    {
      id: 10,
      name: '제주 모험가',
      description: '제주 지역에 10개 이상의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '제주 10개 명소',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'landscape',
      color: 'from-primary to-emerald-400'
    },
    {
      id: 11,
      name: '강원 탐험가',
      description: '강원 지역에 10개 이상의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '강원 10개 명소',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'terrain',
      color: 'from-emerald-400 to-orange-500'
    },
    {
      id: 12,
      name: '경상도 탐험가',
      description: '경상도 지역에 10개 이상의 사진을 업로드하면 획득할 수 있습니다.',
      shortDescription: '경상도 10개 명소',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'temple_buddhist',
      color: 'from-primary to-rose-500'
    },
    {
      id: 13,
      name: '미식가',
      description: '맛집 사진을 20개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '맛집 20곳 방문',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 20 },
      icon: 'restaurant',
      color: 'from-primary to-rose-500'
    },
    {
      id: 14,
      name: '카페 마니아',
      description: '카페 사진을 15개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '카페 15곳 방문',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 15 },
      icon: 'local_cafe',
      color: 'from-amber-400 to-yellow-500'
    },
    {
      id: 15,
      name: '디저트 러버',
      description: '디저트 카페를 10개 이상 방문하면 획득할 수 있습니다.',
      shortDescription: '디저트 10곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'cake',
      color: 'from-pink-400 to-rose-500'
    },
    {
      id: 16,
      name: '자연 애호가',
      description: '자연 명소 사진을 25개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '자연 25곳 방문',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 25 },
      icon: 'forest',
      color: 'from-green-400 to-lime-500'
    },
    {
      id: 17,
      name: '야경 사진가',
      description: '야경 사진을 10개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '야경 10곳 촬영',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'nightlight',
      color: 'from-sky-500 to-primary'
    },
    {
      id: 18,
      name: '일출 사냥꾼',
      description: '일출 사진을 5개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '일출 5회 촬영',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 5 },
      icon: 'wb_sunny',
      color: 'from-yellow-400 to-orange-500'
    },
    {
      id: 19,
      name: '전국 정복자',
      description: '5개 이상의 지역을 방문하면 획득할 수 있습니다.',
      shortDescription: '5개 지역 방문',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 5 },
      icon: 'public',
      color: 'from-pink-400 to-rose-500'
    },
    {
      id: 20,
      name: '대한민국 일주',
      description: '10개 이상의 지역을 방문하면 획득할 수 있습니다.',
      shortDescription: '10개 지역 방문',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'flag',
      color: 'from-red-400 to-pink-500'
    },
    {
      id: 21,
      name: '인기 여행자',
      description: '게시물에 좋아요를 100개 이상 받으면 획득할 수 있습니다.',
      shortDescription: '좋아요 100개',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 100 },
      icon: 'favorite',
      color: 'from-accent to-rose-500'
    },
    {
      id: 22,
      name: '소통왕',
      description: '댓글을 50개 이상 작성하면 획득할 수 있습니다.',
      shortDescription: '댓글 50개',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 50 },
      icon: 'chat',
      color: 'from-blue-400 to-cyan-500'
    },
    {
      id: 23,
      name: '문화 탐방가',
      description: '박물관이나 미술관을 10곳 이상 방문하면 획득할 수 있습니다.',
      shortDescription: '문화시설 10곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'museum',
      color: 'from-primary to-sky-500'
    },
    {
      id: 24,
      name: '역사 애호가',
      description: '역사 유적지를 15곳 이상 방문하면 획득할 수 있습니다.',
      shortDescription: '유적지 15곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 15 },
      icon: 'account_balance',
      color: 'from-stone-400 to-amber-500'
    },
    {
      id: 25,
      name: '해변 러버',
      description: '해변이나 바다 사진을 20개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '해변 20곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 20 },
      icon: 'beach_access',
      color: 'from-sky-400 to-blue-500'
    },
    {
      id: 26,
      name: '산악인',
      description: '산이나 등산로 사진을 15개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '산 15곳 등반',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 15 },
      icon: 'landscape',
      color: 'from-emerald-400 to-green-600'
    },
    {
      id: 27,
      name: '축제 마니아',
      description: '축제나 행사 사진을 10개 이상 업로드하면 획득할 수 있습니다.',
      shortDescription: '축제 10곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 10 },
      icon: 'celebration',
      color: 'from-fuchsia-400 to-pink-500'
    },
    {
      id: 28,
      name: '쇼핑 전문가',
      description: '쇼핑 명소를 15개 이상 방문하면 획득할 수 있습니다.',
      shortDescription: '쇼핑 15곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 15 },
      icon: 'shopping_bag',
      color: 'from-primary to-indigo-500'
    },
    {
      id: 29,
      name: '야외활동가',
      description: '공원이나 야외 활동지를 20개 이상 방문하면 획득할 수 있습니다.',
      shortDescription: '야외 20곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 20 },
      icon: 'park',
      color: 'from-green-400 to-emerald-500'
    },
    {
      id: 30,
      name: '건축물 감상가',
      description: '유명 건축물을 15개 이상 촬영하면 획득할 수 있습니다.',
      shortDescription: '건축물 15곳',
      acquiredDate: null,
      acquired: false,
      progress: { current: 0, total: 15 },
      icon: 'apartment',
      color: 'from-slate-400 to-gray-500'
    }
  ]; */

  // 필터링된 뱃지 목록 (이미 위에서 정의됨)

  const handleBadgeClick = (badge) => {
    setSelectedBadge(badge);
  };

  const closeModal = () => {
    setSelectedBadge(null);
  };

  return (
    <div className="screen-layout bg-white dark:bg-background-dark h-screen overflow-hidden flex flex-col">
      <div className="screen-content flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* 헤더 */}
        <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 justify-between shadow-sm" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
          <button
            onClick={() => navigate('/profile')}
            aria-label="Back"
            className="flex size-12 shrink-0 items-center justify-center text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
            뱃지 목록
          </h1>
        </header>

        {/* 필터 토글 */}
        <div className="flex px-4 py-3">
          <div className="flex h-12 flex-1 items-center justify-center rounded-full bg-background-light dark:bg-black/20 p-1.5">
            <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 text-sm font-medium leading-normal transition-colors duration-200 ${filter === 'all'
                ? 'bg-primary text-white'
                : 'text-text-primary-light dark:text-text-primary-dark'
              }`}>
              <span className="truncate">전체</span>
              <input
                className="invisible w-0"
                name="badge-filter"
                type="radio"
                value="all"
                checked={filter === 'all'}
                onChange={() => setFilter('all')}
              />
            </label>
            <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 text-sm font-medium leading-normal transition-colors duration-200 ${filter === 'acquired'
                ? 'bg-primary text-white'
                : 'text-text-primary-light dark:text-text-primary-dark'
              }`}>
              <span className="truncate">획득</span>
              <input
                className="invisible w-0"
                name="badge-filter"
                type="radio"
                value="acquired"
                checked={filter === 'acquired'}
                onChange={() => setFilter('acquired')}
              />
            </label>
          </div>
        </div>


        {/* 뱃지 그리드 */}
        <main className="px-4 pb-28" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredBadges.map((badge, index) => {
              const hasNumericProgress = badge.progressTarget != null && badge.progressCurrent !== undefined;
              const progressText = hasNumericProgress
                ? `${badge.progressCurrent} / ${badge.progressTarget}${badge.progressUnit || ''}`
                : `${Math.round(badge.progress || 0)}%`;
              return (
              <button
                key={badge.name || index}
                onClick={() => handleBadgeClick(badge)}
                className={`flex flex-col gap-2 items-center text-center p-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${badge.isEarned
                    ? 'bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary shadow-lg ring-2 ring-primary/20'
                    : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'
                  }`}
              >
                {/* 뱃지 아이콘 */}
                <div className={`relative w-16 h-16 rounded-full flex items-center justify-center ${badge.isEarned ? 'bg-primary/20 shadow-md' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <span className="text-4xl">
                    {badge.icon || '🏆'}
                  </span>
                  {badge.isEarned && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-gray-900" title="획득 완료">✓</span>
                  )}
                </div>

                {/* 뱃지 정보 */}
                <div className="flex flex-col gap-0.5 w-full min-w-0">
                  <p className={`text-sm font-bold leading-tight truncate ${badge.isEarned ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                    {getBadgeDisplayName(badge)}
                  </p>
                  {badge.shortCondition && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={badge.shortCondition}>
                      {badge.shortCondition}
                    </p>
                  )}

                  {badge.isEarned ? (
                    <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] font-bold text-green-600 dark:text-green-400">🎉 획득</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${[3, 4].includes(badge.difficulty) ? 'bg-primary/90 text-white' : badge.difficulty === 2 ? 'bg-blue-500/90 text-white' : 'bg-green-500/90 text-white'}`}>
                        {typeof badge.difficulty === 'number' ? ({ 1: '하', 2: '중', 3: '상', 4: '최상' }[badge.difficulty] || '중') : (badge.difficulty || '중')}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 w-full">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-500 min-w-0"
                          style={{ width: `${Math.min(100, badge.progress || 0)}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mt-0.5">
                        {progressText}
                      </p>
                    </div>
                  )}
                </div>
              </button>
              );
            })}
          </div>

          {/* 빈 상태 */}
          {filteredBadges.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <span className="material-symbols-outlined text-6xl text-text-secondary-light dark:text-text-secondary-dark mb-4">
                workspace_premium
              </span>
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-medium mb-2">
                아직 획득한 뱃지가 없습니다
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                첫 사진을 올려서 뱃지를 획득해보세요!
              </p>
              <button
                onClick={() => navigate('/upload')}
                className="bg-primary text-white px-8 py-4 min-h-[48px] rounded-full font-semibold text-base hover:bg-primary/90 transition-colors shadow-lg flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>add_a_photo</span>
                첫 사진 올리기
              </button>
            </div>
          )}
        </main>
      </div>

      <BottomNavigation />

      {/* 뱃지 상세 모달 - 달성 조건 명시 + 획득 시 성취감 피드백 */}
      {selectedBadge && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div 
            className={`w-full max-w-sm flex flex-col rounded-2xl overflow-hidden shadow-2xl ${selectedBadge.isEarned ? 'bg-gradient-to-b from-primary/10 to-white dark:from-primary/20 dark:to-gray-900 ring-2 ring-primary/30' : 'bg-white dark:bg-background-dark'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center p-6 overflow-y-auto max-h-[85vh]">
              {/* 획득 시 상단 축하 문구 */}
              {selectedBadge.isEarned && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 mb-3">
                  <span className="text-lg">🎉</span>
                  <span className="text-sm font-bold">획득 완료!</span>
                </div>
              )}

              {/* 뱃지 아이콘 */}
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 ${selectedBadge.isEarned ? 'bg-primary/20 shadow-lg' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <span className="text-5xl">
                  {selectedBadge.icon || '🏆'}
                </span>
                {selectedBadge.isEarned && (
                  <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold border-2 border-white dark:border-gray-900">✓</span>
                )}
              </div>

              <h2 className={`mt-4 text-xl font-bold ${selectedBadge.isEarned ? 'text-primary' : 'text-gray-800 dark:text-gray-200'}`}>
                {getBadgeDisplayName(selectedBadge)}
              </h2>

              {/* 달성 조건 한 줄 (명확하게) */}
              {selectedBadge.shortCondition && (
                <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                  목표: {selectedBadge.shortCondition}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${[3, 4].includes(selectedBadge.difficulty) ? 'bg-primary text-white' : selectedBadge.difficulty === 2 ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'}`}>
                  난이도 {typeof selectedBadge.difficulty === 'number' ? ({ 1: '하', 2: '중', 3: '상', 4: '최상' }[selectedBadge.difficulty] || '중') : (selectedBadge.difficulty || '중')}
                </span>
              </div>

              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed px-1">
                {selectedBadge.description}
              </p>

              {/* 미획득: 진행도 + 현재/목표 수치 */}
              {!selectedBadge.isEarned && (
                <div className="mt-4 w-full space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">진행 상황</span>
                    <span className="font-bold text-primary">
                      {selectedBadge.progressTarget != null && selectedBadge.progressCurrent !== undefined
                        ? `${selectedBadge.progressCurrent} / ${selectedBadge.progressTarget}${selectedBadge.progressUnit || ''}`
                        : `${Math.round(selectedBadge.progress || 0)}%`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, selectedBadge.progress || 0)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedBadge.shortCondition ? `조건을 달성하면 뱃지를 획득할 수 있어요.` : '활동을 이어가면 뱃지를 획득할 수 있어요.'}
                  </p>
                </div>
              )}

              {/* 획득 시: 획득일 + 성취 메시지 */}
              {selectedBadge.isEarned && selectedBadge.earnedAt && (
                <div className="mt-4 w-full flex flex-col gap-2">
                  <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-xs text-gray-600 dark:text-gray-400">획득일</p>
                    <p className="text-base font-bold text-primary">
                      {new Date(selectedBadge.earnedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    👍 이 조건을 달성했어요. 앞으로도 많은 제보 부탁해요!
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={closeModal}
                className="w-full py-4 font-semibold text-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
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

export default BadgeListScreen;
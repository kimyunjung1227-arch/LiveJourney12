import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getWeatherByRegion } from '../api/weather';
import { filterRecentPosts, filterActivePosts48 } from '../utils/timeUtils';
import { getLandmarksByRegion } from '../utils/regionLandmarks';
import { logger } from '../utils/logger';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getRegionDefaultImage } from '../utils/regionDefaultImages';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import { getGridCoverDisplay } from '../utils/postMedia';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxRegion,
} from '../utils/feedGridCardStyles';
import { normalizeRegionName, postMatchesCanonicalRegion } from '../utils/regionNames';
import StatusBadge from '../components/StatusBadge';
import { getPhotoStatusFromPost } from '../utils/photoStatus';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { getTimeAgo } from '../utils/timeUtils';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import { useAuth } from '../contexts/AuthContext';

const RegionDetailScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { regionName: regionNameParam } = useParams();
  const location = useLocation();
  const decodedName = regionNameParam ? decodeURIComponent(regionNameParam) : '';
  const canonicalRegionName = normalizeRegionName(decodedName || location.state?.region?.name || '서울');
  const region = { ...(location.state?.region || {}), name: canonicalRegionName };
  const focusLocation = location.state?.focusLocation || null;
  const placeTitle = location.state?.placeTitle || null;
  const headerTitle = placeTitle || region.name || canonicalRegionName;

  const [realtimePhotos, setRealtimePhotos] = useState([]);
  const [allRegionPosts, setAllRegionPosts] = useState([]); // 전체 게시물 저장
  const [activeFilter, setActiveFilter] = useState('all'); // 필터 상태: 'all', 'blooming', 'spots', 'food'

  const filterScrollRef = useRef(null);
  const filterButtonRefs = useRef({});
  const { handleDragStart: handleFilterDrag, hasMovedRef: filterHasMovedRef } = useHorizontalDragScroll();

  const [weatherInfo, setWeatherInfo] = useState({
    icon: '☀️',
    condition: '맑음',
    temperature: '27℃',
    loading: false
  });

  const [selectedLandmarks, setSelectedLandmarks] = useState([]); // 선택된 명소 ID 목록
  const [showLandmarkModal, setShowLandmarkModal] = useState(false); // 명소 선택 모달 표시 여부
  const bodyRef = useRef(null);

  // 시간을 숫자로 변환하는 함수 (정렬용)
  const timeToMinutes = useCallback((timeLabel) => {
    if (timeLabel === '방금') return 0;
    if (timeLabel.includes('분 전')) return parseInt(timeLabel);
    if (timeLabel.includes('시간 전')) return parseInt(timeLabel) * 60;
    if (timeLabel.includes('일 전')) return parseInt(timeLabel) * 24 * 60;
    return 999999; // 알 수 없는 경우 맨 뒤로
  }, []);

  // 지역 데이터 로드 (useCallback) — Supabase + 로컬 병합 후 사용자 업로드 사진 연동
  const loadRegionData = useCallback(async () => {
    const localPosts = getUploadedPostsSafe();
    const supabasePosts = await fetchPostsSupabase(user?.id || null);
    const combinedPosts = getCombinedPosts(combinePostsSupabaseAndLocal(supabasePosts, localPosts));

    // 7일 이내 게시물 필터링
    const recentPosts = filterActivePosts48(combinedPosts);
    logger.log(`📊 ${region.name} - 7일 이내 게시물: ${recentPosts.length}개`);

    let regionPosts = recentPosts.filter((post) => postMatchesCanonicalRegion(post, canonicalRegionName));

    const applyPlaceFocus = (posts) => {
      if (!focusLocation) return posts;
      const focus = focusLocation.toLowerCase();
      const tokens = focus.split(/\s+/).filter((t) => t.length >= 2);
      return posts.filter((post) => {
        const detailed = (post.detailedLocation || post.placeName || '').toLowerCase();
        const locText = (post.location || '').toLowerCase();
        const blob = `${detailed} ${locText}`;
        if (blob.includes(focus)) return true;
        return tokens.some((t) => blob.includes(t));
      });
    };

    // 상세 장소(focusLocation)가 넘어온 경우: 지역 게시물 중에서 장소 키워드로 좁힘 → 없으면 전체 최근 게시물에서 동일 키워드 검색
    if (focusLocation) {
      let narrowed = applyPlaceFocus(regionPosts);
      if (narrowed.length === 0) {
        narrowed = applyPlaceFocus(recentPosts);
        logger.log(`🎯 장소 키워드 전역 검색: ${focusLocation} → ${narrowed.length}개 게시물`);
      } else {
        logger.log(`🎯 상세 위치 필터 적용: ${focusLocation} → ${narrowed.length}개 게시물`);
      }
      regionPosts = narrowed;
    }

    // 선택된 명소로 필터링 (현재 지역의 명소만 사용)
    if (selectedLandmarks.length > 0) {
      const currentRegionLandmarks = getLandmarksByRegion(region.name);
      const selectedLandmarkObjects = currentRegionLandmarks.filter(l =>
        selectedLandmarks.includes(l.id)
      );

      if (selectedLandmarkObjects.length > 0) {
        regionPosts = regionPosts.filter(post => {
          // 게시물의 위치 정보
          const postLocation = (post.detailedLocation || post.placeName || post.location || '').toLowerCase();
          const postTags = (post.tags || []).join(' ').toLowerCase();
          const postNote = (post.note || post.content || '').toLowerCase();
          const searchText = `${postLocation} ${postTags} ${postNote}`;

          // 선택된 명소 중 하나라도 키워드와 일치하면 true
          return selectedLandmarkObjects.some(landmark => {
            return landmark.keywords.some(keyword => {
              return searchText.includes(keyword.toLowerCase());
            });
          });
        });
        logger.log(`🏛️ ${region.name} 명소 필터 적용: ${selectedLandmarks.length}개 명소 → ${regionPosts.length}개 게시물`);
      }
    }

    regionPosts = regionPosts
      .sort((a, b) => {
        // 시간순 정렬 (최신순)
        const timeA = timeToMinutes(a.timeLabel || '방금');
        const timeB = timeToMinutes(b.timeLabel || '방금');
        return timeA - timeB;
      });


    const formattedPosts = regionPosts
      .map(post => ({
        ...post,
        id: post.id,
        images: (post.images || []).map(getDisplayImageUrl),
        videos: (post.videos || []).map(getDisplayImageUrl),
        image: getDisplayImageUrl(post.images?.[0] || post.videos?.[0] || post.image || post.thumbnail),
        time: post.timeLabel || getTimeAgo(post.photoDate || post.exifData?.photoDate || post.timestamp || post.createdAt || post.time) || '방금',
        timeLabel: post.timeLabel || getTimeAgo(post.photoDate || post.exifData?.photoDate || post.timestamp || post.createdAt || post.time) || '방금',
        category: post.category || '일반',
        categoryName: post.categoryName,
        labels: post.aiLabels,
        detailedLocation: post.detailedLocation || post.placeName,
        placeName: post.placeName,
        address: post.address,
        location: post.location,
        tags: post.tags || post.aiLabels || [],
        note: post.note || post.content,
        likes: post.likes || post.likeCount || 0,
        user: post.user || '여행자',
        userId: post.userId,
        comments: post.comments || [],
        qnaList: post.qnaList || [],
        timestamp: post.timestamp || post.createdAt || post.time,
      }));

    const seenIds = new Set();
    const dedupedPosts = [];
    formattedPosts.forEach((p) => {
      const id = String(p?.id ?? '');
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      dedupedPosts.push(p);
    });

    setAllRegionPosts(dedupedPosts);

    logger.log('📊 지역 게시물 로드:', {
      total: dedupedPosts.length
    });
  }, [canonicalRegionName, region.name, timeToMinutes, selectedLandmarks, focusLocation, user?.id]);

  // 필터에 따른 게시물 필터링 및 표시
  useEffect(() => {
    let filtered = [];

    if (activeFilter === 'all') {
      filtered = allRegionPosts;
    } else if (activeFilter === 'blooming') {
      filtered = allRegionPosts.filter(post => post.category === 'bloom');
    } else if (activeFilter === 'spots') {
      filtered = allRegionPosts.filter(post => post.category === 'landmark' || post.category === 'scenic');
    } else if (activeFilter === 'food') {
      filtered = allRegionPosts.filter(post => post.category === 'food');
    } else {
      filtered = allRegionPosts;
    }

    setRealtimePhotos(filtered);
  }, [allRegionPosts, activeFilter]);

  // 필터 변경 시 해당 버튼이 앞으로 오도록 스크롤
  useEffect(() => {
    if (filterButtonRefs.current[activeFilter] && filterScrollRef.current) {
      const button = filterButtonRefs.current[activeFilter];
      const container = filterScrollRef.current;

      // 약간의 지연을 두어 DOM 업데이트 완료 후 스크롤
      setTimeout(() => {
        if (button && container) {
          // 버튼의 위치 계산
          const buttonLeft = button.offsetLeft;
          const buttonWidth = button.offsetWidth;
          const containerWidth = container.clientWidth;
          const containerScrollLeft = container.scrollLeft;
          const buttonRight = buttonLeft + buttonWidth;
          const containerRight = containerScrollLeft + containerWidth;

          // 버튼이 보이는 영역 밖에 있으면 스크롤
          if (buttonLeft < containerScrollLeft) {
            // 버튼이 왼쪽에 있으면 맨 앞으로
            container.scrollTo({
              left: buttonLeft - 16, // px-4 패딩 고려
              behavior: 'smooth'
            });
          } else if (buttonRight > containerRight) {
            // 버튼이 오른쪽에 있으면 보이도록
            container.scrollTo({
              left: buttonLeft - containerWidth + buttonWidth + 16,
              behavior: 'smooth'
            });
          }
        }
      }, 150);
    }
  }, [activeFilter]);

  // 날씨 정보 가져오기 (useCallback) - 재시도 로직 포함
  const fetchWeatherData = useCallback(async (forceRefresh = false) => {
    setWeatherInfo(prev => ({ ...prev, loading: true }));
    try {
      const result = await getWeatherByRegion(region.name, forceRefresh);
      if (result.success) {
        setWeatherInfo({
          icon: result.weather.icon,
          condition: result.weather.condition,
          temperature: result.weather.temperature,
          loading: false
        });
      } else {
        const w = result.weather || {};
        setWeatherInfo({
          icon: w.icon || '🌤️',
          condition: w.condition && w.condition !== '-' ? w.condition : '정보 없음',
          temperature: w.temperature || '-',
          loading: false
        });
      }
    } catch (error) {
      console.error('날씨 정보 조회 실패:', error);
      setWeatherInfo(prev => ({ ...prev, loading: false }));
    }
  }, [region.name]);

  useEffect(() => {
    loadRegionData();
    fetchWeatherData();

    // 날씨 정보 주기적 갱신 (5분마다)
    const weatherInterval = setInterval(() => {
      logger.log(`🔄 날씨 정보 자동 갱신: ${region.name}`);
      fetchWeatherData(true); // 강제 새로고침
    }, 5 * 60 * 1000);

    // 게시물 업데이트 이벤트 리스너
    const handlePostsUpdate = () => {
      logger.log(`🔄 ${region.name} 지역상세 - 게시물 업데이트 감지`);
      loadRegionData();
    };

    window.addEventListener('postsUpdated', handlePostsUpdate);
    window.addEventListener('newPostsAdded', handlePostsUpdate);

    return () => {
      clearInterval(weatherInterval);
      window.removeEventListener('postsUpdated', handlePostsUpdate);
      window.removeEventListener('newPostsAdded', handlePostsUpdate);
    };
  }, [loadRegionData, fetchWeatherData, region.name]);

  // 좋아요 변경 이벤트 수신해서 지역 상세 화면에서도 즉시 반영
  useEffect(() => {
    const onPostLikeUpdated = (e) => {
      const { postId, likesCount, isLiked } = e.detail || {};
      if (!postId) return;
      const id = String(postId);
      const merge = (p) => {
        if (!p || String(p.id) !== id) return p;
        const next = { ...p };
        if (typeof likesCount === 'number') {
          next.likes = likesCount;
          next.likeCount = likesCount;
        }
        if (typeof isLiked === 'boolean') {
          next.likedByMe = isLiked;
        }
        return next;
      };
      setAllRegionPosts((prev) => prev.map(merge));
      setRealtimePhotos((prev) => prev.map(merge));
    };
    window.addEventListener('postLikeUpdated', onPostLikeUpdated);
    return () => window.removeEventListener('postLikeUpdated', onPostLikeUpdated);
  }, []);

  return (
    <div className="screen-layout bg-white dark:bg-background-dark relative h-screen overflow-hidden">
      <div className="screen-content relative bg-white dark:bg-background-dark">
        {/* 뒤로가기 구역 — sticky + pointer-events-none 제거로 항상 클릭 가능 */}
        <header
          className="flex flex-col sticky top-0 z-[100] shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center justify-between px-3 py-3 pb-1 bg-white dark:bg-background-dark">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/main', { replace: true });
                }
              }}
              className="flex size-12 shrink-0 items-center justify-center text-black dark:text-white rounded-full bg-transparent hover:bg-gray-100 dark:hover:bg-black/20 transition-colors cursor-pointer touch-manipulation"
              aria-label="뒤로가기"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <h1 className="flex-1 text-center text-base font-bold leading-tight tracking-[-0.01em] text-black dark:text-white px-1 line-clamp-2">
              {headerTitle}
            </h1>
            <div className="size-11 shrink-0" aria-hidden />
          </div>

          {/* 날씨 — 은은한 회색 패널로 가독성 확보 */}
          <div className="flex justify-center px-3 pb-2">
            <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-xl border border-slate-300/50 bg-slate-100/90 px-4 shadow-sm backdrop-blur-sm dark:border-slate-600/50 dark:bg-slate-800/85">
              {weatherInfo.loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
              ) : (
                <>
                  <span className="text-base">{weatherInfo.icon}</span>
                  <p
                    className="font-semibold leading-normal text-slate-900 dark:text-slate-100"
                    style={{
                      fontSize: 13,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {weatherInfo.condition}
                    {' · '}
                    <span style={{ fontSize: 14 }}>{weatherInfo.temperature}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </header>

        <div
          ref={bodyRef}
          className="screen-body relative z-10 bg-background-light dark:bg-background-dark rounded-t-[18px]"
          style={{ overflowY: 'auto', maxHeight: '62vh' }}
        >
          <main>

            {/* 현장 실시간 정보 */}
            <div>
              {/* 제목 + 대표명소 버튼 (우측) */}
              <div className="flex items-center justify-between px-4 pb-1 pt-4">
                <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-text-headings dark:text-gray-100">
                  {headerTitle} 현지 실시간 상황
                </h2>
                <button
                  onClick={() => setShowLandmarkModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary-soft hover:bg-primary/20 transition-colors whitespace-nowrap"
                >
                  {selectedLandmarks.length > 0
                    ? `${region.name} 대표명소 (${selectedLandmarks.length})`
                    : `${region.name} 대표명소 보기`
                  }
                </button>
              </div>

              {/* 필터 버튼 - 슬라이드 가능 (좌·우 여백: 핸드폰에서 잘리지 않도록) */}
              <div className="pb-2 w-full">
                <div
                  ref={filterScrollRef}
                  onMouseDown={handleFilterDrag}
                  className="flex gap-2 overflow-x-scroll overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth cursor-grab"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    overflowX: 'scroll',
                    overflowY: 'hidden',
                    width: '100%',
                    scrollSnapType: 'x mandatory',
                    paddingLeft: 'max(16px, env(safe-area-inset-left, 12px))',
                    paddingRight: 'max(16px, env(safe-area-inset-right, 12px))'
                  }}
                >
                  <button
                    ref={(el) => filterButtonRefs.current['all'] = el}
                    onClick={() => {
                      if (!filterHasMovedRef.current) setActiveFilter('all');
                    }}
                    style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeFilter === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    전체
                  </button>
                  <button
                    ref={(el) => filterButtonRefs.current['blooming'] = el}
                    onClick={() => {
                      if (!filterHasMovedRef.current) setActiveFilter('blooming');
                    }}
                    style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeFilter === 'blooming'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    🌸 개화정보
                  </button>
                  <button
                    ref={(el) => filterButtonRefs.current['spots'] = el}
                    onClick={() => {
                      if (!filterHasMovedRef.current) setActiveFilter('spots');
                    }}
                    style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeFilter === 'spots'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    🏞️ 가볼만한 곳
                  </button>
                  <button
                    ref={(el) => filterButtonRefs.current['food'] = el}
                    onClick={() => {
                      if (!filterHasMovedRef.current) setActiveFilter('food');
                    }}
                    style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeFilter === 'food'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    🍜 맛집 정보
                  </button>
                </div>
              </div>

              {realtimePhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">add_a_photo</span>
                  <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                    {region.name}의 실시간 정보가 없어요
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                    첫 번째 사진을 공유해보세요!
                  </p>
                  <button
                    onClick={() => navigate('/upload')}
                    className="bg-primary text-white px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors shadow-lg flex items-center gap-2 mx-auto"
                  >
                    <span className="material-symbols-outlined">add_a_photo</span>
                    첫 사진 올리기
                  </button>
                </div>
              ) : (
                <div className="px-4 pb-3">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      rowGap: '7px',
                      columnGap: '7px'
                    }}
                  >
                    {realtimePhotos.map((photo, idx) => {
                      const weather = photo.weather || null;
                      const hasWeather = weather && (weather.icon || weather.temperature);
                      const isLiked = !!photo.likedByMe;
                      const likeCount = photo.likes || photo.likeCount || 0;
                      const gridCover = getGridCoverDisplay(photo, getDisplayImageUrl);
                      const status = getPhotoStatusFromPost(photo);

                      return (
                        <div
                          key={photo.id}
                          onClick={() => {
                            const currentIndex = allRegionPosts.findIndex(p => p.id === photo.id);
                            navigate(`/post/${photo.id}`, {
                              state: {
                                post: photo,
                                allPosts: allRegionPosts,
                                currentPostIndex: currentIndex >= 0 ? currentIndex : 0
                              }
                            });
                          }}
                          style={{
                            ...feedGridCardBoxFlat,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={feedGridImageBoxRegion}>
                            {gridCover.mode === 'img' && gridCover.src ? (
                              <img
                                src={gridCover.src}
                                alt={photo.location || region.name}
                                loading="eager"
                                decoding="async"
                                fetchPriority={idx < 4 ? 'high' : 'auto'}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            ) : (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#cbd5e1',
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>image</span>
                              </div>
                            )}
                            {status !== 'NONE' && (
                              <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3 }}>
                                <StatusBadge status={status} />
                              </div>
                            )}
                          </div>

                          <div className="min-h-0 flex flex-col gap-0.5 overflow-hidden px-0.5 pb-0.5 pt-0">
                            <div className="text-[13px] font-bold text-gray-900 dark:text-gray-100 truncate shrink-0">
                              {photo.detailedLocation || photo.placeName || photo.location || region.name}
                            </div>
                            {(photo.note || photo.content) && (
                              <div className="text-xs text-gray-600 dark:text-gray-300 leading-snug max-h-[2.7em] overflow-hidden line-clamp-2">
                                {photo.note || photo.content}
                              </div>
                            )}
                            <div className="flex justify-between items-center mt-0.5 shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>{photo.time}</span>
                              {hasWeather && (
                                <span className="inline-flex items-center gap-1">
                                  {weather.icon && <span>{weather.icon}</span>}
                                  {weather.temperature && <span>{weather.temperature}</span>}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* 위로가기 버튼 - 프로필 버튼 바로 위, 흰색 완전 원형 */}
      <button
        type="button"
        onClick={() => {
          if (bodyRef.current) {
            bodyRef.current.scrollTop = 0;
            if (typeof bodyRef.current.scrollTo === 'function') {
              bodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 20px)',
          right: 'calc((100vw - 460px) / 2 + 20px)',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(148,163,184,0.5)',
          boxShadow: '0 4px 14px rgba(15,23,42,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 200
        }}
        aria-label="위로가기"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#111827' }}>north</span>
      </button>

      <BottomNavigation />

      {/* 명소 선택 모달 - 화면 가운데 */}
      {showLandmarkModal && (
        <div
          className="fixed inset-0 bg-black/30 md:bg-black/40 flex items-center justify-center z-[200] p-4"
          onClick={() => setShowLandmarkModal(false)}
        >
          <div
            className="w-full max-w-lg bg-background-light dark:bg-background-dark rounded-2xl max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
              <h3 className="text-lg font-bold text-text-headings dark:text-gray-100">
                {region.name} 대표 명소
              </h3>
              <button
                onClick={() => setShowLandmarkModal(false)}
                className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark"
              >
                close
              </button>
            </div>

            {/* 설명 */}
            <div className="px-4 pt-4">
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {region.name}의 대표 명소를 선택하세요. 선택한 명소의 사진만 표시됩니다.
              </p>
            </div>

            {/* 명소 목록 - 현재 지역만 */}
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const currentLandmarks = getLandmarksByRegion(region.name);

                if (currentLandmarks.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12">
                      <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">location_off</span>
                      <p className="text-base font-medium text-gray-700 dark:text-gray-300 text-center">
                        {region.name}의 대표 명소 정보가 없습니다.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {currentLandmarks.map((landmark) => {
                      const isSelected = selectedLandmarks.includes(landmark.id);
                      return (
                        <button
                          key={landmark.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedLandmarks(selectedLandmarks.filter(id => id !== landmark.id));
                            } else {
                              setSelectedLandmarks([...selectedLandmarks, landmark.id]);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${isSelected
                            ? 'bg-primary-soft border-primary text-primary'
                            : 'bg-background dark:bg-card-dark border-border-light dark:border-border-dark text-text-headings dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                        >
                          <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                            {landmark.name}
                          </span>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* 푸터 */}
            <div className="flex gap-2 p-4 border-t border-border-light dark:border-border-dark">
              <button
                onClick={() => {
                  setSelectedLandmarks([]);
                  setShowLandmarkModal(false);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-background dark:bg-card-dark text-text-secondary-light dark:text-text-secondary-dark font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                초기화
              </button>
              <button
                onClick={() => {
                  setShowLandmarkModal(false);
                  loadRegionData();
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-dark transition-colors"
              >
                {selectedLandmarks.length > 0 ? `${selectedLandmarks.length}개 선택됨` : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionDetailScreen;

















































import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getUnreadCount } from '../utils/notifications';
import { getTimeAgo, filterRecentPosts, isOlderThanTwoDays } from '../utils/timeUtils';
import { getInterestPlaces, toggleInterestPlace } from '../utils/interestPlaces';
import { getRegionDefaultImage } from '../utils/regionDefaultImages';
import { logger } from '../utils/logger';
import { getRecommendedRegions, RECOMMENDATION_TYPES } from '../utils/recommendationEngine';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import './MainScreen.css';
import { getCombinedPosts } from '../utils/mockData';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getPostAccuracyCount } from '../utils/socialInteractions';
import { getWeatherByRegion } from '../api/weather';

const MainScreen = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedTag, setSelectedTag] = useState(null);
    const [popularTags, setPopularTags] = useState([]);

    const [realtimeData, setRealtimeData] = useState([]);
    const [crowdedData, setCrowdedData] = useState([]);
    const [recommendedData, setRecommendedData] = useState([]);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [allPostsForRecommend, setAllPostsForRecommend] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [interestPlaces, setInterestPlaces] = useState([]);
    const [selectedInterest, setSelectedInterest] = useState(null);
    const [showAddInterestModal, setShowAddInterestModal] = useState(false);
    const [newInterestPlace, setNewInterestPlace] = useState('');
    // 국내 관심지역 선택용 상태 (전국 8도)
    const [selectedCountry, setSelectedCountry] = useState('서울');
    const [selectedCity, setSelectedCity] = useState('서울 전체');
    const [selectedInterestLabels, setSelectedInterestLabels] = useState([]);
    const [deleteConfirmPlace, setDeleteConfirmPlace] = useState(null);
    const [selectedRecommendTag, setSelectedRecommendTag] = useState('active');

    const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
    const videoRefs = useRef(new Map());
    const currentlyPlayingVideo = useRef(null);

    const withDragCheck = useCallback((fn) => () => {
        if (!hasMovedRef.current) fn();
    }, [hasMovedRef]);

    // Intersection Observer로 화면에 보이는 동영상만 재생
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target;

                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        // 이전에 재생 중이던 비디오가 있으면 일시정지
                        if (currentlyPlayingVideo.current && currentlyPlayingVideo.current !== video) {
                            const prevVideo = currentlyPlayingVideo.current;
                            if (prevVideo && !prevVideo.paused) {
                                prevVideo.pause();
                            }
                        }
                        // 현재 비디오 재생
                        if (video && video.paused) {
                            video.play().catch(() => {
                                // 자동 재생이 차단된 경우 무시
                            });
                            currentlyPlayingVideo.current = video;
                        }
                    } else {
                        // 화면에서 벗어나면 일시정지
                        if (video && !video.paused) {
                            video.pause();
                        }
                        if (currentlyPlayingVideo.current === video) {
                            currentlyPlayingVideo.current = null;
                        }
                    }
                });
            },
            {
                threshold: [0, 0.5, 1],
                rootMargin: '0px',
            }
        );

        // 모든 비디오 요소 관찰
        const videos = Array.from(videoRefs.current.values()).filter(Boolean);
        videos.forEach((video) => {
            observer.observe(video);
        });

        return () => {
            videos.forEach((video) => {
                observer.unobserve(video);
            });
            observer.disconnect();
        };
    }, [realtimeData, crowdedData, recommendedData, selectedInterest]);

    const loadMockData = useCallback(async () => {
        const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');

        // Supabase에서 실제 게시물 불러오기 (실패 시 빈 배열)
        const supabasePosts = await fetchPostsSupabase();

        // Supabase + 로컬 결합 후 id 기준 중복 제거 (같은 게시물이 피드에 2번 나오는 것 방지)
        const byId = new Map();
        [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach((p) => {
          if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
        });
        const combined = Array.from(byId.values());
        // 관리자가 삭제한 게시물은 제외 (다른 탭에서 삭제했거나 이벤트를 놓친 경우)
        let deletedIds = new Set();
        try {
            const raw = sessionStorage.getItem('adminDeletedPostIds') || '[]';
            deletedIds = new Set(JSON.parse(raw));
            sessionStorage.removeItem('adminDeletedPostIds');
        } catch (_) {}
        const combinedFiltered = combined.filter((p) => p && p.id && !deletedIds.has(String(p.id)));
        const allPosts = getCombinedPosts(combinedFiltered);

        // 메인 피드 기준: 기본적으로 최근 7일 이내 게시물만 사용하되,
        // 48시간이 지난 게시물은 완전히 숨기지 않고 노출 우선순위만 낮춰서 사용한다.
        const posts = filterRecentPosts(allPosts, 7);

        // 촬영 시간 라벨 포맷터 (가볍게: "2/10 14:30")
        const formatCaptureLabel = (post) => {
            const src = post.photoDate || post.timestamp || post.createdAt;
            if (!src) return null;
            const d = new Date(src);
            if (Number.isNaN(d.getTime())) return null;
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const hours = d.getHours();
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${month}/${day} ${hours}:${minutes}`;
        };

        // ===== 태그 분류용 집계 (장소별 통계) =====
        const now = Date.now();
        const placeStats = {};

        const getPlaceKey = (post) => {
            return post.location || post.placeName || post.detailedLocation || '기록';
        };

        const collectTextForPost = (post) => {
            const tags = Array.isArray(post.tags) ? post.tags : [];
            const parts = [
                post.note,
                post.content,
                post.categoryName,
                post.location,
                post.placeName,
                ...tags.map((t) => typeof t === 'string' ? t : String(t || ''))
            ].filter(Boolean);
            return parts.join(' ');
        };

        posts.forEach((post) => {
            const placeKey = getPlaceKey(post);
            if (!placeStats[placeKey]) {
                placeStats[placeKey] = {
                    // 실시간 계층 (최근 60분)
                    waitingRecent: 0,
                    soldoutRecent: 0,
                    // 시즌/이벤트 계층 (최근 24시간)
                    blossom24h: 0,
                    newMenu24h: 0,
                    popup24h: 0,
                    total24h: 0,
                    // 상시 특징 계층 (누적)
                    nightViewAll: 0,
                    parkingAll: 0,
                    photoSpotAll: 0,
                    totalAll: 0,
                };
            }

            const stats = placeStats[placeKey];
            const text = collectTextForPost(post);
            const ts = post.timestamp || post.createdAt || post.time;
            const postTime = ts ? new Date(ts).getTime() : now;
            const diffMinutes = Math.max(0, (now - postTime) / 60000);
            const diffHours = diffMinutes / 60;

            const hasWaiting = text.includes('웨이팅') || text.includes('대기') || text.includes('줄') || text.includes('북적');
            const hasSoldout = text.includes('재고') || text.includes('소진') || text.includes('품절');
            const hasBlossom = text.includes('벚꽃') || text.includes('꽃놀이') || text.includes('벚꽃축제');
            const hasNewMenu = text.includes('신메뉴') || text.includes('신상') || text.includes('한정') || text.includes('시즌메뉴');
            const hasPopup = text.includes('팝업') || text.includes('팝업스토어');
            const hasNightView = text.includes('야경');
            const hasParking = text.includes('주차');
            const hasPhotoSpot = text.includes('포토존') || text.includes('사진 맛집') || text.includes('사진맛집') || text.includes('인스타');

            // 실시간: 최근 60분 이내 제보
            if (diffMinutes <= 60) {
                if (hasWaiting) stats.waitingRecent += 1;
                if (hasSoldout) stats.soldoutRecent += 1;
            }

            // 시즌/이벤트: 최근 24시간
            if (diffHours <= 24) {
                stats.total24h += 1;
                if (hasBlossom) stats.blossom24h += 1;
                if (hasNewMenu) stats.newMenu24h += 1;
                if (hasPopup) stats.popup24h += 1;
            }

            // 상시 특징: 누적
            stats.totalAll += 1;
            if (hasNightView) stats.nightViewAll += 1;
            if (hasParking) stats.parkingAll += 1;
            if (hasPhotoSpot) stats.photoSpotAll += 1;
        });

        const transformPost = (post) => {
            const dynamicTime = getTimeAgo(post.timestamp || post.createdAt || post.time);
            // 급상승 지표 계산 (최근 좋아요 증가율 기반)
            const recentLikes = post.likes || 0;
            const surgeIndicator = recentLikes > 50 ? '급상승' : recentLikes > 20 ? '인기' : '실시간';
            const surgePercent = recentLikes > 50 ? Math.floor(Math.random() * 50) + 100 : recentLikes > 20 ? Math.floor(Math.random() * 30) + 50 : Math.floor(Math.random() * 30) + 20;

            const placeKey = getPlaceKey(post);
            const stats = placeStats[placeKey] || {
                waitingRecent: 0,
                soldoutRecent: 0,
                blossom24h: 0,
                newMenu24h: 0,
                popup24h: 0,
                total24h: 0,
                nightViewAll: 0,
                parkingAll: 0,
                photoSpotAll: 0,
                totalAll: 0,
            };

            const reasonTags = [];

            // 1) 실시간 상태 (Live) - 최우선
            if (stats.waitingRecent >= 3) {
                reasonTags.push('#지금_웨이팅_폭주');
            }
            if (stats.soldoutRecent >= 2) {
                reasonTags.push('#재고_소진_임박');
            }

            // 2) 시즌/이벤트 (Context) - 최근 24시간 / 48시간 맥락
            if (stats.total24h > 0) {
                const blossomRatio = stats.blossom24h / stats.total24h;
                if (blossomRatio >= 0.7) {
                    reasonTags.push('#벚꽃_절정');
                }
                const newMenuRatio = stats.newMenu24h / stats.total24h;
                if (newMenuRatio >= 0.4) {
                    reasonTags.push('#신메뉴_출시');
                }
                const popupRatio = stats.popup24h / stats.total24h;
                if (popupRatio >= 0.4) {
                    reasonTags.push('#팝업스토어');
                }
            }

            // 3) 상시 특징 (Feature) - 누적 리뷰 기반
            if (stats.totalAll > 0) {
                const nightRatio = stats.nightViewAll / stats.totalAll;
                if (nightRatio >= 0.3) {
                    reasonTags.push('#야경_최고');
                }
                const parkingRatio = stats.parkingAll / stats.totalAll;
                if (parkingRatio >= 0.3) {
                    reasonTags.push('#주차_편함');
                }
                const photoRatio = stats.photoSpotAll / stats.totalAll;
                if (photoRatio >= 0.3) {
                    reasonTags.push('#사진_맛집');
                }
            }

            // 아무 태그도 없으면 가벼운 기본 태그로 보완 (정보 과부하 방지용 1~2개)
            const uniqueReasons = [...new Set(reasonTags)];
            if (uniqueReasons.length === 0) {
                const fallback = ['#추천_맛집', '#SNS_화제', '#오늘_특가', '#사진_맛집'];
                const shuffled = [...fallback].sort(() => 0.5 - Math.random());
                uniqueReasons.push(shuffled[0]);
            }

            const firstImageUrl = (post.images && post.images.length > 0) ? post.images[0] : (post.image || post.thumbnail || '');
            const firstVideoUrl = (post.videos && post.videos.length > 0) ? post.videos[0] : '';
            const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
            const commentsArr = Array.isArray(post.comments) ? post.comments : [];
            return {
                ...post,
                id: post.id,
                image: getDisplayImageUrl(firstImageUrl || firstVideoUrl || ''),
                thumbnailIsVideo: !firstImageUrl && !!firstVideoUrl,
                firstVideoUrl: firstVideoUrl ? getDisplayImageUrl(firstVideoUrl) : null,
                title: post.location,
                time: dynamicTime,
                content: post.note || post.content || `${post.location}의 모습`,
                likes: likesNum,
                likeCount: likesNum,
                comments: commentsArr,
                weather: post.weather || null,
                surgeIndicator,
                surgePercent,
                // 메타데이터 기반 촬영 시간 라벨
                captureLabel: formatCaptureLabel(post),
                // 카드당 최대 2~3개 태그만 노출
                reasonTags: uniqueReasons.slice(0, 3),
            };
        };

        const transformedAll = posts.map(transformPost);

        // "지금 여기는": 최신순 정렬 후 상위 20개
        // 48시간이 지난 게시물은 점수에서 큰 패널티를 줘서 하단으로 보내되, 완전히 제외하지는 않는다.
        const byLatest = [...transformedAll].sort((a, b) => {
            const tA = a.timestamp || a.createdAt || a.time || 0;
            const tB = b.timestamp || b.createdAt || b.time || 0;
            const dateA = typeof tA === 'number' ? tA : new Date(tA).getTime();
            const dateB = typeof tB === 'number' ? tB : new Date(tB).getTime();
            const isOldA = isOlderThanTwoDays(a.timestamp || a.createdAt || a.time);
            const isOldB = isOlderThanTwoDays(b.timestamp || b.createdAt || b.time);
            const penaltyMs = 1000 * 60 * 60 * 24 * 2; // 48시간 상당 패널티
            const scoreA = dateA - (isOldA ? penaltyMs : 0);
            const scoreB = dateB - (isOldB ? penaltyMs : 0);
            return scoreB - scoreA;
        });
        setRealtimeData(byLatest.slice(0, 20));

        // "실시간 급상승 핫플": 다양한 카테고리에서 인기 게시물 선택
        // 좋아요 수가 높거나 최근 게시물을 우선적으로 선택
        const hotPosts = transformedAll
            .filter(p => {
                // 다양한 카테고리 포함: waiting, blooming, food, spots 등
                const hasLikes = (p.likes || 0) > 0;
                const isRecent = p.time && (p.time.includes('방금') || p.time.includes('분 전') || p.time.includes('시간 전'));
                return hasLikes || isRecent;
            })
            .sort((a, b) => {
                // 좋아요 수 기준 정렬, 같으면 최신순
                if (b.likes !== a.likes) return b.likes - a.likes;
                const timeA = a.time || '';
                const timeB = b.time || '';
                if (timeA.includes('방금')) return -1;
                if (timeB.includes('방금')) return 1;
                if (timeA.includes('분 전') && !timeB.includes('분 전')) return -1;
                if (timeB.includes('분 전') && !timeA.includes('분 전')) return 1;
                return 0;
            })
            .slice(0, 15); // 상위 15개 선택

        const crowdedWithAccuracy = (hotPosts.length > 0 ? hotPosts : transformedAll.slice(20, 35))
            .map(p => ({ ...p, accuracyCount: getPostAccuracyCount(p.id) }));
        setCrowdedData(crowdedWithAccuracy);

        // 추천 여행지: 현재는 Supabase/로컬에서 집계한 posts 기반으로 계산
        const recs = getRecommendedRegions(allPosts, selectedRecommendTag);
        setRecommendedData(recs.slice(0, 10));
        setAllPostsForRecommend(allPosts);
    }, [selectedRecommendTag]);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            await loadMockData();
        } catch (err) {
            logger.error('메인 피드 로딩 중 오류 (fallback로 계속 진행):', err);
        } finally {
            setLoading(false);
        }
    }, [loadMockData]);

    const loadInterestPlaces = useCallback(() => {
        const places = getInterestPlaces();
        setInterestPlaces(places);
    }, []);

    const filteredInterestPosts = useMemo(() => {
        if (!selectedInterest) return [];
        const allPosts = [...realtimeData, ...crowdedData, ...recommendedData];
        return allPosts.filter(item => {
            const location = item.location || item.title || '';
            return location.includes(selectedInterest) || selectedInterest.includes(location);
        }).filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
    }, [selectedInterest, realtimeData, crowdedData, recommendedData]);

    const handleAddInterestPlace = useCallback(() => {
        // 새 UI: 여러 개의 국내 관심지역을 한 번에 추가
        if (!selectedInterestLabels || selectedInterestLabels.length === 0) return;

        let addedAny = false;
        selectedInterestLabels.forEach((label) => {
            const added = toggleInterestPlace(label);
            if (added) addedAny = true;
        });

        if (addedAny) {
            loadInterestPlaces();
        }

        setShowAddInterestModal(false);
        setSelectedInterestLabels([]);
    }, [selectedInterestLabels, loadInterestPlaces]);

    const handleDeleteInterestPlace = useCallback(() => {
        if (deleteConfirmPlace) {
            toggleInterestPlace(deleteConfirmPlace);
            loadInterestPlaces();
            if (selectedInterest === deleteConfirmPlace) setSelectedInterest(null);
            setDeleteConfirmPlace(null);
        }
    }, [deleteConfirmPlace, loadInterestPlaces, selectedInterest]);

    useEffect(() => {
        fetchPosts();
        setUnreadNotificationCount(getUnreadCount());
        loadInterestPlaces();
    }, [fetchPosts, loadInterestPlaces]);

    // 메인 화면으로 돌아올 때마다 목록 재조회 (좋아요·댓글 DB 반영 확인)
    const prevPathRef = useRef('');
    useEffect(() => {
        if (location.pathname === '/') {
            if (prevPathRef.current !== '/') fetchPosts();
            prevPathRef.current = '/';
        } else {
            prevPathRef.current = location.pathname;
        }
    }, [location.pathname, fetchPosts]);

    // 상세에서 좋아요 반영 시 메인 목록의 해당 게시물 좋아요 수 동기화
    useEffect(() => {
        const onPostLikeUpdated = (e) => {
            const { postId, likesCount } = e.detail || {};
            if (!postId || typeof likesCount !== 'number') return;
            const id = String(postId);
            const updateLikes = (p) => (p && String(p.id) === id ? { ...p, likes: likesCount, likeCount: likesCount } : p);
            setRealtimeData((prev) => prev.map(updateLikes));
            setCrowdedData((prev) => prev.map(updateLikes));
            setRecommendedData((prev) => prev.map(updateLikes));
            setAllPostsForRecommend((prev) => (Array.isArray(prev) ? prev.map(updateLikes) : prev));
        };
        window.addEventListener('postLikeUpdated', onPostLikeUpdated);
        return () => window.removeEventListener('postLikeUpdated', onPostLikeUpdated);
    }, []);

    // 상세에서 댓글 반영 시 메인 목록의 해당 게시물 댓글 수 동기화
    useEffect(() => {
        const onPostCommentsUpdated = (e) => {
            const { postId, comments } = e.detail || {};
            if (!postId || !Array.isArray(comments)) return;
            const id = String(postId);
            const updateComments = (p) => (p && String(p.id) === id ? { ...p, comments } : p);
            setRealtimeData((prev) => prev.map(updateComments));
            setCrowdedData((prev) => prev.map(updateComments));
            setRecommendedData((prev) => prev.map(updateComments));
            setAllPostsForRecommend((prev) => (Array.isArray(prev) ? prev.map(updateComments) : prev));
        };
        window.addEventListener('postCommentsUpdated', onPostCommentsUpdated);
        return () => window.removeEventListener('postCommentsUpdated', onPostCommentsUpdated);
    }, []);

    // 관리자가 게시물 삭제 시 메인에서 즉시 제거 후 DB 기준으로 다시 불러오기
    useEffect(() => {
        const onAdminDeletedPost = (e) => {
            const postId = e.detail?.postId ? String(e.detail.postId) : null;
            if (postId) {
                setRealtimeData((prev) => prev.filter((p) => p && String(p.id) !== postId));
                setCrowdedData((prev) => prev.filter((p) => p && String(p.id) !== postId));
                setRecommendedData((prev) => prev.filter((p) => p && String(p.id) !== postId));
                setAllPostsForRecommend((prev) => (Array.isArray(prev) ? prev.filter((p) => p && String(p.id) !== postId) : prev));
            }
            fetchPosts();
        };
        window.addEventListener('adminDeletedPost', onAdminDeletedPost);
        return () => window.removeEventListener('adminDeletedPost', onAdminDeletedPost);
    }, [fetchPosts]);

    // 탭/창 포커스 복귀 시 목록 다시 불러오기 (다른 탭에서 관리자가 삭제한 경우 반영)
    useEffect(() => {
        const onVisible = () => { fetchPosts(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchPosts]);

    // 게시물에 날씨가 없을 때 지역 기준으로 기온 조회 (카드에 기온 표시용)
    useEffect(() => {
        const regions = new Set();
        [...realtimeData, ...crowdedData].forEach((p) => {
            if (p && !p.weather && (p.region || p.location)) {
                const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
                if (r) regions.add(r);
            }
        });
        if (regions.size === 0) return;
        let cancelled = false;
        const map = {};
        Promise.all(
            Array.from(regions).map(async (region) => {
                try {
                    const res = await getWeatherByRegion(region);
                    if (!cancelled && res?.success && res.weather) return { region, weather: res.weather };
                } catch (_) {}
                return null;
            })
        ).then((results) => {
            if (cancelled) return;
            results.forEach((r) => { if (r) map[r.region] = r.weather; });
            setWeatherByRegion((prev) => ({ ...prev, ...map }));
        });
        return () => { cancelled = true; };
    }, [realtimeData, crowdedData]);

    // 새 알림이 생기면 메인 화면에서도 배지 갱신
    useEffect(() => {
        const onCountChange = () => setUnreadNotificationCount(getUnreadCount());
        window.addEventListener('notificationCountChanged', onCountChange);
        return () => window.removeEventListener('notificationCountChanged', onCountChange);
    }, []);

    // 추천 여행지 탭 변경 시 추천 목록만 갱신 (실시간 급상승 태그는 그대로 유지)
    useEffect(() => {
        if (!allPostsForRecommend || allPostsForRecommend.length === 0) return;
        const recs = getRecommendedRegions(allPostsForRecommend, selectedRecommendTag);
        setRecommendedData(recs.slice(0, 10));
    }, [selectedRecommendTag, allPostsForRecommend]);

    return (
        <div className="screen-layout bg-background-light dark:bg-background-dark">
            <div
                className="screen-content"
                style={{
                    background: '#ffffff',
                }}
            >
                {/* 앱 헤더: 로고 + 검색창 + 알림 */}
                <div className="app-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: '#ffffff',
                    backdropFilter: 'blur(10px)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    borderBottom: 'none',
                    boxShadow: 'none'
                }}>
                    <span
                        className="logo-text"
                        style={{
                            fontSize: '18px',
                            fontWeight: 700,
                            color: '#0f172a',
                            opacity: 0.9,
                            letterSpacing: '-0.3px',
                            flexShrink: 0
                        }}
                    >
                        Live Journey
                    </span>
                    {/* 중앙 검색창 (예시 이미지 스타일 참고) */}
                    <button
                        type="button"
                        onClick={() => navigate('/search')}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            maxWidth: 260,
                            height: 32,
                            marginLeft: 12,
                            marginRight: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 4px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #e2e8f0',
                            color: '#94a3b8',
                            fontSize: 14,
                            cursor: 'pointer'
                        }}
                        aria-label="검색으로 이동"
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            어디로 떠나볼까요?
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#94a3b8' }}>search</span>
                    </button>
                    <button
                        onClick={() => navigate('/notifications')}
                        className="icon-btn"
                        style={{ minWidth: 44, minHeight: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                        aria-label="알림"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>notifications</span>
                        {unreadNotificationCount > 0 && (
                            <span className="noti-badge" aria-label="새 알림">
                                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* 상단 배너 - 배포 전까지는 숨김 */}
                {false && (() => {
                    const BANNER_SLIDES = [
                        { type: 'hotplace', title: '실시간 핫플 보기', subtitle: '지금 붐비는 스팟을 한눈에', icon: '🌏', bg: '#26C6DA', path: '/realtime-feed' },
                        { type: 'event', title: '이벤트', subtitle: '참여하고 혜택 받기', icon: '🎁', bg: '#7C3AED', path: '/realtime-feed' },
                        { type: 'magazine', title: '여행 정보 모음', subtitle: '지역별 꿀팁·가이드', icon: '📚', bg: '#059669', path: '/main' },
                    ];
                    const BANNER_H = 72;
                    return (
                        <div style={{ padding: '8px 16px 4px', background: '#ffffff' }}>
                            <div
                                style={{
                                    width: '100%',
                                    height: BANNER_H,
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        scrollbarWidth: 'none',
                                        cursor: 'grab',
                                        scrollSnapType: 'x mandatory',
                                        scrollBehavior: 'smooth',
                                        WebkitOverflowScrolling: 'touch',
                                        display: 'flex',
                                    }}
                                    className="hide-scrollbar"
                                    onMouseDown={handleDragStart}
                                >
                                    {BANNER_SLIDES.map((banner) => (
                                        <button
                                            key={banner.type}
                                            type="button"
                                            onClick={withDragCheck(() => navigate(banner.path))}
                                            style={{
                                                flex: '0 0 100%',
                                                width: '100%',
                                                minWidth: '100%',
                                                height: BANNER_H,
                                                boxSizing: 'border-box',
                                                margin: 0,
                                                borderRadius: 0,
                                                border: 'none',
                                                background: banner.bg,
                                                padding: '0 16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                                cursor: 'pointer',
                                                scrollSnapAlign: 'start',
                                                scrollSnapStop: 'always',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                                                    {banner.icon}
                                                </div>
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{banner.title}</div>
                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{banner.subtitle}</div>
                                                </div>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>chevron_right</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 관심 지역/장소 — 라벨 없이 원형 목록만 */}
                <div style={{ padding: '4px 16px 8px', background: '#ffffff' }}>
                    <div
                        style={{ display: 'flex', gap: '10px', padding: '0 0 4px 0', overflowX: 'auto', scrollbarWidth: 'none', cursor: 'grab', scrollSnapType: 'x mandatory' }}
                        className="hide-scrollbar"
                        onMouseDown={handleDragStart}
                    >
                        {interestPlaces.map((place, idx) => {
                            const isSelected = selectedInterest === place.name;
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4,
                                        flexShrink: 0,
                                        position: 'relative',
                                        scrollSnapAlign: 'start',
                                        minWidth: 56,
                                    }}
                                >
                                        <div style={{ position: 'relative' }}>
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={withDragCheck(() => setSelectedInterest(isSelected ? null : place.name))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setSelectedInterest(isSelected ? null : place.name);
                                                    }
                                                }}
                                                style={{
                                                    width: 48,
                                                    height: 48,
                                                    minWidth: 48,
                                                    minHeight: 48,
                                                    borderRadius: '50%',
                                                    border: isSelected
                                                        ? '2px solid rgba(15,23,42,0.9)'
                                                        : '1px solid rgba(148,163,184,0.7)',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    background: '#E5E7EB',
                                                }}
                                            >
                                                <img
                                                    src={getRegionDefaultImage(place.name)}
                                                    alt={place.name}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        display: 'block',
                                                    }}
                                                />
                                            </div>
                                            {isSelected && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        withDragCheck(() => setDeleteConfirmPlace(place.name))();
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: -4,
                                                        right: 0,
                                                        transform: 'translate(30%, -40%)',
                                                        width: 56,
                                                        height: 56,
                                                        minWidth: 56,
                                                        minHeight: 56,
                                                        padding: 0,
                                                        border: 'none',
                                                        background: 'transparent',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 2,
                                                    }}
                                                    aria-label={`${place.name} 관심 지역 삭제`}
                                                >
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: '999px',
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #ffeded',
                                                        color: '#ff4d4f',
                                                        fontSize: 18,
                                                        lineHeight: 0,
                                                        fontWeight: 700,
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                                                    }}>
                                                        ×
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: isSelected ? '#0F172A' : '#94A3B8',
                                            fontWeight: isSelected ? 600 : 400,
                                            maxWidth: 56,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {place.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 지금 여기는 — 관심 지역 선택 시 숨김, 한 화면에 핫플까지 보이도록 높이 축소 */}
                {!selectedInterest && (
                    <div style={{ padding: '12px 16px 14px', background: '#ffffff' }}>
                    <div style={{ padding: '0 0 8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>지금 여기는</h2>
                        </div>
                        <button
                            onClick={() => navigate('/realtime-feed')}
                            className="border-none bg-transparent text-primary hover:text-primary-dark dark:hover:text-primary-soft text-sm font-semibold cursor-pointer py-1.5 px-2.5 min-h-[36px] flex items-center gap-1"
                        >
                            <span>더보기</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                        </button>
                    </div>
                    <div
                    style={{ display: 'flex', gap: '7px', padding: '0 0 12px 0', overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', cursor: 'grab', background: '#ffffff' }}
                        className="hide-scrollbar"
                        onMouseDown={handleDragStart}
                    >
                        {realtimeData.map((post) => {
                            // 동영상 우선 체크: videos 배열이 있으면 첫 번째 동영상 사용
                            let firstVideo = null;
                            if (post.videos) {
                                if (Array.isArray(post.videos) && post.videos.length > 0) {
                                    firstVideo = getDisplayImageUrl(post.videos[0]);
                                } else if (typeof post.videos === 'string' && post.videos.trim()) {
                                    firstVideo = getDisplayImageUrl(post.videos);
                                }
                            }
                            
                            // 동영상이 없을 때만 이미지 사용
                            const firstImage = firstVideo ? null : getDisplayImageUrl(Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || ''));
                            const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
                            const weather = post.weather || weatherByRegion[regionKey] || null;
                            const hasWeather = weather && (weather.icon || weather.temperature);
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
                            return (
                                <div
                                    key={post.id}
                                    onClick={withDragCheck(() => navigate(`/post/${post.id}`, { state: { post, allPosts: realtimeData } }))}
                                    style={{
                                        minWidth: '52%',
                                        width: '52%',
                                        overflow: 'visible',
                                        flexShrink: 0,
                                        cursor: 'pointer',
                                        scrollSnapAlign: 'start',
                                        scrollSnapStop: 'always'
                                    }}
                                >
                                    <div style={{ width: '100%', height: '200px', background: '#e5e7eb', position: 'relative', borderRadius: '14px', overflow: 'hidden', marginBottom: '4px' }}>
                                        {firstVideo ? (
                                            <video
                                                ref={(el) => {
                                                    if (el) {
                                                        videoRefs.current.set(`realtime-${post.id}`, el);
                                                    } else {
                                                        videoRefs.current.delete(`realtime-${post.id}`);
                                                    }
                                                }}
                                                data-video-id={`realtime-${post.id}`}
                                                src={firstVideo}
                                                poster={firstImage || getDisplayImageUrl(Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || '')) || undefined}
                                                muted
                                                loop
                                                playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : firstImage ? (
                                            <img
                                                src={firstImage}
                                                alt={post.location}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : null}
                                        {/* 날씨 정보만 이미지 우측 상단에 오버레이 */}
                                        {hasWeather && (
                                            <div style={{ position: 'absolute', top: '6px', right: '10px', background: 'rgba(15,23,42,0.7)', padding: '4px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#f9fafb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {weather.icon && <span>{weather.icon}</span>}
                                                {weather.temperature && <span>{weather.temperature}</span>}
                                            </div>
                                        )}
                                        {/* 좋아요·댓글 — 이미지 우하단 반투명 pill (앱 디자인 통일) */}
                                        <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '4px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                                {likeCount}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '4px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chat_bubble</span>
                                                {commentCount}
                                            </span>
                                        </div>
                                    </div>
                                    {/* 사진 정보 하단 — 여백만 사용, 하나의 피드 느낌 */}
                                    <div style={{ padding: '6px 14px 10px', minHeight: '100px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexShrink: 0 }}>
                                            <div style={{ color: '#111827', fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                                {post.location || '어딘가의 지금'}
                                            </div>
                                            <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
                                                {post.captureLabel || post.time}
                                            </span>
                                        </div>
                                        {(post.content || post.note) && (
                                            <div style={{ color: '#4b5563', fontSize: '13px', lineHeight: 1.45, marginTop: '6px', height: '2.9em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                {post.content || post.note}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* 메인 컨텐츠 */}
                {selectedInterest ? (
                    <div style={{ padding: '0 16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f0f9ff', padding: '6px 12px', borderRadius: '12px' }}>
                            <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '14px', lineHeight: 1.3 }}>"{selectedInterest}" 모아보기</span>
                            <button
                                type="button"
                                onClick={() => {
                                    // 관심지역 전체 피드를 별도 화면(지역 상세)에서 볼 수 있도록 이동
                                    navigate(`/region/${encodeURIComponent(selectedInterest)}`, {
                                        state: { region: { name: selectedInterest } },
                                    });
                                }}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#0284c7',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '4px 10px',
                                    minHeight: 'auto',
                                    lineHeight: 1.3,
                                }}
                            >
                                전체 보기
                            </button>
                        </div>
                        {filteredInterestPosts.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                {filteredInterestPosts.map((post) => (
                                    <div key={post.id} onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: filteredInterestPosts } })} style={{ overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                                        {/* 정사각형 썸네일 — 2x2 그리드 통일 */}
                                        <div style={{ width: '100%', aspectRatio: '1', background: '#eee', position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
                                            {(Array.isArray(post.videos) && post.videos.length > 0) ? (
                                                <video
                                                    ref={(el) => {
                                                        if (el) {
                                                            videoRefs.current.set(`interest-${post.id}`, el);
                                                        } else {
                                                            videoRefs.current.delete(`interest-${post.id}`);
                                                        }
                                                    }}
                                                    data-video-id={`interest-${post.id}`}
                                                    src={getDisplayImageUrl(post.videos[0])}
                                                    poster={getDisplayImageUrl(post.images?.[0] || post.image || post.thumbnail)}
                                                    muted
                                                    loop
                                                    playsInline
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '12px' }}
                                                />
                                            ) : post.thumbnailIsVideo && post.firstVideoUrl ? (
                                                <video src={post.firstVideoUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '12px' }} />
                                            ) : (post.images && post.images.length > 0) ? (
                                                <img src={getDisplayImageUrl(post.images[0])} alt={post.location} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '12px' }} />
                                            ) : (
                                                <img src={getDisplayImageUrl(post.image || post.thumbnail)} alt={post.location} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '12px' }} />
                                            )}
                                            {/* 좋아요·댓글 — 이미지 우하단 반투명 pill */}
                                            <div style={{ position: 'absolute', bottom: '6px', right: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '3px 7px', borderRadius: '9999px', fontSize: '10px', fontWeight: 600 }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                                    {Number(post.likes ?? post.likeCount ?? 0) || 0}
                                                </span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '3px 7px', borderRadius: '9999px', fontSize: '10px', fontWeight: 600 }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>chat_bubble</span>
                                                    {Array.isArray(post.comments) ? post.comments.length : 0}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ padding: '8px 4px 6px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.content || post.note || post.location || ''}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                                                <span>{post.time || ''}</span>
                                                <span style={{ maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.location || ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                                <p style={{ margin: 0, fontSize: '14px' }}>아직 이 지역의 사진이 없어요.</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>첫 번째 사진을 올려보세요!</p>
                            </div>
                        )}
                    </div>
                ) : (
                <div style={{ padding: '0 16px 20px', background: '#ffffff', minHeight: '100%' }}>

                        {/* 실시간 급상승 핫플 — 참고 디자인: 4:3 카드, 위치 뱃지 좌하단, 좋아요/댓글 우하단 */}
                        <div style={{ marginBottom: '0', paddingTop: '0', paddingBottom: '20px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#374151' }}>실시간 급상승 핫플 🔥</h3>
                                </div>
                                <button
                                    onClick={() => navigate('/crowded-place')}
                                    className="border-none bg-transparent text-primary hover:text-primary-dark dark:hover:text-primary-soft text-sm font-semibold cursor-pointer py-1.5 px-2.5 min-h-[36px] flex items-center gap-1"
                                >
                                    <span>더보기</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                                </button>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '10px',
                                    paddingBottom: '4px',
                                    background: '#ffffff',
                                    overflowX: 'auto',
                                    scrollbarWidth: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    cursor: 'grab'
                                }}
                                className="hide-scrollbar"
                                onMouseDown={handleDragStart}
                            >
                                {crowdedData.map(post => {
                                    const situationText = (post.note || post.content)
                                        ? String(post.note || post.content).trim().replace(/\s+/g, ' ').slice(0, 28) + (String(post.note || post.content).trim().length > 28 ? '…' : '')
                                        : (post.reasonTags && post.reasonTags[0])
                                            ? '지금 ' + String(post.reasonTags[0]).replace(/#/g, '').replace(/_/g, ' ')
                                            : '';
                                    return (
                                    <div
                                        key={post.id}
                                        onClick={withDragCheck(() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } }))}
                                        style={{
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            minWidth: '42%',
                                            maxWidth: '42%',
                                            flexShrink: 0,
                                            overflow: 'hidden',
                                            borderRadius: '16px',
                                            background: '#fff',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                                            border: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#eee', position: 'relative' }}>
                                            {(Array.isArray(post.videos) && post.videos.length > 0) ? (
                                                <video
                                                    ref={(el) => {
                                                        if (el) videoRefs.current.set(`crowded-${post.id}`, el);
                                                        else videoRefs.current.delete(`crowded-${post.id}`);
                                                    }}
                                                    data-video-id={`crowded-${post.id}`}
                                                    src={getDisplayImageUrl(post.videos[0])}
                                                    poster={getDisplayImageUrl(post.images?.[0] || post.image || post.thumbnail)}
                                                    muted
                                                    loop
                                                    playsInline
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                />
                                            ) : post.thumbnailIsVideo && post.firstVideoUrl ? (
                                                <video src={post.firstVideoUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            ) : (Array.isArray(post.images) && post.images.length > 0) || post.image || post.thumbnail ? (
                                                <img src={getDisplayImageUrl(post.images?.[0] || post.image || post.thumbnail)} alt={post.location} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', background: '#e5e7eb' }} />
                                            )}
                                            <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '3px 6px', borderRadius: '9999px', fontSize: '10px', fontWeight: 600 }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                                    {Number(post.likes ?? post.likeCount ?? 0) || 0}
                                                </span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '3px 6px', borderRadius: '9999px', fontSize: '10px', fontWeight: 600 }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>chat_bubble</span>
                                                    {Array.isArray(post.comments) ? post.comments.length : 0}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ padding: '10px 10px 12px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {post.location}
                                            </div>
                                            {situationText && (
                                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#4b5563', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                    {situationText}
                                                </p>
                                            )}
                                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{post.time || post.captureLabel || ''}</div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ✨ 추천 여행지 */}
                        <div style={{ marginBottom: '24px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 12px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#374151' }}>추천 여행지</h3>
                                </div>
                                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                                    {RECOMMENDATION_TYPES.find(t => t.id === selectedRecommendTag)?.description}
                                </p>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    padding: '0 0 12px 0',
                                    overflowX: 'auto',
                                    scrollbarWidth: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    cursor: 'grab',
                                    scrollSnapType: 'x mandatory',
                                }}
                                className="hide-scrollbar"
                                onMouseDown={handleDragStart}
                            >
                                {RECOMMENDATION_TYPES.map((tag) => {
                                    const isActive = selectedRecommendTag === tag.id;
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={withDragCheck(() => setSelectedRecommendTag(tag.id))}
                                            style={{
                                                flexShrink: 0,
                                                scrollSnapAlign: 'start',
                                                padding: '6px 12px',
                                                borderRadius: 999,
                                                border: isActive ? '1px solid #26C6DA' : '1px solid #e2e8f0',
                                                backgroundColor: isActive ? 'rgba(38,198,218,0.08)' : '#ffffff',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 4,
                                                fontSize: 12,
                                                fontWeight: isActive ? 700 : 500,
                                                color: isActive ? '#0f172a' : '#64748b',
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                                transition: 'all 0.18s ease-out',
                                            }}
                                        >
                                            <span>{tag.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div
                                style={{ display: 'flex', gap: '10px', padding: '0 0 16px 0', overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', cursor: 'grab' }}
                                className="hide-scrollbar"
                                onMouseDown={handleDragStart}
                            >
                                {recommendedData.map((item, idx) => {
                                    const regionPosts = allPostsForRecommend.filter(p =>
                                        (typeof p.location === 'string' && p.location.includes(item.regionName)) ||
                                        (p.detailedLocation && String(p.detailedLocation).includes(item.regionName)) ||
                                        (p.placeName && String(p.placeName).includes(item.regionName))
                                    );
                                    const rawImages = [
                                        item.image,
                                        ...regionPosts.flatMap(p => (p.images && p.images.length ? p.images : [p.thumbnail || p.image].filter(Boolean)))
                                    ].filter(Boolean).slice(0, 5);
                                    const displayImages = rawImages.map(url => getDisplayImageUrl(url)).filter(Boolean);
                                    const mainSrc = displayImages[0] || 'https://images.unsplash.com/photo-1548115184-bc65ae4986cf?w=800&q=80';

                                    return (
                                        <div
                                            key={idx}
                                            onClick={withDragCheck(() => navigate(`/region/${item.regionName}`))}
                                            style={{ minWidth: '74%', width: '74%', overflow: 'visible', flexShrink: 0, cursor: 'pointer', scrollSnapAlign: 'center', scrollSnapStop: 'always' }}
                                        >
                                            <div style={{ width: '100%', height: '200px', display: 'flex', overflow: 'hidden', borderRadius: '14px', marginBottom: '4px', background: '#e5e7eb' }}>
                                                <div style={{ flex: 1, overflowX: 'auto', display: 'flex', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }} className="hide-scrollbar">
                                                    {(displayImages.length ? displayImages : [mainSrc]).map((src, i) => (
                                                        <img
                                                            key={i}
                                                            src={src}
                                                            alt={item.title}
                                                            style={{ width: '100%', minWidth: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start', borderRadius: '14px' }}
                                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1548115184-bc65ae4986cf?w=800&q=80'; }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ padding: '6px 14px 10px' }}>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#06b6d4', marginBottom: '3px' }}>추천</div>
                                                <div style={{ color: '#111827', fontSize: '14px', fontWeight: 800, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.title}
                                                </div>
                                                <div style={{ color: '#4b5563', fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.description}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* 관심 지역 삭제 확인 모달 */}
            {deleteConfirmPlace && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'white', width: '85%', maxWidth: '300px', padding: '24px', borderRadius: '20px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700 }}>관심 지역 삭제</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>'{deleteConfirmPlace}'을(를) 관심 지역에서 삭제하시겠습니까?</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" onClick={() => setDeleteConfirmPlace(null)} style={{ flex: 1, padding: '14px 16px', minHeight: 48, borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: '15px' }}>취소</button>
                            <button type="button" onClick={handleDeleteInterestPlace} style={{ flex: 1, padding: '14px 16px', minHeight: 48, borderRadius: '12px', background: '#ef4444', color: 'white', fontWeight: 600, fontSize: '15px' }}>삭제</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 관심 지역 추가 모달 - 지역 선택 UI */}
            {showAddInterestModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                    }}
                >
                    <div style={{ background: '#ffffff', width: '100%', maxWidth: 420, maxHeight: '80vh', borderRadius: 28, overflowY: 'auto', overflowX: 'hidden', boxShadow: '0 18px 45px rgba(15,23,42,0.35)', display: 'flex', flexDirection: 'column', margin: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {/* 헤더 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #e5e7eb' }}>
                            <button
                                type="button"
                                onClick={() => { setShowAddInterestModal(false); }}
                                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#111827' }}
                                aria-label="닫기"
                            >
                                <span style={{ fontSize: 20 }}>×</span>
                            </button>
                            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#111827' }}>관심지역 설정</h3>
                            <div style={{ width: 44, height: 44 }} />
                        </div>
                        {/* 본문: 좌우 2열 레이아웃 */}
                        <div style={{ display: 'flex', flex: 1, minHeight: 260 }}>
                            {/* 왼쪽: 국내 권역 리스트 (전국 8도 개념) */}
                            <div style={{ width: '38%', borderRight: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                {['서울', '경기', '인천', '강원', '충청', '전라', '경상', '제주'].map((country) => {
                                    const isActive = selectedCountry === country;
                                    return (
                                        <button
                                            key={country}
                                            type="button"
                                            onClick={() => { setSelectedCountry(country); setSelectedCity(`${country} 전체`); }}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                textAlign: 'left',
                                                border: 'none',
                                                background: isActive ? '#e5f0ff' : 'transparent',
                                                color: isActive ? '#111827' : '#94a3b8',
                                                fontSize: 14,
                                                fontWeight: isActive ? 600 : 500,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {country}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* 오른쪽: 선택한 권역의 세부 지역 리스트 */}
                            <div style={{ flex: 1, background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                                    {selectedCountry}
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {(() => {
                                        const cityMap = {
                                            '서울': ['서울 전체', '종로·중구', '강남·서초', '송파·강동', '마포·용산', '홍대·신촌', '여의도'],
                                            '경기': ['경기 전체', '성남·분당', '수원', '고양·일산', '용인', '김포·파주', '가평·양평'],
                                            '인천': ['인천 전체', '송도', '연수·남동', '부평·계양', '중구(월미·영종)'],
                                            '강원': ['강원 전체', '춘천', '강릉', '속초', '평창', '양양'],
                                            '충청': ['충청 전체', '대전', '세종', '천안·아산', '청주'],
                                            '전라': ['전라 전체', '전주', '광주', '여수', '순천', '목포', '군산'],
                                            '경상': ['경상 전체', '부산', '대구', '울산', '경주', '포항', '창원·마산·진해'],
                                            '제주': ['제주 전체', '제주시', '서귀포', '애월', '성산·표선'],
                                        };
                                        const cities = cityMap[selectedCountry] || [`${selectedCountry} 전체`];
                                        return cities.map((city) => {
                                            const label = city.includes('전체') ? city : `${selectedCountry} ${city}`;
                                            const isActive = selectedInterestLabels.includes(label);
                                            return (
                                                <button
                                                    key={city}
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedInterestLabels((prev) =>
                                                            prev.includes(label)
                                                                ? prev.filter((v) => v !== label)
                                                                : [...prev, label]
                                                        )
                                                    }
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        border: 'none',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        background: isActive ? '#f9fafb' : '#ffffff',
                                                        cursor: 'pointer',
                                                        fontSize: 14,
                                                        color: '#111827',
                                                    }}
                                                >
                                                    <span>{city}</span>
                                                    {isActive && (
                                                        <span style={{ color: '#0ea5e9', fontSize: 16 }}>✓</span>
                                                    )}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                        {/* 하단 버튼 */}
                        <div style={{ padding: '14px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => { setShowAddInterestModal(false); setSelectedInterestLabels([]); }}
                                style={{
                                    flex: 1,
                                    padding: '12px 14px',
                                    borderRadius: 999,
                                    border: '1px solid #e5e7eb',
                                    background: '#ffffff',
                                    color: '#6b7280',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                }}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleAddInterestPlace}
                                style={{
                                    flex: 1,
                                    padding: '12px 14px',
                                    borderRadius: 999,
                                    border: 'none',
                                    background: selectedInterestLabels.length > 0 ? '#111827' : '#cbd5e1',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: 14,
                                    cursor: selectedInterestLabels.length > 0 ? 'pointer' : 'default',
                                }}
                                disabled={selectedInterestLabels.length === 0}
                            >
                                추가하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNavigation />
        </div >
    );

};

export default MainScreen;

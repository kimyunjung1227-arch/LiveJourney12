import React, { useState, useEffect, useRef, useCallback } from 'react';

const LONG_PRESS_MS = 450;
import { useNavigate, useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import { getUnreadCount } from '../utils/notifications';
import { getEarnedBadgesForDisplay, getBadgeDisplayName } from '../utils/badgeSystem';
import { getTrustScore, getTrustGrade, TRUST_GRADES } from '../utils/trustIndex';
import { getCoordinatesByLocation } from '../utils/regionLocationMapping';
import { follow, unfollow, isFollowing, getFollowerCount, getFollowingCount, getFollowerIds, getFollowingIds } from '../utils/followSystem';
import { logger } from '../utils/logger';
import { getDisplayImageUrl } from '../api/upload';
import api from '../api/axios';
import { cleanLegacyUploadedPosts } from '../utils/localStorageManager';
import { deletePostSupabase, fetchPostsByUserIdSupabase } from '../api/postsSupabase';

// HTML 문자열(template literal)로 src/alt를 주입할 때 속성 안전 처리
const escapeHtmlAttr = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/** 게시물에서 지도 핀/썸네일에 쓸 이미지 URL 하나 반환 (동영상만 있으면 빈 문자열 → 플레이스홀더 사용) */
const getPostPinImageUrl = (post) => {
  if (!post) return '';
  const hasImage = post.images && Array.isArray(post.images) && post.images.length > 0;
  const raw = hasImage ? post.images[0] : (post.thumbnail ?? post.image ?? post.imageUrl ?? '');
  const str = typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? '');
  if (!str) return '';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(str)) return '';
  return getDisplayImageUrl(str);
};

/** 게시물에서 지도용 좌표 추출 { lat, lng }. coordinates / location 객체 / 지역명 순으로 시도 */
const getPostCoordinates = (post) => {
  if (!post) return null;
  const c = post.coordinates;
  if (c && (c.lat != null || c.latitude != null) && (c.lng != null || c.longitude != null)) {
    return { lat: Number(c.lat ?? c.latitude), lng: Number(c.lng ?? c.longitude) };
  }
  const loc = post.location;
  if (loc && typeof loc === 'object' && (loc.lat != null || loc.lon != null)) {
    const lat = loc.lat ?? loc.latitude;
    const lng = loc.lng ?? loc.lon ?? loc.longitude;
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  const name = post.detailedLocation || (typeof post.location === 'string' ? post.location : null) || post.placeName;
  if (name) return getCoordinatesByLocation(name);
  return null;
};

/** 게시물에서 날짜(YYYY-MM-DD) 키 추출 (photoDate 우선) */
const getPostDateKey = (post) => {
  if (!post) return null;
  const raw = post.photoDate || post.createdAt || post.timestamp;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** YYYY-MM-DD 문자열을 로컬 기준 Date로 파싱 */
const parseDateKeyLocal = (key) => {
  if (!key) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const ProfileScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, logout, isAuthenticated } = useAuth();
  const [user, setUser] = useState(null);
  const [myPosts, setMyPosts] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [representativeBadge, setRepresentativeBadge] = useState(null);
  const [showBadgeSelector, setShowBadgeSelector] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const longPressTimerRef = useRef(null);
  const didLongPressRef = useRef(false);
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'map' | 'savedRoutes'
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [selectedSavedRoute, setSelectedSavedRoute] = useState(null);
  const [trustScore, setTrustScore] = useState(0);

  const refreshTrustScore = useCallback(() => {
    setTrustScore(getTrustScore());
  }, []);

  useEffect(() => {
    refreshTrustScore();
    const handler = () => {
      const token = localStorage.getItem('token');
      if (token && !token.startsWith('mock_token')) {
        api.get('/auth/me').then(() => {}).catch(() => refreshTrustScore());
      }
      refreshTrustScore();
    };
    window.addEventListener('trustIndexUpdated', handler);
    return () => window.removeEventListener('trustIndexUpdated', handler);
  }, [refreshTrustScore]);

  // 신뢰지수(Compass Score)는 클라이언트 매트릭스로 계산; 서버 trustScore는 참고용
  useEffect(() => {
    if (isAuthenticated) refreshTrustScore();
  }, [isAuthenticated, refreshTrustScore]);

  useEffect(() => {
    const tab = location.state?.tab;
    if (tab === 'savedRoutes' || tab === 'map') setActiveTab(tab);
  }, [location.state?.tab]);

  useEffect(() => {
    if (activeTab === 'savedRoutes') {
      try {
        const routes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
        setSavedRoutes(routes);
        if (routes.length > 0) {
          setSelectedSavedRoute((prev) =>
            prev && routes.some((r) => r.id === prev.id) ? prev : routes[0]
          );
        } else {
          setSelectedSavedRoute(null);
        }
      } catch {
        setSavedRoutes([]);
        setSelectedSavedRoute(null);
      }
    }
  }, [activeTab]);

  const handleStorageUpdate = useCallback(() => {
    if (activeTab === 'savedRoutes') {
      try {
        const routes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
        setSavedRoutes(routes);
        if (routes.length > 0) {
          setSelectedSavedRoute((prev) =>
            prev && routes.some((r) => r.id === prev.id) ? prev : routes[0]
          );
        } else {
          setSelectedSavedRoute(null);
        }
      } catch {
        setSavedRoutes([]);
        setSelectedSavedRoute(null);
      }
    }
  }, [activeTab]);

  useEffect(() => {
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [handleStorageUpdate]);

  // 지도 관련
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const mapInitialBoundsDoneRef = useRef(false); // true면 더 이상 자동 이동 안 함 (사용자가 직접 화면 이동)
  const [mapLoading, setMapLoading] = useState(true);
  // 저장된 경로 미리보기용 지도
  const savedRoutesMapRef = useRef(null);
  const savedRoutesMapInstance = useRef(null);
  const savedRoutesPolylineRef = useRef(null);
  const savedRoutesMarkersRef = useRef([]);

  // 날짜 / 날씨 필터 (나의 기록 지도)
  const [selectedDate, setSelectedDate] = useState('');
  const [weatherFilter, setWeatherFilter] = useState('all'); // 'all' | 'sunny' | 'cloudy' | 'rain_snow'
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [mapDatesExpanded, setMapDatesExpanded] = useState(false); // 나의 기록 지도 날짜 5개 이상일 때 펼치기
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFollowListModal, setShowFollowListModal] = useState(false);
  const [followListType, setFollowListType] = useState('follower'); // 'follower' | 'following'
  const [followListIds, setFollowListIds] = useState([]);
  const [showTrustGradesModal, setShowTrustGradesModal] = useState(false);
  const [trustExplainOpen, setTrustExplainOpen] = useState(false);
  // 내 사진 탭 보기 방식: 'date' | 'custom'
  // 기본은 "모아보기"가 먼저 보이도록 custom으로 설정
  const [photoViewMode, setPhotoViewMode] = useState('custom');

  // 모든 Hook을 먼저 선언한 후 useEffect 실행
  useEffect(() => {
    if (!isAuthenticated) return;
    // localStorage에서 사용자 정보 로드
    const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
    // authUser가 있으면 우선 사용, 없으면 localStorage에서 로드한 값 사용
    const userData = authUser || savedUser;
    if (userData && Object.keys(userData).length > 0) {
      setUser(userData);
    }

    // 획득한 뱃지 로드 (신뢰지수 등급 제외, 뱃지 구역에만 표시)
    const badges = getEarnedBadgesForDisplay();
    setEarnedBadges(badges);
    logger.log('🏆 프로필 화면 - 획득한 뱃지 로드:', badges.length);

    // 대표 뱃지 로드 (반드시 획득한 뱃지 중에서 선택)
    const userId = userData?.id;
    let savedRepBadgeJson = userId
      ? localStorage.getItem(`representativeBadge_${userId}`) || localStorage.getItem('representativeBadge')
      : localStorage.getItem('representativeBadge');

    let repBadge = null;
    if (savedRepBadgeJson) {
      try {
        repBadge = JSON.parse(savedRepBadgeJson);
      } catch {
        repBadge = null;
      }
    }

    // 저장된 대표 뱃지가 있지만, 현재 획득한 뱃지 목록에 없으면 무효 처리
    if (repBadge && !badges.some(b => b.name === repBadge.name)) {
      repBadge = null;
    }

    // 대표 뱃지가 없고, 획득한 뱃지가 있다면 그 안에서 하나를 대표로 선택
    if (!repBadge && badges && badges.length > 0) {
      let badgeIndex = 0;
      if (userId) {
        const hash = userId.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        badgeIndex = hash % badges.length;
      }
      repBadge = badges[badgeIndex];
      localStorage.setItem(`representativeBadge_${userId}`, JSON.stringify(repBadge));
    }

    if (repBadge) {
      setRepresentativeBadge(repBadge);
    }

    // 목업/테스트 게시물 흔적 제거 후 내 게시물 로드 (Supabase + localStorage 병합 → 로그아웃 후 재로그인해도 기록 유지)
    cleanLegacyUploadedPosts();
    const uploadedPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const localUserPosts = uploadedPosts.filter(post => post.userId === userId);

    const loadMergedMyPosts = async () => {
      const fromSupabase = userId
        ? await fetchPostsByUserIdSupabase(userId)
        : [];
      const byId = new Map();
      fromSupabase.forEach(p => byId.set(p.id, { ...p }));
      localUserPosts.forEach(p => {
        if (!byId.has(p.id)) byId.set(p.id, { ...p });
      });
      const merged = [...byId.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      // 좌표 없으면 지역명으로 보강 (지도 표시용)
      const enriched = merged.map(p => {
        if (getPostCoordinates(p)) return p;
        const name = p.detailedLocation || (typeof p.location === 'string' ? p.location : '') || p.placeName;
        const coords = name ? getCoordinatesByLocation(name) : null;
        return coords ? { ...p, coordinates: coords } : p;
      });
      logger.log('📊 프로필 화면 - 내 게시물 로드 (Supabase + 로컬 병합)');
      logger.debug('  Supabase:', fromSupabase.length, '로컬(내것):', localUserPosts.length, '병합:', enriched.length, '사용자 ID:', userId);
      setMyPosts(enriched);
      setFilteredPosts(enriched);
      const dates = [...new Set(
        enriched.map(post => getPostDateKey(post)).filter(Boolean)
      )].sort((a, b) => (parseDateKeyLocal(b)?.getTime() || 0) - (parseDateKeyLocal(a)?.getTime() || 0));
      setAvailableDates(dates);
    };
    loadMergedMyPosts();

    // 알림 개수 업데이트
    setUnreadNotificationCount(getUnreadCount());

    // 알림 이벤트 리스너
    const handleNotificationUpdate = () => {
      setUnreadNotificationCount(getUnreadCount());
    };

    // 게시물 업데이트 이벤트 리스너 (Supabase + localStorage 병합으로 갱신)
    const handlePostsUpdate = () => {
      logger.log('🔄 프로필 화면 - 게시물 업데이트 이벤트 수신');
      const previousPostsCount = myPosts.length;
      setTimeout(async () => {
        const updatedPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
        const updatedLocalUserPosts = updatedPosts.filter(post => {
          const postUserId = post.userId ||
            (typeof post.user === 'string' ? post.user : post.user?.id) ||
            post.user;
          return postUserId === userId;
        });
        const fromSupabase = userId ? await fetchPostsByUserIdSupabase(userId) : [];
        const byId = new Map();
        fromSupabase.forEach(p => byId.set(p.id, { ...p }));
        updatedLocalUserPosts.forEach(p => { if (!byId.has(p.id)) byId.set(p.id, { ...p }); });
        const merged = [...byId.values()].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const enriched = merged.map(p => {
          if (getPostCoordinates(p)) return p;
          const name = p.detailedLocation || (typeof p.location === 'string' ? p.location : '') || p.placeName;
          const coords = name ? getCoordinatesByLocation(name) : null;
          return coords ? { ...p, coordinates: coords } : p;
        });
        logger.debug('🔄 게시물 업데이트 (Supabase+로컬 병합):', { Supabase: fromSupabase.length, 로컬: updatedLocalUserPosts.length, 병합: enriched.length });
        setMyPosts(enriched);

        const dates = [...new Set(
          enriched.map(post => getPostDateKey(post)).filter(Boolean)
        )].sort((a, b) => (parseDateKeyLocal(b)?.getTime() || 0) - (parseDateKeyLocal(a)?.getTime() || 0));
        setAvailableDates(dates);

        if (enriched.length > previousPostsCount && !selectedDate && activeTab === 'map') {
          const newPost = enriched.find(p => !myPosts.find(op => op.id === p.id));
          if (newPost) {
            const dateStr = getPostDateKey(newPost);
            if (dates.includes(dateStr)) setSelectedDate(dateStr);
          }
        }
      }, 100);
    };

    // 뱃지 업데이트 이벤트 리스너
    const handleBadgeUpdate = () => {
      const updatedBadges = getEarnedBadgesForDisplay();
      setEarnedBadges(updatedBadges);
      logger.log('🏆 뱃지 업데이트:', updatedBadges.length);
    };

    // 사용자 정보 업데이트 이벤트 리스너
    const handleUserUpdate = () => {
      const updatedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userData = authUser || updatedUser;
      if (userData && Object.keys(userData).length > 0) {
        setUser(userData);
      }
    };

    window.addEventListener('notificationUpdate', handleNotificationUpdate);
    window.addEventListener('newPostsAdded', handlePostsUpdate);
    window.addEventListener('storage', handlePostsUpdate);
    window.addEventListener('badgeEarned', handleBadgeUpdate);
    window.addEventListener('userUpdated', handleUserUpdate);

    return () => {
      window.removeEventListener('notificationUpdate', handleNotificationUpdate);
      window.removeEventListener('newPostsAdded', handlePostsUpdate);
      window.removeEventListener('storage', handlePostsUpdate);
      window.removeEventListener('badgeEarned', handleBadgeUpdate);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, [isAuthenticated, authUser]);

  // 팔로워/팔로잉 수 로드 및 followsUpdated 구독
  useEffect(() => {
    const u = authUser || user;
    const uid = u?.id;
    if (!isAuthenticated || !uid) return;
    const load = () => {
      setFollowerCount(getFollowerCount(uid));
      setFollowingCount(getFollowingCount(uid));
    };
    load();
    window.addEventListener('followsUpdated', load);
    return () => window.removeEventListener('followsUpdated', load);
  }, [isAuthenticated, authUser, user?.id]);

  // 날짜 / 날씨 필터 적용
  useEffect(() => {
    if (activeTab === 'map') {
      let filtered = [...myPosts];

      if (selectedDate) {
        const filterDate = parseDateKeyLocal(selectedDate);
        if (!filterDate) {
          setFilteredPosts(filtered);
          return;
        }
        filterDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);

        filtered = filtered.filter(post => {
          const key = getPostDateKey(post);
          if (!key) return false;
          const postDate = parseDateKeyLocal(key);
          if (!postDate) return false;
          postDate.setHours(0, 0, 0, 0);
          return postDate >= filterDate && postDate < nextDay;
        });
      }

      // 날씨 필터
      if (weatherFilter !== 'all') {
        filtered = filtered.filter(post => {
          const condRaw = post.weather?.condition || '';
          const cond = condRaw.toLowerCase();
          if (!cond) return false;
          if (weatherFilter === 'sunny') {
            return cond.includes('맑') || cond.includes('sun');
          }
          if (weatherFilter === 'cloudy') {
            return cond.includes('흐') || cond.includes('cloud');
          }
          if (weatherFilter === 'rain_snow') {
            return (
              cond.includes('비') ||
              cond.includes('눈') ||
              cond.includes('rain') ||
              cond.includes('snow')
            );
          }
          return true;
        });
      }

      setFilteredPosts(filtered);
    } else {
      setFilteredPosts(myPosts);
    }
  }, [myPosts, selectedDate, weatherFilter, activeTab]);

  // 새 게시물 추가 시 해당 날짜로 자동 선택
  useEffect(() => {
    if (myPosts.length > 0 && !selectedDate && activeTab === 'map') {
      const latestPost = myPosts[0];
      if (latestPost) {
        const dateStr = getPostDateKey(latestPost);
        // availableDates에 해당 날짜가 있으면 자동 선택
        if (dateStr && availableDates.includes(dateStr)) {
          setSelectedDate(dateStr);
        }
      }
    }
  }, [myPosts.length, availableDates, activeTab]);

  // 지도 초기화 및 마커 표시
  const initMap = useCallback(() => {
    logger.log('🗺️ 지도 초기화 시작', {
      kakaoLoaded: !!window.kakao,
      mapRefExists: !!mapRef.current,
      activeTab,
      postsCount: filteredPosts.length
    });

    if (!window.kakao || !window.kakao.maps) {
      logger.debug('⏳ Kakao Map API 로딩 대기...');
      setTimeout(initMap, 100);
      return;
    }

    if (!mapRef.current) {
      logger.debug('⏳ 지도 컨테이너 대기...');
      setTimeout(initMap, 100);
      return;
    }

    if (activeTab !== 'map') {
      logger.debug('⏸️ 지도 탭이 아님, 초기화 중단');
      return;
    }

    try {
      // 기존 마커 및 선 제거
      markersRef.current.forEach(markerData => {
        if (markerData.overlay) {
          markerData.overlay.setMap(null);
        }
        if (markerData.marker) {
          markerData.marker.setMap(null);
        }
        if (markerData.polyline) {
          markerData.polyline.setMap(null);
        }
      });
      markersRef.current = [];

      // 기존 지도 인스턴스 확인 (재사용 가능하면 재사용)
      // innerHTML 사용하지 않음 - React DOM 충돌 방지

      // 지도 컨테이너 가져오기 (innerHTML 사용하지 않음 - React DOM 충돌 방지)
      const container = mapRef.current;

      // 게시물이 있으면 첫 번째 게시물 위치로, 없으면 서울로
      let centerLat = 37.5665;
      let centerLng = 126.9780;
      let level = 6;

      if (filteredPosts.length > 0) {
        const coords = getPostCoordinates(filteredPosts[0]) || getPostCoordinates(filteredPosts.find(p => getPostCoordinates(p)));
        if (coords) {
          centerLat = coords.lat;
          centerLng = coords.lng;
          level = 5;
          logger.debug('📍 첫 게시물 위치로 지도 중심 설정:', coords);
        }
      }

      // 지도 컨테이너 크기 확인
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        logger.warn('⚠️ 지도 컨테이너 크기가 0입니다. 재시도...');
        setTimeout(initMap, 200);
        return;
      }

      logger.log('✅ 지도 생성 시작:', { centerLat, centerLng, level, containerSize: { width: container.offsetWidth, height: container.offsetHeight } });

      // 기존 지도 인스턴스가 있으면 재사용, 없으면 새로 생성
      let map = mapInstance.current;

      if (!map) {
        map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: level
        });
        mapInstance.current = map;
      } else {
        // 재사용 시에도 이번 날짜/전체 기록에 맞게 중심 이동 (한눈에 보이도록)
        map.setCenter(new window.kakao.maps.LatLng(centerLat, centerLng));
        map.setLevel(level);
      }

      logger.log('✅ 지도 인스턴스 생성/갱신 완료');

      // 지도가 완전히 로드될 때까지 대기
      const tilesLoadedHandler = () => {
        logger.debug('✅ 지도 타일 로드 완료');
        setMapLoading(false);
        // 지도 로드 후 마커 생성
        createMarkersAfterMapLoad(map);
      };

      window.kakao.maps.event.addListener(map, 'tilesloaded', tilesLoadedHandler);

      // 타임아웃 설정 (지도가 로드되지 않아도 진행)
      setTimeout(() => {
        logger.warn('⏰ 지도 로드 타임아웃, 마커 생성 진행');
        setMapLoading(false);
        // 타임아웃 후에도 마커 생성 시도
        if (markersRef.current.length === 0) {
          createMarkersAfterMapLoad(map);
        }
      }, 2000);

      // 즉시 마커 생성 시도 (지도가 이미 로드된 경우)
      setTimeout(() => {
        if (markersRef.current.length === 0) {
          createMarkersAfterMapLoad(map);
        }
      }, 500);

      // 마커 생성 함수 (지도 로드 후 호출)
      const createMarkersAfterMapLoad = (map) => {
        logger.log('📍 마커 생성 시작:', filteredPosts.length);

        // 기존 마커 및 선 제거
        markersRef.current.forEach(markerData => {
          if (markerData.overlay) {
            markerData.overlay.setMap(null);
          }
          if (markerData.marker) {
            markerData.marker.setMap(null);
          }
          if (markerData.polyline) {
            markerData.polyline.setMap(null);
          }
        });
        markersRef.current = [];

        const bounds = new window.kakao.maps.LatLngBounds();
        let hasValidMarker = false;

        // 기본 마커 생성 함수 (먼저 정의)
        const createDefaultMarker = (post, index, position, map) => {
          const marker = new window.kakao.maps.Marker({
            position: position,
            map: map
          });

          const infoWindow = new window.kakao.maps.InfoWindow({
            content: `
              <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${post.location || '여행지'}</div>
                ${post.note ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${post.note}</div>` : ''}
              </div>
            `,
            removable: true
          });

          window.kakao.maps.event.addListener(marker, 'click', () => {
            const currentIndex = filteredPosts.findIndex(p => p.id === post.id);
            navigate(`/post/${post.id}`, {
              state: {
                post: post,
                allPosts: filteredPosts,
                currentPostIndex: currentIndex >= 0 ? currentIndex : 0
              }
            });
          });

          window.kakao.maps.event.addListener(marker, 'mouseover', () => {
            infoWindow.open(map, marker);
          });

          window.kakao.maps.event.addListener(marker, 'mouseout', () => {
            infoWindow.close();
          });

          markersRef.current.push({ marker: marker, overlay: null, post: post });
          hasValidMarker = true;
        };

        // 마커 생성 함수 (MapScreen과 동일한 스타일)
        const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iNCIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNMjQgMTZDMjAgMTYgMTcgMTkgMTcgMjNDMTcgMjcgMjAgMzAgMjQgMzBDMjggMzAgMzEgMjcgMzEgMjNDMzEgMTkgMjggMTYgMjQgMTZaIiBmaWxsPSIjOUI5Q0E1Ii8+CjxwYXRoIGQ9Ik0yNCAzMkMyMCAzMiAxNyAyOSAxNyAyNUMxNyAyMSAyMCAxOCAyNCAxOEMyOCAxOCAzMSAyMSAzMSAyNUMzMSAyOSAyOCAzMiAyNCAzMloiIGZpbGw9IiM5QjlDQTUiLz4KPC9zdmc+';
        const createMarker = (post, index, map, bounds) => {
          const coords = getPostCoordinates(post);
          if (!coords || (Number.isNaN(coords.lat) || Number.isNaN(coords.lng))) return;

          const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
          bounds.extend(position);

          // 올린 사진을 핀 썸네일로 사용 (getPostPinImageUrl로 풀 URL 보장)
          const imageUrl = getPostPinImageUrl(post);

          const el = document.createElement('div');
          el.innerHTML = `
            <button 
              class="pin-btn relative w-12 h-12 border-3 border-white shadow-lg rounded-md overflow-hidden hover:scale-110 transition-all duration-200 cursor-pointer" 
              style="z-index: ${index}" 
              data-post-id="${post.id}"
              data-post-index="${index}"
            >
              <img 
                class="w-full h-full object-cover" 
                width="48"
                height="48"
                loading="eager"
                alt="${escapeHtmlAttr(post.location || '여행지')}"
              />
            </button>
          `;
          // img src는 JS로 설정 (URL 깨짐 방지, 실제 사진 표시)
          const img = el.querySelector('img');
          if (img) {
            img.src = imageUrl || PLACEHOLDER_SVG;
            img.onerror = function () { this.onerror = null; this.src = PLACEHOLDER_SVG; };
          }

          // 클릭 이벤트 핸들러
          const button = el.querySelector('button');
          if (button) {
            button.addEventListener('click', () => {
              const currentIndex = filteredPosts.findIndex(p => p.id === post.id);
              navigate(`/post/${post.id}`, {
                state: {
                  post: post,
                  allPosts: filteredPosts,
                  currentPostIndex: currentIndex >= 0 ? currentIndex : 0
                }
              });
            });

            button.addEventListener('mouseenter', () => {
              button.style.transform = 'scale(1.1)';
            });

            button.addEventListener('mouseleave', () => {
              button.style.transform = 'scale(1)';
            });
          }

          // CustomOverlay 생성
          const overlay = new window.kakao.maps.CustomOverlay({
            position: position,
            content: el,
            yAnchor: 1,
            zIndex: index
          });

          overlay.setMap(map);

          // 인포윈도우 생성 (썸네일 이미지도 실제 사진으로)
          const infoImgUrl = getPostPinImageUrl(post);
          const infoWindow = new window.kakao.maps.InfoWindow({
            content: `
              <div style="padding: 12px; min-width: 200px; max-width: 300px;">
                ${infoImgUrl ? `
                  <img 
                    src="${escapeHtmlAttr(infoImgUrl)}" 
                    alt="${escapeHtmlAttr(post.location || '여행지')}"
                    style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;"
                    onerror="this.style.display='none'"
                  />
                ` : ''}
                <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${(post.location || '여행지').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                ${post.note ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${String(post.note).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
              </div>
            `,
            removable: true
          });

          // 임시 마커 (인포윈도우 표시용)
          const tempMarker = new window.kakao.maps.Marker({
            position: position
          });

          // 마우스오버 이벤트
          if (button) {
            button.addEventListener('mouseenter', () => {
              infoWindow.open(map, tempMarker);
            });

            button.addEventListener('mouseleave', () => {
              infoWindow.close();
            });
          }

          markersRef.current.push({
            id: post.id,
            marker: null,
            overlay: overlay,
            post: post,
            element: el.firstChild
          });
          hasValidMarker = true;
        };

        // 필터링된 게시물에 대해 마커 생성 및 좌표 수집
        const sortedPosts = [...filteredPosts].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || 0);
          const dateB = new Date(b.createdAt || b.timestamp || 0);
          return dateA - dateB;
        });

        const pathCoordinates = [];
        sortedPosts.forEach((post, index) => {
          const coords = getPostCoordinates(post);
          if (coords && !Number.isNaN(coords.lat) && !Number.isNaN(coords.lng)) {
            pathCoordinates.push(new window.kakao.maps.LatLng(coords.lat, coords.lng));
          }
          createMarker(post, index, map, bounds);
        });

        // 경로 선 그리기 (2개 이상의 좌표가 있을 때)
        if (pathCoordinates.length >= 2) {
          const polyline = new window.kakao.maps.Polyline({
            path: pathCoordinates,
            strokeWeight: 3,
            strokeColor: '#14B8A6', // primary 색상
            strokeOpacity: 0.7,
            strokeStyle: 'solid'
          });
          polyline.setMap(map);
          markersRef.current.push({ polyline: polyline });
        }

        // 날짜/탭 진입 시 항상 핀 위치로 지도 이동 (한눈에 보이도록)
        const overlayMarkers = markersRef.current.filter(m => m.overlay || m.marker);
        if (overlayMarkers.length > 0) {
          const moveToPins = () => {
            // 이미 한 번 자동으로 이동했다면 더 이상 지도를 강제로 움직이지 않음
            if (mapInitialBoundsDoneRef.current) {
              logger.debug('🔒 지도 자동 이동 생략 (사용자 제어 모드)');
              return;
            }
            const validBounds = new window.kakao.maps.LatLngBounds();
            overlayMarkers.forEach(markerData => {
              if (markerData.overlay) {
                try { validBounds.extend(markerData.overlay.getPosition()); } catch (_) {}
              } else if (markerData.marker) {
                try { validBounds.extend(markerData.marker.getPosition()); } catch (_) {}
              }
            });
            if (overlayMarkers.length >= 2) {
              map.setBounds(validBounds, 50, 50, 50, 50); // 패딩
              logger.debug('✅ 지도 범위 조정 완료 (핀 전체)');
            } else {
              const first = overlayMarkers[0];
              const pos = first.overlay ? first.overlay.getPosition() : first.marker.getPosition();
              map.setCenter(pos);
              map.setLevel(5);
              logger.debug('✅ 지도 중심 이동 완료 (단일 핀)');
            }
            mapInitialBoundsDoneRef.current = true;
          };
          setTimeout(moveToPins, 350);
        }
      };
    } catch (error) {
      logger.error('지도 초기화 오류:', error);
      setMapLoading(false);
    }
  }, [filteredPosts, activeTab, navigate, selectedDate]);

  // 탭 변경 또는 날짜 변경 시 지도 초기화
  useEffect(() => {
    if (activeTab === 'map') {
      logger.log('🗺️ 나의 기록 지도 탭 활성화 또는 날짜 변경');
      setMapLoading(true);

      // 기존 마커 및 선 제거
      markersRef.current.forEach(markerData => {
        try {
          if (markerData.overlay) {
            markerData.overlay.setMap(null);
          }
          if (markerData.marker) {
            markerData.marker.setMap(null);
          }
          if (markerData.polyline) {
            markerData.polyline.setMap(null);
          }
        } catch (error) {
          logger.warn('마커 제거 오류 (무시):', error);
        }
      });
      markersRef.current = [];

      let retryTimerId = null;
      const initTimer = setTimeout(() => {
        if (mapRef.current) {
          initMap();
        } else {
          retryTimerId = setTimeout(() => {
            if (mapRef.current) initMap();
            else setMapLoading(false);
          }, 400);
        }
      }, 300);

      return () => {
        clearTimeout(initTimer);
        if (retryTimerId) clearTimeout(retryTimerId);
      };
    } else {
      // 다른 탭으로 전환 시 지도 정리
      logger.log('🗑️ 다른 탭으로 전환, 지도 정리');
      if (mapInstance.current) {
        // 마커 제거
        markersRef.current.forEach(markerData => {
          try {
            if (markerData.overlay) {
              markerData.overlay.setMap(null);
            }
            if (markerData.marker) {
              markerData.marker.setMap(null);
            }
            if (markerData.polyline) {
              markerData.polyline.setMap(null);
            }
          } catch (error) {
            logger.warn('마커 제거 오류 (무시):', error);
          }
        });
        markersRef.current = [];
        // 지도 인스턴스는 유지 (다음 탭 전환 시 재사용 가능)
        // mapInstance.current = null; // 주석 처리: React DOM 충돌 방지
      }
      setMapLoading(false);
    }
  }, [activeTab, filteredPosts, initMap, selectedDate]);

  const handleLogout = () => {
    // 로그아웃 플래그 설정
    sessionStorage.setItem('justLoggedOut', 'true');

    // 로그아웃 처리
    logout();

    // 시작 화면으로 이동
    navigate('/', { replace: true });
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      setSelectedPhotos([]);
      setIsEditMode(false);
      return;
    }
    // 모아보기/날짜순 현재 뷰 유지한 채 편집 모드 진입
    setIsEditMode(true);
  };

  const togglePhotoSelection = (postId) => {
    if (selectedPhotos.includes(postId)) {
      setSelectedPhotos(selectedPhotos.filter(id => id !== postId));
    } else {
      setSelectedPhotos([...selectedPhotos, postId]);
    }
  };

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePhotoLongPress = useCallback((post) => {
    didLongPressRef.current = true;
    if (!isEditMode) {
      setIsEditMode(true);
      setSelectedPhotos([post.id]);
    } else {
      togglePhotoSelection(post.id);
    }
  }, [isEditMode, selectedPhotos]);

  const handlePhotoPressStart = useCallback((post) => {
    didLongPressRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      handlePhotoLongPress(post);
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, handlePhotoLongPress]);

  const handlePhotoPressEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const deleteSelectedPhotos = async () => {
    if (selectedPhotos.length === 0) {
      alert('삭제할 사진을 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedPhotos.length}개의 사진을 삭제하시겠습니까?`)) {
      return;
    }

    // Supabase에서도 해당 게시물 삭제 (UUID인 경우만)
    try {
      await Promise.all(selectedPhotos.map((id) => deletePostSupabase(id)));
    } catch (e) {
      logger.warn('Supabase 게시물 삭제 중 일부 실패:', e);
    }

    // localStorage에서 선택된 사진 삭제
    const allPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const filteredPosts = allPosts.filter(post => !selectedPhotos.includes(post.id));
    localStorage.setItem('uploadedPosts', JSON.stringify(filteredPosts));

    // 내 게시물 목록 업데이트
    const userId = user?.id || authUser?.id;
    const updatedMyPosts = filteredPosts.filter(post => post.userId === userId);
    setMyPosts(updatedMyPosts);
    setFilteredPosts(updatedMyPosts);

    // 사용 가능한 날짜 목록 업데이트
    const dates = [...new Set(
      updatedMyPosts
        .map(post => {
          const date = new Date(post.createdAt || post.timestamp || Date.now());
          return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
        })
        .filter(Boolean)
    )].sort((a, b) => new Date(b) - new Date(a));
    setAvailableDates(dates);

    // 삭제된 게시물의 날짜가 선택되어 있고, 그 날짜에 더 이상 게시물이 없으면 날짜 선택 해제
    if (selectedDate && !dates.includes(selectedDate)) {
      setSelectedDate('');
    }

    setSelectedPhotos([]);
    setIsEditMode(false);

    // 다른 화면에서도 목록 갱신되도록 이벤트 발생
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('postsUpdated'));
    window.dispatchEvent(new CustomEvent('newPostsAdded'));

    alert(`${selectedPhotos.length}개의 사진이 삭제되었습니다.`);
  };

  // 저장된 경로 미리보기 지도 렌더링 (저장된 경로 탭일 때)
  useEffect(() => {
    if (activeTab !== 'savedRoutes') {
      savedRoutesMapInstance.current = null;
      savedRoutesMarkersRef.current = [];
      savedRoutesPolylineRef.current = null;
      return;
    }

    const route = selectedSavedRoute;

    // 이전 마커 및 경로 정리
    try {
      savedRoutesMarkersRef.current.forEach((m) => m.setMap && m.setMap(null));
      savedRoutesMarkersRef.current = [];
      if (savedRoutesPolylineRef.current) {
        savedRoutesPolylineRef.current.setMap(null);
        savedRoutesPolylineRef.current = null;
      }
    } catch {
      // 무시
    }

    if (!route || !route.pins || route.pins.length === 0) return;
    if (!savedRoutesMapRef.current) return;

    const ensureMap = () => {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(ensureMap, 150);
        return;
      }

      const container = savedRoutesMapRef.current;
      if (!container) return;

      const firstPin = route.pins[0];
      const centerLat = firstPin.lat ?? 37.5665;
      const centerLng = firstPin.lng ?? 126.9780;

      let map = savedRoutesMapInstance.current;
      if (!map) {
        map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: 6,
        });
        savedRoutesMapInstance.current = map;
      } else {
        map.setCenter(new window.kakao.maps.LatLng(centerLat, centerLng));
      }

      const path = [];
      const bounds = new window.kakao.maps.LatLngBounds();

      route.pins.forEach((pin, index) => {
        if (pin.lat == null || pin.lng == null) return;
        const pos = new window.kakao.maps.LatLng(pin.lat, pin.lng);
        bounds.extend(pos);
        path.push(pos);

        // MapScreen에서 사용하는 것과 비슷한 스타일의 사진 핀 (상대 경로 → 풀 URL)
        const imageUrl = getDisplayImageUrl(pin.image);
        const el = document.createElement('div');
        el.innerHTML = `
          <button
            class="saved-route-pin"
            style="
              z-index: ${index};
              width: 44px;
              height: 44px;
              border: 3px solid white;
              border-radius: 6px;
              box-shadow: 0 3px 10px rgba(0,0,0,0.35);
              overflow: hidden;
              cursor: default;
              padding: 0;
              margin: 0;
              background: #f5f5f5;
              position: relative;
            "
          >
            <img
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              "
              src="${escapeHtmlAttr(imageUrl) || ''}"
              alt="${escapeHtmlAttr(pin.location || '경로 지점')}"
              onerror="this.style.display='none';"
            />
          </button>
        `;

        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          yAnchor: 1,
          xAnchor: 0.5,
          zIndex: index,
        });

        overlay.setMap(map);
        savedRoutesMarkersRef.current.push(overlay);
      });

      if (path.length >= 2) {
        const polyline = new window.kakao.maps.Polyline({
          path,
          strokeWeight: 3,
          strokeColor: '#00BCD4',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
        });
        polyline.setMap(map);
        savedRoutesPolylineRef.current = polyline;
      }

      if (path.length >= 1) {
        // 여유 패딩을 주어 전체 경로가 보이도록
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const latSpan = Math.max((ne.getLat() - sw.getLat()) * 0.25, 0.01);
        const lngSpan = Math.max((ne.getLng() - sw.getLng()) * 0.25, 0.01);
        bounds.extend(new window.kakao.maps.LatLng(sw.getLat() - latSpan, sw.getLng() - lngSpan));
        bounds.extend(new window.kakao.maps.LatLng(ne.getLat() + latSpan, ne.getLng() + lngSpan));
        map.setBounds(bounds);
      }
    };

    ensureMap();
  }, [activeTab, selectedSavedRoute]);

  // 대표 뱃지 선택
  const selectRepresentativeBadge = (badge) => {
    const currentUser = user || authUser;
    const userId = currentUser?.id;
    if (userId) {
      localStorage.setItem(`representativeBadge_${userId}`, JSON.stringify(badge));
    }
    localStorage.setItem('representativeBadge', JSON.stringify(badge)); // 호환성 유지
    setRepresentativeBadge(badge);
    setShowBadgeSelector(false);

    // user 정보 업데이트
    if (currentUser) {
      const updatedUser = { ...currentUser, representativeBadge: badge };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }

    logger.log('✅ 대표 뱃지 선택:', badge.name);
  };

  // 대표 뱃지 제거
  const removeRepresentativeBadge = () => {
    const currentUser = user || authUser;
    const userId = currentUser?.id;
    if (userId) {
      localStorage.removeItem(`representativeBadge_${userId}`);
    }
    localStorage.removeItem('representativeBadge'); // 호환성 유지
    setRepresentativeBadge(null);

    if (currentUser) {
      const updatedUser = { ...currentUser, representativeBadge: null };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }

    logger.log('❌ 대표 뱃지 제거');
  };


  const badgeCount = earnedBadges.length;

  // 프로필 화면 안에서 사용할 소셜 로그인 핸들러
  const handleSocialLogin = async (provider) => {
    setLoginLoading(true);
    setLoginError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const providerLower = provider.toLowerCase();
      let authEndpoint = '';

      if (providerLower === 'kakao') {
        authEndpoint = `${apiUrl}/api/auth/kakao`;
      } else if (providerLower === 'naver') {
        authEndpoint = `${apiUrl}/api/auth/naver`;
      } else if (providerLower === 'google') {
        authEndpoint = `${apiUrl}/api/auth/google`;
      } else {
        throw new Error('지원하지 않는 소셜 로그인 제공자입니다.');
      }

      window.location.href = authEndpoint;
    } catch (error) {
      logger.error('소셜 로그인 실패:', error);
      setLoginError(`${provider} 로그인에 실패했습니다.`);
      setLoginLoading(false);
    }
  };

  // 로그인되지 않은 경우: 프로필 화면 안에서 소셜 로그인 카드 표시
  if (!isAuthenticated) {
    return (
      <div className="screen-layout bg-white dark:bg-zinc-900">
        <div className="screen-content">
          {/* 헤더 */}
          <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 justify-between shadow-sm">
            <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
              프로필
            </h1>
          </header>

          {/* 소셜 로그인 화면 - 화면 정중앙 배치 */}
          <main
            className="flex-1 flex flex-col items-center justify-center px-6 py-8"
            style={{ minHeight: 'calc(100vh - 160px)' }}
          >
            <div className="w-full max-w-md text-center">
              {/* 상단 카피 */}
              <div className="mb-8">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 tracking-[0.15em] uppercase">
                  LIVEJOURNEY
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                  실시간 여행 현황 검증의 기준,<br />라이브저니
                </p>
              </div>

              {/* 소셜 로그인 버튼들 */}
              <div className="flex flex-col items-center gap-3 mb-3">
                {/* 카카오 로그인 - 카카오톡 느낌의 말풍선 + TALK 로고 */}
                <button
                  onClick={() => handleSocialLogin('Kakao')}
                  disabled={loginLoading}
                  className="flex cursor-pointer items-center justify-center gap-3 rounded-full h-12 px-6 bg-[#FEE500] text-[#000000] text-sm font-bold tracking-tight hover:bg-[#fdd835] active:bg-[#fbc02d] transition-all shadow-md disabled:opacity-50 w-full max-w-sm"
                  style={{ touchAction: 'manipulation' }}
                >
                  <svg
                    className="w-6 h-6 shrink-0 flex-shrink-0"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    role="img"
                  >
                    {/* 검정 말풍선 배경 */}
                    <path
                      d="M12 3C7.029 3 3 6.582 3 10.95c0 3.133 2.01 5.867 5 7.516v3.234c0 .276.224.5.5.5.132 0 .26-.053.354-.146L10.5 18.4c.94.134 1.924.2 2.923.2 4.971 0 9-3.582 9-7.95S16.971 3 12 3z"
                      fill="#000000"
                    />
                    {/* TALK 텍스트 */}
                    <text
                      x="12"
                      y="14"
                      textAnchor="middle"
                      fontSize="7"
                      fontWeight="700"
                      fill="#FEE500"
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    >
                      TALK
                    </text>
                  </svg>
                  <span className="truncate">카카오로 시작하기</span>
                </button>

                {/* 구글 로그인 */}
                <button
                  onClick={() => handleSocialLogin('Google')}
                  disabled={loginLoading}
                  className="flex cursor-pointer items-center justify-center gap-3 rounded-full h-12 px-6 bg-white dark:bg-gray-900 text-[#1F1F1F] dark:text-white text-sm font-semibold tracking-tight border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-gray-800 active:bg-zinc-100 transition-all shadow-sm disabled:opacity-50 w-full max-w-sm"
                  style={{ touchAction: 'manipulation' }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="truncate">구글로 시작하기</span>
                </button>
              </div>

              {/* 에러 메시지 */}
              {loginError && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-xs font-medium text-center">
                  {loginError}
                </div>
              )}

              {/* 로딩 상태 */}
              {loginLoading && (
                <div className="mt-3 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300 dark:border-gray-600"></div>
                  <span className="text-xs font-medium">로그인 중...</span>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* 하단 네비게이션 */}
        <BottomNavigation unreadNotificationCount={0} />
      </div>
    );
  }

  // 사용자 정보가 아직 로드되지 않은 경우
  if (isAuthenticated && !user && !authUser) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark">
        <div className="screen-content">
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 dark:border-gray-600"></div>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">사용자 정보를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 현재 사용자 정보 (user 또는 authUser)
  const currentUser = user || authUser;

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark">
      <div className="screen-content">
        {/* 헤더 */}
        <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 justify-between">
          <BackButton onClick={() => navigate('/main', { replace: true })} />
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold">프로필</h1>
          <button
            onClick={() => navigate('/settings')}
            className="flex size-10 shrink-0 items-center justify-center text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="설정"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
        </header>

        {/* 메인 컨텐츠 */}
        <div className="screen-body">
          {/* 프로필 정보 */}
          <div className="bg-white dark:bg-gray-900 px-6 py-6">
            <div className="flex items-center gap-4 mb-4">
              {/* 프로필 사진 */}
              <div className="flex-shrink-0">
                {currentUser?.profileImage && currentUser.profileImage !== 'default' ? (
                  <img
                    src={currentUser.profileImage}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700" />
                )}
              </div>

              {/* 사용자 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    <h2 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold truncate max-w-[180px] sm:max-w-[240px]" title={currentUser?.username || '모사모'}>
                      {currentUser?.username || '모사모'}
                    </h2>
                    {/* 대표 뱃지 - 클릭 가능 */}
                    <button
                      onClick={() => {
                        if (earnedBadges.length > 0) {
                          setShowBadgeSelector(true);
                        } else {
                          alert('아직 획득한 뱃지가 없습니다.');
                        }
                      }}
                      disabled={earnedBadges.length === 0}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {representativeBadge ? (
                        <>
                          <span className="text-base leading-none" role="img" aria-label={representativeBadge.name}>
                            {representativeBadge.icon || '🏆'}
                          </span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{representativeBadge.name}</span>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">뱃지 없음</span>
                      )}
                    </button>
                    {/* 뱃지 모아보기 버튼 - 메인 컬러 */}
                    <button
                      onClick={() => navigate('/badges')}
                      className="flex items-center justify-center rounded-full transition-colors bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                      style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                      title="뱃지 모아보기"
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>add</span>
                    </button>
                  </div>
                  {/* 프로필 편집 버튼 - 메인 컬러 */}
                  <button
                    onClick={() => {
                      logger.debug('🔧 프로필 편집 버튼 클릭 → /profile/edit으로 이동');
                      navigate('/profile/edit');
                    }}
                    className="flex items-center justify-center rounded-full transition-colors bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30"
                    style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                    title="프로필 편집"
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>edit</span>
                  </button>
                </div>
                {/* 자기 소개 (있을 때만) */}
                {currentUser?.bio && (
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1 line-clamp-2 break-keep">
                    {currentUser.bio}
                  </p>
                )}
                {/* 게시물·팔로워·팔로잉 - 한 줄, 동일 여백, 왼쪽·중앙·우측 */}
                <div className="flex items-center w-full mt-2 text-gray-600 dark:text-gray-400">
                  <span className="flex-1 text-left text-sm font-medium">{myPosts.length} 게시물</span>
                  <button
                    type="button"
                    onClick={() => {
                      const uid = (authUser || user)?.id;
                      if (uid) { setFollowListIds(getFollowerIds(uid)); setFollowListType('follower'); setShowFollowListModal(true); }
                    }}
                    className="flex-1 text-center text-sm font-medium hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    {followerCount} 팔로워
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const uid = (authUser || user)?.id;
                      if (uid) { setFollowListIds(getFollowingIds(uid)); setFollowListType('following'); setShowFollowListModal(true); }
                    }}
                    className="flex-1 text-right text-sm font-medium hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    {followingCount} 팔로잉
                  </button>
                </div>
              </div>
            </div>

            {/* 신뢰지수 구역 - 신뢰지수만 좌측, 수치·등급 우측, 등급 전체 보기 */}
            <div className="px-6 py-4">
              {(() => {
                const uid = (authUser || user)?.id;
                const { grade, nextGrade, progressToNext } = getTrustGrade(trustScore, uid ? String(uid) : null);
                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-nowrap min-w-0">
                      <button
                        type="button"
                        onClick={() => { setTrustExplainOpen(false); setShowTrustGradesModal(true); }}
                        className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark shrink-0 hover:text-primary transition-colors"
                      >
                        신뢰지수
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{trustScore}</span>
                        <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">{grade.icon} {grade.name}</span>
                      </div>
                    </div>
                    {nextGrade && (
                      <>
                        <div className="flex justify-end mb-0.5">
                          <span className="text-xs text-gray-500 dark:text-gray-400">다음 등급까지 {nextGrade.minScore - trustScore}점</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-400 dark:bg-gray-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressToNext}%` }}
                          />
                        </div>
                      </>
                    )}
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => { setTrustExplainOpen(false); setShowTrustGradesModal(true); }}
                        className="text-xs text-primary hover:underline"
                      >
                        등급 전체 보기
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>

          {/* 기록 탭 */}
          <div className="bg-white dark:bg-gray-900 px-6 py-6 border-t border-gray-100 dark:border-gray-800">
            {/* 탭 전환 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('my')}
                className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'my'
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                내 사진
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'map'
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                나의 기록 지도
              </button>
              <button
                onClick={() => setActiveTab('savedRoutes')}
                className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'savedRoutes'
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                저장된 경로
              </button>
            </div>

            {/* 내 사진 탭 - 보기 모드 선택 (모아보기 / 날짜 순) + 공통 편집 버튼 */}
            {activeTab === 'my' && myPosts.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPhotoViewMode('custom')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      photoViewMode === 'custom'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    모아보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoViewMode('date')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      photoViewMode === 'date'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    날짜 순
                  </button>
                </div>
                <button
                  type="button"
                  onClick={toggleEditMode}
                  className={`text-[11px] font-medium px-2 py-1 rounded-full transition-colors ${
                    isEditMode
                      ? 'text-primary bg-primary-5'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {isEditMode ? '완료' : '편집'}
                </button>
              </div>
            )}

            {/* 편집 버튼 (내 사진 탭에서만) */}
            {/* 내 사진 탭 (타임라인 형식) */}
            {activeTab === 'my' && myPosts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-medium mb-2">
                  아직 올린 사진이 없어요
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                  내 지역의 실시간 사진을 올려<br />
                  나만의 발자취를 만들어보세요!
                </p>
                <button
                  onClick={() => navigate('/upload')}
                  className="bg-primary text-white py-3 px-6 rounded-full font-semibold hover:bg-primary/90 transition-colors shadow-lg inline-flex items-center gap-2"
                >
                  첫 사진 올리기
                </button>
              </div>
            )}

            {activeTab === 'my' && myPosts.length > 0 && photoViewMode === 'date' && (
              <div className="space-y-6">
                {/* 편집 모드 + 선택 시: 작은 삭제 버튼 (선택 개수 작게) */}
                {isEditMode && selectedPhotos.length > 0 && (
                  <button
                    onClick={deleteSelectedPhotos}
                    className="w-full py-2 px-3 rounded-lg bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 mb-3"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>선택 {selectedPhotos.length}장 삭제</span>
                  </button>
                )}

                {Object.entries(
                  myPosts.reduce((acc, post) => {
                    const date = new Date(post.createdAt || Date.now());
                    const dateKey = date.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    });
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(post);
                    return acc;
                  }, {})
                )
                  .sort((a, b) => new Date(b[1][0].createdAt) - new Date(a[1][0].createdAt))
                  .map(([date, posts], dateIndex) => (
                    <div key={date}>
                      {/* 날짜 헤더 */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{date}</h3>
                        </div>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{posts.length}장</span>
                      </div>

                      {/* 사진 그리드 (작은 썸네일) */}
                      <div className="grid grid-cols-4 gap-2">
                        {posts.map((post, index) => {
                          const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
                          const isLiked = likedPosts[post.id] || false;
                          const likeCount = post.likes || post.likeCount || 0;
                          const allPosts = myPosts;
                          const currentIndex = allPosts.findIndex(p => p.id === post.id);

                          return (
                            <div
                              key={post.id || index}
                              onMouseDown={() => handlePhotoPressStart(post)}
                              onMouseUp={handlePhotoPressEnd}
                              onMouseLeave={handlePhotoPressEnd}
                              onTouchStart={() => handlePhotoPressStart(post)}
                              onTouchEnd={handlePhotoPressEnd}
                              onTouchCancel={handlePhotoPressEnd}
                              onClick={(e) => {
                                if (didLongPressRef.current) {
                                  didLongPressRef.current = false;
                                  return;
                                }
                                if (isEditMode) {
                                  togglePhotoSelection(post.id);
                                } else {
                                  navigate(`/post/${post.id}`, {
                                    state: {
                                      post: post,
                                      allPosts: allPosts,
                                      currentPostIndex: currentIndex >= 0 ? currentIndex : 0
                                    }
                                  });
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {/* 이미지 - 선택 시 하늘색 원 표시 */}
                              <div
                                className={`aspect-square relative overflow-hidden rounded-md mb-1 ${isEditMode && selectedPhotos.includes(post.id) ? 'ring-2 ring-sky-400 ring-offset-1 rounded-md' : ''}`}
                              >
                                {post.videos && post.videos.length > 0 ? (
                                  <video
                                    src={getDisplayImageUrl(post.videos[0])}
                                    className="w-full h-full object-cover"
                                    muted
                                    loop
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={getDisplayImageUrl(post.imageUrl || post.images?.[0] || post.image || post.thumbnail)}
                                    alt={post.location}
                                    className={`w-full h-full object-cover transition-all duration-300 ${isEditMode ? 'hover:opacity-70' : 'hover:scale-110'
                                      }`}
                                  />
                                )}

                                {/* 편집 모드: 선택 시 하늘색 원 */}
                                {isEditMode && (
                                  <div
                                    className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${selectedPhotos.includes(post.id) ? 'bg-sky-400 ring-2 ring-sky-300' : 'bg-white/80 dark:bg-gray-800/80 ring-2 ring-gray-300 dark:ring-gray-600'}`}
                                    onClick={(e) => { e.stopPropagation(); togglePhotoSelection(post.id); }}
                                    role="button"
                                    aria-label={selectedPhotos.includes(post.id) ? '선택 해제' : '선택'}
                                  >
                                    {selectedPhotos.includes(post.id) && (
                                      <span className="text-white text-[10px] font-bold">✓</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 이미지 밖 하단 텍스트 — 사진 아래 시트 스타일 통일 */}
                              <div className="space-y-0.5 min-w-0" style={{ borderTop: '3px solid #475569', background: '#f8fafc', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '12px 14px 14px' }}>
                                <p className="text-[10px] font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                                  {post.note || post.location || '기록'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* 내 사진 탭 - 모아보기 (편집 가능, 선택 시 하늘색 원) */}
            {activeTab === 'my' && myPosts.length > 0 && photoViewMode === 'custom' && (
              <div className="space-y-3">
                {isEditMode && selectedPhotos.length > 0 && (
                  <button
                    onClick={deleteSelectedPhotos}
                    className="w-full py-2 px-3 rounded-lg bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 mb-3"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>선택 {selectedPhotos.length}장 삭제</span>
                  </button>
                )}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    모아보기: 좋아요 많은 순으로 보기
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([...myPosts]
                    .slice()
                    .sort((a, b) => (b.likes || b.likeCount || 0) - (a.likes || a.likeCount || 0))
                  ).map((post, index) => {
                    const allPosts = myPosts;
                    const currentIndex = allPosts.findIndex(p => p.id === post.id);
                    const isSelected = selectedPhotos.includes(post.id);

                    return (
                      <div
                        key={post.id || index}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (isEditMode) {
                            togglePhotoSelection(post.id);
                          } else {
                            navigate(`/post/${post.id}`, {
                              state: {
                                post,
                                allPosts,
                                currentPostIndex: currentIndex >= 0 ? currentIndex : 0,
                              },
                            });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (isEditMode) togglePhotoSelection(post.id);
                            else navigate(`/post/${post.id}`, { state: { post, allPosts, currentPostIndex: currentIndex >= 0 ? currentIndex : 0 } });
                          }
                        }}
                        className="cursor-pointer text-left"
                      >
                        <div
                          className={`aspect-square relative overflow-hidden rounded-md mb-1 ${isEditMode && isSelected ? 'ring-2 ring-sky-400 ring-offset-1 rounded-md' : ''}`}
                        >
                          {post.videos && post.videos.length > 0 ? (
                            <video
                              src={getDisplayImageUrl(post.videos[0])}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                            />
                          ) : (
                            <img
                              src={getDisplayImageUrl(post.imageUrl || post.images?.[0] || post.image || post.thumbnail)}
                              alt={post.location}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {isEditMode && (
                            <div
                              className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-sky-400 ring-2 ring-sky-300' : 'bg-white/80 dark:bg-gray-800/80 ring-2 ring-gray-300 dark:ring-gray-600'}`}
                              onClick={(e) => { e.stopPropagation(); togglePhotoSelection(post.id); }}
                              role="button"
                              aria-label={isSelected ? '선택 해제' : '선택'}
                            >
                              {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                          )}
                        </div>
                        {(post.note || post.location) && (
                          <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark truncate">
                            {post.note || post.location}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 나의 기록 지도 탭 */}
            {activeTab === 'map' && (
              <div>
                {myPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-medium mb-2">
                      아직 기록이 없어요
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                      첫 사진을 올리면<br />
                      여기에 나의 기록으로 표시돼요!
                    </p>
                    <button
                      onClick={() => navigate('/upload')}
                      className="bg-primary text-white py-3 px-6 rounded-full font-semibold hover:bg-primary/90 transition-colors shadow-lg inline-flex items-center gap-2"
                    >
                      첫 사진 올리기
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* 날짜 / 날씨 필터 - 언제, 어떤 날씨에 어디를 다녔는지 한눈에 보기 */}
                    {availableDates.length > 0 && (() => {
                      const showExpand = availableDates.length >= 5;
                      const visibleDates = showExpand && !mapDatesExpanded
                        ? availableDates.slice(0, 4)
                        : availableDates;
                      return (
                        <div className="mb-3 space-y-2">
                          {/* 날짜 필터 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setSelectedDate('')}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!selectedDate
                                  ? 'bg-primary text-white shadow-sm'
                                  : 'bg-white/95 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                              전체
                            </button>
                            {visibleDates.map((date) => {
                              const dateObj = new Date(date);
                              const dateStr = dateObj.toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                              });
                              const isSelected = selectedDate === date;
                              return (
                                <button
                                  key={date}
                                  onClick={() => setSelectedDate(isSelected ? '' : date)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isSelected
                                      ? 'bg-primary text-white shadow-sm'
                                      : 'bg-white/95 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                  {dateStr}
                                </button>
                              );
                            })}
                            {showExpand && (
                              <button
                                onClick={() => setMapDatesExpanded((prev) => !prev)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
                              >
                                {mapDatesExpanded ? '접기' : `펼치기 (${availableDates.length}일)`}
                              </button>
                            )}
                            {availableDates.length > 7 && (
                              <button
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'date';
                                  input.max = new Date().toISOString().split('T')[0];
                                  input.value = selectedDate || '';
                                  input.onchange = (e) => {
                                    if (e.target.value) {
                                      setSelectedDate(e.target.value);
                                    }
                                  };
                                  input.click();
                                }}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
                              >
                                + 날짜 선택
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })()}

                    {/* 지도 영역 */}
                    <div
                      ref={mapRef}
                      id="travel-map"
                      className="w-full h-96 rounded-xl overflow-hidden mb-4 bg-gray-100 dark:bg-gray-800"
                      style={{ minHeight: '384px', position: 'relative' }}
                    >
                      {mapLoading && (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800 z-10">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 dark:border-gray-600 mx-auto mb-4"></div>
                            <p className="text-sm">지도를 불러오는 중...</p>
                          </div>
                        </div>
                      )}

                      {/* 여행 통계 - 지도 하단 오버레이 */}
                      {filteredPosts.length > 0 && (() => {
                        // 이동 거리 계산
                        const getDistanceKm = (lat1, lon1, lat2, lon2) => {
                          const toRad = (v) => (v * Math.PI) / 180;
                          const R = 6371;
                          const dLat = toRad(lat2 - lat1);
                          const dLon = toRad(lon2 - lon1);
                          const a =
                            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(toRad(lat1)) *
                            Math.cos(toRad(lat2)) *
                            Math.sin(dLon / 2) *
                            Math.sin(dLon / 2);
                          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                          return R * c;
                        };

                        // 촬영일(photoDate) 우선 정렬해 이동 순서 반영
                        const sortedPosts = [...filteredPosts].sort((a, b) => {
                          const rawA = a.photoDate || a.createdAt || a.timestamp || 0;
                          const rawB = b.photoDate || b.createdAt || b.timestamp || 0;
                          const dateA = new Date(rawA).getTime();
                          const dateB = new Date(rawB).getTime();
                          return dateA - dateB;
                        });

                        let totalDistance = 0;
                        for (let i = 0; i < sortedPosts.length - 1; i++) {
                          const coords1 = getPostCoordinates(sortedPosts[i]);
                          const coords2 = getPostCoordinates(sortedPosts[i + 1]);
                          if (coords1 && coords2) {
                            const lat1 = Number(coords1.lat);
                            const lng1 = Number(coords1.lng);
                            const lat2 = Number(coords2.lat);
                            const lng2 = Number(coords2.lng);
                            if (Number.isFinite(lat1) && Number.isFinite(lng1) && Number.isFinite(lat2) && Number.isFinite(lng2)) {
                              totalDistance += getDistanceKm(lat1, lng1, lat2, lng2);
                            }
                          }
                        }

                        // 방문한 곳 목록 (중복 제거)
                        const visitedPlaces = [...new Set(
                          filteredPosts
                            .filter(post => post.location || post.detailedLocation)
                            .map(post => post.location || post.detailedLocation)
                        )];

                        return (
                          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-center gap-3">
                            <div className="px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full border border-white/50 shadow-sm">
                              <span className="text-xs font-semibold text-gray-700">
                                총 {totalDistance.toFixed(1)}km
                              </span>
                            </div>
                            <div className="px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full border border-white/50 shadow-sm">
                              <span className="text-xs font-semibold text-gray-700">
                                방문 {visitedPlaces.length}곳
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 지역별 사진 수 */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">지역</h3>
                      {Object.entries(
                        filteredPosts.reduce((acc, post) => {
                          const location = post.location || '기타';
                          acc[location] = (acc[location] || 0) + 1;
                          return acc;
                        }, {})
                      )
                        .sort((a, b) => b[1] - a[1])
                        .map(([location, count]) => (
                          <div
                            key={location}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            onClick={() => {
                              setActiveTab('my');
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{location}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                              {count}장
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 저장된 경로 탭 - 바로 보기 */}
            {activeTab === 'savedRoutes' && (() => {
              const deleteRoute = (routeId) => {
                if (!confirm('이 경로를 삭제하시겠습니까?')) return;
                const updated = savedRoutes.filter((r) => r.id !== routeId);
                localStorage.setItem('savedRoutes', JSON.stringify(updated));
                setSavedRoutes(updated);
                if (updated.length === 0) {
                  setSelectedSavedRoute(null);
                } else if (!updated.some((r) => r.id === selectedSavedRoute?.id)) {
                  setSelectedSavedRoute(updated[0]);
                }
              };
              return (
                <div className="space-y-4">
                  {savedRoutes.length === 0 ? (
                  <div className="text-center py-12">
                      <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-medium mb-2">저장된 경로가 없어요</p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">지도에서 경로를 만들고 저장해보세요!</p>
                      <button
                        onClick={() => navigate('/map')}
                        className="bg-primary text-white py-3 px-6 rounded-full font-semibold hover:bg-primary/90 transition-colors shadow-lg inline-flex items-center gap-2"
                      >
                        지도에서 경로 만들기
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">저장한 경로</h3>
                          {selectedSavedRoute && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{selectedSavedRoute.pins?.length || 0}개 장소</span>
                          )}
                        </div>
                        <div
                          ref={savedRoutesMapRef}
                          className="w-full h-64 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800"
                        />
                      </div>
                      {savedRoutes.map((route) => {
                        const isSelected = selectedSavedRoute?.id === route.id;
                        return (
                          <div
                            key={route.id}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                              isSelected ? 'bg-primary/10 border-primary/60' : 'bg-gray-50 dark:bg-gray-800 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedSavedRoute(route)}
                              className="flex-1 flex items-center gap-4 text-left min-w-0 p-0 border-0 bg-transparent cursor-pointer"
                            >
                              {route.pins?.[0]?.image ? (
                                <img src={getDisplayImageUrl(route.pins[0].image)} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{route.pins?.length || 0}개 장소 경로</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{route.pins?.map((p) => p.location).filter(Boolean).join(' → ') || '저장된 경로'}</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); deleteRoute(route.id); }}
                              className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 flex-shrink-0"
                            >
                              삭제
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        </div>

        {/* 대표 뱃지 선택 모달 */}
        {showBadgeSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl">
              {/* 헤더 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-bold">대표 뱃지 선택</h2>
                <button
                  onClick={() => setShowBadgeSelector(false)}
                  className="px-3 h-8 flex items-center justify-center rounded-full text-xs font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  닫기
                </button>
              </div>

              {/* 뱃지 리스트 */}
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {representativeBadge && (
                  <button
                    onClick={removeRepresentativeBadge}
                    className="w-full mb-3 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500 text-sm font-semibold"
                  >
                    대표 뱃지 제거
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {earnedBadges.map((badge, index) => (
                    <button
                      key={index}
                      onClick={() => selectRepresentativeBadge(badge)}
                      className={`p-4 rounded-xl border-2 transition-all ${representativeBadge?.name === badge.name
                          ? 'bg-gradient-to-br from-primary/20 to-accent/20 border-primary shadow-lg'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-5xl leading-none" role="img" aria-label={getBadgeDisplayName(badge)}>
                          {badge.icon || '🏆'}
                        </span>
                        <p className="text-sm font-bold text-center">{getBadgeDisplayName(badge)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.difficulty === '상' ? 'bg-gray-700 dark:bg-gray-600 text-white' :
                            badge.difficulty === '중' ? 'bg-blue-500 text-white' :
                              'bg-green-500 text-white'
                          }`}>
                          {badge.difficulty}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 팔로워 / 팔로잉 목록 모달 - 핸드폰 화면사이즈에 맞춤 */}
        {showFollowListModal && (
          <div
            className="absolute inset-0 z-[100] flex flex-col bg-white dark:bg-gray-900 w-full max-w-[460px] mx-auto min-h-[100dvh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={() => setShowFollowListModal(false)}
          >
            <div
              className="flex-1 min-h-0 w-full flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                  {followListType === 'follower' ? '팔로워' : '팔로잉'}
                </h2>
                <button
                  onClick={() => setShowFollowListModal(false)}
                  className="px-3 h-8 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  닫기
                </button>
              </div>
              <div className="px-4 pt-4 pb-6 overflow-y-auto flex-1 min-h-0">
                {followListIds.length === 0 ? (
                  <p className="text-center py-8 text-text-secondary-light dark:text-text-secondary-dark text-sm">
                    {followListType === 'follower' ? '팔로워가 없습니다' : '팔로우 중인 사용자가 없습니다'}
                  </p>
                ) : (
                  (() => {
                    const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
                    const currentUserData = authUser || user;
                    const myId = currentUserData?.id;

                    const resolveUserInfo = (uid) => {
                      if (String(uid) === String(myId) && currentUserData) {
                        return {
                          username: currentUserData.username || '사용자',
                          profileImage: currentUserData.profileImage || null,
                        };
                      }
                      const p = posts.find((post) => {
                        const pu = post.userId || (typeof post.user === 'string' ? post.user : post.user?.id);
                        return String(pu) === String(uid);
                      });
                      if (!p) return { username: '사용자', profileImage: null };
                      if (!p.user) return { username: '사용자', profileImage: null };
                      if (typeof p.user === 'string') {
                        return { username: p.user, profileImage: null };
                      }
                      return {
                        username: p.user?.username || '사용자',
                        profileImage: p.user?.profileImage || null,
                      };
                    };

                    const getRepBadge = (uid) => {
                      try {
                        const j = localStorage.getItem(`representativeBadge_${uid}`);
                        return j ? JSON.parse(j) : null;
                      } catch {
                        return null;
                      }
                    };

                    return followListIds.map((uid) => {
                      const { username, profileImage } = resolveUserInfo(uid);
                      const repBadge = getRepBadge(uid);
                      return (
                        <div
                          key={uid}
                          className="flex items-center justify-between gap-3 py-3 pb-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 last:pb-3"
                        >
                          <button
                            type="button"
                            onClick={() => { setShowFollowListModal(false); navigate(`/user/${uid}`); }}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            {/* 프로필 이미지 */}
                            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-teal-100 dark:bg-teal-900">
                              {profileImage ? (
                                <img src={profileImage} alt="" className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            {/* 사용자 이름 + 대표 뱃지 */}
                            <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                              <span className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate w-full text-left">
                                {username}
                              </span>
                              {repBadge && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex-shrink-0">
                                  <span className="text-sm">{repBadge.icon}</span>
                                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{repBadge.name}</span>
                                </div>
                              )}
                            </div>
                          </button>
                          {/* 팔로우 버튼: 언제든 팔로우/팔로잉 취소 가능 */}
                          {myId && String(uid) !== String(myId) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isFollowing(null, uid)) {
                                  unfollow(uid);
                                  if (followListType === 'following') {
                                    setFollowListIds((prev) => prev.filter((id) => String(id) !== String(uid)));
                                  }
                                } else {
                                  follow(uid);
                                }
                              }}
                              className={`shrink-0 py-2 px-4 rounded-xl text-sm font-semibold transition-colors ${isFollowing(null, uid)
                                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                                  : 'bg-primary text-white hover:bg-primary/90'
                                }`}
                            >
                              {isFollowing(null, uid) ? '팔로잉' : '팔로우'}
                            </button>
                          )}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {/* 신뢰지수 등급 전체 보기 모달 */}
        {showTrustGradesModal && (
          <div
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowTrustGradesModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="신뢰지수 등급"
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">신뢰지수 등급</h2>
                <button
                  type="button"
                  onClick={() => setShowTrustGradesModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                  aria-label="닫기"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                <div className="mb-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTrustExplainOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
                    aria-expanded={trustExplainOpen}
                  >
                    <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">점수가 어떻게 올라가나요?</span>
                    <span className={`material-symbols-outlined text-lg text-gray-500 dark:text-gray-400 transition-transform ${trustExplainOpen ? 'rotate-180' : ''}`} aria-hidden>expand_more</span>
                  </button>
                  {trustExplainOpen && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700">
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside pt-2">
                        <li>게시물 업로드 (많을수록 가산)</li>
                        <li>GPS·위치 인증된 글 작성</li>
                        <li>상세한 캡션(50자 이상)</li>
                        <li>다른 사람에게 &apos;정확해요&apos; 받기</li>
                        <li>최근 48시간 이내 업로드 보너스</li>
                      </ul>
                    </div>
                  )}
                </div>
                {(() => {
                  const uid = (authUser || user)?.id;
                  const { grade: currentGrade } = getTrustGrade(trustScore, uid ? String(uid) : null);
                  const currentGradeId = currentGrade?.id;
                  return TRUST_GRADES.map((g) => (
                  <div
                    key={g.id}
                    className={`flex flex-col gap-1 py-3 px-3 rounded-xl ${currentGradeId === g.id ? 'bg-primary/10 dark:bg-primary/20 border border-primary/30' : 'bg-gray-50 dark:bg-gray-800'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xl" aria-hidden>{g.icon}</span>
                      <span className="flex-1 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{g.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {g.nextScore != null ? `${g.minScore}점 ~ ${g.nextScore - 1}점` : `${g.minScore}점 이상`}
                      </span>
                    </div>
                  </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default ProfileScreen;








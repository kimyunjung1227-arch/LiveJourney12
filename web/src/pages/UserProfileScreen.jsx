import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { getEarnedBadgesForUser, BADGES, getBadgeDisplayName } from '../utils/badgeSystem';
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { getCoordinatesByLocation } from '../utils/regionLocationMapping';
import { follow, unfollow, isFollowing, getFollowerCount, getFollowingCount } from '../utils/followSystem';
import { notifyFollowReceived, notifyFollowingStarted } from '../utils/notifications';
import { logger } from '../utils/logger';
import { getDisplayImageUrl } from '../api/upload';
import { getPosts } from '../api/posts';
import { fetchPostsByUserIdSupabase } from '../api/postsSupabase';
import { getTrustRawScore, getTrustGrade } from '../utils/trustIndex';
import api from '../api/axios';
import {
  resolveUserDisplayFromPosts,
  getCachedFollowProfile,
  setCachedFollowProfile,
} from '../utils/userProfileHints';

const UserProfileScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [representativeBadge, setRepresentativeBadge] = useState(null);
  const [stats, setStats] = useState({ posts: 0 });
  const [loading, setLoading] = useState(true);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null); // 여행 지도 핀 클릭 시 가벼운 사진상세 모달용
  const [isFollow, setIsFollow] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  /** Compass 누적(내부). 화면에는 등급 단계 0~100만 표시 */
  const [trustRawScore, setTrustRawScore] = useState(0);

  // 지도 관련
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!userId) {
      navigate(-1);
      return;
    }

    // userId가 변경되면 상태 완전 초기화
    setLoading(true);
    setUser(null);
    setUserPosts([]);
    setEarnedBadges([]);
    setRepresentativeBadge(null);
    setStats({ posts: 0 });
    setShowAllBadges(false);
    setTrustRawScore(0);

    // 해당 사용자의 정보 찾기 (게시물에서)
    const uploadedPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const profileHint = location.state?.profileHint;

    // userId 매칭 (일관된 로직 - PostDetailScreen과 동일)
    const userPost = uploadedPosts.find(p => {
      // userId 추출 로직 (PostDetailScreen과 동일)
      let postUserId = p.userId;

      // p.user가 문자열인 경우
      if (!postUserId && typeof p.user === 'string') {
        postUserId = p.user;
      }

      // p.user가 객체인 경우
      if (!postUserId && p.user && typeof p.user === 'object') {
        postUserId = p.user.id || p.user.userId;
      }

      // 그 외의 경우
      if (!postUserId) {
        postUserId = p.user;
      }

      // 문자열 비교를 위해 모두 문자열로 변환
      return String(postUserId) === String(userId);
    });

    const cached = getCachedFollowProfile(userId);
    const resolvedFromPosts = resolveUserDisplayFromPosts(userId, uploadedPosts);
    const pickUsername = () => {
      if (profileHint?.username && profileHint.username !== '사용자') return profileHint.username;
      if (cached?.username && cached.username !== '사용자') return cached.username;
      if (userPost) {
        const postUserId = userPost.userId ||
          (typeof userPost.user === 'string' ? userPost.user : userPost.user?.id) ||
          userPost.user;
        return (typeof userPost.user === 'string' ? userPost.user : userPost.user?.username) ||
          String(postUserId) ||
          resolvedFromPosts.username;
      }
      return resolvedFromPosts.username;
    };
    const pickAvatar = () =>
      profileHint?.profileImage ??
      cached?.profileImage ??
      (userPost && typeof userPost.user === 'object' ? userPost.user?.profileImage : null) ??
      userPost?.userAvatar ??
      resolvedFromPosts.profileImage ??
      null;

    setUser({
      id: String(userId),
      username: pickUsername(),
      profileImage: pickAvatar(),
    });

    const isOwnProfile = currentUser && String(userId) === String(currentUser.id);
    const repBadgeJson = localStorage.getItem(`representativeBadge_${userId}`);
    if (repBadgeJson) {
      try {
        setRepresentativeBadge(JSON.parse(repBadgeJson));
      } catch {
        setRepresentativeBadge(null);
      }
    } else {
      setRepresentativeBadge(null);
    }

    // 해당 사용자의 게시물: Supabase(다른 사용자 사진 포함) + localStorage + 기존 API
    const getPostUserId = (post) => {
      let uid = post.userId;
      if (!uid && typeof post.user === 'string') uid = post.user;
      if (!uid && post.user && typeof post.user === 'object') uid = post.user.id || post.user.userId || post.user._id;
      if (!uid) uid = post.user;
      return uid != null ? String(uid) : '';
    };
    const localPosts = uploadedPosts.filter(post => getPostUserId(post) === String(userId));

    const merge = async () => {
      const byId = new Map();
      localPosts.forEach(p => { if (p && (p.id || p._id)) byId.set(p.id || p._id, p); });

      const applyMerged = (mergedList) => {
        const merged = [...mergedList].sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
        setUserPosts(merged);
        setStats({ posts: merged.length });
        const badges = getEarnedBadgesForUser(userId, merged) || [];
        setEarnedBadges(badges);
        if (!repBadgeJson) {
          setRepresentativeBadge((prev) => {
            if (prev) return prev;
            if (!badges.length) return null;
            const idx = userId ? (userId.toString().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % badges.length) : 0;
            const pick = badges[idx];
            if (isOwnProfile && pick) {
              try {
                localStorage.setItem(`representativeBadge_${userId}`, JSON.stringify(pick));
              } catch (_) { /* ignore */ }
            }
            return pick;
          });
        }
        const postsWithMedia = merged.filter(
          p => (p.images && p.images.length > 0) || p.image || p.imageUrl || (p.videos && p.videos.length > 0)
        );
        const dateSet = new Set();
        postsWithMedia.forEach(post => {
          const raw = post.createdAt || post.timestamp;
          if (raw == null || raw === '') return;
          const d = new Date(raw);
          if (isNaN(d.getTime())) return;
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          dateSet.add(`${y}-${m}-${day}`);
        });
        setAvailableDates([...dateSet].sort((a, b) => new Date(b) - new Date(a)));
      };

      // 로컬만으로 먼저 화면 표시 (느린 전체 Supabase 조회 제거)
      applyMerged([...byId.values()]);
      setLoading(false);

      // 1) Supabase: 해당 user_id(UUID) 게시물만 (경량)
      try {
        let supabasePosts = await fetchPostsByUserIdSupabase(userId);
        if ((!supabasePosts || supabasePosts.length === 0) && /^[0-9a-f-]{36}$/i.test(String(userId).trim())) {
          try {
            supabasePosts = await getMergedMyPostsForStats(userId);
          } catch (_) {
            supabasePosts = [];
          }
        }
        (supabasePosts || []).forEach(p => { if (p && p.id) byId.set(p.id, p); });
        if (supabasePosts && supabasePosts.length > 0) {
          const first = supabasePosts[0];
          const u = first.user && typeof first.user === 'object' ? first.user : {};
          setUser((prev) => {
            const next = {
              ...(prev || {}),
              id: String(userId),
              username: u.username || prev?.username || '사용자',
              profileImage: u.profileImage ?? prev?.profileImage ?? null,
            };
            if (next.username && next.username !== '사용자') {
              setCachedFollowProfile(userId, { username: next.username, profileImage: next.profileImage ?? null });
            }
            return next;
          });
        }
      } catch (_) { /* Supabase 실패 시 로컬/API만 사용 */ }

      localPosts.forEach(p => { if (p && (p.id || p._id) && !byId.has(p.id || p._id)) byId.set(p.id || p._id, p); });

      try {
        const res = await getPosts({ limit: 100 });
        if (res && res.posts && Array.isArray(res.posts)) {
          const apiForUser = res.posts.filter(post => getPostUserId(post) === String(userId));
          apiForUser.forEach(apiPost => {
            const id = apiPost.id || apiPost._id;
            const normalized = {
              ...apiPost,
              id: id,
              imageUrl: apiPost.imageUrl || apiPost.image || (apiPost.images && apiPost.images[0]),
              images: apiPost.images || (apiPost.imageUrl ? [apiPost.imageUrl] : []),
              createdAt: apiPost.createdAt || apiPost.timestamp,
              timestamp: apiPost.timestamp || apiPost.createdAt
            };
            if (!byId.has(id)) byId.set(id, normalized);
            else byId.set(id, { ...byId.get(id), ...normalized });
          });
        }
      } catch (_) { /* API 없으면 무시 */ }

      applyMerged([...byId.values()]);
    };
    merge();

    // cleanup 함수: userId가 변경될 때 이전 상태 완전 초기화
    return () => {
      setLoading(true);
      setUser(null);
      setUserPosts([]);
      setEarnedBadges([]);
      setRepresentativeBadge(null);
      setStats({ posts: 0 });
      setShowAllBadges(false);
      setSelectedDate('');
      setAvailableDates([]);
    };
  }, [userId, navigate, currentUser, location.key]);

  // 팔로우 / 팔로워·팔로잉 수 로드 및 followsUpdated 구독
  useEffect(() => {
    if (!userId) return;
    const load = () => {
      setFollowerCount(getFollowerCount(userId));
      setFollowingCount(getFollowingCount(userId));
      setIsFollow(isFollowing(null, userId));
    };
    load();
    window.addEventListener('followsUpdated', load);
    return () => window.removeEventListener('followsUpdated', load);
  }, [userId]);

  // 신뢰지수: 클라이언트 Compass 누적(등급·단계 진행률은 getTrustGrade로 계산)
  useEffect(() => {
    if (!userId) return;
    const raw = getTrustRawScore(userId, userPosts.length ? userPosts : null);
    setTrustRawScore(raw);
  }, [userId, userPosts]);

  // 서버에서 유저 정보 가져오기 (신뢰지수는 로컬 Compass 기준으로 통일)
  useEffect(() => {
    if (!userId) return;
    const isServerId = /^[a-fA-F0-9]{24}$/.test(String(userId));
    if (!isServerId) return;
    api.get(`/users/${userId}`)
      .then((res) => {
        const u = res.data?.user;
        if (u && (u.username || u.profileImage != null)) {
          setUser((prev) => (prev ? { ...prev, ...u, id: prev.id } : null));
          // 서버에 저장된 대표 뱃지가 있으면 우선 사용 (사용자가 설정한 대표 뱃지 노출)
          if (u.representativeBadge) {
            setRepresentativeBadge(u.representativeBadge);
          }
        }
      })
      .catch(() => {});
  }, [userId]);

  // 날짜별 필터된 게시물 (지도 + 그리드 공통) + 항상 날짜순(최신순) 정렬
  const filteredUserPosts = React.useMemo(() => {
    let list = userPosts;
    if (selectedDate) {
      const filterDate = new Date(selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      list = userPosts.filter(post => {
        const postDate = new Date(post.createdAt || post.timestamp || Date.now());
        postDate.setHours(0, 0, 0, 0);
        return postDate >= filterDate && postDate < nextDay;
      });
    }
    // 사용자가 올린 피드를 날짜순(최신순)으로 정렬
    return [...list].sort((a, b) => {
      const ta = (a.createdAt || a.timestamp || 0) ? new Date(a.createdAt || a.timestamp).getTime() : 0;
      const tb = (b.createdAt || b.timestamp || 0) ? new Date(b.createdAt || b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [userPosts, selectedDate]);

  // 지도에 표시할 수 있는 게시물 (filteredUserPosts 중 coordinates 또는 지역명으로 좌표 추출 가능)
  const postsForMap = React.useMemo(() => {
    return filteredUserPosts.filter(post => {
      const coords = post.coordinates || getCoordinatesByLocation(post.detailedLocation || post.location);
      return coords && coords.lat != null && coords.lng != null;
    });
  }, [filteredUserPosts]);

  // 여행 지도 초기화 (다른 사용자 프로필에서 해당 사용자의 여행 경로 표시)
  const initTravelMap = useCallback(() => {
    if (!mapRef.current || postsForMap.length === 0) {
      setMapLoading(false);
      return;
    }
    if (!window.kakao || !window.kakao.maps) {
      setTimeout(initTravelMap, 120);
      return;
    }

    setMapLoading(true);
    try {
      markersRef.current.forEach(markerData => {
        try {
          if (markerData.overlay) markerData.overlay.setMap(null);
          if (markerData.marker) markerData.marker.setMap(null);
          if (markerData.polyline) markerData.polyline.setMap(null);
        } catch (_) { }
      });
      markersRef.current = [];

      const container = mapRef.current;
      if (!container || container.offsetWidth === 0) {
        setMapLoading(false);
        return;
      }

      let centerLat = 37.5665, centerLng = 126.9780, level = 6;
      const first = postsForMap[0];
      const firstCoords = first.coordinates || getCoordinatesByLocation(first.detailedLocation || first.location);
      if (firstCoords) {
        centerLat = firstCoords.lat;
        centerLng = firstCoords.lng;
        level = 5;
      }

      let map = mapInstance.current;
      if (!map) {
        map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: level,
        });
        mapInstance.current = map;
      } else {
        map.setCenter(new window.kakao.maps.LatLng(centerLat, centerLng));
        map.setLevel(level);
      }

      const pathCoordinates = [];
      const sorted = [...postsForMap].sort((a, b) =>
        new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0)
      );

      sorted.forEach((post, index) => {
        const coords = post.coordinates || getCoordinatesByLocation(post.detailedLocation || post.location);
        if (!coords) return;
        const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
        pathCoordinates.push(position);

        const imageUrl = getDisplayImageUrl(post.images?.[0] || post.imageUrl || post.image || post.thumbnail);
        const el = document.createElement('div');
        el.innerHTML = `
          <button class="relative w-10 h-10 border-2 border-white shadow-md rounded-md overflow-hidden hover:scale-110 transition-all cursor-pointer" style="z-index:${index}" data-post-id="${post.id}">
            <img class="w-full h-full object-cover" src="${imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjRjNGNEY2Ii8+PHBhdGggZD0iTTIwIDE0QzE3IDE0IDE1IDE2IDE1IDE5YzAgMyAyIDUgNSA1czUtMiA1LTVjMC0zLTIuODEtNS01IDVaIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+'}" alt="${post.location || '여행지'}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjRjNGNEY2Ii8+PHBhdGggZD0iTTIwIDE0YzAgMC0zIDItNSAycy01LTItNS0yIiBmaWxsPSIjOUI5Q0E1Ii8+PC9zdmc+';" />
          </button>
        `;
        const btn = el.querySelector('button');
        if (btn) {
          btn.addEventListener('click', () => {
            const idx = filteredUserPosts.findIndex(p => p.id === post.id);
            setSelectedPost({ post, allPosts: filteredUserPosts, currentPostIndex: idx >= 0 ? idx : 0 });
          });
        }
        const overlay = new window.kakao.maps.CustomOverlay({ position, content: el, yAnchor: 1, zIndex: index });
        overlay.setMap(map);
        markersRef.current.push({ overlay });
      });

      if (pathCoordinates.length >= 2) {
        const polyline = new window.kakao.maps.Polyline({
          path: pathCoordinates,
          strokeWeight: 3,
          strokeColor: '#14B8A6',
          strokeOpacity: 0.7,
          strokeStyle: 'solid',
        });
        polyline.setMap(map);
        markersRef.current.push({ polyline });
      }

      if (markersRef.current.length > 0) {
        const bounds = new window.kakao.maps.LatLngBounds();
        markersRef.current.forEach(md => {
          if (md.overlay) bounds.extend(md.overlay.getPosition());
        });
        if (markersRef.current.filter(md => md.overlay).length > 1) {
          map.setBounds(bounds);
        } else {
          const first = markersRef.current.find(md => md.overlay);
          if (first) map.setCenter(first.overlay.getPosition());
        }
      }
    } catch (err) {
      logger.warn('여행 지도 초기화 오류:', err);
    } finally {
      setMapLoading(false);
    }
  }, [postsForMap, filteredUserPosts]);

  useEffect(() => {
    if (postsForMap.length > 0) {
      const t = setTimeout(initTravelMap, 100);
      return () => {
        clearTimeout(t);
        markersRef.current.forEach(md => {
          try {
            if (md.overlay) md.overlay.setMap(null);
            if (md.polyline) md.polyline.setMap(null);
          } catch (_) { }
        });
        markersRef.current = [];
      };
    } else {
      setMapLoading(false);
    }
  }, [postsForMap.length, initTravelMap]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 dark:border-gray-600 mx-auto mb-4"></div>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark relative h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
      <div className="screen-content flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* 헤더 (고정) */}
        <header className="screen-header flex-shrink-0 bg-white dark:bg-gray-900 flex items-center p-4 justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex size-12 shrink-0 items-center justify-center text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold">프로필</h1>
          <div className="w-12"></div>
        </header>

        {/* 메인 컨텐츠 (스크롤 영역: 프로필·통계·날짜·지도·피드) */}
        <div
          className="screen-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}
        >
          {/* 프로필 정보 */}
          <div className="bg-white dark:bg-gray-900 px-6 py-6">
            <div className="flex items-start gap-4 mb-4">
              {/* 프로필 사진 */}
              <div className="flex-shrink-0">
                {user.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-4xl">person</span>
                  </div>
                )}
              </div>

              {/* 사용자 정보 */}
              <div className="flex-1 min-w-0">
                {/* 이름 + 대표 뱃지 / 팔로우 버튼 — 한 줄 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h2 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold truncate">
                      {user.username || '사용자'}
                    </h2>
                    {representativeBadge && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full flex-shrink-0">
                        <span className="text-sm">{representativeBadge.icon}</span>
                        <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 max-w-[72px] truncate">
                          {representativeBadge.name}
                        </span>
                      </div>
                    )}
                  </div>
                  {currentUser && String(currentUser.id) !== String(userId) && (
                    <button
                      onClick={() => {
                        if (followLoading) return;
                        setFollowLoading(true);
                        if (isFollow) {
                          unfollow(userId);
                          setIsFollow(false);
                          setFollowerCount((c) => Math.max(0, c - 1));
                        } else {
                          const r = follow(userId);
                          if (r.success) {
                            setIsFollow(true);
                            setFollowerCount((c) => c + 1);
                            const myName = currentUser?.username || '여행자';
                            const theirName = user?.username || '사용자';
                            setCachedFollowProfile(userId, {
                              username: theirName,
                              profileImage: user?.profileImage || null,
                            });
                            notifyFollowReceived(myName, userId, {
                              actorUserId: currentUser.id,
                              actorAvatar: currentUser?.profileImage || null,
                            });
                            notifyFollowingStarted(theirName, currentUser.id, {
                              targetUserId: userId,
                              targetAvatar: user?.profileImage || null,
                            });
                          }
                        }
                        setFollowLoading(false);
                      }}
                      disabled={followLoading}
                      className={`shrink-0 py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors ${isFollow
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                        : 'bg-primary text-white'
                        }`}
                    >
                      {isFollow ? '팔로잉' : '팔로우'}
                    </button>
                  )}
                </div>
                {/* 자기 소개: 이름·뱃지 하단에 한 줄로 표시 */}
                {user?.bio && (
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1.5 line-clamp-2 break-keep w-full">
                    {user.bio}
                  </p>
                )}

                {/* 획득한 뱃지 개수 표시 (이름 줄 아래) */}
                {earnedBadges.length > (representativeBadge ? 1 : 0) && (
                  <button
                    onClick={() => setShowAllBadges(true)}
                    className="mt-1 inline-flex min-w-[32px] h-7 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 items-center justify-center px-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                      +{earnedBadges.length - (representativeBadge ? 1 : 0)}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 통계 정보 */}
          <div className="bg-white dark:bg-gray-900 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-around flex-wrap gap-y-2">
              <div className="text-center min-w-[52px]">
                <div className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{stats.posts}</div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">게시물</div>
              </div>
              <div className="text-center min-w-[52px]">
                <div className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{followerCount}</div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">팔로워</div>
              </div>
              <div className="text-center min-w-[52px]">
                <div className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">{followingCount}</div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">팔로잉</div>
              </div>
            </div>
          </div>

          {/* 신뢰지수 - 한 줄로 깔끔하게 (다른 사용자도 해당 사용자 게시물 기준으로 표시) */}
          {(() => {
            const postsForTrust = userPosts.length ? userPosts : null;
            const { grade, nextGrade, progressToNext, pointsRemainingInTier } = getTrustGrade(trustRawScore, userId || null, postsForTrust);
            return (
              <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-6 py-4">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-nowrap min-w-0">
                  <span className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark shrink-0">신뢰지수</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title="등급마다 0~100점, 높은 등급일수록 채우기 더딤">단계 진행 (0~100)</span>
                </div>
                <div className="flex items-center gap-2 mb-1.5 flex-nowrap min-w-0">
                  <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 shrink-0">{progressToNext}</span>
                  <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap shrink-0">{grade.icon} {grade.name}</span>
                  {nextGrade && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">이번 단계 승급까지 {pointsRemainingInTier}점</span>
                  )}
                </div>
                {nextGrade && (
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-400 dark:bg-gray-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressToNext}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* 여행 지도 - 이 사용자가 다녀온 장소를 지도에 표시 (다른 사용자도 볼 수 있음) */}
          {userPosts.length > 0 && (
            <div className="bg-white dark:bg-gray-900 px-4 py-4 border-t border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-600 dark:text-gray-400 text-xl">map</span>
                {user.username || '사용자'}의 여행 지도
              </h3>
              {filteredUserPosts.length === 0 ? (
                <div className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    등록한 게시물이 없습니다
                  </p>
                </div>
              ) : postsForMap.length === 0 ? (
                <div className="h-40 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    방문한 장소 중 위치 정보가 있는 곳이 없습니다
                  </p>
                </div>
              ) : (
                <div className="relative overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                  <div ref={mapRef} className="w-full h-48" />
                  {mapLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-600 border-t-transparent" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 사진 피드 - 내 사진처럼 4열·가볍게 (날짜 없음) */}
          <div className="bg-white dark:bg-gray-900 px-4 py-4 border-t border-gray-100 dark:border-gray-800">
            {userPosts.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">
                  photo_library
                </span>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  아직 업로드한 사진이 없습니다
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredUserPosts.map((post, index) => (
                  <button
                    key={post.id || index}
                    type="button"
                    onClick={() => {
                      const currentIndex = filteredUserPosts.findIndex(p => p.id === post.id);
                      navigate(`/post/${post.id}`, {
                        state: {
                          post: post,
                          allPosts: filteredUserPosts,
                          currentPostIndex: currentIndex >= 0 ? currentIndex : 0
                        }
                      });
                    }}
                    className="cursor-pointer text-left p-0 border-0 bg-transparent rounded-md overflow-hidden"
                  >
                    <div className="aspect-square relative overflow-hidden rounded-md">
                      {post.videos && post.videos.length > 0 ? (
                        <video
                          src={getDisplayImageUrl(post.videos[0])}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          muted
                          loop
                          playsInline
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <img
                          src={getDisplayImageUrl(post.imageUrl || post.images?.[0] || post.image || post.thumbnail)}
                          alt={post.location || ''}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNGM0Y0RjYiLz48cGF0aCBkPSJNNTAgMzVDNDMgMzUgMzggNDAgMzggNDdjMCA3IDUgMTIgMTIgMTJzMTItNSAxMi0xMmMwLTctNy0xMi0xMi0xMnoiIGZpbGw9IiM5QjlDQTEiLz48L3N2Zz4=';
                          }}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />

      {/* 게시물 상세화면 모달 - 지도화면과 동일하게 화면 내 절대위치 오버레이 */}
      {
        selectedPost && (
          <div
            onClick={() => setSelectedPost(null)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                width: '100%',
                maxWidth: 'calc(100% - 40px)',
                maxHeight: 'calc(100vh - 200px)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
            >
              {/* 헤더 */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {selectedPost.post.location || selectedPost.post.detailedLocation || '여행지'}
                </h2>
                <button
                  onClick={() => setSelectedPost(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: 'none',
                    background: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>
                    close
                  </span>
                </button>
              </div>

              {/* 이미지/동영상 */}
              <div style={{
                width: '100%',
                aspectRatio: '4/3',
                overflow: 'hidden',
                background: '#f5f5f5'
              }}>
                {selectedPost.post.videos && selectedPost.post.videos.length > 0 ? (
                  <video
                    src={getDisplayImageUrl(selectedPost.post.videos[0])}
                    controls
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={getDisplayImageUrl(selectedPost.post.images?.[0] || selectedPost.post.imageUrl || selectedPost.post.image || selectedPost.post.thumbnail)}
                    alt={selectedPost.post.location || '여행지'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>

              {/* 내용 — 사진 아래 시트 스타일 통일 */}
              <div style={{
                padding: '16px',
                overflowY: 'auto',
                flex: 1,
                borderTop: '3px solid #475569',
                background: '#f8fafc',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                {selectedPost.post.note && (
                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.6'
                  }}>
                    {selectedPost.post.note}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                  paddingTop: '12px'
                }}>
                  <span className="material-symbols-outlined text-gray-600 dark:text-gray-400" style={{ fontSize: '18px' }}>
                    location_on
                  </span>
                  <span style={{
                    fontSize: '13px',
                    color: '#999'
                  }}>
                    {selectedPost.post.detailedLocation || selectedPost.post.location || '위치 정보 없음'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedPost(null);
                    navigate(`/post/${selectedPost.post.id}`, {
                      state: {
                        post: selectedPost.post,
                        allPosts: selectedPost.allPosts,
                        currentPostIndex: selectedPost.currentPostIndex
                      }
                    });
                  }}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    background: '#00BCD4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  전체 보기
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 뱃지 모두보기 모달 */}
      {
        showAllBadges && (
          <div
            className="fixed inset-0 bg-black/50 z-[200] flex items-end justify-center"
            onClick={() => setShowAllBadges(false)}
          >
            <div
              className="bg-white dark:bg-gray-900 w-full max-w-[360px] rounded-3xl overflow-hidden mb-2 mx-2 flex flex-col"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: 'calc(100vh - 16px)' }}
            >
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">획득한 뱃지</h2>
                <button
                  onClick={() => setShowAllBadges(false)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* 뱃지 그리드 - 스크롤 가능 */}
              <div className="p-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                <div className="grid grid-cols-3 gap-4">
                  {earnedBadges.map((badge, index) => {
                    const isRepresentative = representativeBadge?.name === badge.name;
                    return (
                      <div
                        key={index}
                        className="flex flex-col items-center"
                      >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${isRepresentative
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                          }`}>
                          <span className="text-3xl">{badge.icon}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white text-center mb-1">
                          {getBadgeDisplayName(badge)}
                        </p>
                        {isRepresentative && (
                          <span className="text-[10px] font-bold text-white bg-primary px-2 py-0.5 rounded">
                            대표
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default UserProfileScreen;


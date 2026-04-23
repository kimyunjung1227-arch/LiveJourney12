import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import BackButton from '../components/BackButton';
import ProfileInjangSection from '../components/ProfileInjangSection';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { getEarnedBadgesForUser, getBadgeDisplayName } from '../utils/badgeSystem';
import { getMergedMyPostsForStats } from '../api/postsSupabase';
import { getCoordinatesByLocation } from '../utils/regionLocationMapping';
import {
  follow,
  unfollow,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
  getFollowerIds,
  getFollowingIds,
  syncFollowersFromSupabase,
  syncFollowingFromSupabase,
  isFollowingRemote,
} from '../utils/followSystem';
import { notifyFollowReceived, notifyFollowingStarted } from '../utils/notifications';
import { logger } from '../utils/logger';
import { getDisplayImageUrl } from '../api/upload';
import { getPosts } from '../api/posts';
import { fetchPostsByUserIdSupabase, fetchPostsSupabase } from '../api/postsSupabase';
import { fetchProfilesByIdsSupabase } from '../api/profilesSupabase';
import { getTrustRawScore, getTrustGrade, TRUST_GRADES } from '../utils/trustIndex';
import api from '../api/axios';
import {
  resolveUserDisplayFromPosts,
  getCachedFollowProfile,
  setCachedFollowProfile,
} from '../utils/userProfileHints';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const UserProfileScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [representativeBadge, setRepresentativeBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [mapDatesExpanded, setMapDatesExpanded] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null); // 여행 지도 핀 클릭 시 가벼운 사진상세 모달용
  const [isFollow, setIsFollow] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  /** Compass 누적(내부). 화면에는 등급 단계 0~100만 표시 */
  const [trustRawScore, setTrustRawScore] = useState(0);
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'map' — 내 프로필과 동일 탭 구조
  const [photoViewMode, setPhotoViewMode] = useState('custom'); // 'custom' | 'date'
  const [showFollowListModal, setShowFollowListModal] = useState(false);
  const [followListType, setFollowListType] = useState('follower');
  const [followListIds, setFollowListIds] = useState([]);
  const [followListPostPool, setFollowListPostPool] = useState([]);
  const [followListProfiles, setFollowListProfiles] = useState({});
  const [showTrustGradesModal, setShowTrustGradesModal] = useState(false);
  const [trustExplainOpen, setTrustExplainOpen] = useState(false);

  // 지도 관련
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [geoCoordsByKey, setGeoCoordsByKey] = useState({});

  const getPostCoords = useCallback((post) => {
    if (!post) return null;
    const c = post.coordinates;
    if (c && (c.lat != null || c.latitude != null) && (c.lng != null || c.longitude != null)) {
      return { lat: Number(c.lat ?? c.latitude), lng: Number(c.lng ?? c.longitude) };
    }
    const locObj = post.location;
    if (locObj && typeof locObj === 'object' && (locObj.lat != null || locObj.lon != null)) {
      const lat = locObj.lat ?? locObj.latitude;
      const lng = locObj.lng ?? locObj.lon ?? locObj.longitude;
      if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
    }
    const name = post.detailedLocation || (typeof post.location === 'string' ? post.location : null) || post.placeName;
    const mapped = name ? getCoordinatesByLocation(name) : null;
    if (mapped) return mapped;
    if (name) {
      const cached = geoCoordsByKey[String(name)];
      if (cached && cached.lat != null && cached.lng != null) return cached;
    }
    return null;
  }, [geoCoordsByKey]);

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
    setTrustRawScore(0);

    // 해당 사용자의 정보 찾기 (게시물에서)
    const uploadedPosts = getUploadedPostsSafe();
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
      username: pickUsername() || '여행자',
      profileImage: pickAvatar(),
    });

    const isOwnProfile = currentUser && String(userId) === String(currentUser.id);
    const repBadgeJson = null;
    setRepresentativeBadge(null);

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
        const badges = getEarnedBadgesForUser(userId, merged) || [];
        setEarnedBadges(badges);
        if (!repBadgeJson) {
          setRepresentativeBadge((prev) => {
            if (prev) return prev;
            if (!badges.length) return null;
            const idx = userId ? (userId.toString().split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % badges.length) : 0;
            const pick = badges[idx];
            if (isOwnProfile && pick) {
              // 서버 운영 전환: localStorage 제거
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
        let supabasePosts = await fetchPostsByUserIdSupabase(userId, currentUser?.id || null);
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
              username: u.username || prev?.username || '여행자',
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
      setSelectedDate('');
      setAvailableDates([]);
    };
  }, [userId, navigate, currentUser, location.key]);

  // 팔로우 / 팔로워·팔로잉 수 로드 및 followsUpdated 구독
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        await Promise.all([syncFollowersFromSupabase(userId), syncFollowingFromSupabase(userId)]);
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setFollowerCount(getFollowerCount(userId));
      setFollowingCount(getFollowingCount(userId));
      try {
        const ok = await isFollowingRemote(null, userId);
        if (!cancelled) setIsFollow(ok);
      } catch {
        if (!cancelled) setIsFollow(isFollowing(null, userId));
      }
    };
    void load();
    const onFollows = () => void load();
    window.addEventListener('followsUpdated', onFollows);
    return () => {
      cancelled = true;
      window.removeEventListener('followsUpdated', onFollows);
    };
  }, [userId]);

  useEffect(() => {
    if (!showFollowListModal || !userId) return;
    const local = getUploadedPostsSafe();
    setFollowListPostPool(local);
    setFollowListProfiles({});
    let cancelled = false;
    const ids = Array.isArray(followListIds) ? followListIds : [];
    (async () => {
      try {
        const remote = await fetchPostsSupabase(currentUser?.id || null);
        if (cancelled) return;
        const byId = new Map();
        local.forEach((p) => {
          if (p?.id != null) byId.set(p.id, p);
        });
        (remote || []).forEach((p) => {
          if (p?.id != null && !byId.has(p.id)) byId.set(p.id, p);
        });
        setFollowListPostPool([...byId.values()]);
      } catch {
        setFollowListPostPool(local);
      }

      // profiles 우선 조회: 게시물이 삭제되어도 유저 표시(닉네임/아바타)가 사라지지 않도록
      try {
        const rows = await fetchProfilesByIdsSupabase(ids);
        if (cancelled) return;
        const map = {};
        (Array.isArray(rows) ? rows : []).forEach((r) => {
          if (r?.id) {
            map[String(r.id)] = {
              username: r?.username ? String(r.username) : '',
              profileImage: r?.avatar_url ? String(r.avatar_url) : null,
              bio: r?.bio ? String(r.bio) : null,
            };
          }
        });
        setFollowListProfiles(map);
      } catch {
        setFollowListProfiles({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showFollowListModal, followListIds, userId]);

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

  // 사진 탭: 전체 게시물 최신순 (내 프로필과 동일하게 날짜 필터는 지도 탭에서만)
  const photoPostsSorted = useMemo(() => {
    return [...userPosts].sort((a, b) => {
      const ta = new Date(a.createdAt || a.timestamp || 0).getTime();
      const tb = new Date(b.createdAt || b.timestamp || 0).getTime();
      return tb - ta;
    });
  }, [userPosts]);

  // 기록 지도 탭: 날짜 칩 필터 적용
  const mapTabFilteredPosts = useMemo(() => {
    let list = userPosts;
    if (selectedDate) {
      const filterDate = new Date(selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      list = userPosts.filter((post) => {
        const postDate = new Date(post.createdAt || post.timestamp || Date.now());
        postDate.setHours(0, 0, 0, 0);
        return postDate >= filterDate && postDate < nextDay;
      });
    }
    return [...list].sort((a, b) => {
      const ta = (a.createdAt || a.timestamp || 0) ? new Date(a.createdAt || a.timestamp).getTime() : 0;
      const tb = (b.createdAt || b.timestamp || 0) ? new Date(b.createdAt || b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [userPosts, selectedDate]);

  const postsForMap = useMemo(() => {
    return mapTabFilteredPosts.filter((post) => {
      const coords = getPostCoords(post);
      return coords && coords.lat != null && coords.lng != null;
    });
  }, [mapTabFilteredPosts, getPostCoords]);

  useEffect(() => {
    const missing = mapTabFilteredPosts
      .map((p) => {
        const key = p?.detailedLocation || (typeof p?.location === 'string' ? p.location : null) || p?.placeName || '';
        return { post: p, key: String(key).trim() };
      })
      .filter(({ post, key }) => post && key && !getPostCoords(post));

    if (missing.length === 0) return;
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;

    const geocoder = new window.kakao.maps.services.Geocoder();
    let cancelled = false;

    const run = async () => {
      for (const { key } of missing.slice(0, 12)) {
        if (cancelled) return;
        if (geoCoordsByKey[key]) continue;

        await new Promise((resolve) => {
          geocoder.addressSearch(key, (result, status) => {
            if (cancelled) return resolve();
            if (status === window.kakao.maps.services.Status.OK && result && result[0]) {
              const lat = Number(result[0].y);
              const lng = Number(result[0].x);
              if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                setGeoCoordsByKey((prev) => ({ ...prev, [key]: { lat, lng } }));
              }
            }
            resolve();
          });
        });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [mapTabFilteredPosts, getPostCoords, geoCoordsByKey]);

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
      if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
        setTimeout(initTravelMap, 160);
        return;
      }

      let centerLat = 37.5665, centerLng = 126.9780, level = 6;
      const first = postsForMap[0];
      const firstCoords = getPostCoords(first);
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
      // 컨테이너 크기/레이아웃 변경 후에도 타일이 제대로 뜨도록 강제 리레이아웃
      try {
        map.relayout();
      } catch (_) {}

      const pathCoordinates = [];
      const sorted = [...postsForMap].sort((a, b) =>
        new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0)
      );

      sorted.forEach((post, index) => {
        const coords = getPostCoords(post);
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
            const idx = mapTabFilteredPosts.findIndex(p => p.id === post.id);
            setSelectedPost({ post, allPosts: mapTabFilteredPosts, currentPostIndex: idx >= 0 ? idx : 0 });
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
  }, [postsForMap, mapTabFilteredPosts, getPostCoords]);

  useEffect(() => {
    if (activeTab !== 'map') {
      setMapLoading(false);
      return undefined;
    }
    if (postsForMap.length > 0) {
      const t = setTimeout(initTravelMap, 100);
      const onResize = () => {
        if (mapInstance.current) {
          try { mapInstance.current.relayout(); } catch (_) {}
        }
        initTravelMap();
      };
      window.addEventListener('resize', onResize);
      return () => {
        clearTimeout(t);
        window.removeEventListener('resize', onResize);
        markersRef.current.forEach(md => {
          try {
            if (md.overlay) md.overlay.setMap(null);
            if (md.polyline) md.polyline.setMap(null);
          } catch (_) { }
        });
        markersRef.current = [];
      };
    }
    setMapLoading(false);
    return undefined;
  }, [activeTab, postsForMap.length, initTravelMap]);

  useEffect(() => {
    if (activeTab !== 'map') return;
    const t = setTimeout(() => {
      if (mapInstance.current) {
        try { mapInstance.current.relayout(); } catch (_) {}
      }
    }, 150);
    return () => clearTimeout(t);
  }, [activeTab]);

  const locationLabel = (post) => {
    if (!post) return '기타';
    if (typeof post.location === 'string' && post.location.trim()) return post.location;
    if (post.detailedLocation) return post.detailedLocation;
    return '기타';
  };

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
    <div className="screen-layout bg-background-light dark:bg-background-dark relative min-h-[100dvh]">
      <div className="screen-content">
        <header className="screen-header bg-white dark:bg-gray-900 flex items-center p-4 justify-between">
          <BackButton onClick={() => navigate(-1)} />
          <h1 className="text-text-primary-light dark:text-text-primary-dark text-lg font-bold">프로필</h1>
          <div className="w-10 shrink-0" aria-hidden />
        </header>

        <div className="screen-body">
          <div className="bg-white dark:bg-gray-900 px-4 py-2.5">
            <div className="flex flex-col gap-2.5">
              {/* 1줄: 프로필 사진 + 이름/대표뱃지 + 팔로우 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-600 dark:text-gray-300 text-3xl">person</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="min-w-0 flex items-center gap-2">
                    <h2
                      className="text-text-primary-light dark:text-text-primary-dark text-sm font-bold truncate max-w-[160px] sm:max-w-[220px]"
                      title={user.username || '사용자'}
                    >
                      {user.username || '사용자'}
                    </h2>
                    {representativeBadge && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/badge/live/${encodeURIComponent(String(representativeBadge?.name || ''))}`, {
                            state: { badge: representativeBadge },
                          })
                        }
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full flex-shrink-0 border border-gray-200 dark:border-gray-600 max-w-[140px] hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                      >
                        <span className="text-sm">{representativeBadge.icon}</span>
                        <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {getBadgeDisplayName(representativeBadge) || representativeBadge.name}
                        </span>
                      </button>
                    )}
                  </div>
                  {currentUser && String(currentUser.id) !== String(userId) && (
                    <button
                      type="button"
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
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                    >
                      {isFollow ? '팔로잉' : '팔로우'}
                    </button>
                  )}
                </div>
                {user?.bio && (
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1 line-clamp-2 break-keep">
                    {user.bio}
                  </p>
                )}
                </div>
              </div>

              {/* 2줄: 게시물/팔로워/팔로잉 (첨부 이미지 스타일) */}
              <div className="flex items-center gap-10 text-gray-700 dark:text-gray-300">
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">게시물</span>
                  <span className="text-base font-bold">{userPosts.length}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!userId) return;
                    await syncFollowersFromSupabase(userId);
                    setFollowListIds(getFollowerIds(userId));
                    setFollowListType('follower');
                    setShowFollowListModal(true);
                  }}
                  className="flex flex-col items-start"
                >
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">팔로워</span>
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">{followerCount}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!userId) return;
                    await syncFollowingFromSupabase(userId);
                    setFollowListIds(getFollowingIds(userId));
                    setFollowListType('following');
                    setShowFollowListModal(true);
                  }}
                  className="flex flex-col items-start"
                >
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">팔로잉</span>
                  <span className="text-base font-bold text-gray-900 dark:text-gray-100">{followingCount}</span>
                </button>
              </div>
            </div>

            <ProfileInjangSection
              badges={earnedBadges}
              onOpenBadge={(badge) =>
                navigate(`/badge/live/${encodeURIComponent(String(badge?.name || ''))}`, {
                  state: { badge },
                })
              }
              onViewAll={() => userId && navigate(`/user/${userId}/badges`, {
                state: {
                  badges: (earnedBadges || []).map((b) => ({
                    name: b?.name,
                    displayName: b?.displayName,
                    icon: b?.icon,
                    category: b?.category,
                    earnedAt: b?.earnedAt,
                    region: b?.region,
                    description: b?.description,
                    shortCondition: b?.shortCondition,
                    progressCurrent: b?.progressCurrent,
                    progressTarget: b?.progressTarget,
                    progressUnit: b?.progressUnit,
                    tone: b?.tone,
                    gradientCss: b?.gradientCss,
                    difficulty: b?.difficulty,
                    dynamic: b?.dynamic,
                  })),
                  profileHint: { username: user?.username || '사용자', profileImage: user?.profileImage || null },
                },
              })}
            />

            <div className="px-6 py-4">
              {(() => {
                const postsForTrust = userPosts.length ? userPosts : null;
                const { grade, nextGrade, progressToNext, pointsRemainingInTier } = getTrustGrade(
                  trustRawScore,
                  userId || null,
                  postsForTrust
                );
                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1 flex-nowrap min-w-0">
                      <button
                        type="button"
                        onClick={() => { setTrustExplainOpen(false); setShowTrustGradesModal(true); }}
                        className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark shrink-0 hover:text-primary transition-colors"
                      >
                        신뢰지수
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{progressToNext}</span>
                        <span className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                          {grade.icon} {grade.name}
                        </span>
                      </div>
                    </div>
                    {nextGrade && (
                      <>
                        <div className="flex justify-end mb-0.5">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">이번 단계 승급까지 {pointsRemainingInTier}점</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
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

          <div className="bg-white dark:bg-gray-900 px-6 py-6 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('my')}
                className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'my'
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                사진
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm whitespace-nowrap ${activeTab === 'map'
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                기록 지도
              </button>
            </div>

            {activeTab === 'my' && userPosts.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPhotoViewMode('custom')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${photoViewMode === 'custom'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    모아보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoViewMode('date')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${photoViewMode === 'date'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    날짜 순
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'my' && userPosts.length === 0 && (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3 block">photo_library</span>
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-medium mb-2">아직 올린 사진이 없어요</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm">이 사용자의 게시물이 여기에 표시됩니다.</p>
              </div>
            )}

            {activeTab === 'my' && userPosts.length > 0 && photoViewMode === 'date' && (
              <div className="space-y-6">
                {Object.entries(
                  photoPostsSorted.reduce((acc, post) => {
                    const date = new Date(post.createdAt || post.timestamp || Date.now());
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
                  .sort((a, b) => new Date(b[1][0].createdAt || b[1][0].timestamp) - new Date(a[1][0].createdAt || a[1][0].timestamp))
                  .map(([date, posts]) => (
                    <div key={date}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{date}</h3>
                        </div>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{posts.length}장</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {posts.map((post, index) => {
                          const allPosts = photoPostsSorted;
                          const currentIndex = allPosts.findIndex((p) => p.id === post.id);
                          return (
                            <button
                              key={post.id || index}
                              type="button"
                              onClick={() => navigate(`/post/${post.id}`, {
                                state: {
                                  post,
                                  allPosts,
                                  currentPostIndex: currentIndex >= 0 ? currentIndex : 0,
                                },
                              })}
                              className="cursor-pointer text-left p-0 border-0 bg-transparent"
                            >
                              <div className="aspect-square relative overflow-hidden rounded-md mb-1">
                                {post.videos && post.videos.length > 0 ? (
                                  <video
                                    src={getDisplayImageUrl(post.videos[0], { allowBlob: true })}
                                    className="w-full h-full object-cover"
                                    muted
                                    loop
                                    playsInline
                                  />
                                ) : (
                                  <img
                                    src={getDisplayImageUrl(post.imageUrl || post.images?.[0] || post.image || post.thumbnail)}
                                    alt=""
                                    className="w-full h-full object-cover hover:scale-110 transition-all duration-300"
                                    loading="eager"
                                    decoding="async"
                                    fetchPriority={index < 8 ? 'high' : 'auto'}
                                  />
                                )}
                              </div>
                              <div className="space-y-0.5 min-w-0" style={{ borderTop: '3px solid #475569', background: '#f8fafc', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '12px 14px 14px' }}>
                                <p className="text-[10px] font-medium text-text-primary-light dark:text-text-primary-dark truncate">
                                  {post.note || locationLabel(post) || '기록'}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {activeTab === 'my' && userPosts.length > 0 && photoViewMode === 'custom' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">모아보기: 좋아요 많은 순으로 보기</p>
                <div className="grid grid-cols-3 gap-2">
                  {([...photoPostsSorted]
                    .slice()
                    .sort((a, b) => (b.likes || b.likeCount || 0) - (a.likes || a.likeCount || 0))
                  ).map((post, index) => {
                    const allPosts = photoPostsSorted;
                    const currentIndex = allPosts.findIndex((p) => p.id === post.id);
                    return (
                      <button
                        key={post.id || index}
                        type="button"
                        onClick={() => navigate(`/post/${post.id}`, {
                          state: {
                            post,
                            allPosts,
                            currentPostIndex: currentIndex >= 0 ? currentIndex : 0,
                          },
                        })}
                        className="cursor-pointer text-left p-0 border-0 bg-transparent"
                      >
                        <div className="aspect-square relative overflow-hidden rounded-md mb-1">
                          {post.videos && post.videos.length > 0 ? (
                            <video
                              src={getDisplayImageUrl(post.videos[0], { allowBlob: true })}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                            />
                          ) : (
                            <img
                              src={getDisplayImageUrl(post.imageUrl || post.images?.[0] || post.image || post.thumbnail)}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="eager"
                              decoding="async"
                              fetchPriority={index < 9 ? 'high' : 'auto'}
                            />
                          )}
                        </div>
                        {(post.note || locationLabel(post)) && (
                          <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark truncate">
                            {post.note || locationLabel(post)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'map' && (
              <div>
                {userPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-base font-medium mb-2">아직 기록이 없어요</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">게시물이 올라오면 지도에 표시됩니다.</p>
                  </div>
                ) : (
                  <div>
                    {availableDates.length > 0 && (() => {
                      const showExpand = availableDates.length >= 5;
                      const visibleDates = showExpand && !mapDatesExpanded
                        ? availableDates.slice(0, 4)
                        : availableDates;
                      return (
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedDate('')}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!selectedDate
                                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
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
                                  type="button"
                                  onClick={() => setSelectedDate(isSelected ? '' : date)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isSelected
                                    ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                                    : 'bg-white/95 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                  {dateStr}
                                </button>
                              );
                            })}
                            {showExpand && (
                              <button
                                type="button"
                                onClick={() => setMapDatesExpanded((prev) => !prev)}
                                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
                              >
                                {mapDatesExpanded ? '접기' : `펼치기 (${availableDates.length}일)`}
                              </button>
                            )}
                            {availableDates.length > 7 && (
                              <button
                                type="button"
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

                    <div
                      ref={mapRef}
                      id="travel-map-user"
                      className="w-full h-96 rounded-xl overflow-hidden mb-4 bg-gray-100 dark:bg-gray-800 relative"
                      style={{ minHeight: '384px' }}
                    >
                      {mapLoading && (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800 z-10">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-300 dark:border-gray-600 mx-auto mb-4" />
                            <p className="text-sm">지도를 불러오는 중...</p>
                          </div>
                        </div>
                      )}
                      {mapTabFilteredPosts.length > 0 && (() => {
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
                        const sortedPosts = [...mapTabFilteredPosts].sort((a, b) => {
                          const rawA = a.photoDate || a.createdAt || a.timestamp || 0;
                          const rawB = b.photoDate || b.createdAt || b.timestamp || 0;
                          return new Date(rawA).getTime() - new Date(rawB).getTime();
                        });
                        let totalDistance = 0;
                        for (let i = 0; i < sortedPosts.length - 1; i++) {
                          const coords1 = getPostCoords(sortedPosts[i]);
                          const coords2 = getPostCoords(sortedPosts[i + 1]);
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
                        const visitedPlaces = [...new Set(
                          mapTabFilteredPosts
                            .filter((post) => locationLabel(post) && locationLabel(post) !== '기타')
                            .map((post) => locationLabel(post))
                        )];
                        return (
                          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-center gap-3 pointer-events-none">
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
                      {postsForMap.length === 0 && mapTabFilteredPosts.length > 0 && (
                        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/60 dark:bg-gray-900/50">
                          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark px-4 text-center">
                            방문한 장소 중 위치 정보가 있는 게시물이 없습니다
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">지역</h3>
                      {Object.entries(
                        mapTabFilteredPosts.reduce((acc, post) => {
                          const location = locationLabel(post);
                          acc[location] = (acc[location] || 0) + 1;
                          return acc;
                        }, {})
                      )
                        .sort((a, b) => b[1] - a[1])
                        .map(([loc, count]) => (
                          <button
                            key={loc}
                            type="button"
                            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                            onClick={() => setActiveTab('my')}
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{loc}</span>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                              {count}장
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
                  type="button"
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
                    const posts = getUploadedPostsSafe();
                    const currentUserData = currentUser;
                    const myId = currentUserData?.id;
                    const pool = followListPostPool.length > 0 ? followListPostPool : posts;
                    const resolveUserInfo = (uid) => {
                      if (String(uid) === String(myId) && currentUserData) {
                        return {
                          username: currentUserData.username || '여행자',
                          profileImage: currentUserData.profileImage || null,
                        };
                      }
                      const fromProfiles = followListProfiles?.[String(uid)];
                      if (fromProfiles?.username) {
                        return {
                          username: fromProfiles.username,
                          profileImage: fromProfiles.profileImage || null,
                        };
                      }
                      const cached = getCachedFollowProfile(uid);
                      const fromPosts = resolveUserDisplayFromPosts(uid, pool);
                      const username =
                        (cached?.username && cached.username !== '사용자' && cached.username !== '여행자' ? cached.username : null) ||
                        (fromPosts.username !== '사용자' && fromPosts.username !== '여행자' ? fromPosts.username : null) ||
                        cached?.username ||
                        fromPosts.username;
                      const profileImage = fromPosts.profileImage || cached?.profileImage || null;
                      return { username: username || '여행자', profileImage };
                    };
                    const getRepBadge = (uid) => {
                      void uid;
                      return null;
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
                            onClick={() => {
                              const { username: un, profileImage: av } = resolveUserInfo(uid);
                              setCachedFollowProfile(uid, { username: un, profileImage: av });
                              setShowFollowListModal(false);
                              navigate(`/user/${uid}`, {
                                state: { profileHint: { username: un, profileImage: av } },
                              });
                            }}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-teal-100 dark:bg-teal-900">
                              {profileImage ? (
                                <img src={profileImage} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                              <span className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate w-full text-left">
                                {username}
                              </span>
                              {repBadge && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex-shrink-0 max-w-[160px]">
                                  <span className="text-sm">{repBadge.icon}</span>
                                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                                    {getBadgeDisplayName(repBadge) || repBadge.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </button>
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
                                  const r = follow(uid);
                                  if (r.success) {
                                    setCachedFollowProfile(uid, { username, profileImage });
                                    notifyFollowingStarted(username, myId, {
                                      targetUserId: uid,
                                      targetAvatar: profileImage || null,
                                    });
                                  }
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

        {showTrustGradesModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
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
                  const rawModal = getTrustRawScore(userId ? String(userId) : null, userPosts.length ? userPosts : null);
                  const { grade: currentGrade } = getTrustGrade(rawModal, userId ? String(userId) : null, userPosts.length ? userPosts : null);
                  const currentGradeId = currentGrade?.id;
                  return TRUST_GRADES.map((g) => (
                    <div
                      key={g.id}
                      className={`flex flex-col gap-1 py-3 px-3 rounded-xl ${currentGradeId === g.id ? 'bg-primary/10 dark:bg-primary/20 border border-primary/30' : 'bg-gray-50 dark:bg-gray-800'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl" aria-hidden>{g.icon}</span>
                        <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{g.name}</span>
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
                    src={getDisplayImageUrl(selectedPost.post.videos[0], { allowBlob: true })}
                    controls
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={getDisplayImageUrl(selectedPost.post.images?.[0] || selectedPost.post.imageUrl || selectedPost.post.image || selectedPost.post.thumbnail)}
                    alt={selectedPost.post.location || '여행지'}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
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
                    background: '#111827',
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

    </div >
  );
};

export default UserProfileScreen;


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import BottomNavigation from '../components/BottomNavigation';
import { getPost } from '../api/posts';
import { getDisplayImageUrl } from '../api/upload';
import {
  fetchPostByIdSupabase,
  applyPostLikesCountFromServer,
  addCommentToPostSupabase,
  updateCommentsInPostSupabase,
  deletePostSupabase,
  getMergedMyPostsForStats,
} from '../api/postsSupabase';
import { useAuth } from '../contexts/AuthContext';
import { getWeatherByRegion } from '../api/weather';
import { getTimeAgo } from '../utils/dateUtils';
import { addComment, deleteCommentFromPost, updateCommentInPost, getPostAccuracyCount, hasUserMarkedAccurate, toggleAccuracyFeedback } from '../utils/socialInteractions';
import { getBadgeDisplayName, getEarnedBadgesForUser } from '../utils/badgeSystem';
import { getTrustRawScore, getTrustGrade } from '../utils/trustIndex';
import { follow, unfollow, isFollowing } from '../utils/followSystem';
import { notifyFollowingStarted, notifyLike, notifyComment } from '../utils/notifications';
import { mergeCommentsWithCache, setCommentsCacheForPost } from '../utils/postCommentsCache';
import { getCachedFollowProfile, setCachedFollowProfile } from '../utils/userProfileHints';
import { recordConversion, CONVERSION_TYPES } from '../utils/conversionEvents';
import { logger } from '../utils/logger';
import { buildMediaItemsFromPost } from '../utils/postMedia';
import { tagTranslations } from '../utils/tagTranslations';
import { getCategoryChipsFromPost } from '../utils/travelCategories';
import { getLikeSnapshot, toggleLikeLocal } from '../utils/postLikesLocal';
import { toggleLikeForPost } from '../utils/postLikeActions';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import {
  addCommentSupabase,
  deleteCommentSupabase,
  fetchCommentsForPostSupabase,
  updateCommentSupabase,
} from '../api/socialSupabase';
import 'swiper/css';

const PostDetailScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: postId } = useParams();
  const { user } = useAuth();
  const { post: passedPost, fromMap, selectedPinId, allPins, mapState, allPosts, currentPostIndex } = location.state || {};

  const [post, setPost] = useState(passedPost);
  const [loading, setLoading] = useState(!passedPost);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [currentPostIndexState, setCurrentPostIndexState] = useState(currentPostIndex || 0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [representativeBadge, setRepresentativeBadge] = useState(null);
  const [userBadges, setUserBadges] = useState([]);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isFollowAuthor, setIsFollowAuthor] = useState(false);
  const [accuracyMarked, setAccuracyMarked] = useState(false);
  const [accuracyCount, setAccuracyCount] = useState(0);
  const [authorTrustScore, setAuthorTrustScore] = useState(null);
  const [authorTrustGrade, setAuthorTrustGrade] = useState(null);
  const [weatherInfo, setWeatherInfo] = useState({
    icon: '☀️',
    condition: '맑음',
    temperature: '20°C',
    loading: true
  });

  // 터치 스와이프 (좌우)
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // 상하 스와이프 (게시물 간 이동) - 인스타그램 스타일
  const [verticalTouchStart, setVerticalTouchStart] = useState(0);
  const [verticalTouchEnd, setVerticalTouchEnd] = useState(0);
  const [isVerticalSwipe, setIsVerticalSwipe] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // 이미지 영역에서의 터치 추적
  const [isImageAreaTouch, setIsImageAreaTouch] = useState(false);

  // 미니 지도
  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const scrollContentRef = useRef(null);
  const nextPostSentinelRef = useRef(null);
  const mediaSwiperRef = useRef(null);
  const authorPostMenuRef = useRef(null);
  const shareMenuRef = useRef(null);
  const [showAuthorPostMenu, setShowAuthorPostMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // 슬라이드 가능한 게시물 목록
  const slideablePosts = useMemo(() => {
    if (allPosts && Array.isArray(allPosts) && allPosts.length > 0) {
      return allPosts;
    }
    return passedPost ? [passedPost] : [];
  }, [allPosts, passedPost]);

  // 미디어 배열 (이미지 + 동영상 순서 유지, 모바일과 동일 로직) — 표시용 풀 URL
  const toUrl = (v) => (typeof v === 'string' ? v : (v?.url ?? v?.src ?? v?.href ?? ''));
  const postForMedia = useMemo(() => {
    if (!post) return null;
    const rawImages = Array.isArray(post.images)
      ? post.images
      : post.images
        ? [post.images]
        : post.image
          ? [post.image]
          : post.thumbnail
            ? [post.thumbnail]
            : [];
    const rawVideos = Array.isArray(post.videos) ? post.videos : post.videos ? [post.videos] : [];
    const images = rawImages.map(toUrl).filter(Boolean);
    const videos = rawVideos.map(toUrl).filter(Boolean);
    const thumb = post.thumbnail ? toUrl(post.thumbnail) : '';
    const single = post.image ? toUrl(post.image) : '';
    return {
      images,
      videos,
      thumbnail: thumb || undefined,
      image: single || undefined,
      imageUrl: post.imageUrl ? toUrl(post.imageUrl) : undefined,
    };
  }, [post]);

  const mediaItems = useMemo(() => {
    if (!postForMedia) return [];
    return buildMediaItemsFromPost(postForMedia).map((m) => ({
      type: m.type,
      url: getDisplayImageUrl(m.uri),
      posterUrl: m.posterUri ? getDisplayImageUrl(m.posterUri) : undefined,
    }));
  }, [postForMedia]);

  const images = useMemo(() => {
    const rawImages = Array.isArray(post?.images)
      ? post.images
      : post?.images ? [post.images] : post?.image ? [post.image] : post?.thumbnail ? [post.thumbnail] : [];
    return rawImages.map(toUrl).filter(Boolean).map(getDisplayImageUrl);
  }, [post]);

  const currentMediaItem = useMemo(() => {
    if (mediaItems.length > 0) return mediaItems[currentImageIndex] || null;
    return null;
  }, [mediaItems, currentImageIndex]);

  // Q&A 포맷 변환 (useCallback)
  const formatQnA = useCallback((questions) => {
    return questions.map((q, idx) => {
      const items = [{
        id: `q-${idx}`,
        type: 'question',
        user: q.user?.username || '익명',
        content: q.question,
        time: getTimeAgo(q.createdAt),
        avatar: q.user?.profileImage || null
      }];

      if (q.answer) {
        items.push({
          id: `a-${idx}`,
          type: 'answer',
          user: q.answeredBy?.username || '작성자',
          isAuthor: true,
          content: q.answer,
          time: getTimeAgo(q.createdAt),
          avatar: q.answeredBy?.profileImage || null
        });
      }

      return items;
    }).flat();
  }, [getTimeAgo]);

  // 게시물 데이터 가져오기 (useCallback)
  const fetchPost = useCallback(async () => {
    if (!postId && !passedPost) {
      alert('게시물 정보가 없습니다.');
      navigate(-1);
      return;
    }

    if (passedPost) {
      setPost(passedPost);
      const allComments = [...(passedPost.comments || []), ...(passedPost.qnaList || [])];
      setComments(mergeCommentsWithCache(passedPost.id, allComments));
      {
        const snap = getLikeSnapshot(
          passedPost.id,
          user?.id || null,
          passedPost.likes ?? passedPost.likeCount ?? 0
        );
        setLikeCount(snap.count);
        setLiked(snap.liked);
      }
      setAccuracyMarked(hasUserMarkedAccurate(passedPost.id));
      setAccuracyCount(getPostAccuracyCount(passedPost.id));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(postId || '').trim());

      // Supabase UUID면 먼저 DB에서 조회 (새로고침 시에도 댓글 유지)
      if (isUuid) {
        const fresh = await fetchPostByIdSupabase(postId);
        if (fresh) {
          logger.log('✅ Supabase에서 게시물·댓글 로드:', fresh.id);
          setPost(fresh);
          setComments(mergeCommentsWithCache(fresh.id, Array.isArray(fresh.comments) ? fresh.comments : []));
          {
            const snap = getLikeSnapshot(
              fresh.id,
              user?.id || null,
              fresh.likes ?? fresh.likeCount ?? 0
            );
            setLikeCount(snap.count);
            setLiked(snap.liked);
          }
          setAccuracyMarked(hasUserMarkedAccurate(fresh.id));
          setAccuracyCount(getPostAccuracyCount(fresh.id));
          setLoading(false);
          return;
        }
      }

      // localStorage에서 찾기 (로컬 전용 게시물)
      const localPosts = getUploadedPostsSafe();
      const localPost = localPosts.find(p =>
        p.id === postId ||
        p.id === `uploaded-${postId}` ||
        p.id === `realtime-${postId}` ||
        p.id === `crowded-${postId}` ||
        p.id === `recommend-${postId}`
      );

      if (localPost) {
        logger.log('✅ localStorage에서 게시물 찾음:', localPost.id);
        setPost(localPost);
        const allComments = [...(localPost.comments || []), ...(localPost.qnaList || [])];
        setComments(mergeCommentsWithCache(localPost.id, allComments));
        {
          const snap = getLikeSnapshot(
            localPost.id,
            user?.id || null,
            localPost.likes ?? localPost.likeCount ?? 0
          );
          setLikeCount(snap.count);
          setLiked(snap.liked);
        }
        setAccuracyMarked(hasUserMarkedAccurate(localPost.id));
        setAccuracyCount(getPostAccuracyCount(localPost.id));
        setLoading(false);
        return;
      }

      // REST API fallback
      logger.log('🔍 API에서 게시물 조회 중:', postId);
      const response = await getPost(postId);
      if (response.success && response.post) {
        const serverPost = response.post;
        setPost(serverPost);
        const serverComments = Array.isArray(serverPost.comments) ? serverPost.comments : [];
        const qnaFormatted = formatQnA(serverPost.questions || []);
        setComments(mergeCommentsWithCache(serverPost.id, [...serverComments, ...qnaFormatted]));
        {
          const snap = getLikeSnapshot(
            serverPost.id,
            user?.id || null,
            serverPost.likesCount ?? serverPost.likes ?? 0
          );
          setLikeCount(snap.count);
          setLiked(snap.liked);
        }
        setAccuracyMarked(hasUserMarkedAccurate(serverPost.id));
        setAccuracyCount(getPostAccuracyCount(serverPost.id));
      } else {
        // DB 미연결 또는 로컬 전용 게시물 → 이전 화면으로
        navigate(-1);
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        navigate(-1);
      } else if (error.response?.status === 404) {
        // 게시물 없음(로컬 전용 ID 등) → 조용히 이전으로
        navigate(-1);
      } else if (error.response?.status === 500) {
        logger.error('게시물 조회 서버 오류:', error.response?.data);
        navigate(-1);
      } else {
        logger.error('❌ 게시물 불러오기 실패:', error);
        navigate(-1);
      }
    } finally {
      setLoading(false);
    }
  }, [postId, passedPost, navigate, formatQnA, user?.id]);

  // 정보 정확도 평가 상태 동기화 (서버: post.accuracyCount/userMarked, 로컬: localStorage)
  useEffect(() => {
    if (!post?.id) return;
    if (typeof post.userMarked === 'boolean' || typeof post.accuracyCount === 'number') {
      setAccuracyMarked(!!post.userMarked);
      setAccuracyCount(Number(post.accuracyCount) || 0);
    } else {
      setAccuracyMarked(hasUserMarkedAccurate(post.id));
      setAccuracyCount(getPostAccuracyCount(post.id));
    }
  }, [post?.id, post?.userMarked, post?.accuracyCount]);

  // Supabase 게시물 최신 데이터 조회 (댓글만 DB 기준으로 반영; 좋아요는 로컬 단일 로직)
  const refreshPostFromSupabase = useCallback(() => {
    if (!postId || typeof postId !== 'string') return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId.trim());
    if (!isUuid) return;
    fetchPostByIdSupabase(postId).then((fresh) => {
      if (!fresh) return;
      setPost((prev) => ({
        ...(prev || {}),
        ...fresh,
        comments: mergeCommentsWithCache(
          postId,
          Array.isArray(fresh.comments) ? fresh.comments : (prev?.comments ?? [])
        )
      }));
      if (Array.isArray(fresh.comments)) setComments(mergeCommentsWithCache(postId, fresh.comments));
    });
  }, [postId]);

  useEffect(() => {
    if (!postId || typeof postId !== 'string') return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId.trim());
    if (!isUuid) return;
    let cancelled = false;
    fetchPostByIdSupabase(postId).then((fresh) => {
      if (cancelled || !fresh) return;
      setPost((prev) => ({
        ...(prev || {}),
        ...fresh,
        comments: mergeCommentsWithCache(postId, Array.isArray(fresh.comments) ? fresh.comments : (prev?.comments ?? []))
      }));
      if (Array.isArray(fresh.comments)) setComments(mergeCommentsWithCache(postId, fresh.comments));
    });
    return () => { cancelled = true; };
  }, [postId]);

  // 탭 포커스 시 최신 좋아요·댓글 다시 불러오기
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && postId) refreshPostFromSupabase();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [postId, refreshPostFromSupabase]);

  // 정보가 정확해요 버튼 클릭 (다른 사용자가 누르면 작성자 신뢰지수 상승)
  const handleAccuracyClick = useCallback(async () => {
    if (!post?.id) return;
    const result = await toggleAccuracyFeedback(post.id);
    setAccuracyMarked(result.marked);
    setAccuracyCount(result.newCount);
  }, [post?.id]);

  // 좋아요 처리 (완전 새 로컬 토글 + 카운트)
  const handleLike = useCallback(async () => {
    if (!post?.id) return;
    if (!user?.id) {
      alert('로그인 후 좋아요를 누를 수 있어요.');
      return;
    }

    const fallback = post.likes ?? post.likeCount ?? likeCount ?? 0;
    // UUID 게시물은 DB(post_likes)로 저장하여 기기 간 동기화
    const serverRes = await toggleLikeForPost({ postId: post.id, userId: user.id, baseLikesCount: Number(fallback) || 0 });
    if (serverRes?.success && typeof serverRes.likesCount === 'number') {
      const before = getLikeSnapshot(post.id, user.id, fallback);
      setLiked(!!serverRes.isLiked);
      setLikeCount(serverRes.likesCount);
      setPost((p) => (p ? { ...p, likes: serverRes.likesCount, likeCount: serverRes.likesCount } : p));

      if (!before.liked && !!serverRes.isLiked) {
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 600);
      }
      return;
    }

    // UUID 게시물인데 서버가 실패한 경우(세션 없음 등)는 로컬 토글로 fallback 하면 안 됨
    if (serverRes?.reason && serverRes.reason !== 'non_uuid') {
      alert(serverRes.reason === 'no_session' ? '로그인 세션이 없어요. 다시 로그인 후 시도해 주세요.' : '좋아요 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }

    // 로컬 게시물(비-UUID)
    const before = getLikeSnapshot(post.id, user.id, fallback);
    const next = toggleLikeLocal(post.id, user.id, fallback);
    if (!next) return;

    setLiked(next.liked);
    setLikeCount(next.count);
    setPost((p) => (p ? { ...p, likes: next.count, likeCount: next.count } : p));

    // 좋아요를 누를 때만 애니메이션 표시
    if (!before.liked && next.liked) {
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 600);
    }

    // 타인 게시물에 좋아요 알림(로컬 알림)
    if (!before.liked && next.liked && post.userId && String(post.userId) !== String(user.id)) {
      const actorName = user.username || user.email?.split('@')[0] || '여행자';
      const thumbRaw = Array.isArray(post.images) && post.images[0] ? post.images[0] : (post.image || post.thumbnail || null);
      notifyLike(actorName, post.location || post.placeName || '게시물', {
        recipientUserId: post.userId,
        postId: post.id,
        actorUserId: user.id,
        actorAvatar: user.profileImage || null,
        thumbnailUrl: thumbRaw ? getDisplayImageUrl(thumbRaw) : null,
      });
    }
  }, [post, user?.id, user?.username, user?.email, user?.profileImage, likeCount]);


  // 이미지 스와이프 (useCallback)
  const handleImageSwipe = useCallback((direction) => {
    const maxIndex = mediaItems.length > 0 ? mediaItems.length : images.length;

    if (maxIndex <= 1) {
      // 이미지가 1개 이하면 슬라이드 불가
      return;
    }

    if (direction === 'left') {
      // 왼쪽 버튼 클릭: 다음 이미지 (마지막이면 첫 번째로)
      const nextIndex = currentImageIndex < maxIndex - 1
        ? currentImageIndex + 1
        : 0;
      setCurrentImageIndex(nextIndex);
    } else if (direction === 'right') {
      // 오른쪽 버튼 클릭: 이전 이미지 (첫 번째면 마지막으로)
      const prevIndex = currentImageIndex > 0
        ? currentImageIndex - 1
        : maxIndex - 1;
      setCurrentImageIndex(prevIndex);
    }
  }, [currentImageIndex, images.length, mediaItems.length]);

  // 댓글 추가 핸들러 (DB 기준: Supabase UUID면 DB 저장, 로컬 게시물이면 localStorage)
  const handleAddComment = useCallback(async () => {
    if (!post || !commentText.trim()) return;

    const username = user?.username || user?.email?.split('@')[0] || '익명';
    const text = commentText.trim();
    const userId = user?.id || null;
    const newComment = {
      id: `comment-${Date.now()}`,
      user: typeof user === 'object' && user ? { username, id: userId, profileImage: user?.profileImage || null } : username,
      userId,
      content: text,
      timestamp: new Date().toISOString(),
      avatar: user?.profileImage || null
    };

    const isSupabasePost = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(post.id || '').trim());
    if (isSupabasePost) {
      // 멀티계정: post_comments 테이블에 insert → 목록 재조회
      if (user?.id) {
        const ins = await addCommentSupabase({
          postId: post.id,
          userId: user.id,
          username,
          avatarUrl: user?.profileImage || null,
          content: text,
        });
        if (ins?.success) {
          const rows = await fetchCommentsForPostSupabase(post.id);
          const mapped = (rows || []).map((c) => ({
            id: String(c.id),
            userId: c.user_id ? String(c.user_id) : null,
            user: c.user_id ? { id: String(c.user_id), username: c.username || null, profileImage: c.avatar_url || null } : (c.username || '유저'),
            content: c.content || '',
            timestamp: c.created_at || new Date().toISOString(),
            createdAt: c.created_at || new Date().toISOString(),
            avatar: c.avatar_url || null,
          }));
          setComments(mapped);
          setCommentsCacheForPost(post.id, mapped);
          window.dispatchEvent(new CustomEvent('postCommentsUpdated', { detail: { postId: post.id, comments: mapped } }));
          /* addCommentSupabase에서 게시물 작성자에게 Supabase 알림 삽입 */
        } else {
          const merged = mergeCommentsWithCache(post.id, [...comments, newComment]);
          setComments(merged);
          setCommentsCacheForPost(post.id, merged);
        }
      }
    } else {
      const uploadedPosts = getUploadedPostsSafe();
      const existsInStorage = uploadedPosts.some((p) => p.id === post.id);
      if (existsInStorage) {
        const newComments = addComment(post.id, text, username, userId);
        if (Array.isArray(newComments) && newComments.length > 0) {
          setComments(newComments);
          setCommentsCacheForPost(post.id, newComments);
        } else {
          const merged = mergeCommentsWithCache(post.id, [...comments, newComment]);
          setComments(merged);
          setCommentsCacheForPost(post.id, merged);
        }
        if (user?.id && post.userId && String(post.userId) !== String(user.id)) {
          notifyComment(username, post.location || post.placeName || '', text, {
            recipientUserId: post.userId,
            postId: post.id,
          });
        }
      } else {
        const merged = mergeCommentsWithCache(post.id, [...comments, newComment]);
        setComments(merged);
        setCommentsCacheForPost(post.id, merged);
      }
    }

    setCommentText('');
  }, [post, commentText, user, comments]);

  const isSupabasePost = post && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(post.id || '').trim());
  const isPostAuthor = post && user && String(post.userId || post.user?.id || post.user) === String(user.id);

  const handleDeleteComment = useCallback(async (commentId) => {
    if (!post || !commentId) return;
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    if (isSupabasePost) {
      const uid = user?.id || null;
      if (!uid) return;
      const res = await deleteCommentSupabase({ commentId, userId: uid });
      if (res?.success) {
        const rows = await fetchCommentsForPostSupabase(post.id);
        const mapped = (rows || []).map((c) => ({
          id: String(c.id),
          userId: c.user_id ? String(c.user_id) : null,
          user: c.user_id ? { id: String(c.user_id), username: c.username || null, profileImage: c.avatar_url || null } : (c.username || '유저'),
          content: c.content || '',
          timestamp: c.created_at || new Date().toISOString(),
          createdAt: c.created_at || new Date().toISOString(),
          avatar: c.avatar_url || null,
        }));
        setComments(mapped);
        setCommentsCacheForPost(post.id, mapped);
        window.dispatchEvent(new CustomEvent('postCommentsUpdated', { detail: { postId: post.id, comments: mapped } }));
      }
    } else {
      const next = deleteCommentFromPost(post.id, commentId);
      setComments(next);
      setCommentsCacheForPost(post.id, next);
    }
  }, [post, comments, isSupabasePost]);

  const handleStartEditComment = useCallback((comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content || '');
  }, []);

  const handleSaveEditComment = useCallback(async () => {
    if (!post || !editingCommentId || editCommentText.trim() === '') return;
    const text = editCommentText.trim();
    if (isSupabasePost) {
      const uid = user?.id || null;
      if (!uid) return;
      const res = await updateCommentSupabase({ commentId: editingCommentId, userId: uid, content: text });
      if (res?.success) {
        const rows = await fetchCommentsForPostSupabase(post.id);
        const mapped = (rows || []).map((c) => ({
          id: String(c.id),
          userId: c.user_id ? String(c.user_id) : null,
          user: c.user_id ? { id: String(c.user_id), username: c.username || null, profileImage: c.avatar_url || null } : (c.username || '유저'),
          content: c.content || '',
          timestamp: c.created_at || new Date().toISOString(),
          createdAt: c.created_at || new Date().toISOString(),
          avatar: c.avatar_url || null,
        }));
        setComments(mapped);
        setCommentsCacheForPost(post.id, mapped);
        window.dispatchEvent(new CustomEvent('postCommentsUpdated', { detail: { postId: post.id, comments: mapped } }));
      }
    } else {
      const next = updateCommentInPost(post.id, editingCommentId, text);
      setComments(next);
      setCommentsCacheForPost(post.id, next);
    }
    setEditingCommentId(null);
    setEditCommentText('');
  }, [post, comments, editingCommentId, editCommentText, isSupabasePost]);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setEditCommentText('');
  }, []);

  const handleNavigateToEditPost = useCallback(() => {
    if (!postId) return;
    navigate(`/post/${postId}/edit`);
  }, [navigate, postId]);

  const handleReportPost = useCallback(() => {
    if (!post?.id) return;
    if (!window.confirm('이 게시물을 신고하시겠습니까?')) return;
    try {
      const key = 'reportedPosts_v1';
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      const idStr = String(post.id);
      if (!raw.includes(idStr)) raw.push(idStr);
      localStorage.setItem(key, JSON.stringify(raw));
      alert('신고가 접수되었습니다. 검토 후 조치하겠습니다.');
    } catch {
      alert('처리 중 오류가 발생했습니다.');
    }
  }, [post?.id]);

  const handleDeletePost = useCallback(async () => {
    if (!post || !isPostAuthor) return;
    if (!window.confirm('이 게시물을 삭제할까요?')) return;
    const idStr = String(post.id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr.trim());
    if (isUuid) {
      const res = await deletePostSupabase(idStr);
      if (!res?.success) {
        alert(res?.error || '삭제에 실패했습니다. 다시 시도해 주세요.');
        return;
      }
    }
    try {
      const uploaded = getUploadedPostsSafe();
      const filtered = uploaded.filter((p) => p && String(p.id) !== idStr);
      localStorage.setItem('uploadedPosts', JSON.stringify(filtered));
    } catch (_) {}
    window.dispatchEvent(new Event('postsUpdated'));
    navigate(-1);
  }, [post, isPostAuthor, navigate]);

  // 게시물 변경 (상하/좌우 스와이프 모두 지원)
  const changePost = useCallback((direction) => {
    if (!slideablePosts || slideablePosts.length === 0 || isTransitioning) return;

    let newIndex;
    if (slideablePosts.length === 1) {
      // 게시물이 1개면 변경하지 않음
      return;
    }

    setIsTransitioning(true);

    if (direction === 'up' || direction === 'left') {
      // 위로 또는 왼쪽으로: 이전 게시물 (첫 번째면 마지막으로)
      newIndex = currentPostIndexState > 0
        ? currentPostIndexState - 1
        : slideablePosts.length - 1;
    } else {
      // 아래로 또는 오른쪽으로: 다음 게시물 (마지막이면 첫 번째로)
      newIndex = currentPostIndexState < slideablePosts.length - 1
        ? currentPostIndexState + 1
        : 0;
    }

    setCurrentPostIndexState(newIndex);
    const newPost = slideablePosts[newIndex];
    setPost(newPost);
    setCurrentImageIndex(0);
    {
      const snap = getLikeSnapshot(
        newPost.id,
        user?.id || null,
        newPost.likes ?? newPost.likeCount ?? 0
      );
      setLiked(snap.liked);
      setLikeCount(snap.count);
    }
    setComments([...(newPost.comments || []), ...(newPost.qnaList || [])]);

    // 스크롤을 맨 위로 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 전환 애니메이션 완료 후 플래그 해제
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [slideablePosts, currentPostIndexState, isTransitioning, user?.id]);

  // 터치/마우스 스와이프 제스처 (좌우 + 상하)
  const handleStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setTouchStart(clientX);
    setVerticalTouchStart(clientY);
    setIsVerticalSwipe(false);
  };

  const handleMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setTouchEnd(clientX);
    setVerticalTouchEnd(clientY);

    // 상하 움직임이 좌우 움직임보다 크면 상하 스와이프로 판단 (인스타그램 스타일)
    const horizontalDistance = Math.abs(clientX - touchStart);
    const verticalDistance = Math.abs(clientY - verticalTouchStart);

    // 상하 움직임이 더 크고, 최소 5px 이상이면 상하 스와이프로 판단
    if (verticalDistance > horizontalDistance && verticalDistance > 5) {
      setIsVerticalSwipe(true);
    }
  };

  const handleEnd = () => {
    if (!touchStart || !touchEnd || !verticalTouchStart || !verticalTouchEnd) {
      setTouchStart(0);
      setTouchEnd(0);
      setVerticalTouchStart(0);
      setVerticalTouchEnd(0);
      setIsImageAreaTouch(false);
      return;
    }

    const horizontalDistance = Math.abs(touchStart - touchEnd);
    const verticalDistance = Math.abs(verticalTouchStart - verticalTouchEnd);

    if (isVerticalSwipe) {
      // 상하 스와이프 - 인스타그램 스타일 (직관적인 방향)
      // 아래로 스와이프 (아래로 당기기) = 다음 게시물
      // 위로 스와이프 (위로 올리기) = 이전 게시물
      const verticalDistance = verticalTouchStart - verticalTouchEnd;
      const isDownSwipe = verticalDistance > 30; // 아래로 당기기 = 다음 게시물
      const isUpSwipe = verticalDistance < -30; // 위로 올리기 = 이전 게시물

      if (isDownSwipe) {
        changePost('down'); // 다음 게시물
      } else if (isUpSwipe) {
        changePost('up'); // 이전 게시물
      }
    } else if (horizontalDistance > verticalDistance) {
      // 좌우 스와이프가 상하 스와이프보다 큰 경우
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      // 이미지 영역에서의 터치인지 확인
      if (isImageAreaTouch) {
        // 이미지 영역: 이미지가 여러 개면 이미지 간 이동, 1개면 게시물 간 이동
        const maxIndex = mediaItems.length > 0 ? mediaItems.length : images.length;

        if (maxIndex > 1) {
          // 이미지가 여러 개면 이미지 간 이동
          if (isLeftSwipe) {
            // 왼쪽으로 스와이프: 다음 이미지 (마지막이면 첫 번째로)
            const nextIndex = currentImageIndex < maxIndex - 1
              ? currentImageIndex + 1
              : 0;
            setCurrentImageIndex(nextIndex);
          }

          if (isRightSwipe) {
            // 오른쪽으로 스와이프: 이전 이미지 (첫 번째면 마지막으로)
            const prevIndex = currentImageIndex > 0
              ? currentImageIndex - 1
              : maxIndex - 1;
            setCurrentImageIndex(prevIndex);
          }
        } else {
          // 이미지가 1개면 게시물 간 이동
          if (isLeftSwipe) {
            // 왼쪽으로 스와이프: 다음 게시물
            changePost('right');
          } else if (isRightSwipe) {
            // 오른쪽으로 스와이프: 이전 게시물
            changePost('left');
          }
        }
      } else {
        // 이미지 영역 외부: 게시물 간 이동
        if (isLeftSwipe) {
          // 왼쪽으로 스와이프: 다음 게시물
          changePost('right');
        } else if (isRightSwipe) {
          // 오른쪽으로 스와이프: 이전 게시물
          changePost('left');
        }
      }
    }

    setTouchStart(0);
    setTouchEnd(0);
    setVerticalTouchStart(0);
    setVerticalTouchEnd(0);
    setIsImageAreaTouch(false);
    setIsVerticalSwipe(false);
  };

  // 마우스 드래그로 이미지 슬라이드 전용 (게시물 전환은 터치 위주)
  const mouseDragStartRef = useRef(null);

  const handleImageMouseDown = (e) => {
    mouseDragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleImageMouseUp = (e) => {
    if (!mouseDragStartRef.current) return;

    const startX = mouseDragStartRef.current.x;
    const startY = mouseDragStartRef.current.y;
    const endX = e.clientX;
    const endY = e.clientY;

    const diffX = startX - endX;
    const diffY = startY - endY;

    const maxIndex = mediaItems.length > 0 ? mediaItems.length : images.length;
    if (maxIndex <= 1) {
      mouseDragStartRef.current = null;
      return;
    }

    // 좌우 이동이 상하보다 크고, 일정 거리 이상일 때만 슬라이드
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        // 왼쪽으로 드래그: 다음 이미지
        const nextIndex = currentImageIndex < maxIndex - 1 ? currentImageIndex + 1 : 0;
        setCurrentImageIndex(nextIndex);
      } else {
        // 오른쪽으로 드래그: 이전 이미지
        const prevIndex = currentImageIndex > 0 ? currentImageIndex - 1 : maxIndex - 1;
        setCurrentImageIndex(prevIndex);
      }
    }

    mouseDragStartRef.current = null;
  };

  // 터치 이벤트 핸들러
  const handleTouchStart = (e) => {
    handleStart(e);
  };

  const handleTouchMove = (e) => {
    // 이미지 영역에서만 preventDefault (스크롤 허용을 위해)
    if (isImageAreaTouch) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const horizontalDistance = Math.abs(clientX - touchStart);
      const verticalDistance = Math.abs(clientY - verticalTouchStart);

      // 좌우 움직임이 상하 움직임보다 크면 preventDefault (이미지 스와이프)
      if (horizontalDistance > verticalDistance && horizontalDistance > 10) {
        e.preventDefault();
      }
    }
    // 이미지 영역이 아니면 preventDefault 하지 않음 (스크롤 허용)
    handleMove(e);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // 대표 뱃지 / 사용자 뱃지 / 레벨 로드
  useEffect(() => {
    if (!post) return;

    const postUserId =
      post?.userId ||
      (typeof post?.user === 'string' ? post.user : post?.user?.id) ||
      post?.user;

    if (!postUserId) return;

    (async () => {
      const authorId = String(postUserId || '');
      let postsForAuthor = [];
      try {
        if (authorId) {
          postsForAuthor = await getMergedMyPostsForStats(authorId);
        }
      } catch {
        postsForAuthor = [];
      }
      if (post && post.id && !postsForAuthor.some((p) => String(p.id || p._id) === String(post.id || post._id))) {
        postsForAuthor = [post, ...postsForAuthor];
      }

      const badges = getEarnedBadgesForUser(postUserId, postsForAuthor) || [];
      setUserBadges(badges);

      let repBadge = null;
      const repBadgeJson = localStorage.getItem(`representativeBadge_${postUserId}`);
      if (repBadgeJson) {
        try {
          repBadge = JSON.parse(repBadgeJson);
        } catch {
          repBadge = null;
        }
      }
      if (!repBadge && badges.length > 0) {
        repBadge = badges[0];
        try {
          const saved = JSON.parse(localStorage.getItem('user') || '{}');
          if (saved?.id && String(saved.id) === String(postUserId)) {
            localStorage.setItem(`representativeBadge_${postUserId}`, JSON.stringify(repBadge));
          }
        } catch (_) { /* ignore */ }
      }
      if (!repBadge) {
        const fallbackBadgeName =
          (post?.user && typeof post.user === 'object' && post.user.badges?.[0]) ||
          post?.badge ||
          null;
        if (fallbackBadgeName) {
          repBadge = { name: fallbackBadgeName, icon: '🏅' };
        }
      }
      if (repBadge) {
        setRepresentativeBadge(repBadge);
      }

      const raw = getTrustRawScore(authorId || null, postsForAuthor.length ? postsForAuthor : null);
      const { grade, progressToNext } = getTrustGrade(raw, authorId || null, postsForAuthor.length ? postsForAuthor : null);
      setAuthorTrustScore(progressToNext);
      setAuthorTrustGrade(grade);
    })();
  }, [post]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // PC 키보드: 아래/위 화살표·PageDown/PageUp으로 다음/이전 게시물
  useEffect(() => {
    const onKeyDown = (e) => {
      if (slideablePosts.length <= 1) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        changePost('down');
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        changePost('up');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slideablePosts.length, changePost]);

  const locationText = useMemo(() => post?.location?.name || post?.location || post?.title || '여행지', [post]);
  const detailedLocationText = useMemo(() => post?.detailedLocation || post?.placeName || null, [post]);
  const addressText = useMemo(() => post?.address || null, [post]);
  const authorDisplay = useMemo(() => {
    if (!post) return null;
    const pid = post.userId ?? (typeof post.user === 'object' ? post.user?.id : null) ?? post.user;
    if (user?.id && String(pid) === String(user.id)) return user;
    if (post.user && typeof post.user === 'object') return post.user;
    return null;
  }, [post, user]);
  const userName = useMemo(() => {
    const fromAuthor = authorDisplay?.username || (typeof post?.user === 'string' ? post.user : null);
    if (fromAuthor) return fromAuthor;
    // 작성자 객체는 있는데 이름만 비어 있으면 이메일·기본값 사용 (Supabase에 author_username 미저장 이력 보정)
    if (authorDisplay?.email) return authorDisplay.email.split('@')[0] || '여행자';
    if (post?.user && typeof post.user === 'object' && post.user?.email) return post.user.email.split('@')[0] || '여행자';
    return '익명 여행자';
  }, [authorDisplay, post]);
  const userBadge = useMemo(() => post?.user?.badges?.[0] || post?.badge || null, [post]);
  const authorAvatar = useMemo(
    () => authorDisplay?.profileImage || post?.userAvatar || null,
    [authorDisplay, post]
  );
  // EXIF에서 추출한 촬영 날짜 우선 사용
  const photoDate = useMemo(() => post?.photoDate || post?.exifData?.photoDate || null, [post]);
  // 상세 화면용 촬영 시간 라벨 (예: "2/10 14:30 촬영")
  const captureLabel = useMemo(() => {
    const src = photoDate || post?.timestamp || post?.createdAt;
    if (!src) return null;
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return null;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes} 촬영`;
  }, [photoDate, post]);
  const categoryName = useMemo(() => post?.categoryName || null, [post]);
  const categoryIcon = useMemo(() => post?.categoryIcon || null, [post]);
  const categoryChips = useMemo(() => getCategoryChipsFromPost(post), [post]);
  // EXIF에서 검증된 위치 정보
  const verifiedLocation = useMemo(() => post?.verifiedLocation || post?.exifData?.gpsCoordinates ? locationText : null, [post, locationText]);
  const hasExifData = useMemo(() => !!(post?.exifData || post?.photoDate || post?.verifiedLocation), [post]);

  // 공유 기능 - useMemo 정의 후에!
  const handleShare = useCallback(async () => {
    const shareData = {
      title: `${locationText} - LiveJourney`,
      text: `${detailedLocationText || locationText}의 실시간 정보를 확인해보세요!`,
      url: window.location.href
    };

    try {
      // Web Share API 지원 확인
      if (navigator.share) {
        await navigator.share(shareData);
        logger.log('✅ 공유 성공!');
        // 공유는 포인트 없음 (악용 가능성 높음)
      } else {
        // Web Share API 미지원 시 URL 복사
        await navigator.clipboard.writeText(window.location.href);
        alert('✅ 링크가 복사되었습니다!\n\n다른 사람에게 공유해보세요!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        logger.error('공유 실패:', error);
        // Fallback: URL 복사
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert('✅ 링크가 복사되었습니다!\n다른 사람에게 공유해보세요.');
        } catch (clipboardError) {
          alert('공유에 실패했습니다.');
        }
      }
    }
  }, [locationText, detailedLocationText]);

  useEffect(() => {
    if (!showAuthorPostMenu && !showShareMenu) return;
    const onDoc = (e) => {
      if (showAuthorPostMenu && authorPostMenuRef.current && !authorPostMenuRef.current.contains(e.target)) {
        setShowAuthorPostMenu(false);
      }
      if (showShareMenu && shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showAuthorPostMenu, showShareMenu]);

  // 날씨 정보: 항상 업로드 시점(사용자가 올린 시간) 기준으로 표시. 시간이 지나도 업로드 당시 날씨 유지
  useEffect(() => {
    if (!post) return;

    const frozen = post.weatherSnapshot || post.weather;
    if (frozen) {
      // 저장된 업로드 시점 날씨 스냅샷 (시간이 지나도 변경하지 않음)
      setWeatherInfo({
        icon: frozen.icon,
        condition: frozen.condition,
        temperature: frozen.temperature,
        loading: false
      });
      return;
    }

    // 예전에 올린 글처럼 날씨가 없는 경우에만 현재 지역 날씨를 참고용으로 한 번만 조회
    if (!locationText) {
      setWeatherInfo(prev => ({ ...prev, loading: false }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setWeatherInfo(prev => ({ ...prev, loading: true }));
        const result = await getWeatherByRegion(locationText);
        if (cancelled) return;
        if (result?.success && result.weather) {
          setWeatherInfo({
            icon: result.weather.icon,
            condition: result.weather.condition,
            temperature: result.weather.temperature,
            loading: false
          });
        } else {
          setWeatherInfo(prev => ({ ...prev, loading: false, condition: '정보 없음', temperature: '' }));
        }
      } catch (error) {
        if (!cancelled) setWeatherInfo(prev => ({ ...prev, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [post, locationText]);

  // 작성자 팔로우 여부 로드 및 followsUpdated 구독
  const postUserId = post ? (post.userId || (typeof post.user === 'string' ? post.user : post.user?.id) || post.user) : null;
  useEffect(() => {
    if (!postUserId) return;
    const load = () => setIsFollowAuthor(isFollowing(null, postUserId));
    load();
    window.addEventListener('followsUpdated', load);
    return () => window.removeEventListener('followsUpdated', load);
  }, [postUserId]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background-light dark:bg-background-dark">
        <p className="text-gray-500">게시물을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      className="screen-layout bg-background-light dark:bg-background-dark"
      style={{ height: '100vh', overflow: 'hidden', position: 'relative', paddingTop: 0 }}
    >
      <div
        ref={scrollContentRef}
        className="screen-content"
        style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', paddingTop: 0 }}
      >
        {/* 헤더를 absolute로 변경하여 이미지 위에 오버레이 */}
        <div
          className="screen-header flex items-center p-4 pb-2 absolute top-0 left-0 right-0 z-40 pointer-events-none bg-transparent"
          style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)` }}
        >
          <button
            onClick={() => {
              // 항상 직전 화면으로만 이동 (예: 메인 '지금 여기는' 피드 → 상세 → 뒤로가기)
              navigate(-1);
            }}
            className="text-black flex shrink-0 items-center justify-center pointer-events-auto rounded-full"
            style={{
              width: 44,
              height: 44,
              backgroundColor: 'rgba(15,23,42,0.45)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
          >
            <span className="material-symbols-outlined text-2xl text-white">arrow_back</span>
          </button>
        </div>

        {/* 게시물 간 이동 가이드 화살표 (가벼운 스타일) */}
        {slideablePosts.length > 1 && (
          <>
            <div className="fixed left-2 top-[35vh] z-10 pointer-events-none">
              <span className="material-symbols-outlined text-white/25 text-lg">chevron_left</span>
            </div>
            <div className="fixed right-2 top-[35vh] z-10 pointer-events-none">
              <span className="material-symbols-outlined text-white/25 text-lg">chevron_right</span>
            </div>
          </>
        )}

        <div className="flex w-full bg-transparent dark:bg-transparent" style={{ marginTop: 0 }}>
          <div
            className="image-swipe-area relative flex w-full gap-1 overflow-hidden rounded-b-2xl bg-white shadow-md dark:bg-gray-900"
            style={{ height: '60vh', minHeight: '330px', marginTop: '-64px' }}
          >
            <Swiper
              key={post?.id ?? 'post-media'}
              onSwiper={(swiper) => {
                mediaSwiperRef.current = swiper;
              }}
              onSlideChange={(swiper) => setCurrentImageIndex(swiper.activeIndex)}
              initialSlide={currentImageIndex}
              speed={280}
              resistanceRatio={0.85}
              className="w-full h-full"
            >
              {mediaItems.length > 0
                ? mediaItems.map((media, index) => (
                    <SwiperSlide key={index}>
                      <div
                        className="w-full flex-shrink-0 relative bg-black"
                        style={{ height: '60vh', minHeight: '330px' }}
                      >
                        {media.type === 'video' ? (
                          <video
                            src={media.url}
                            poster={media.posterUrl || undefined}
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted={isVideoMuted}
                            playsInline
                            controls={false}
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="eager"
                            decoding="async"
                            fetchPriority={index === 0 ? 'high' : 'auto'}
                          />
                        )}
                      </div>
                    </SwiperSlide>
                  ))
                : images.map((image, index) => (
                    <SwiperSlide key={index}>
                      <img
                        src={image}
                        alt=""
                        className="w-full flex-shrink-0 object-cover"
                        loading="eager"
                        decoding="async"
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        style={{ height: '60vh', minHeight: '330px' }}
                      />
                    </SwiperSlide>
                  ))}
            </Swiper>

            {(mediaItems.length > 1 || images.length > 1) && (
              <>
                {/* 페이지 인디케이터 - 클릭 가능 */}
                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
                  {(mediaItems.length > 0 ? mediaItems : images).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setCurrentImageIndex(index);
                          mediaSwiperRef.current?.slideTo(index);
                        }
                      }}
                      onClick={() => {
                        setCurrentImageIndex(index);
                        mediaSwiperRef.current?.slideTo(index);
                      }}
                      aria-label={`사진 ${index + 1} / ${(mediaItems.length > 0 ? mediaItems : images).length}`}
                      className={`carousel-page-dot inline-flex min-h-0 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 leading-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                        index === currentImageIndex
                          ? 'h-1.5 w-5 bg-white'
                          : 'h-1.5 w-1.5 bg-white/40 hover:bg-white/55'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {currentMediaItem?.type === 'video' && (
              <button
                type="button"
                onClick={() => setIsVideoMuted((prev) => !prev)}
                className="absolute right-2 bottom-3 z-20 flex shrink-0 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm shadow-sm"
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 32,
                  maxWidth: 32,
                  maxHeight: 32,
                  padding: 0,
                  aspectRatio: '1',
                  boxSizing: 'border-box'
                }}
                title={isVideoMuted ? '소리 켜기' : '소리 끄기'}
                aria-label={isVideoMuted ? '소리 켜기' : '소리 끄기'}
              >
                <span className="material-symbols-outlined text-[17px] leading-none block">
                  {isVideoMuted ? 'volume_off' : 'volume_up'}
                </span>
              </button>
            )}
          </div>
        </div>

        <main className="flex flex-col w-full max-w-full bg-white dark:bg-gray-900" style={{ minHeight: 'auto' }}>
          <div className="w-full max-w-full px-4 pt-4 pb-3">
            <div className="w-full max-w-full space-y-4">
              {/* 프로필 - 사진 아래 (박스/배경 없이) */}
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    const postUserId = post?.userId ||
                      (typeof post?.user === 'string' ? post.user : post?.user?.id) ||
                      post?.user;
                    const currentUserId = user?.id;
                    if (postUserId && postUserId !== currentUserId) {
                      setCachedFollowProfile(postUserId, { username: userName, profileImage: authorAvatar || null });
                      navigate(`/user/${postUserId}`, {
                        state: { profileHint: { username: userName, profileImage: authorAvatar || null } },
                      });
                    } else if (postUserId && postUserId === currentUserId) {
                      navigate('/profile');
                    }
                  }}
                >
                  {authorAvatar ? (
                    <div
                      className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-10 w-10 flex-shrink-0"
                      style={{ backgroundImage: `url("${authorAvatar}")` }}
                    />
                  ) : (
                    <div className="rounded-full h-10 w-10 flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-100">
                      {String(userName || '여행자').charAt(0)}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-bold text-[#181410] dark:text-white">
                        {userName}
                      </p>
                      {representativeBadge && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs">{representativeBadge.icon}</span>
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 max-w-[92px] truncate">
                            {getBadgeDisplayName(representativeBadge) || representativeBadge.name}
                          </span>
                        </div>
                      )}
                    </div>
                    {(authorTrustScore != null || authorTrustGrade) && (
                      <p className="mt-0.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark truncate">
                        신뢰지수 <span className="font-semibold text-gray-700 dark:text-gray-300">{authorTrustScore ?? 0}</span>
                        {authorTrustGrade ? (
                          <span className="ml-1 text-gray-600 dark:text-gray-400">
                            {authorTrustGrade.icon} {authorTrustGrade.name}
                          </span>
                        ) : null}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {postUserId && user?.id && String(postUserId) !== String(user.id) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isFollowAuthor) {
                          unfollow(postUserId);
                          setIsFollowAuthor(false);
                        } else {
                          const r = follow(postUserId);
                          if (r.success) {
                            setIsFollowAuthor(true);
                            setCachedFollowProfile(postUserId, {
                              username: userName,
                              profileImage: authorAvatar || null,
                            });
                            /* followSystem → followSupabase에서 수신자에게 원격 알림 */
                            notifyFollowingStarted(userName, user.id, {
                              targetUserId: postUserId,
                              targetAvatar: authorAvatar || null,
                            });
                          }
                        }
                      }}
                      className={`shrink-0 py-1.5 px-3 rounded-xl text-xs font-semibold ${
                        isFollowAuthor
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          : 'bg-primary text-white hover:opacity-90'
                      }`}
                    >
                      {isFollowAuthor ? '팔로잉' : '팔로우'}
                    </button>
                  )}
                </div>
              </div>

              {/* 위치 + 작성자 메뉴(수정·삭제) */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">위치정보</p>
                  <p className="mt-0.5 truncate text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {verifiedLocation || detailedLocationText || locationText}
                  </p>
                </div>
                {isPostAuthor ? (
                  <div className="relative shrink-0 pt-0.5" ref={authorPostMenuRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAuthorPostMenu((v) => !v);
                        setShowShareMenu(false);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      aria-label="게시물 메뉴"
                      aria-expanded={showAuthorPostMenu}
                      aria-haspopup="menu"
                    >
                      <span className="material-symbols-outlined text-[22px]">more_vert</span>
                    </button>
                    {showAuthorPostMenu && (
                      <div
                        className="absolute right-0 top-full z-[100] mt-1 w-[min(100vw-2rem,220px)] overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                          onClick={() => {
                            setShowAuthorPostMenu(false);
                            handleNavigateToEditPost();
                          }}
                        >
                          <span>수정하기</span>
                          <span
                            className="material-symbols-outlined shrink-0 text-[20px] text-gray-500 dark:text-gray-400"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                            aria-hidden
                          >
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                          onClick={() => {
                            setShowAuthorPostMenu(false);
                            handleDeletePost();
                          }}
                        >
                          <span>삭제하기</span>
                          <span
                            className="material-symbols-outlined shrink-0 text-[20px] text-gray-500 dark:text-gray-400"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                            aria-hidden
                          >
                            delete
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              {addressText ? (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{addressText}</p>
              ) : null}

              {/* 기온 · 촬영시각 · 카테고리 한 블록 */}
              <div className="mt-3">
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">기온 · 사진정보 · 카테고리</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {weatherInfo.loading ? (
                    <span>날씨 로딩…</span>
                  ) : (
                    <>
                      <span className="mr-1">{weatherInfo.icon}</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {weatherInfo.temperature
                          ? `${weatherInfo.condition}, ${weatherInfo.temperature}`
                          : weatherInfo.condition}
                        {(post?.weatherSnapshot || post?.weather) ? (
                          <span className="ml-1 text-xs font-normal text-gray-400">(업로드 시점 기록, 고정)</span>
                        ) : null}
                      </span>
                    </>
                  )}
                  <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {captureLabel || post?.time || (post?.createdAt ? getTimeAgo(post.createdAt) : '방금 전')}
                  </span>
                  {categoryChips.length > 0 ? (
                    <>
                      <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        {categoryChips.map((c, idx) => (
                          <span key={`${c.slug}-${idx}`} className="inline-flex items-center gap-0.5" title={c.name}>
                            {c.icon ? <span aria-hidden="true">{c.icon}</span> : null}
                            <span>{c.name}</span>
                          </span>
                        ))}
                      </span>
                    </>
                  ) : (categoryName || categoryIcon) ? (
                    <>
                      <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 flex-wrap">
                        {categoryIcon ? <span aria-hidden="true">{categoryIcon}</span> : null}
                        <span title={categoryName || ''}>{categoryName || '—'}</span>
                      </span>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">사용자 입력내용</p>
                  {(post?.note || post?.content) ? (
                    <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.65] text-zinc-900 dark:text-zinc-100">
                      {post.note || post.content}
                    </p>
                  ) : (
                    <p className="mt-2 text-[15px] leading-relaxed text-gray-400 dark:text-gray-500">작성자가 남긴 노트가 없습니다</p>
                  )}
                </div>

              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">해시태그</p>
                  {(() => {
                    const getText = (t) =>
                      (typeof t === 'string'
                        ? (t || '').replace(/^#+/, '')
                        : String(t?.name ?? t?.label ?? '')).trim();
                    const seen = new Set();
                    const merged = [];
                    [...(post?.tags || []), ...(post?.aiLabels || [])].forEach((t) => {
                      const raw = getText(t);
                      const key = raw.toLowerCase();
                      if (!key || seen.has(key)) return;
                      seen.add(key);
                      merged.push(raw);
                    });
                    return merged.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {merged.map((tagText, index) => {
                          const korean = tagTranslations[tagText.toLowerCase()] || tagText;
                          return (
                            <button
                              key={`tag-${index}`}
                              type="button"
                              onClick={() => {
                                const raw = (tagText || '').replace(/^#+/, '').trim();
                                navigate(`/hashtags?tag=${encodeURIComponent(raw)}`);
                              }}
                              className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
                            >
                              #{korean}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">태그가 없습니다</p>
                    );
                  })()}
                </div>
            </div>

            {fromMap && allPins && mapState && (
              <button
                type="button"
                onClick={() => {
                  if (post?.id) recordConversion(post.id, CONVERSION_TYPES.MAP);
                  navigate('/map', { state: { mapState, selectedPinId } });
                }}
                className="mt-3 flex w-full items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:w-auto"
              >
                <span className="material-symbols-outlined text-lg">map</span>
                <span>지도에서 주변 보기</span>
              </button>
            )}
          </div>

          {/* 정보가 정확해요 - 다른 사용자들이 정보 정확도 평가 */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">이 정보가 도움이 되었나요?</p>
            <button
              type="button"
              onClick={handleAccuracyClick}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-colors ${
                accuracyMarked
                  ? 'bg-primary/15 text-primary border-2 border-primary'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${accuracyMarked ? 'text-primary' : ''}`} style={accuracyMarked ? { fontVariationSettings: "'FILL' 1" } : {}}>
                check_circle
              </span>
              <span>정보가 정확해요</span>
              {accuracyCount > 0 && (
                <span className="font-bold text-primary">({accuracyCount})</span>
              )}
            </button>
          </div>

          {/* 인터랙션 바 — 좌: 좋아요·댓글 / 우: 공유 */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-5">
              <button type="button" onClick={handleLike} className="flex items-center gap-1.5" aria-label="좋아요">
                <span className="relative inline-flex">
                  <span
                    className={`material-symbols-outlined text-[26px] ${liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
                    style={liked ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {liked ? 'favorite' : 'favorite_border'}
                  </span>
                  {showHeartAnimation && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="heart-animation text-2xl" style={{ color: '#ef4444' }}>♥️</span>
                    </span>
                  )}
                </span>
                <span className={`text-[15px] font-semibold ${liked ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                  {likeCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('comment-input');
                  if (input) {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => input.focus(), 300);
                  }
                }}
                className="flex items-center gap-1.5"
                aria-label="댓글"
              >
                <span className="material-symbols-outlined text-[26px] text-gray-600 dark:text-gray-400">chat_bubble_outline</span>
                <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">{comments.length}</span>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative" ref={shareMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowShareMenu((v) => !v);
                    setShowAuthorPostMenu(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="더 보기"
                  aria-expanded={showShareMenu}
                  aria-haspopup="menu"
                >
                  <span className="material-symbols-outlined text-[26px] text-gray-600 dark:text-gray-400">more_vert</span>
                </button>
                {showShareMenu && (
                  <div
                    className="absolute right-0 bottom-full z-[100] mb-1 w-[min(100vw-2rem,220px)] overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      onClick={async () => {
                        setShowShareMenu(false);
                        await handleShare();
                      }}
                    >
                      <span>공유</span>
                      <span
                        className="material-symbols-outlined shrink-0 text-[20px] text-gray-500 dark:text-gray-400"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                        aria-hidden
                      >
                        share
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      onClick={() => {
                        setShowShareMenu(false);
                        handleReportPost();
                      }}
                    >
                      <span>신고하기</span>
                      <span
                        className="material-symbols-outlined shrink-0 text-[20px] text-gray-500 dark:text-gray-400"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                        aria-hidden
                      >
                        flag
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 댓글 섹션 - 항상 열린 상태 */}
          <div id="comment-section" className="flex flex-col gap-3 px-4 py-3 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#181410] dark:text-white">
                  댓글 & 질문 {(() => {
                    const withContent = comments.filter((c) => (c.content ?? c.text ?? '').trim() !== '');
                    return withContent.length > 0 ? `(${withContent.length})` : '';
                  })()}
                </h2>
              </div>

              {/* 댓글 목록 (내용 있는 댓글만 표시 — 빈 유저 항목 제외) */}
              {(() => {
                const commentsWithContent = comments.filter((c) => (c.content ?? c.text ?? '').trim() !== '');
                return commentsWithContent.length > 0 && (
                <div className="flex flex-col gap-3 mt-2">
                  {commentsWithContent.map((comment) => {
                    const commentAuthorId = comment.userId || (comment.user && typeof comment.user === 'object' ? comment.user.id : null);
                    const canEditComment = user && (String(commentAuthorId) === String(user.id));
                    const isEditing = editingCommentId === comment.id;
                    const resolved = (() => {
                      const uid = commentAuthorId != null ? String(commentAuthorId) : '';
                      const cached = uid ? getCachedFollowProfile(uid) : null;
                      let savedMe = null;
                      try {
                        const saved = JSON.parse(localStorage.getItem('user') || '{}');
                        if (saved?.id != null && uid && String(saved.id) === uid) savedMe = saved;
                      } catch {
                        // ignore
                      }
                      const displayName =
                        (savedMe?.username || null) ??
                        (cached?.username || null) ??
                        comment.user?.username ??
                        (typeof comment.user === 'string' ? comment.user : null) ??
                        '유저';
                      const displayAvatar =
                        (savedMe?.profileImage && savedMe.profileImage !== 'default' ? savedMe.profileImage : null) ??
                        (cached?.profileImage ?? null) ??
                        (comment.avatar || null);
                      return { displayName, displayAvatar };
                    })();
                    return (
                      <div key={comment.id} className="flex gap-3">
                        {resolved.displayAvatar ? (
                          <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-8 w-8 flex-shrink-0"
                            style={{ backgroundImage: `url("${resolved.displayAvatar}")` }}
                          />
                        ) : (
                          <div className="rounded-full h-8 w-8 flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-semibold text-gray-700 dark:text-gray-100">
                            {String(resolved.displayName ?? '유저').charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col flex-1">
                          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg rounded-tl-none flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#181410] dark:text-white">
                                {resolved.displayName}
                              </p>
                              {isEditing ? (
                                <div className="mt-2 flex flex-col gap-2">
                                  <input
                                    type="text"
                                    value={editCommentText}
                                    onChange={(e) => setEditCommentText(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-[#181410] dark:text-white"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button type="button" onClick={handleSaveEditComment} className="text-xs font-semibold text-primary">저장</button>
                                    <button type="button" onClick={handleCancelEditComment} className="text-xs font-semibold text-gray-500">취소</button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-800 dark:text-gray-300 mt-1">{comment.content ?? comment.text ?? ''}</p>
                              )}
                            </div>
                            {!isEditing && canEditComment && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button type="button" onClick={() => handleStartEditComment(comment)} className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary">수정</button>
                                <button type="button" onClick={() => handleDeleteComment(comment.id)} className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-red-500">삭제</button>
                              </div>
                            )}
                          </div>
                          {!isEditing && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {getTimeAgo(comment.timestamp ?? comment.createdAt ?? null)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })()}

              {/* 댓글 입력 */}
              <div className="flex gap-2 items-center mt-4">
                <input
                  id="comment-input"
                  className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl h-14 px-4 text-sm text-[#181410] dark:text-white placeholder:text-gray-400 placeholder:text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none cursor-text"
                  placeholder="댓글이나 질문을 입력하세요 💬"
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  onClick={(e) => e.target.focus()}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className={`flex-shrink-0 rounded-xl h-14 px-6 flex items-center justify-center font-bold text-base transition-colors ${
                    commentText.trim()
                      ? 'bg-primary text-white hover:opacity-90'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  전송
                </button>
              </div>
              {/* 하단 스크롤 시 다음 게시물로 이동 감지 */}
              {slideablePosts.length > 1 && currentPostIndexState < slideablePosts.length - 1 && (
                <div ref={nextPostSentinelRef} style={{ height: 1, width: '100%', visibility: 'hidden' }} aria-hidden="true" />
              )}
            </div>
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default PostDetailScreen;




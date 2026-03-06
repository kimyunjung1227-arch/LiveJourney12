import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import BottomNavigation from '../components/BottomNavigation';
import { getPost } from '../api/posts';
import { getDisplayImageUrl } from '../api/upload';
import { updatePostLikesSupabase, fetchPostByIdSupabase, addCommentToPostSupabase } from '../api/postsSupabase';
import { useAuth } from '../contexts/AuthContext';
import { getWeatherByRegion } from '../api/weather';
import { getTimeAgo } from '../utils/dateUtils';
import { toggleLike, isPostLiked, addComment, getPostAccuracyCount, hasUserMarkedAccurate, toggleAccuracyFeedback } from '../utils/socialInteractions';
import { toggleInterestPlace, isInterestPlace } from '../utils/interestPlaces';
import { getEarnedBadgesForUser } from '../utils/badgeSystem';
import { getTrustScore, getTrustGrade } from '../utils/trustIndex';
import { follow, unfollow, isFollowing } from '../utils/followSystem';
import { logger } from '../utils/logger';
import 'swiper/css';

// 영어 태그를 한국어로 번역
const tagTranslations = {
  // 자연/풍경
  'nature': '자연',
  'landscape': '풍경',
  'mountain': '산',
  'beach': '해변',
  'forest': '숲',
  'river': '강',
  'lake': '호수',
  'sunset': '일몰',
  'sunrise': '일출',
  'sky': '하늘',
  'cloud': '구름',
  'tree': '나무',
  'flower': '꽃',
  'cherry blossom': '벚꽃',
  'autumn': '가을',
  'spring': '봄',
  'summer': '여름',
  'winter': '겨울',
  'snow': '눈',
  'rain': '비',

  // 음식
  'food': '음식',
  'restaurant': '맛집',
  'cafe': '카페',
  'coffee': '커피',
  'dessert': '디저트',
  'korean food': '한식',
  'japanese food': '일식',
  'chinese food': '중식',
  'western food': '양식',
  'street food': '길거리음식',
  'seafood': '해산물',
  'meat': '고기',
  'vegetable': '채소',
  'fruit': '과일',
  'bread': '빵',
  'noodle': '면요리',
  'rice': '밥',

  // 건물/장소
  'building': '건물',
  'architecture': '건축',
  'temple': '사찰',
  'palace': '궁궐',
  'castle': '성',
  'tower': '타워',
  'bridge': '다리',
  'park': '공원',
  'garden': '정원',
  'street': '거리',
  'alley': '골목',
  'market': '시장',
  'shop': '상점',
  'mall': '쇼핑몰',

  // 활동
  'travel': '여행',
  'trip': '여행',
  'hiking': '등산',
  'camping': '캠핑',
  'picnic': '피크닉',
  'festival': '축제',
  'event': '이벤트',
  'concert': '공연',
  'exhibition': '전시',
  'shopping': '쇼핑',
  'walking': '산책',

  // 동물
  'animal': '동물',
  'dog': '강아지',
  'cat': '고양이',
  'bird': '새',
  'fish': '물고기',

  // 기타
  'photo': '사진',
  'photography': '사진',
  'art': '예술',
  'culture': '문화',
  'history': '역사',
  'traditional': '전통',
  'modern': '현대',
  'vintage': '빈티지',
  'night': '밤',
  'day': '낮',
  'morning': '아침',
  'evening': '저녁',
  'beautiful': '아름다운',
  'pretty': '예쁜',
  'cute': '귀여운',
  'cool': '멋진',
  'amazing': '놀라운',
  'scenic': '경치좋은'
};

const PostDetailScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();
  const { user } = useAuth();
  const { post: passedPost, fromMap, selectedPinId, allPins, mapState, allPosts, currentPostIndex } = location.state || {};

  const [post, setPost] = useState(passedPost);
  const [loading, setLoading] = useState(!passedPost);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentPostIndexState, setCurrentPostIndexState] = useState(currentPostIndex || 0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post?.likes || 0);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [representativeBadge, setRepresentativeBadge] = useState(null);
  const [userBadges, setUserBadges] = useState([]);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [isCommentSectionOpen, setIsCommentSectionOpen] = useState(false);
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

  // 슬라이드 가능한 게시물 목록
  const slideablePosts = useMemo(() => {
    if (allPosts && Array.isArray(allPosts) && allPosts.length > 0) {
      return allPosts;
    }
    return passedPost ? [passedPost] : [];
  }, [allPosts, passedPost]);

  // 미디어 배열 (이미지 + 동영상), 표시용 풀 URL로 변환 (문자열/배열/객체 혼합 지원)
  const toUrl = (v) => (typeof v === 'string' ? v : (v?.url ?? v?.src ?? v?.href ?? ''));
  const mediaItems = useMemo(() => {
    const rawImages = Array.isArray(post?.images)
      ? post.images
      : post?.images ? [post.images] : post?.image ? [post.image] : post?.thumbnail ? [post.thumbnail] : [];
    const rawVideos = Array.isArray(post?.videos) ? post.videos : post?.videos ? [post.videos] : [];
    const imgUrls = rawImages.map(toUrl).filter(Boolean).map((img) => ({ type: 'image', url: getDisplayImageUrl(img) }));
    const vidUrls = rawVideos.map(toUrl).filter(Boolean).map((vid) => ({ type: 'video', url: getDisplayImageUrl(vid) }));
    return [...imgUrls, ...vidUrls];
  }, [post]);

  const images = useMemo(() => {
    const rawImages = Array.isArray(post?.images)
      ? post.images
      : post?.images ? [post.images] : post?.image ? [post.image] : post?.thumbnail ? [post.thumbnail] : [];
    return rawImages.map(toUrl).filter(Boolean).map(getDisplayImageUrl);
  }, [post]);

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
      setComments(allComments);
      setLikeCount(passedPost.likes || 0);
      setLiked(isPostLiked(passedPost.id));
      setIsFavorited(isInterestPlace(passedPost.location || passedPost.placeName));
      setAccuracyMarked(hasUserMarkedAccurate(passedPost.id));
      setAccuracyCount(getPostAccuracyCount(passedPost.id));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 먼저 localStorage에서 찾기 (Mock 데이터 또는 로컬 업로드)
      const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
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
        setComments(allComments);
        setLikeCount(localPost.likes || 0);
        setLiked(isPostLiked(localPost.id));
        setIsFavorited(isInterestPlace(localPost.location || localPost.placeName));
        setAccuracyMarked(hasUserMarkedAccurate(localPost.id));
        setAccuracyCount(getPostAccuracyCount(localPost.id));
        setLoading(false);
        return;
      }

      // localStorage에 없으면 API 호출 (네트워크 오류는 조용히 처리)
      logger.log('🔍 API에서 게시물 조회 중:', postId);
      const response = await getPost(postId);
      if (response.success && response.post) {
        const serverPost = response.post;
        setPost(serverPost);
        const serverComments = Array.isArray(serverPost.comments) ? serverPost.comments : [];
        const qnaFormatted = formatQnA(serverPost.questions || []);
        setComments([...serverComments, ...qnaFormatted]);
        setLikeCount(serverPost.likesCount ?? serverPost.likes ?? 0);
        setLiked(isPostLiked(serverPost.id));
        setIsFavorited(isInterestPlace(serverPost.location || serverPost.placeName));
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
  }, [postId, passedPost, navigate, formatQnA]);

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

  // Supabase 게시물 최신 데이터 조회 (좋아요·댓글 DB 기준으로 항상 반영)
  const refreshPostFromSupabase = useCallback(() => {
    if (!postId || typeof postId !== 'string') return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId.trim());
    if (!isUuid) return;
    fetchPostByIdSupabase(postId).then((fresh) => {
      if (!fresh) return;
      setPost((prev) => ({
        ...(prev || {}),
        ...fresh,
        likes: fresh.likes ?? fresh.likeCount ?? prev?.likes,
        likeCount: fresh.likeCount ?? fresh.likes ?? prev?.likeCount,
        comments: Array.isArray(fresh.comments) ? fresh.comments : (prev?.comments ?? [])
      }));
      setLikeCount(fresh.likes ?? fresh.likeCount ?? 0);
      if (Array.isArray(fresh.comments)) setComments(fresh.comments);
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
        likes: fresh.likes ?? fresh.likeCount ?? prev?.likes,
        likeCount: fresh.likeCount ?? fresh.likes ?? prev?.likeCount,
        comments: Array.isArray(fresh.comments) ? fresh.comments : (prev?.comments ?? [])
      }));
      setLikeCount(fresh.likes ?? fresh.likeCount ?? 0);
      if (Array.isArray(fresh.comments)) setComments(fresh.comments);
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

  // 좋아요 처리
  const handleFavorite = useCallback(() => {
    if (!post) return;

    const place = {
      name: post.location || post.placeName || '장소',
      location: post.location || post.placeName,
      region: post.region || post.location?.split(' ')[0],
      coordinates: post.coordinates
    };

    const newState = toggleInterestPlace(place);
    setIsFavorited(newState);

    // 토스트 메시지
    if (newState) {
      console.log(`⭐ "${place.name}" 관심 장소 추가!`);
    } else {
      console.log(`⭐ "${place.name}" 관심 장소 해제`);
    }
  }, [post]);

  const handleLike = useCallback(() => {
    if (!post) return;

    const wasLiked = liked;
    const optimisticLiked = !liked;

    // 먼저 UI를 낙관적으로 업데이트
    setLiked(optimisticLiked);
    setLikeCount((prev) => {
      const base = typeof prev === 'number' ? prev : 0;
      return Math.max(0, base + (optimisticLiked ? 1 : -1));
    });

    const result = toggleLike(post.id);

    // localStorage 기반 게시물이면 util에서 계산한 카운트를 신뢰
    if (result.existsInStorage) {
      setLiked(result.isLiked);
      setLikeCount(result.newCount);
    } else {
      // Supabase 게시물: DB에 좋아요 수 반영 후 화면은 낙관적 업데이트 유지
      const delta = optimisticLiked ? 1 : -1;
      updatePostLikesSupabase(post.id, delta).then((res) => {
        if (res?.success && typeof res.likesCount === 'number') {
          setLikeCount(res.likesCount);
          window.dispatchEvent(new CustomEvent('postLikeUpdated', { detail: { postId: post.id, likesCount: res.likesCount } }));
        }
      });
      setLiked(optimisticLiked);
    }

    // 좋아요를 누를 때만 애니메이션 표시 (좋아요 취소가 아닐 때)
    if (result.isLiked && !wasLiked) {
      // 애니메이션이 끝난 뒤에도 항상 가득 찬 하트 상태 유지
      setLiked(true);

      setShowHeartAnimation(true);

      // 애니메이션 완료 후 효과만 숨기기 (하트 상태는 유지)
      setTimeout(() => {
        setShowHeartAnimation(false);
      }, 600);
    }

    logger.log(result.isLiked ? '❤️ 좋아요!' : '💔 좋아요 취소');
  }, [post, liked]);


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
      user: username,
      userId,
      content: text,
      timestamp: new Date().toISOString(),
      avatar: user?.profileImage || null
    };

    const isSupabasePost = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(post.id || '').trim());
    if (isSupabasePost) {
      const res = await addCommentToPostSupabase(post.id, newComment);
      if (res?.success && Array.isArray(res.comments)) {
        setComments(res.comments);
        window.dispatchEvent(new CustomEvent('postCommentsUpdated', { detail: { postId: post.id, comments: res.comments } }));
      } else {
        setComments((prev) => [...prev, newComment]);
      }
    } else {
      const uploadedPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
      const existsInStorage = uploadedPosts.some((p) => p.id === post.id);
      if (existsInStorage) {
        const newComments = addComment(post.id, text, username, userId);
        if (Array.isArray(newComments) && newComments.length > 0) setComments(newComments);
        else setComments((prev) => [...prev, newComment]);
      } else {
        setComments((prev) => [...prev, newComment]);
      }
    }

    setCommentText('');
  }, [post, commentText, user]);

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
    setLiked(isPostLiked(newPost.id));
    setLikeCount(newPost.likes || 0);
    setComments([...(newPost.comments || []), ...(newPost.qnaList || [])]);

    // 스크롤을 맨 위로 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 전환 애니메이션 완료 후 플래그 해제
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [slideablePosts, currentPostIndexState, isTransitioning]);

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

    // 1) 사용자 전체 뱃지 먼저 계산 (사진 상세에서는 대표 뱃지만 사용하지만,
    //    추후 확장에 대비해 일단 로드해 둠)
    const badges = getEarnedBadgesForUser(postUserId) || [];
    setUserBadges(badges);

    // 2) 저장된 대표 뱃지 로드
    let repBadge = null;
    const repBadgeJson = localStorage.getItem(`representativeBadge_${postUserId}`);
    if (repBadgeJson) {
      try {
        repBadge = JSON.parse(repBadgeJson);
      } catch {
        repBadge = null;
      }
    }

    // 3) 없으면 보유 뱃지 중 하나를 대표 뱃지로 사용
    if (!repBadge && badges.length > 0) {
      // 난이도/정렬 등의 로직이 생기면 여기서 변경
      repBadge = badges[0];
      localStorage.setItem(`representativeBadge_${postUserId}`, JSON.stringify(repBadge));
    }

    // 4) 그래도 없으면, 포스트에 들어있는 텍스트 배지를 대표 뱃지처럼 보여줌
    if (!repBadge) {
      const fallbackBadgeName =
        (post?.user && typeof post.user === 'object' && post.user.badges?.[0]) ||
        post?.badge ||
        null;

      if (fallbackBadgeName) {
        repBadge = {
          name: fallbackBadgeName,
          icon: '🏅',
        };
      }
    }

    if (repBadge) {
      setRepresentativeBadge(repBadge);
    }

    // 5) 작성자 신뢰지수 (로컬 게시물 + 현재 게시물로 계산, 다른 사용자 게시물에서도 표시)
    const getPostAuthorId = (p) => {
      const id = p?.userId ?? (typeof p?.user === 'string' ? p.user : p?.user?.id) ?? p?.user;
      return id != null ? String(id) : '';
    };
    const uploadedPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const sameAuthorPosts = uploadedPosts.filter((p) => getPostAuthorId(p) === String(postUserId));
    const withCurrent = post?.id || post?._id
      ? sameAuthorPosts.some((p) => (p.id || p._id) === (post.id || post._id))
        ? sameAuthorPosts
        : [post, ...sameAuthorPosts]
      : [post, ...sameAuthorPosts];
    const score = getTrustScore(postUserId, withCurrent.length ? withCurrent : null);
    const { grade } = getTrustGrade(score, postUserId, withCurrent.length ? withCurrent : null);
    setAuthorTrustScore(score);
    setAuthorTrustGrade(grade);
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
  const userName = useMemo(
    () => authorDisplay?.username || (typeof post?.user === 'string' ? post.user : null) || '익명 여행자',
    [authorDisplay, post]
  );
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

  // 날씨 정보: 항상 업로드 시점(사용자가 올린 시간) 기준으로 표시. 시간이 지나도 업로드 당시 날씨 유지
  useEffect(() => {
    if (!post) return;

    if (post.weather) {
      // 저장된 업로드 시점 날씨 사용 (몇 시간이 지나도 변경하지 않음)
      setWeatherInfo({
        icon: post.weather.icon,
        condition: post.weather.condition,
        temperature: post.weather.temperature,
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
            className="image-swipe-area w-full gap-1 overflow-hidden bg-white dark:bg-gray-900 flex relative shadow-md"
            style={{ height: '60vh', minHeight: '330px', marginTop: '-64px' }}
          >
            {/* 프로필 - 사진 위 오버레이 */}
            <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none">
              <div className="flex items-center justify-between bg-white/90 dark:bg-gray-900/90 rounded-2xl px-3 py-2 shadow-sm pointer-events-auto">
                <div
                  className="flex gap-3 items-center cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
                  onClick={() => {
                    const postUserId = post?.userId ||
                      (typeof post?.user === 'string' ? post.user : post?.user?.id) ||
                      post?.user;
                    const currentUserId = user?.id;
                    if (postUserId && postUserId !== currentUserId) {
                      navigate(`/user/${postUserId}`);
                    } else if (postUserId && postUserId === currentUserId) {
                      navigate('/profile');
                    }
                  }}
                >
                  {authorAvatar ? (
                    <div
                      className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-10 w-10 ring-2 ring-gray-200 dark:ring-gray-700 flex-shrink-0"
                      style={{ backgroundImage: `url("${authorAvatar}")` }}
                    />
                  ) : (
                    <div className="rounded-full h-10 w-10 ring-2 ring-gray-200 dark:ring-gray-700 flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-100">
                      {String(userName || '여행자').charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[#181410] dark:text-white text-sm font-bold leading-tight truncate">
                        {userName}
                      </p>
                      {representativeBadge && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full flex-shrink-0">
                          <span className="text-xs">{representativeBadge.icon}</span>
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 max-w-[72px] truncate">
                            {representativeBadge.name}
                          </span>
                        </div>
                      )}
                    </div>
                    {(authorTrustScore != null || authorTrustGrade) && (
                      <div className="mt-0.5">
                        <p className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1">
                          <span>신뢰지수</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{authorTrustScore ?? 0}</span>
                          {authorTrustGrade && (
                            <span className="text-gray-600 dark:text-gray-400 text-[11px]">
                              {authorTrustGrade.icon} {authorTrustGrade.name}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {postUserId && user?.id && String(postUserId) !== String(user.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFollowAuthor) {
                        unfollow(postUserId);
                        setIsFollowAuthor(false);
                      } else {
                        follow(postUserId);
                        setIsFollowAuthor(true);
                      }
                    }}
                    className={`ml-2 shrink-0 py-1.5 px-3 rounded-xl text-xs font-semibold ${
                      isFollowAuthor ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-primary text-white hover:opacity-90'
                    }`}
                  >
                    {isFollowAuthor ? '팔로잉' : '팔로우'}
                  </button>
                )}
              </div>
            </div>

            <Swiper
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
                        className="w-full flex-shrink-0 relative"
                        style={{ height: '60vh', minHeight: '330px' }}
                      >
                        {media.type === 'video' ? (
                          <video
                            src={media.url}
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                            controls={false}
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt=""
                            className="w-full h-full object-cover"
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
                        style={{ height: '60vh', minHeight: '330px' }}
                      />
                    </SwiperSlide>
                  ))}
            </Swiper>

            {(mediaItems.length > 1 || images.length > 1) && (
              <>
                {/* 페이지 인디케이터 - 클릭 가능 */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {(mediaItems.length > 0 ? mediaItems : images).map((_, index) => (
                    <div
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        index === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                      }`}
                    ></div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <main className="flex flex-col bg-white dark:bg-gray-900" style={{ minHeight: 'auto' }}>
          <div className="px-4 pt-4 pb-3">
            {/* 📍 위치 정보 */}
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-2xl flex-shrink-0">location_on</span>
              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {verifiedLocation || detailedLocationText || locationText}
                  </p>
                  {categoryName && (
                    <span
                      title={categoryName}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-lg"
                      aria-label={categoryName}
                    >
                      {categoryName.includes('개화') && '🌸'}
                      {categoryName.includes('맛집') && '🍜'}
                      {categoryName.includes('야경') && '🌙'}
                      {categoryName.includes('시즌') && '🍂'}
                      {!categoryName.includes('개화') && !categoryName.includes('맛집') && !categoryName.includes('야경') && !categoryName.includes('시즌') && '🏞️'}
                    </span>
                  )}
                </div>
                {/* 지역명이 두 번 반복되어 보이는 것을 막기 위해, 하단의 locationText 한 줄은 숨김 처리 */}
                {addressText && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">{addressText}</p>
                )}
                <div className="flex items-center flex-wrap gap-3 text-sm mb-3">
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="material-symbols-outlined !text-lg">schedule</span>
                    <span>
                      {captureLabel || post?.time || (post?.createdAt ? getTimeAgo(post.createdAt) : '방금 전')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    {weatherInfo.loading ? (
                      <>
                        <span className="material-symbols-outlined !text-lg">wb_sunny</span>
                        <span>로딩중...</span>
                      </>
                    ) : (
                      <>
                        <span className="!text-lg">{weatherInfo.icon}</span>
                        <span>{weatherInfo.condition}, {weatherInfo.temperature}</span>
                        {post?.weather && (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">(업로드 당시)</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {fromMap && allPins && mapState && (
                  <button
                    onClick={() => navigate('/map', { state: { mapState, selectedPinId } })}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-lg">map</span>
                    <span>지도에서 주변 보기</span>
                  </button>
                )}
              </div>
            </div>

            {/* 📝 작성자 노트 */}
            <div className="flex items-start gap-3 mb-4">
              <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-2xl flex-shrink-0">edit_note</span>
              <div className="flex-1">
                {(post?.note || post?.content) ? (
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {post.note || post.content}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    작성자가 남긴 노트가 없습니다
                  </p>
                )}
              </div>
            </div>

            {/* 🏷️ 해시태그 */}
              <div className="flex items-start gap-3 mb-4">
                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-2xl flex-shrink-0">tag</span>
                <div className="flex-1">
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
                      <div className="flex flex-wrap gap-2">
                        {merged.map((tagText, index) => {
                          const korean = tagTranslations[tagText.toLowerCase()] || tagText;
                          const handleTagClick = () => {
                            // 원본 태그 텍스트(앞의 # 제거)를 그대로 HashtagScreen으로 전달
                            const raw = (tagText || '').replace(/^#+/, '').trim();
                            navigate(`/hashtags?tag=${encodeURIComponent(raw)}`);
                          };
                          return (
                            <button
                              key={`tag-${index}`}
                              type="button"
                              onClick={handleTagClick}
                              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            >
                              #{korean}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-gray-500">태그가 없습니다</p>
                    );
                  })()}
                </div>
              </div>
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

          {/* 인터랙션 바 - 좋아요, 댓글, 공유 */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              {/* 좋아요 (하트 아이콘 크기에 맞춘 애니메이션) */}
              <button
                onClick={handleLike}
                className="flex items-center gap-2"
              >
                <span className="relative inline-flex">
                  <span
                    className={`material-symbols-outlined text-2xl ${liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
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
                <span className={`text-base font-semibold ${liked ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {likeCount}
                </span>
              </button>

              {/* 댓글 */}
              <button
                onClick={() => {
                  setIsCommentSectionOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      // 열릴 때만 스크롤 + 포커스
                      setTimeout(() => {
                        const input = document.getElementById('comment-input');
                        if (input) {
                          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          input.focus();
                        }
                      }, 50);
                    }
                    return next;
                  });
                }}
                className="flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-2xl text-gray-600 dark:text-gray-400">chat_bubble_outline</span>
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300">{comments.length}</span>
              </button>
            </div>

            {/* 공유 */}
            <button
              onClick={handleShare}
              className="flex items-center"
            >
              <span className="material-symbols-outlined text-2xl text-gray-600 dark:text-gray-400">ios_share</span>
            </button>
          </div>

          {/* 댓글 섹션 - 댓글 버튼을 눌렀을 때만 표시 */}
          {isCommentSectionOpen && (
            <div className="flex flex-col gap-3 px-4 py-3 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#181410] dark:text-white">
                  댓글 & 질문 {comments.length > 0 && `(${comments.length})`}
                </h2>
              </div>

              {/* 댓글 목록 */}
              {comments.length > 0 && (
                <div className="flex flex-col gap-3 mt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      {comment.avatar ? (
                        <div
                          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-8 w-8 flex-shrink-0"
                          style={{ backgroundImage: `url("${comment.avatar}")` }}
                        />
                      ) : (
                        <div className="rounded-full h-8 w-8 flex-shrink-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-semibold text-gray-700 dark:text-gray-100">
                          {String(comment.user?.username ?? comment.user ?? '유저').charAt(0)}
                        </div>
                      )}
                      <div className="flex flex-col flex-1">
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg rounded-tl-none">
                          <p className="text-sm font-bold text-[#181410] dark:text-white">
                            {comment.user?.username ?? comment.user ?? '유저'}
                          </p>
                          <p className="text-sm text-gray-800 dark:text-gray-300 mt-1">
                            {comment.content}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {getTimeAgo(comment.timestamp || comment.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
          )}
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default PostDetailScreen;




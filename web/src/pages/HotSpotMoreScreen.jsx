import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';

const FILTERS = [
  { id: '전체', label: '전체', icon: null },
  { id: '카페', label: '카페', icon: 'local_cafe' },
  { id: '맛집', label: '맛집', icon: 'restaurant' },
  { id: '명소', label: '명소', icon: 'location_on' },
];

const matchFilter = (post, filterId) => {
  if (filterId === '전체') return true;
  const cat = (post.category || '').toLowerCase();
  const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
  const content = (post.content || post.note || '').toLowerCase();
  const loc = (post.location || '').toLowerCase();
  const text = `${cat} ${tags} ${content} ${loc}`;
  if (filterId === '카페') return text.includes('카페') || text.includes('cafe') || text.includes('커피');
  if (filterId === '맛집') return cat === 'food';
  if (filterId === '명소') return cat === 'scenic' || cat === 'landmark';
  return true;
};

// 댓글/작성자 아바타 URL 수집 (최대 3개)
const getAvatarUrls = (post) => {
  const urls = [];
  const commenters = Array.isArray(post.comments) ? post.comments : [];
  commenters.forEach((c) => {
    const avatar = c.avatar || c.user?.avatar;
    if (avatar && !urls.includes(avatar)) urls.push(avatar);
  });
  const uploaderAvatar = post.user?.avatar || post.avatar;
  if (uploaderAvatar && !urls.includes(uploaderAvatar)) urls.unshift(uploaderAvatar);
  return urls.slice(0, 3);
};

const HotSpotMoreScreen = () => {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [activeFilter, setActiveFilter] = useState('전체');
  const [liveViewCount, setLiveViewCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const contentRef = useRef(null);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('adminDeletedPost', handler);
    return () => window.removeEventListener('adminDeletedPost', handler);
  }, []);

  useEffect(() => {
    const onLike = (e) => {
      const { postId, likesCount } = e.detail || {};
      if (!postId || typeof likesCount !== 'number') return;
      const id = String(postId);
      setList((prev) =>
        prev.map((p) => (p && String(p.id) === id ? { ...p, likes: likesCount, likeCount: likesCount } : p))
      );
    };
    const onComments = (e) => {
      const { postId, comments: nextComments } = e.detail || {};
      if (!postId || !Array.isArray(nextComments)) return;
      const id = String(postId);
      setList((prev) =>
        prev.map((p) => (p && String(p.id) === id ? { ...p, comments: nextComments } : p))
      );
    };
    window.addEventListener('postLikeUpdated', onLike);
    window.addEventListener('postCommentsUpdated', onComments);
    return () => {
      window.removeEventListener('postLikeUpdated', onLike);
      window.removeEventListener('postCommentsUpdated', onComments);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
      const supabasePosts = await fetchPostsSupabase();
      const byId = new Map();
      [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach((p) => {
        if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
      });
      const allPosts = getCombinedPosts(Array.from(byId.values()));
      const posts = filterActivePosts48(allPosts);

      const transformPost = (post) => {
        const firstImage = post.images?.[0] || post.image || post.thumbnail || '';
        const firstVideo = post.videos?.[0] || '';
        const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
        const commentsArr = Array.isArray(post.comments) ? post.comments : [];
        const timeStr = getTimeAgo(post.timestamp || post.createdAt || post.time);
        return {
          ...post,
          id: post.id,
          image: getDisplayImageUrl(firstImage || firstVideo || ''),
          thumbnailIsVideo: !firstImage && !!firstVideo,
          firstVideoUrl: firstVideo ? getDisplayImageUrl(firstVideo) : null,
          location: post.location,
          region: post.region || (post.location || '').trim().split(/\s+/).slice(0, 2).join(' ') || post.location,
          time: timeStr,
          content: post.note || post.content || `${post.location || '장소'}의 모습`,
          likes: likesNum,
          likeCount: likesNum,
          comments: commentsArr,
        };
      };

      const transformed = posts.map(transformPost);
      const hotPosts = transformed
        .filter((p) => {
          const hasLikes = (p.likes || 0) > 0;
          const isRecent = p.time && (p.time.includes('방금') || p.time.includes('분 전') || p.time.includes('시간 전'));
          return hasLikes || isRecent;
        })
        .sort((a, b) => {
          if (b.likes !== a.likes) return b.likes - a.likes;
          if (a.time && a.time.includes('방금')) return -1;
          if (b.time && b.time.includes('방금')) return 1;
          if (a.time && a.time.includes('분 전') && !(b.time && b.time.includes('분 전'))) return -1;
          if (b.time && b.time.includes('분 전') && !(a.time && a.time.includes('분 전'))) return 1;
          return 0;
        })
        .slice(0, 100);

      setList(hotPosts.length > 0 ? hotPosts : transformed.slice(0, 50));

      const uniqueUserIds = new Set();
      (hotPosts.length > 0 ? hotPosts : transformed).forEach((p) => {
        const uid = p.userId || (typeof p.user === 'string' ? p.user : p.user?.id);
        if (uid) uniqueUserIds.add(String(uid));
      });
      const totalEngagement = (hotPosts.length > 0 ? hotPosts : transformed).reduce((sum, p) => sum + (p.likes || 0) + (p.comments?.length || 0) * 2, 0);
      setLiveViewCount(Math.max(uniqueUserIds.size * 2 + 3, Math.min(99, Math.floor(totalEngagement / 3) + 5)));
    };
    loadData();
  }, [refreshKey]);

  const filtered = list.filter((post) => matchFilter(post, activeFilter));

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
      <header className="screen-header sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background-light/90 dark:bg-background-dark/90 border-b border-slate-100 dark:border-slate-800 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-main dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-text-main dark:text-white">
          실시간 급상승 핫플 더보기
        </h1>
        <div className="w-10" />
      </header>

      <div ref={contentRef} className="screen-content flex-1 overflow-y-auto">
        <section className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-rose-500 font-bold text-xs uppercase tracking-wider">Live</span>
          </div>
          <h2 className="text-xl font-bold text-text-main dark:text-white">지금 가장 핫한 장소</h2>
          <p className="text-text-sub dark:text-slate-400 text-sm mt-0.5">실시간으로 올라오는 인기 스팟을 확인하세요</p>
        </section>

        <div className="flex gap-2 overflow-x-auto px-5 py-3 scrollbar-hide">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-text-sub dark:text-slate-300'
                }`}
              >
                {f.icon && <span className="material-symbols-outlined text-lg">{f.icon}</span>}
                {f.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 dark:text-slate-500">
            <span className="material-symbols-outlined text-5xl mb-3">local_fire_department</span>
            <p className="text-sm">아직 핫플 게시물이 없어요</p>
          </div>
        ) : (
          <div className="px-5 pb-32 space-y-5">
            {filtered.map((post) => {
              const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
              const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
              const uploadCount = Math.min(99, commentCount + 1);
              const viewingCount = Math.max(1, Math.min(99, (likeCount + commentCount * 2) % 30 + 3));
              const avatars = getAvatarUrls(post);
              const regionLabel = post.region || post.location || '장소';
              const locationShort = (post.location || post.region || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .join(' ') || regionLabel;
              const title = post.location || post.placeName || post.detailedLocation || '핫플레이스';
              const desc = post.content || post.note || '지금 많은 사람들이 찾고 있어요';

              return (
                <article
                  key={post.id}
                  onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: list } })}
                  className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-md active:scale-[0.99] transition-transform cursor-pointer"
                >
                  {/* 카드 상단: 블러 배경 + 사진 왼쪽 위치(가볍게) + 우상단 뱃지 */}
                  <div className="relative h-32 overflow-hidden">
                    {post.thumbnailIsVideo && post.firstVideoUrl ? (
                      <video
                        src={post.firstVideoUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover scale-110 blur-md"
                      />
                    ) : post.image ? (
                      <img
                        src={post.image}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover scale-110 blur-md"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700" />
                    )}
                    <div className="absolute inset-0 bg-black/20" />
                    {/* 사진 왼쪽 위치 정보 가볍게 (구미 봉곡동 스타일) */}
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/90 text-xs font-medium drop-shadow-sm whitespace-nowrap">
                      {locationShort}
                    </div>
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                      {regionLabel}
                    </div>
                  </div>

                  {/* 카드 본문: 제목, 북마크, 설명 */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-text-main dark:text-white flex-1 min-w-0 truncate">
                        {title}
                      </h3>
                      <button
                        type="button"
                        className="flex-shrink-0 text-slate-400 hover:text-primary dark:hover:text-slate-300"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="저장"
                      >
                        <span className="material-symbols-outlined">bookmark</span>
                      </button>
                    </div>
                    <p className="text-sm text-text-sub dark:text-slate-400 mt-1 line-clamp-2">{desc}</p>

                    {/* 현재 N명이 이 사진을 보고 있어요 */}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <span>현재 <strong className="text-text-main dark:text-slate-300">{viewingCount}명</strong>이 이 사진을 보고 있어요</span>
                    </div>

                    {/* 카드 하단: 아바타 + N명이 사진 올림, 좋아요 */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex -space-x-2">
                          {avatars.length > 0 ? (
                            avatars.map((url, i) => (
                              <div
                                key={i}
                                className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 bg-cover bg-center flex-shrink-0"
                                style={{ backgroundImage: `url(${url})` }}
                              />
                            ))
                          ) : (
                            [1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0"
                              >
                                {String(post.location || '?').charAt(0)}
                              </div>
                            ))
                          )}
                        </div>
                        <span className="text-xs text-text-sub dark:text-slate-400 truncate">
                          지금 {uploadCount}명이 사진을 올렸어요
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 flex-shrink-0">
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                        <span className="text-sm font-semibold">{likeCount}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* 피드 하단: 실시간 N명이 보고 있어요 등 핫플 감성 (하단 네비 위에 고정) */}
        {filtered.length > 0 && (
          <div
            className="fixed left-0 right-0 z-10 pt-3 pb-2 px-4 bg-gradient-to-t from-background-light via-background-light/95 to-transparent dark:from-background-dark dark:via-background-dark/95 pointer-events-none"
            style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="max-w-lg mx-auto flex flex-col gap-0.5 items-center">
              <div className="flex items-center gap-2 text-sm text-text-sub dark:text-slate-400">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>지금 <strong className="text-text-main dark:text-white">{liveViewCount}명</strong>이 보고 있어요</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">실시간 급상승 핫플 · 지금 가장 핫한 장소</p>
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default HotSpotMoreScreen;

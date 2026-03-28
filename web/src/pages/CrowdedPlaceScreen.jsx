import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { rankHotspotPosts } from '../utils/hotnessEngine';
import { toggleBookmark, isPostBookmarked } from '../utils/socialInteractions';
import { getLocationSubtitle, getHotAtmosphere } from '../utils/hotPlaceDisplay';

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

const CrowdedPlaceScreen = () => {
    const navigate = useNavigate();
    const [crowdedData, setCrowdedData] = useState([]);
    const [activeFilter, setActiveFilter] = useState('전체');
    const [refreshKey, setRefreshKey] = useState(0);
    const [bookmarkRefresh, setBookmarkRefresh] = useState(0);
    const contentRef = useRef(null);

    const handleBookmark = (e, post) => {
        e.stopPropagation();
        toggleBookmark(post);
        setBookmarkRefresh((k) => k + 1);
    };

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
            setCrowdedData((prev) =>
                prev.map((p) => (p && String(p.id) === id ? { ...p, likes: likesCount, likeCount: likesCount } : p))
            );
        };
        const onComments = (e) => {
            const { postId, comments: nextComments } = e.detail || {};
            if (!postId || !Array.isArray(nextComments)) return;
            const id = String(postId);
            setCrowdedData((prev) =>
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
            const preFiltered = transformed.filter((p) => {
                const hasLikes = (p.likes || 0) > 0;
                const isRecent = p.time && (p.time.includes('방금') || p.time.includes('분 전') || p.time.includes('시간 전'));
                return hasLikes || isRecent;
            });
            const toRank = preFiltered.length > 0 ? preFiltered : transformed;
            const ranked = rankHotspotPosts(toRank, { verifyFirst: true, maxItems: 100 });
            const crowdedWithRank = ranked.map((r) => ({
                ...r.post,
                _rank: r.rank,
                _impactLabel: r.impactLabel,
            }));
            setCrowdedData(crowdedWithRank.length > 0 ? crowdedWithRank : transformed.slice(0, 50));
        };
        loadData();
    }, [refreshKey]);

    const filteredPosts = crowdedData.filter((post) => matchFilter(post, activeFilter));

    return (
        <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
            {/* 헤더 */}
            <header className="screen-header sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background-light/90 dark:bg-background-dark/90 border-b border-slate-100 dark:border-slate-800 backdrop-blur">
                <button
                    onClick={() => navigate(-1)}
                    aria-label="뒤로가기"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-main dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="flex-1 text-center text-lg font-bold text-text-main dark:text-white">
                    실시간 급상승 핫플
                </h1>
                <div className="w-10" />
            </header>

            {/* 컨텐츠 */}
            <div ref={contentRef} className="screen-content flex-1 overflow-y-auto">
                {/* 상단 타이틀 — 실시간 급상승 핫플 피드 */}
                <section className="px-5 pt-4 pb-1">
                    <h2 className="text-xl font-bold leading-tight text-text-main dark:text-white">
                        실시간 급상승 핫플 🔥
                    </h2>
                    <p className="text-text-sub dark:text-slate-400 text-xs mt-1">지금 가장 핫한 장소를 확인해보세요</p>
                </section>

                {/* 필터 — 칩 사이즈를 줄여 상단 영역 압축 */}
                <div className="flex gap-1.5 overflow-x-auto px-5 py-3 scrollbar-hide">
                    {FILTERS.map((f) => {
                        const isActive = activeFilter === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setActiveFilter(f.id)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                                    isActive
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-text-sub dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                {f.icon && <span className="material-symbols-outlined text-base">{f.icon}</span>}
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                {/* 피드 — 세로 리스트, 4:3 카드, 랭킹은 3위까지 표시하되 피드는 계속 노출 */}
                {filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-5xl mb-3">local_fire_department</span>
                        <p className="text-sm mb-1">아직 실시간 핫플 게시물이 없어요</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">좋아요가 쌓이거나 최근 게시물이 생기면 이곳에 표시돼요.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 px-4 pb-16">
                        {filteredPosts.map((post) => {
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const rank = post._rank;
                            const title = post.location || post.placeName || post.detailedLocation || '핫플레이스';
                            const isBookmarked = bookmarkRefresh >= 0 && isPostBookmarked(post.id);
                            const locationSub = getLocationSubtitle(post, title);
                            const atmosphere = getHotAtmosphere(post);
                            return (
                                <div
                                    key={post.id}
                                    onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } })}
                                    className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer"
                                >
                                    {/* 사진: 메인 핫플과 유사 — 좌상단 TRENDING, 우하단 분위기 */}
                                    <div className="relative w-full aspect-[4/3] bg-slate-200 overflow-hidden rounded-t-2xl">
                                        {rank != null && (
                                            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-slate-900/80 text-white text-[10px] font-extrabold tracking-tight shadow-md">
                                                TRENDING #{rank}
                                            </div>
                                        )}
                                        {post.thumbnailIsVideo && post.firstVideoUrl ? (
                                            <video
                                                src={post.firstVideoUrl}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                            />
                                        ) : post.image ? (
                                            <img src={post.image} alt={post.location || ''} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl">image</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                                        <div
                                            className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold text-white shadow-md ${
                                                atmosphere === 'crowded' ? 'bg-blue-500' : 'bg-amber-500'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                {atmosphere === 'crowded' ? 'groups' : 'sentiment_satisfied'}
                                            </span>
                                            {atmosphere === 'crowded' ? '사람 몰림' : '여유로움'}
                                        </div>
                                    </div>
                                    <div className="p-3.5 pb-3">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-base font-bold text-text-main dark:text-white leading-snug">{title}</h3>
                                                {locationSub ? (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                        {locationSub}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                className="text-slate-400 hover:text-primary transition-colors p-1 flex-shrink-0 mt-0.5"
                                                onClick={(e) => handleBookmark(e, post)}
                                                aria-label="저장"
                                            >
                                                <span className="material-symbols-outlined text-[22px]" style={isBookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                                    bookmark
                                                </span>
                                            </button>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1 min-w-0 truncate">
                                                <span className="material-symbols-outlined text-primary text-[15px] flex-shrink-0">trending_up</span>
                                                <span className="font-medium text-slate-600 dark:text-slate-300">실시간 급상승 중</span>
                                            </span>
                                            <span className="flex-shrink-0 text-slate-400 dark:text-slate-500">
                                                {post.time ? `${post.time} 업로드` : '최근 업로드'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 위로가기 버튼 - 프로필 버튼 바로 위, 흰색 완전 원형 */}
            <button
                type="button"
                onClick={() => {
                    if (contentRef.current) {
                        contentRef.current.scrollTop = 0;
                        if (typeof contentRef.current.scrollTo === 'function') {
                            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
                    zIndex: 60
                }}
                aria-label="위로가기"
            >
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#111827' }}>north</span>
            </button>

            <BottomNavigation />
        </div>
    );
};

export default CrowdedPlaceScreen;

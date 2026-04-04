import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { rankHotspotPosts } from '../utils/hotnessEngine';
import { toggleLike, isPostLiked } from '../utils/socialInteractions';
import { updatePostLikesSupabase } from '../api/postsSupabase';
import { getMapThumbnailUri } from '../utils/postMedia';
import { getUnreadCount } from '../utils/notifications';
import HotFeedCard from '../components/HotFeedCard';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';
import { getWeatherByRegion } from '../api/weather';

const CrowdedPlaceScreen = () => {
    const navigate = useNavigate();
    const [crowdedData, setCrowdedData] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [crowdedSocialIdx, setCrowdedSocialIdx] = useState(0);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const contentRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setCrowdedSocialIdx((i) => (i + 1) % 3), 2800);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        setCrowdedSocialIdx(0);
    }, []);

    const crowdedRegionsKey = useMemo(() => {
        const keys = crowdedData.map((p) => (p?.region || p?.location || '').trim().split(/\s+/)[0]).filter(Boolean);
        return [...new Set(keys)].sort().join('|');
    }, [crowdedData]);

    useEffect(() => {
        const regions = new Set();
        crowdedData.forEach((p) => {
            if (p && !p.weather && (p.region || p.location)) {
                const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
                if (r) regions.add(r);
            }
        });
        if (regions.size === 0) return undefined;
        let cancelled = false;
        const map = {};
        Promise.all(
            Array.from(regions).map(async (region) => {
                try {
                    const res = await getWeatherByRegion(region);
                    if (!cancelled && res?.success && res.weather) return { region, weather: res.weather };
                } catch (_) {
                    /* ignore */
                }
                return null;
            })
        ).then((results) => {
            if (cancelled) return;
            results.forEach((r) => {
                if (r) map[r.region] = r.weather;
            });
            setWeatherByRegion((prev) => ({ ...prev, ...map }));
        });
        return () => {
            cancelled = true;
        };
    }, [crowdedRegionsKey]);

    useEffect(() => {
        const onCountChange = () => setUnreadNotificationCount(getUnreadCount());
        window.addEventListener('notificationCountChanged', onCountChange);
        setUnreadNotificationCount(getUnreadCount());
        return () => window.removeEventListener('notificationCountChanged', onCountChange);
    }, []);

    const handleHotFeedLike = useCallback((e, post) => {
        e.stopPropagation();
        const wasLiked = isPostLiked(post.id);
        const baseLikes = typeof post.likes === 'number'
            ? post.likes
            : (typeof post.likeCount === 'number' ? post.likeCount : 0);
        const result = toggleLike(post.id, baseLikes);
        if (result.existsInStorage) {
            setCrowdedData((prev) =>
                prev.map((p) => (p && p.id === post.id ? { ...p, likes: result.newCount, likeCount: result.newCount } : p))
            );
        } else {
            const delta = wasLiked ? -1 : 1;
            updatePostLikesSupabase(post.id, delta);
            setCrowdedData((prev) =>
                prev.map((p) =>
                    (p && p.id === post.id ? { ...p, likes: result.newCount, likeCount: result.newCount } : p)
                )
            );
        }
    }, []);

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
                const coverStill = getMapThumbnailUri(post);
                return {
                    ...post,
                    id: post.id,
                    // 동영상은 재생하지 않고, 가능한 정지 썸네일(이미지/thumbnail/poster)만 사용
                    image: getDisplayImageUrl(coverStill || firstImage || ''),
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

    const filteredPosts = crowdedData;

    return (
        <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
            {/* 메인과 동일 상단 바 — 뒤로가기 + 로고 + 검색 + 알림 */}
            <div
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 sticky top-0 z-20"
                style={{
                    borderBottom: 'none',
                    boxShadow: 'none',
                }}
            >
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    aria-label="뒤로가기"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#0f172a] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <span
                    className="logo-text shrink-0 text-[18px] font-bold tracking-tight text-[#0f172a] dark:text-white opacity-90"
                    style={{ letterSpacing: '-0.3px' }}
                >
                    Live Journey
                </span>
                <button
                    type="button"
                    onClick={() => navigate('/search')}
                    className="flex flex-1 min-w-0 max-w-[260px] h-8 ml-2 mr-1 items-center justify-between border-0 border-b border-solid border-slate-200 bg-transparent text-slate-400 text-sm cursor-pointer"
                    aria-label="검색"
                >
                    <span className="truncate">어디로 떠나볼까요?</span>
                    <span className="material-symbols-outlined text-[20px] shrink-0">search</span>
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/notifications')}
                    className="relative flex size-11 shrink-0 items-center justify-center text-[#0f172a] dark:text-white"
                    aria-label="알림"
                >
                    <span className="material-symbols-outlined text-2xl">notifications</span>
                    {unreadNotificationCount > 0 && (
                        <span className="noti-badge absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                        </span>
                    )}
                </button>
            </div>

            <div ref={contentRef} className="screen-content flex-1 overflow-y-auto" style={{ background: '#ffffff' }}>
                <div style={{ padding: '8px 16px 24px', background: '#ffffff', minHeight: '100%' }}>
                    <div style={{ marginBottom: '0', paddingTop: '4px', paddingBottom: '24px', background: '#ffffff' }}>
                        <div style={{ padding: '0 0 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>실시간 핫플</h3>
                            <span className="w-10" aria-hidden />
                        </div>

                        {filteredPosts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94a3b8', fontSize: '14px' }}>
                                아직 실시간 핫플 게시물이 없어요.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 pb-16">
                                {filteredPosts.map((post) => {
                                    const cardProps = buildHotFeedCardProps(post, weatherByRegion);
                                    if (!cardProps) return null;
                                    const socialText = getHotFeedSocialLine(cardProps, crowdedSocialIdx);
                                    const liked = isPostLiked(post.id);
                                    return (
                                        <HotFeedCard
                                            key={post.id}
                                            cardProps={cardProps}
                                            socialText={socialText}
                                            liked={liked}
                                            onCardClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } })}
                                            onLikeClick={handleHotFeedLike}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
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

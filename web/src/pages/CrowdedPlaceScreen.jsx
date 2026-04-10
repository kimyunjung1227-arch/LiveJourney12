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
import HotFeedCard from '../components/HotFeedCard';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';
import { getWeatherByRegion } from '../api/weather';

const CrowdedPlaceScreen = () => {
    const navigate = useNavigate();
    const [crowdedData, setCrowdedData] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [crowdedSocialIdx, setCrowdedSocialIdx] = useState(0);
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
            if (p && !p.weather && !p.weatherSnapshot && (p.region || p.location)) {
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
            <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-border-light bg-background-light px-3 py-3 dark:border-border-dark dark:bg-background-dark">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    aria-label="뒤로가기"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-primary-light hover:bg-black/5 dark:text-text-primary-dark dark:hover:bg-white/10"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="min-w-0 flex-1 pr-2 text-center text-[17px] font-bold leading-snug text-text-primary-light dark:text-text-primary-dark">
                    실시간 급상승 핫플
                </h1>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            <div ref={contentRef} className="screen-content flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
                <div className="min-h-full px-4 pb-16 pt-2">
                    <div className="pb-6">

                        {filteredPosts.length === 0 ? (
                            <div className="py-10 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                아직 실시간 핫플 게시물이 없어요.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
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

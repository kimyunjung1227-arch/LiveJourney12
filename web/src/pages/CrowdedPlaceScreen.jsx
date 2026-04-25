import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { rankHotspotPosts } from '../utils/hotnessEngine';
import { toggleBookmark, isPostBookmarked } from '../utils/socialInteractions';
import { getMapThumbnailUri } from '../utils/postMedia';
import { buildHotFeedCardProps } from '../utils/hotFeedCardModel';
import {
    getHotFeedAddressLine,
    getCityDongLine,
    getPhotoCategoryLabel,
    getPhotoCaptionLine,
} from '../utils/hotPlaceDisplay';
import { getWeatherByRegion } from '../api/weather';

const HOT_BADGE_VARIANTS = ['급상승', '실시간 인기', '지금 주목받는 곳', '실시간 핫플'];

function getHotBadgeLabel(variantIndex) {
    return HOT_BADGE_VARIANTS[variantIndex % HOT_BADGE_VARIANTS.length];
}

const CrowdedPlaceScreen = () => {
    const navigate = useNavigate();
    const [crowdedData, setCrowdedData] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [bookmarkRefresh, setBookmarkRefresh] = useState(0);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [badgeTick, setBadgeTick] = useState(0);
    const contentRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setBadgeTick((t) => t + 1), 2600);
        return () => clearInterval(id);
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
                <section className="px-5 pt-3 pb-0.5">
                    <h2 className="text-lg font-bold leading-tight text-text-main dark:text-white">
                        실시간 급상승 핫플 🔥
                    </h2>
                    <p className="text-text-sub dark:text-slate-400 text-[11px] mt-0.5">지금 가장 핫한 장소를 확인해보세요</p>
                </section>

                {/* 필터 제거: 바로 게시물 노출 */}

                {/* 피드 — 세로 리스트, 4:3 카드, 랭킹은 3위까지 표시하되 피드는 계속 노출 */}
                {filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-5xl mb-3">local_fire_department</span>
                        <p className="text-sm mb-1">아직 실시간 핫플 게시물이 없어요</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">좋아요가 쌓이거나 최근 게시물이 생기면 이곳에 표시돼요.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 px-4 pb-16">
                        {filteredPosts.map((post) => {
                            const hotCard = buildHotFeedCardProps(post, weatherByRegion);
                            const addressLine = getHotFeedAddressLine(post);
                            const cityDong = getCityDongLine(post);
                            const photoCat = getPhotoCategoryLabel(post);
                            const regionShort = post.region || (post.location || '').trim().split(/\s+/).slice(0, 2).join(' ') || '위치';
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
                            const photoCount = Math.max(1, Math.min(99, (likeCount + commentCount * 2) % 28 + 4));
                            const captionLine = (hotCard?.captionForCard || getPhotoCaptionLine(post) || '').trim();
                            const hotReasonLabel = String(hotCard?.hotReasonLabel || '').trim();
                            const hotReasonIcon = String(hotCard?.hotReasonIcon || 'local_fire_department');
                            const rawTags = [
                                ...(Array.isArray(post.reasonTags) ? post.reasonTags : []),
                                ...(Array.isArray(post.aiHotTags) ? post.aiHotTags : []),
                            ]
                                .map((t) => String(t || '').replace(/#/g, '').replace(/_/g, ' ').trim())
                                .filter(Boolean);
                            const tagsToShow = rawTags.slice(0, 2);
                            const isBookmarked = bookmarkRefresh >= 0 && isPostBookmarked(post.id);
                            const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
                            const weather = post.weather || weatherByRegion[regionKey] || null;
                            const hasWeather = weather && (weather.icon || weather.temperature != null);
                            return (
                                <div
                                    key={post.id}
                                    onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } })}
                                    className="group flex flex-col cursor-pointer overflow-hidden rounded-[14px] border border-slate-100 bg-white shadow-[0_2px_14px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <div
                                        className="relative w-full shrink-0 overflow-hidden bg-[#e5e7eb]"
                                        style={{
                                            aspectRatio: '4/3',
                                            maxHeight: 'min(54vw, 36dvh, 228px)',
                                        }}
                                    >
                                        <div className="absolute left-2 top-2 z-10 inline-flex max-w-[58%] items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold tracking-tight text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                                                local_fire_department
                                            </span>
                                            {getHotBadgeLabel(badgeTick)}
                                        </div>
                                        {hasWeather ? (
                                            <div className="absolute right-2 top-2 z-10 inline-flex max-w-[58%] items-center gap-1 rounded-full bg-[rgba(15,23,42,0.52)] px-2.5 py-1 text-[10px] font-semibold text-[#f8fafc] shadow-md backdrop-blur-[8px]">
                                                {weather.icon ? <span className="text-xs">{weather.icon}</span> : null}
                                                <span className="truncate">
                                                    {weather.temperature != null && weather.temperature !== '-' ? `${weather.temperature}` : ''}
                                                    {weather.condition && weather.condition !== '-' ? ` ${weather.condition}` : ''}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="absolute right-2 top-2 z-10 inline-flex max-w-[58%] items-center gap-0.5 rounded-full bg-[rgba(15,23,42,0.52)] px-2.5 py-1 text-[10px] font-semibold text-[#f8fafc] backdrop-blur-[8px]">
                                                <span className="material-symbols-outlined text-[13px]">location_on</span>
                                                <span className="truncate">{regionShort}</span>
                                            </div>
                                        )}
                                        {post.image ? (
                                            <img src={post.image} alt={post.location || ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                                        ) : (
                                            <div className="flex h-full min-h-[100px] w-full items-center justify-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl">image</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const raw = Array.isArray(post.images)
                                                ? post.images
                                                : post.images
                                                    ? [post.images]
                                                    : post.image
                                                        ? [post.image]
                                                        : post.thumbnail
                                                            ? [post.thumbnail]
                                                            : [];
                                            const thumbs = raw.map((v) => getDisplayImageUrl(v)).filter(Boolean).slice(0, 3);
                                            const showThumbs = thumbs.length > 1;
                                            if (!showThumbs) return null;
                                            return (
                                                <div className="absolute left-2 bottom-2 z-10 flex items-center gap-1.5 rounded-full bg-[rgba(15,23,42,0.38)] px-2 py-1 shadow-sm backdrop-blur-[8px]">
                                                    {thumbs.map((src, i) => (
                                                        <img
                                                            key={`${post.id}-thumb-${i}`}
                                                            src={src}
                                                            alt=""
                                                            className="h-[30px] w-[30px] rounded-[10px] object-cover"
                                                            style={{ border: '1px solid rgba(255,255,255,0.55)' }}
                                                        />
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="shrink-0 px-2 pb-2.5 pt-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-text-main dark:text-white">{addressLine}</h3>
                                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400">
                                                        {cityDong || regionShort}
                                                    </span>
                                                    {photoCat ? (
                                                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-white">{photoCat}</span>
                                                    ) : null}
                                                </div>
                                                {tagsToShow.length > 0 ? (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {tagsToShow.map((t) => (
                                                            <span
                                                                key={`${post.id}-tag-${t}`}
                                                                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700/60 dark:text-slate-100"
                                                            >
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}

                                                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                                    <span className="material-symbols-outlined text-[14px]" aria-hidden>
                                                        {hotReasonIcon}
                                                    </span>
                                                    <span className="truncate">{hotReasonLabel || '지금 주목받는 장소예요'}</span>
                                                </div>
                                                <p className="mt-1 line-clamp-2 break-words text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                                                    {captionLine || '실시간으로 공유된 장소예요.'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="mt-0.5 shrink-0 p-1 text-slate-400 transition-colors hover:text-primary"
                                                onClick={(e) => handleBookmark(e, post)}
                                                aria-label="저장"
                                            >
                                                <span className="material-symbols-outlined text-[22px]" style={isBookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                                                    bookmark
                                                </span>
                                            </button>
                                        </div>
                                        <div className="mt-2 flex shrink-0 items-center justify-end">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
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

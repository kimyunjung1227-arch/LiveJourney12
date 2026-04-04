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
import {
    getHotFeedAddressLine,
    getCityDongLine,
    getPhotoCaptionLine,
    computeHotFeedViewingCount,
    getAvatarUrls,
    getHotCategoryLabel,
    getPhotoCategoryLabels,
} from '../utils/hotPlaceDisplay';
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

            <div ref={contentRef} className="screen-content flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                    <h2 className="m-0 text-[17px] font-bold text-[#111827] dark:text-white">실시간 핫플</h2>
                </div>

                {filteredPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-5xl mb-3">local_fire_department</span>
                        <p className="text-sm mb-1">아직 실시간 핫플 게시물이 없어요</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">좋아요가 쌓이거나 최근 게시물이 생기면 이곳에 표시돼요.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 px-4 pb-20">
                        {filteredPosts.map((post) => {
                            const addressLine = getHotFeedAddressLine(post);
                            const cityDong = getCityDongLine(post);
                            const photoCategoryLabels = getPhotoCategoryLabels(post);
                            const captionLine = getPhotoCaptionLine(post);
                            const engagementTier = getHotCategoryLabel(post);
                            const tagHint = (post.reasonTags && post.reasonTags[0])
                                ? String(post.reasonTags[0]).replace(/#/g, '').replace(/_/g, ' ').trim()
                                : ((Array.isArray(post.aiHotTags) && post.aiHotTags[0])
                                    ? String(post.aiHotTags[0]).replace(/#/g, '').trim()
                                    : '');
                            let whyHotLine = '';
                            if (post._impactLabel) {
                                whyHotLine = post._impactLabel;
                            } else if (engagementTier === '급상승') {
                                whyHotLine = tagHint ? `최근 이 장소에 관심이 급증했어요. ${tagHint}` : '최근 관심이 급증한 실시간 핫플이에요.';
                            } else if (engagementTier === '사람 많음') {
                                whyHotLine = tagHint ? `지금 현장 반응이 뜨거워요. ${tagHint}` : '지금 많은 분들이 몰리는 곳이에요.';
                            } else if (engagementTier === '인기') {
                                whyHotLine = tagHint ? `꾸준히 사랑받는 장소예요. ${tagHint}` : '꾸준히 인기 있는 핫플이에요.';
                            } else {
                                whyHotLine = tagHint ? `실시간으로 올라온 정보예요. ${tagHint}` : '실시간으로 올라온 핫플 정보예요.';
                            }
                            const loc = (post.location || '').trim();
                            const hasUserCaption = !!(post.note || '').trim()
                                || (!!(post.content || '').trim() && (post.content || '').trim() !== (loc ? `${loc}의 모습` : ''));
                            const captionForCard = hasUserCaption ? captionLine : whyHotLine;
                            const hotReasonLabel = engagementTier === '사람 많음' ? '인파 많음' : engagementTier;
                            const hotReasonIcon = (() => {
                                switch (engagementTier) {
                                    case '급상승': return 'trending_up';
                                    case '사람 많음': return 'groups';
                                    case '인기': return 'favorite';
                                    default: return 'bolt';
                                }
                            })();
                            const hotIndicatorBg = '#b91c1c';
                            const regionShort = post.region || (post.location || '').trim().split(/\s+/).slice(0, 2).join(' ') || '위치';
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
                            const photoCount = Math.max(1, Math.min(99, (likeCount + commentCount * 2) % 28 + 4));
                            const viewingCount = computeHotFeedViewingCount(post);
                            const socialLines = [
                                `지금 약 ${viewingCount}명이 이 피드를 보고 있어요`,
                                `좋아요 ${likeCount}개를 받았어요`,
                                `${photoCount}명이 지금 사진 찍는 중이에요`,
                            ];
                            const socialText = socialLines[crowdedSocialIdx % 3];
                            const avatars = getAvatarUrls(post);
                            const liked = isPostLiked(post.id);
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
                                        <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-100px)] items-center gap-1">
                                            <span
                                                className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-[10px] font-extrabold text-white shadow-md"
                                                style={{ background: hotIndicatorBg }}
                                            >
                                                <span className="material-symbols-outlined shrink-0 text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>{hotReasonIcon}</span>
                                                <span className="truncate">{hotReasonLabel}</span>
                                            </span>
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
                                    <div className="shrink-0 px-0.5 pb-2.5 pt-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="line-clamp-2 text-base font-bold leading-snug text-[#111827] dark:text-white">{addressLine}</h3>
                                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                                    <span className="min-w-0 flex-1 truncate text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">
                                                        {cityDong || regionShort}
                                                    </span>
                                                    {photoCategoryLabels.length > 0 ? (
                                                        <div className="flex max-w-[52%] flex-wrap justify-end gap-1">
                                                            {photoCategoryLabels.map((label) => (
                                                                <span
                                                                    key={`${post.id}-pl-${label}`}
                                                                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                                                                    style={{ background: 'rgba(38, 198, 218, 0.95)' }}
                                                                >
                                                                    {label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <p className="mt-2 line-clamp-2 break-words text-xs font-medium leading-relaxed text-[#374151] dark:text-slate-200">
                                                    {captionForCard}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="mt-0.5 shrink-0 border-0 bg-transparent p-1 text-slate-400 hover:text-rose-500"
                                                onClick={(e) => handleHotFeedLike(e, post)}
                                                aria-label="좋아요"
                                            >
                                                <span className="material-symbols-outlined text-[22px]" style={liked ? { fontVariationSettings: '"FILL" 1', color: '#f43f5e' } : undefined}>
                                                    favorite
                                                </span>
                                            </button>
                                        </div>
                                        <div className="mt-2 flex shrink-0 items-center justify-between gap-2">
                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                <div className="flex items-center pl-0.5">
                                                    {avatars.slice(0, 3).map((url, ai) => (
                                                        <img
                                                            key={`${post.id}-av-${ai}`}
                                                            src={url}
                                                            alt=""
                                                            className="h-[26px] w-[26px] flex-shrink-0 rounded-full border-2 border-white object-cover"
                                                            style={{ marginLeft: ai === 0 ? 0 : -9 }}
                                                        />
                                                    ))}
                                                    {avatars.length === 0 ? (
                                                        <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-slate-200 text-[11px]" aria-hidden>
                                                            👤
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <span
                                                    key={`crowded-social-${post.id}-${crowdedSocialIdx}`}
                                                    className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-slate-600 dark:text-slate-300"
                                                >
                                                    {socialText}
                                                </span>
                                            </div>
                                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{post.time ? `${post.time} 업로드` : '최근 업로드'}</span>
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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48 } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { rankHotspotPosts } from '../utils/hotnessEngine';
import { useAuth } from '../contexts/AuthContext';
import { getLikeSnapshot, toggleLikeLocal } from '../utils/postLikesLocal';
import { getMapThumbnailUri } from '../utils/postMedia';
import HotFeedCard from '../components/HotFeedCard';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';
import { buildPlaceStatsMap, selectPostsForPlaceStats, transformPostForHotFeed } from '../utils/hotFeedPostTransform';
import { getWeatherByRegion } from '../api/weather';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const PRIMARY_HEX = '#26C6DA';

const getPostTimeMs = (post) => {
    const raw = post?.timestamp || post?.createdAt || post?.time;
    const t = raw ? new Date(raw).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
};

const getPostCoords = (post) => {
    const c = post?.coordinates;
    if (c && (c.lat != null || c.latitude != null) && (c.lng != null || c.longitude != null)) {
        return { lat: Number(c.lat ?? c.latitude), lng: Number(c.lng ?? c.longitude) };
    }
    if (post?.location && typeof post.location === 'object') {
        const lat = post.location.lat ?? post.location.latitude;
        const lng = post.location.lng ?? post.location.lon ?? post.location.longitude;
        if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
};

const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const R = 6371;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    return R * c;
};

const formatAgo = (ms) => {
    if (!ms) return '';
    const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (diffMin <= 0) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const h = Math.floor(diffMin / 60);
    return `${h}시간 전`;
};

const CrowdedPlaceScreen = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [crowdedData, setCrowdedData] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [crowdedSocialIdx, setCrowdedSocialIdx] = useState(0);
    const contentRef = useRef(null);
    const [userPos, setUserPos] = useState(null);
    const [, setNowTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setCrowdedSocialIdx((i) => (i + 1) % 3), 2800);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNowTick((x) => x + 1), 30000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!navigator?.geolocation) return undefined;
        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (cancelled) return;
                setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {
                /* ignore */
            },
            { enableHighAccuracy: true, maximumAge: 120000, timeout: 6000 }
        );
        return () => {
            cancelled = true;
        };
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
            if (!p || p.weather || p.weatherSnapshot) return;
            const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
            if (!r) return;
            if (weatherByRegion?.[r]) return;
            regions.add(r);
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
    }, [crowdedRegionsKey, weatherByRegion]);

    const handleHotFeedLike = useCallback((e, post) => {
        e.stopPropagation();
        if (!user?.id) {
            alert('로그인 후 좋아요를 누를 수 있어요.');
            return;
        }
        const baseLikes = typeof post.likes === 'number'
            ? post.likes
            : (typeof post.likeCount === 'number' ? post.likeCount : 0);
        const result = toggleLikeLocal(post.id, user.id, baseLikes);
        if (!result) return;
        setCrowdedData((prev) =>
            prev.map((p) => (p && p.id === post.id ? { ...p, likes: result.count, likeCount: result.count } : p))
        );
    }, [user?.id]);

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
            const localPosts = getUploadedPostsSafe();
            const supabasePosts = await fetchPostsSupabase();
            const allPosts = getCombinedPosts(combinePostsSupabaseAndLocal(supabasePosts, localPosts));
            // 메인 실시간 핫플과 동일한 장소 집계 → 좌상단 핫 태그(reasonTags·급상승 등) 일치
            const postsForPlaceStats = selectPostsForPlaceStats(allPosts);
            const placeStats = buildPlaceStatsMap(postsForPlaceStats);
            const posts = filterActivePosts48(allPosts);

            const transformPost = (post) => {
                const base = transformPostForHotFeed(post, placeStats);
                const firstImage = post.images?.[0] || post.image || post.thumbnail || '';
                const firstVideo = post.videos?.[0] || '';
                const coverStill = getMapThumbnailUri(post);
                return {
                    ...base,
                    // 동영상은 재생하지 않고, 가능한 정지 썸네일(이미지/thumbnail/poster)만 사용
                    image: getDisplayImageUrl(coverStill || firstImage || ''),
                    thumbnailIsVideo: !firstImage && !!firstVideo,
                    firstVideoUrl: firstVideo ? getDisplayImageUrl(firstVideo) : null,
                    location: post.location,
                    region: post.region || (post.location || '').trim().split(/\s+/).slice(0, 2).join(' ') || post.location,
                    content: post.note || post.content || `${post.location || '장소'}의 모습`,
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

    const placeRankings = useMemo(() => {
        const now = Date.now();
        const windowMs = 30 * 60 * 1000;
        const groups = new Map();

        (filteredPosts || []).forEach((p) => {
            if (!p) return;
            const key = String(p.location || p.placeName || p.detailedLocation || p.region || '').trim();
            if (!key) return;
            const ts = getPostTimeMs(p) || now;
            const g = groups.get(key) || {
                key,
                posts: [],
                latestMs: 0,
                recent30m: 0,
                trustSum: 0,
                trustN: 0,
            };
            g.posts.push(p);
            if (ts > g.latestMs) g.latestMs = ts;
            if (now - ts <= windowMs) g.recent30m += 1;
            const v = p._verification?.score;
            if (typeof v === 'number' && Number.isFinite(v)) {
                g.trustSum += v;
                g.trustN += 1;
            }
            groups.set(key, g);
        });

        const items = [...groups.values()].map((g) => {
            const ageMin = Math.max(0, (now - (g.latestMs || now)) / 60000);
            const freshness = Math.exp(-ageMin / 22); // 0~1, 최근성 강하게
            const density = Math.min(1.6, (g.recent30m || 0) / 3);
            const trustAvg = g.trustN > 0 ? g.trustSum / g.trustN : 0.6;
            const trustPercent = Math.max(70, Math.min(99, Math.round(trustAvg * 100)));
            const score = freshness * 2.2 + density * 1.2 + trustAvg * 0.6;

            const representative = [...g.posts].sort((a, b) => getPostTimeMs(b) - getPostTimeMs(a))[0] || null;
            const coords = representative ? getPostCoords(representative) : null;
            const distKm = userPos && coords ? haversineKm(userPos, coords) : null;
            const tags = Array.isArray(representative?.reasonTags) ? representative.reasonTags : [];
            const liveTags = tags
                .map((t) => String(t || '').replace(/_/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 3);

            return {
                key: g.key,
                score,
                latestMs: g.latestMs,
                recent30m: g.recent30m,
                trustPercent,
                representative,
                coords,
                distKm,
                liveTags,
            };
        });

        items.sort((a, b) => b.score - a.score);
        return items.slice(0, 30).map((x, idx) => ({ ...x, rank: idx + 1 }));
    }, [filteredPosts, userPos]);

    const lastUpdatedMs = useMemo(() => {
        const ms = Math.max(0, ...placeRankings.map((p) => Number(p.latestMs || 0)));
        return ms || 0;
    }, [placeRankings]);

    // 소셜 문구는 주기적으로 바뀌지만, 카드 props 계산은 무거우므로 데이터가 바뀔 때만 캐시
    const cardPropsById = useMemo(() => {
        const map = new Map();
        filteredPosts.forEach((post) => {
            if (!post?.id) return;
            const cp = buildHotFeedCardProps(post, weatherByRegion);
            if (cp) map.set(String(post.id), cp);
        });
        return map;
    }, [filteredPosts, weatherByRegion]);

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
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    {lastUpdatedMs ? `업데이트 ${formatAgo(lastUpdatedMs)}` : '업데이트 정보를 불러오는 중...'}
                                </div>
                                <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                                    방금 올라온 사진이 있는 곳 위주로 순위가 바뀝니다
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRefreshKey((k) => k + 1)}
                                className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 shadow-sm hover:border-primary/30 hover:text-primary-dark dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                                style={{ borderColor: 'rgba(38,198,218,0.25)' }}
                            >
                                새로고침
                            </button>
                        </div>

                        {placeRankings.length === 0 ? (
                            <div className="py-10 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                아직 실시간 핫플 게시물이 없어요.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {placeRankings.map((place) => {
                                    const post = place.representative;
                                    if (!post?.id) return null;
                                    const img = post.image || getDisplayImageUrl(post.images?.[0] || post.thumbnail || '');
                                    const distText =
                                        typeof place.distKm === 'number'
                                            ? place.distKm < 1
                                                ? `${Math.round(place.distKm * 1000)}m`
                                                : `${place.distKm.toFixed(1)}km`
                                            : null;

                                    const cardProps = cardPropsById.get(String(post.id));
                                    const socialText = cardProps ? getHotFeedSocialLine(cardProps, crowdedSocialIdx) : '';
                                    const liveTag = place.liveTags?.[0] ? String(place.liveTags[0]).replace(/#/g, '').trim() : '';
                                    const liveTagLine = liveTag ? `#${liveTag}` : '';

                                    return (
                                        <button
                                            key={place.key}
                                            type="button"
                                            onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } })}
                                            className="group relative overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                                        >
                                            <div className="relative aspect-[16/10] w-full bg-zinc-100 dark:bg-zinc-800">
                                                {img ? (
                                                    <img src={img} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                                                        사진 없음
                                                    </div>
                                                )}
                                                <div className="absolute left-3 top-3 flex items-center gap-2">
                                                    <div
                                                        className="flex h-9 min-w-9 items-center justify-center rounded-full bg-black/45 px-3 text-[13px] font-extrabold text-white backdrop-blur"
                                                        aria-label={`랭킹 ${place.rank}위`}
                                                    >
                                                        {place.rank}
                                                    </div>
                                                    {liveTagLine ? (
                                                        <div className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-zinc-900 backdrop-blur">
                                                            {liveTagLine}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3">
                                                    <div className="flex items-end justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-[14px] font-extrabold text-white">
                                                                {String(place.key).trim()}
                                                            </div>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/85">
                                                                <span className="rounded-full bg-white/15 px-2 py-0.5">
                                                                    라이브 인증 {place.trustPercent}%
                                                                </span>
                                                                <span className="rounded-full bg-white/15 px-2 py-0.5">
                                                                    {formatAgo(place.latestMs)}
                                                                </span>
                                                                {distText ? (
                                                                    <span className="rounded-full bg-white/15 px-2 py-0.5">
                                                                        {distText}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0">
                                                            <div
                                                                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-zinc-900 shadow-sm"
                                                                style={{ border: `1px solid rgba(38,198,218,0.28)` }}
                                                                aria-hidden
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]" style={{ color: PRIMARY_HEX }}>
                                                                    chevron_right
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {socialText ? (
                                                        <div className="mt-2 line-clamp-1 text-[11px] font-semibold text-white/80">
                                                            {socialText}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </button>
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

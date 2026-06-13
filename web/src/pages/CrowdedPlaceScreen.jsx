import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48 } from '../utils/timeUtils';
import './MainScreen.css';

import { normalizePostsForFeed } from '../utils/postNormalize';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { rankHotspotPlaces } from '../utils/hotnessEngine';
import { useAuth } from '../contexts/AuthContext';
import { toggleLikeForPost } from '../utils/postLikeActions';
import { getMapThumbnailUri } from '../utils/postMedia';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';
import { buildPlaceStatsMap, selectPostsForPlaceStats, transformPostForHotFeed } from '../utils/hotFeedPostTransform';
import { getWeatherByRegion } from '../api/weather';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import { generatePlaceAiBlurb } from '../utils/placeAiBlurb';
import { useLoginGate } from '../hooks/useLoginGate';
import { fetchPlaceDescription } from '../api/placeDescription';
import { normalizePlaceIdentityKey } from '../utils/placeKeyNormalize';
import { toHotplaceDescPreview } from '../utils/hotplaceDescPreview';
import { SCREEN_GRID_EAGER_COUNT, SCREEN_IMAGE_HIGH_PRIORITY_COUNT } from '../utils/imgAttrs';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { distanceKmBetween } from '../utils/geoDistance';

const PRIMARY_HEX = '#26C6DA';

/** 실시간 핫플 탭(/crowded-place) 랭킹 목록 최대 개수. 장소별 피드(/hotplace/...)는 변경하지 않음 */
const CROWDED_PLACE_FEED_RANK_LIMIT = 30;

/** 지역 필터 — GPS 기준 반경(km). 동네는 같은 생활권, 지역은 같은 광역시·시 수준 */
const REGION_SCOPE_KM = {
    neighborhood: 3,
    region: 20,
};
const REGION_SCOPE_LABEL = {
    national: '전국',
    region: '지역',
    neighborhood: '동네',
};
const REGION_SCOPE_OPTIONS = [
    { id: 'national', label: '전국', hint: '전국 모든 핫플', icon: 'public' },
    { id: 'region', label: '지역', hint: '내 위치 반경 20km', icon: 'travel_explore' },
    { id: 'neighborhood', label: '동네', hint: '내 위치 반경 3km', icon: 'my_location' },
];

const getScopeIcon = (id) =>
    REGION_SCOPE_OPTIONS.find((o) => o.id === id)?.icon || 'place';

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
    const km = distanceKmBetween(a, b);
    return Number.isFinite(km) ? km : null;
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
    const requireLogin = useLoginGate();
    const [crowdedData, setCrowdedData] = useState([]);
    const [allHotPosts, setAllHotPosts] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [crowdedSocialIdx, setCrowdedSocialIdx] = useState(0);
    const contentRef = useRef(null);
    const [userPos, setUserPos] = useState(null);
    const [, setNowTick] = useState(0);
    const [placeDescMap, setPlaceDescMap] = useState({});
    const [regionScope, setRegionScope] = useState('national');
    const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
    const scopeMenuWrapRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setCrowdedSocialIdx((i) => (i + 1) % 3), 2800);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNowTick((x) => x + 1), 30000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!scopeMenuOpen) return undefined;
        const onDown = (e) => {
            if (!scopeMenuWrapRef.current) return;
            if (!scopeMenuWrapRef.current.contains(e.target)) setScopeMenuOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('touchstart', onDown);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
        };
    }, [scopeMenuOpen]);

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

    const handleHotFeedLike = useCallback(async (e, post) => {
        e.stopPropagation();
        if (!requireLogin('좋아요')) return;
        const prevLiked = !!post.likedByMe;
        const prevCount = Math.max(0, Number(post.likes ?? post.likeCount ?? 0) || 0);
        const optimisticLiked = !prevLiked;
        const optimisticCount = Math.max(0, prevCount + (optimisticLiked ? 1 : -1));

        setCrowdedData((prev) =>
            prev.map((p) =>
                p && p.id === post.id
                    ? { ...p, likes: optimisticCount, likeCount: optimisticCount, likedByMe: optimisticLiked }
                    : p
            )
        );

        const serverRes = await toggleLikeForPost({ postId: post.id, userId: user.id, likedBefore: prevLiked });
        if (serverRes?.success) {
            const finalLiked = !!serverRes.isLiked;
            const finalCount = typeof serverRes.likesCount === 'number' ? serverRes.likesCount : optimisticCount;
            setCrowdedData((prev) =>
                prev.map((p) =>
                    p && p.id === post.id
                        ? { ...p, likes: finalCount, likeCount: finalCount, likedByMe: finalLiked }
                        : p
                )
            );
            return;
        }

        // 롤백
        setCrowdedData((prev) =>
            prev.map((p) =>
                p && p.id === post.id
                    ? { ...p, likes: prevCount, likeCount: prevCount, likedByMe: prevLiked }
                    : p
            )
        );
        if (serverRes?.reason && serverRes.reason !== 'non_uuid') {
            alert(serverRes.reason === 'no_session' ? '로그인 세션이 없어요. 다시 로그인 후 시도해 주세요.' : '좋아요 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
    }, [user?.id, requireLogin]);

    useEffect(() => {
        const handler = () => setRefreshKey((k) => k + 1);
        window.addEventListener('adminDeletedPost', handler);
        return () => window.removeEventListener('adminDeletedPost', handler);
    }, []);

    useEffect(() => {
        const onLike = (e) => {
            const { postId, likesCount, isLiked } = e.detail || {};
            if (!postId) return;
            const id = String(postId);
            setCrowdedData((prev) =>
                prev.map((p) => {
                    if (!p || String(p.id) !== id) return p;
                    const next = { ...p };
                    if (typeof likesCount === 'number') {
                        next.likes = likesCount;
                        next.likeCount = likesCount;
                    }
                    if (typeof isLiked === 'boolean') {
                        next.likedByMe = isLiked;
                    }
                    return next;
                })
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
            const supabasePosts = await fetchPostsSupabase(user?.id || null);
            const allPosts = normalizePostsForFeed(combinePostsSupabaseAndLocal(supabasePosts, localPosts));
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
            setAllHotPosts(transformed);
            const preFiltered = transformed.filter((p) => {
                const hasLikes = (p.likes || 0) > 0;
                const isRecent = p.time && (p.time.includes('방금') || p.time.includes('분 전') || p.time.includes('시간 전'));
                return hasLikes || isRecent;
            });
            const toRank = preFiltered.length > 0 ? preFiltered : transformed;
            const rankedPlaces = rankHotspotPlaces(toRank, { verifyFirst: true, maxItems: CROWDED_PLACE_FEED_RANK_LIMIT });
            const repPosts = rankedPlaces
                .filter((p) => p?.representative?.id)
                .map((p) => ({
                    ...p.representative,
                    _rank: p.rank,
                    _compassCount: p.compassCount,
                    _placeKey: p.key,
                }));
            setCrowdedData(repPosts.length > 0 ? repPosts : transformed.slice(0, CROWDED_PLACE_FEED_RANK_LIMIT));
        };
        loadData();
    }, [refreshKey, user?.id]);

    const filteredPosts = crowdedData;

    const placeRankings = useMemo(() => {
        const ranked = rankHotspotPlaces(allHotPosts, { verifyFirst: true, maxItems: CROWDED_PLACE_FEED_RANK_LIMIT });
        return ranked.map((x) => {
            const representative = x.representative;
            const coords = representative ? getPostCoords(representative) : null;
            const distKm = userPos && coords ? haversineKm(userPos, coords) : null;
            const tags = Array.isArray(representative?.reasonTags) ? representative.reasonTags : [];
            const liveTags = tags
                .map((t) => String(t || '').replace(/_/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 3);
            return {
                key: x.key,
                score: x.score,
                latestMs: x.latestMs,
                trustPercent: x.trustPercent,
                representative,
                coords,
                distKm,
                liveTags,
                rank: x.rank,
                compassCount: x.compassCount,
                warning: x.warning,
            };
        });
    }, [allHotPosts, userPos]);

    /**
     * 전국/지역/동네 필터 — GPS 좌표가 없거나 좌표 미상인 장소는 전국에서만 보임.
     * scope 내에서 1, 2, 3 ... 으로 재랭킹해서 "동네 1위 / 지역 1위 / 전국 1위"가
     * 사용자 위치 기반으로 다르게 보이도록 한다.
     */
    const scopedPlaceRankings = useMemo(() => {
        const reRank = (list) => list.map((p, i) => ({ ...p, scopedRank: i + 1 }));
        if (regionScope === 'national') return reRank(placeRankings);
        if (!userPos) return reRank(placeRankings); // GPS 미확보 시 전국으로 폴백
        const maxKm = REGION_SCOPE_KM[regionScope];
        if (!Number.isFinite(maxKm) || maxKm <= 0) return reRank(placeRankings);
        const filtered = placeRankings.filter((p) => Number.isFinite(p?.distKm) && p.distKm <= maxKm);
        // 이미 점수 내림차순으로 정렬되어 있으나 안전하게 한 번 더 정렬한 뒤 재랭킹
        const sorted = [...filtered].sort((a, b) => (b?.score || 0) - (a?.score || 0));
        return reRank(sorted);
    }, [placeRankings, regionScope, userPos]);

    const scopeBlocked = (regionScope === 'region' || regionScope === 'neighborhood') && !userPos;

    // 메인 화면과 동일한 Edge Function 기반 장소 설명을 더보기에서도 사용
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const top = Array.isArray(placeRankings) ? placeRankings.slice(0, 16) : [];
            if (top.length === 0) return;
            const entries = await Promise.all(
                top.map(async (place) => {
                    const key = String(place?.key || '').trim();
                    if (!key) return null;
                    // 이미 있으면 스킵
                    if (placeDescMap && placeDescMap[key]) return null;
                    const post = place.representative;
                    const tags = Array.isArray(place.liveTags) ? place.liveTags.map((t) => String(t || '').replace(/[#_]/g, ' ').trim()).filter(Boolean).slice(0, 6) : [];
                    const regionHint = String(post?.region || post?.location || '').trim();
                    const norm = normalizePlaceIdentityKey(key);
                    const desc = await fetchPlaceDescription({
                        placeKey: key,
                        regionHint,
                        tier: '',
                        tags,
                        userCaptions: [],
                        cacheSalt: norm,
                    });
                    const normalized = toHotplaceDescPreview(desc, { maxChars: 96, maxSentences: 3 });
                    return normalized ? [key, normalized] : null;
                })
            );

            const next = {};
            entries.forEach((e) => {
                if (!e) return;
                const [k, v] = e;
                if (k && v) next[k] = v;
            });
            if (!cancelled && Object.keys(next).length > 0) {
                setPlaceDescMap((prev) => ({ ...(prev || {}), ...next }));
            }
        };

        run();
        return () => {
            cancelled = true;
        };
        // placeDescMap은 의도적으로 deps에서 제외 (무한 루프 방지)
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <PageSeo {...PAGE_SEO.crowdedPlace} />
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border-light bg-background-light px-3 dark:border-border-dark dark:bg-background-dark">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    aria-label="뒤로가기"
                    className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-text-primary-light hover:bg-black/5 dark:text-text-primary-dark dark:hover:bg-white/10"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="pointer-events-none absolute left-1/2 top-1/2 w-[min(70%,260px)] -translate-x-1/2 -translate-y-1/2 truncate text-center text-[17px] font-bold leading-snug text-text-primary-light dark:text-text-primary-dark">
                    실시간 급상승 핫플
                </h1>
                <div ref={scopeMenuWrapRef} className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
                    <button
                        type="button"
                        onClick={() => setScopeMenuOpen((o) => !o)}
                        aria-haspopup="listbox"
                        aria-expanded={scopeMenuOpen}
                        className="flex h-10 items-center gap-1 bg-transparent px-1 text-[13px] font-bold text-zinc-800 hover:opacity-80 dark:text-zinc-100"
                    >
                        <span className="material-symbols-outlined text-[18px]" style={{ color: PRIMARY_HEX }}>
                            {getScopeIcon(regionScope)}
                        </span>
                        <span>{REGION_SCOPE_LABEL[regionScope]}</span>
                        <span className="material-symbols-outlined text-[18px] text-zinc-500">
                            {scopeMenuOpen ? 'expand_less' : 'expand_more'}
                        </span>
                    </button>
                    {scopeMenuOpen ? (
                        <div
                            role="listbox"
                            className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                            style={{ borderRadius: 0 }}
                        >
                            {REGION_SCOPE_OPTIONS.map((opt) => {
                                const isActive = opt.id === regionScope;
                                const willNeedGps = (opt.id === 'region' || opt.id === 'neighborhood') && !userPos;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        onClick={() => {
                                            setRegionScope(opt.id);
                                            setScopeMenuOpen(false);
                                        }}
                                        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] font-semibold transition ${
                                            isActive
                                                ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-200'
                                                : 'text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined mt-[2px] text-[18px]" style={{ color: isActive ? PRIMARY_HEX : '#94a3b8' }}>
                                            {opt.icon}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block leading-tight">{opt.label}</span>
                                            <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                                {willNeedGps ? `${opt.hint} · 위치 권한 필요` : opt.hint}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            </header>

            <div ref={contentRef} className="screen-content flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
                <div className="min-h-full px-3 pb-16 pt-1.5 sm:px-4">
                    {scopeBlocked ? (
                        <div className="mb-2 mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
                            위치 권한이 없어 "전국" 결과로 표시 중이에요. 지역·동네 필터를 쓰려면 브라우저 위치 권한을 허용해 주세요.
                        </div>
                    ) : null}
                    <div className="pb-5">
                        {scopedPlaceRankings.length === 0 ? (
                            <div className="py-10 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                {placeRankings.length === 0
                                    ? '아직 실시간 핫플 게시물이 없어요.'
                                    : regionScope === 'neighborhood'
                                        ? '내 동네(3km 이내)에는 아직 핫플이 없어요. "지역" 또는 "전국"으로 바꿔 보세요.'
                                        : regionScope === 'region'
                                            ? '내 지역(20km 이내)에는 아직 핫플이 없어요. "전국"으로 바꿔 보세요.'
                                            : '아직 실시간 핫플 게시물이 없어요.'}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {scopedPlaceRankings.map((place, placeIndex) => {
                                    const post = place.representative;
                                    if (!post?.id) return null;
                                    const rawCover = post.image || post.images?.[0] || post.thumbnail || '';
                                    const img = rawCover ? getDisplayImageUrl(rawCover) : '';
                                    const eagerLoad = placeIndex < SCREEN_GRID_EAGER_COUNT;
                                    const rawThumbs = Array.isArray(post.images)
                                        ? post.images
                                        : post.images
                                            ? [post.images]
                                            : post.image
                                                ? [post.image]
                                                : post.thumbnail
                                                    ? [post.thumbnail]
                                                    : [];
                                    const thumbs = rawThumbs.map((v) => getDisplayImageUrl(v)).filter(Boolean).slice(0, 3);

                                    const cardProps = cardPropsById.get(String(post.id));
                                    const socialText = cardProps ? getHotFeedSocialLine(cardProps, crowdedSocialIdx) : '';
                                    const tempText = (() => {
                                        const w = cardProps?.weather;
                                        const raw = w?.temperature ?? w?.temp ?? '';
                                        const s = String(raw || '').trim();
                                        if (!s || s === '-') return '';
                                        return s.includes('°') ? s : `${s}°C`;
                                    })();
                                    const uploadLabel =
                                        (cardProps?.uploadTimeLabel && String(cardProps.uploadTimeLabel).trim()) ||
                                        formatAgo(getPostTimeMs(post)) ||
                                        formatAgo(place.latestMs) ||
                                        '';
                                    const hasWeatherPill = Boolean(tempText || (cardProps?.weather?.icon && String(cardProps.weather.icon).trim()));
                                    const hotTagChips = (Array.isArray(place.liveTags) ? place.liveTags : [])
                                        .map((t) => {
                                            const raw = String(t || '')
                                                .replace(/#/g, '')
                                                .trim();
                                            if (!raw) return '';
                                            return raw.startsWith('#') ? raw : `#${raw}`;
                                        })
                                        .filter(Boolean)
                                        .slice(0, 1);
                                    const placeKey = String(place.key || '').trim();
                                    const aiDesc = placeKey ? String(placeDescMap?.[placeKey] || '').trim() : '';
                                    // 3줄(12px·풀폭) 안에서 "…" 없이 완결된 문장으로 끝나도록 정제 (설명/폴백 공통)
                                    const aiBlurb = toHotplaceDescPreview(
                                        aiDesc || generatePlaceAiBlurb(place.key, {
                                            tags: hotTagChips,
                                            cityDong: place.cityDong || '',
                                            tier: cardProps?.hotReasonLabel || '',
                                        }),
                                        { maxChars: 72, maxSentences: 3 }
                                    );

                                    const goToHotplaceDetail = () => {
                                        const pk = String(place.key || '').trim();
                                        if (!pk) {
                                            navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } });
                                            return;
                                        }
                                        navigate(`/hotplace/${encodeURIComponent(pk)}`, {
                                            state: {
                                                placeKey: pk,
                                                allPosts: allHotPosts,
                                            },
                                        });
                                    };

                                    return (
                                        <button
                                            key={place.key}
                                            type="button"
                                            onClick={goToHotplaceDetail}
                                            className="group relative w-full overflow-hidden rounded-sm border border-zinc-100 bg-white text-left shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                                        >
                                            <div className="relative h-[min(56vw,220px)] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800 sm:h-[240px]">
                                                {img ? (
                                                    <img
                                                        src={img}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                        loading={eagerLoad ? 'eager' : 'lazy'}
                                                        decoding="async"
                                                        fetchPriority={placeIndex < SCREEN_IMAGE_HIGH_PRIORITY_COUNT ? 'high' : 'auto'}
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                                                        사진 없음
                                                    </div>
                                                )}

                                                {/* 우측 하단: 가벼운 사진 미리보기 */}
                                                {thumbs.length > 1 ? (
                                                    <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5">
                                                        {thumbs.map((src, i) => (
                                                            <div
                                                                key={`${post.id}-mini-${i}`}
                                                                className="h-[30px] w-[30px] overflow-hidden rounded-sm border border-white/60 bg-white/10 shadow-sm backdrop-blur-[6px]"
                                                            >
                                                                <img
                                                                    src={src}
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                    loading={eagerLoad ? 'eager' : 'lazy'}
                                                                    decoding="async"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                {(() => {
                                                    const displayRank = Number.isFinite(place?.scopedRank) ? place.scopedRank : place.rank;
                                                    if (!displayRank || displayRank > 20) return null;
                                                    return (
                                                        <div
                                                            className="pointer-events-none absolute left-2.5 top-2.5 select-none"
                                                            aria-label={`${displayRank}위`}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: 9999,
                                                                background: 'rgba(15, 23, 42, 0.62)',
                                                                backdropFilter: 'blur(10px)',
                                                                WebkitBackdropFilter: 'blur(10px)',
                                                                border: '1px solid rgba(255,255,255,0.32)',
                                                                boxShadow: '0 10px 28px rgba(15, 23, 42, 0.28)',
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    display: 'inline-block',
                                                                    fontSize: 13,
                                                                    fontWeight: 950,
                                                                    letterSpacing: -0.2,
                                                                    color: '#ffffff',
                                                                    textShadow: '0 2px 12px rgba(0,0,0,0.45)',
                                                                    lineHeight: 1,
                                                                }}
                                                            >
                                                                {displayRank}위
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="px-2.5 pb-2 pt-1.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="truncate text-[15px] font-bold leading-snug text-zinc-900 dark:text-zinc-50">
                                                            {String(place.key).trim()}
                                                        </h4>
                                                        {aiBlurb ? (
                                                            <p className="mt-0.5 line-clamp-3 text-[12px] font-normal leading-snug text-zinc-700 dark:text-zinc-300">
                                                                {aiBlurb}
                                                            </p>
                                                        ) : null}
                                                        {((place.scopedRank ?? place.rank) <= 20 && hotTagChips.length > 0) || hasWeatherPill || uploadLabel ? (
                                                            <div className="mt-1.5 flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-2">
                                                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                                                    {(place.scopedRank ?? place.rank) <= 20 &&
                                                                        hotTagChips.map((tag) => (
                                                                            <span
                                                                                key={`${place.key}-${tag}`}
                                                                                className="max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-extrabold text-slate-900 dark:text-slate-100"
                                                                                style={{
                                                                                    background: 'rgba(38, 198, 218, 0.14)',
                                                                                    borderColor: 'rgba(38, 198, 218, 0.30)',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 4,
                                                                                }}
                                                                                title={tag}
                                                                            >
                                                                                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 14, fontVariationSettings: '"FILL" 1' }}>
                                                                                    local_fire_department
                                                                                </span>
                                                                                {tag}
                                                                            </span>
                                                                        ))}
                                                                </div>
                                                                <div className="flex max-w-[48%] shrink-0 flex-row flex-wrap items-center justify-end gap-1.5">
                                                                    {hasWeatherPill ? (
                                                                        <span
                                                                            className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                                                            title="기온"
                                                                        >
                                                                            {cardProps?.weather?.icon ? (
                                                                                <span className="shrink-0">{cardProps.weather.icon}</span>
                                                                            ) : null}
                                                                            {tempText ? <span className="whitespace-nowrap">{tempText}</span> : null}
                                                                            {cardProps?.weather?.condition &&
                                                                            cardProps.weather.condition !== '-' ? (
                                                                                <span className="hidden truncate sm:inline">
                                                                                    {` ${cardProps.weather.condition}`}
                                                                                </span>
                                                                            ) : null}
                                                                        </span>
                                                                    ) : null}
                                                                    {uploadLabel ? (
                                                                        <span className="whitespace-nowrap text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                                                                            {uploadLabel}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                        {place.warning ? (
                                                            <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                                                {place.warning}
                                                            </p>
                                                        ) : null}
                                                        {socialText ? (
                                                            <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-500">
                                                                {socialText}
                                                            </p>
                                                        ) : null}
                                                    </div>
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

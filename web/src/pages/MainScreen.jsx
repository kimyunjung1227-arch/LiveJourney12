
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getUnreadCount } from '../utils/notifications';
import { getTimeAgo, filterActivePosts48 } from '../utils/timeUtils';
import { logger } from '../utils/logger';
import { getRecommendedRegions, getRecommendationTypesForUi } from '../utils/recommendationEngine';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import './MainScreen.css';
import { getCombinedPosts } from '../utils/mockData';
import { fetchPostsSupabase, fetchQuestionPostsSupabase } from '../api/postsSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri } from '../utils/postMedia';
import { getPostAccuracyCount } from '../utils/socialInteractions';
import { rankHotspotPlaces } from '../utils/hotnessEngine';
import { getWeatherByRegion } from '../api/weather';
import { listPublishedMagazines } from '../utils/magazinesStore';
import HotFeedCard from '../components/HotFeedCard';
import FastImage from '../components/FastImage';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';
import { buildPlaceStatsMap, selectPostsForPlaceStats, transformPostForHotFeed } from '../utils/hotFeedPostTransform';
import { useAuth } from '../contexts/AuthContext';
import { useExifConsent } from '../contexts/ExifConsentContext';
import ExifConsentSheet from '../components/ExifConsentSheet';
import StatusBadge from '../components/StatusBadge';
import { getPhotoStatusFromPost } from '../utils/photoStatus';
import { toggleLikeForPost } from '../utils/postLikeActions';
import { fetchRafflesForUi } from '../api/rafflesSupabase';
import { generatePlaceAiBlurb } from '../utils/placeAiBlurb';
import { getValidWeatherSnapshot } from '../utils/weatherSnapshot';
import { useLoginGate } from '../hooks/useLoginGate';
import { fetchPlaceDescription } from '../api/placeDescription';
import { normalizePlaceIdentityKey } from '../utils/placeKeyNormalize';
import {
    loadMainFeedSnapshotLast,
    saveMainFeedSnapshotLast,
    preloadMainFeedImageUrls,
    MAIN_FEED_IMAGE_OPTS,
} from '../utils/mainFeedSnapshot';

const MainScreen = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, authLoading } = useAuth();
    const { consentResolved, consentLoading, grantExifConsent, declineExifConsent } = useExifConsent();
    const requireLogin = useLoginGate();
    const [selectedTag, setSelectedTag] = useState(null);
    const [popularTags, setPopularTags] = useState([]);

    const [realtimeData, setRealtimeData] = useState([]);
    const [crowdedData, setCrowdedData] = useState([]);
    const [recommendedData, setRecommendedData] = useState([]);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [allPostsForRecommend, setAllPostsForRecommend] = useState([]);
    const [publishedMagazines, setPublishedMagazines] = useState([]);
    const [askSituationPreview, setAskSituationPreview] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [hotFeedVideoPoster, setHotFeedVideoPoster] = useState(null);
    const [selectedRecommendTag, setSelectedRecommendTag] = useState('season_peak');
    const [recommendationTypesUi, setRecommendationTypesUi] = useState(() => getRecommendationTypesForUi());
    const [hotFeedSlideIndex, setHotFeedSlideIndex] = useState(0);
    const [hotFeedSocialIdx, setHotFeedSocialIdx] = useState(0);
    const [hasOngoingRaffle, setHasOngoingRaffle] = useState(false);
    const [hotplaceAiDescription, setHotplaceAiDescription] = useState('');
    const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
    /** 새로고침 직후 세션 스냅샷으로 이미지 URL을 먼저 채워 두었는지 */
    const hydratedFromSessionRef = useRef(false);
    const videoRefs = useRef(new Map());
    const currentlyPlayingVideo = useRef(null);
    const withDragCheck = useCallback((fn) => () => {
        if (!hasMovedRef.current) fn();
    }, [hasMovedRef]);

    // Intersection Observer로 화면에 보이는 동영상만 재생
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const video = entry.target;

                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        // 이전에 재생 중이던 비디오가 있으면 일시정지
                        if (currentlyPlayingVideo.current && currentlyPlayingVideo.current !== video) {
                            const prevVideo = currentlyPlayingVideo.current;
                            if (prevVideo && !prevVideo.paused) {
                                prevVideo.pause();
                            }
                        }
                        // 현재 비디오 재생
                        if (video && video.paused) {
                            video.play().catch(() => {
                                // 자동 재생이 차단된 경우 무시
                            });
                            currentlyPlayingVideo.current = video;
                        }
                    } else {
                        // 화면에서 벗어나면 일시정지
                        if (video && !video.paused) {
                            video.pause();
                        }
                        if (currentlyPlayingVideo.current === video) {
                            currentlyPlayingVideo.current = null;
                        }
                    }
                });
            },
            {
                threshold: [0, 0.5, 1],
                rootMargin: '0px',
            }
        );

        // 모든 비디오 요소 관찰
        const videos = Array.from(videoRefs.current.values()).filter(Boolean);
        videos.forEach((video) => {
            observer.observe(video);
        });

        return () => {
            videos.forEach((video) => {
                observer.unobserve(video);
            });
            observer.disconnect();
        };
    }, [realtimeData, crowdedData, recommendedData]);

    const loadMockData = useCallback(async () => {
        // Supabase에서 실제 게시물 불러오기 (실패 시 빈 배열)
        // 로그인 사용자의 좋아요 상태(post.likedByMe)를 서버에서 함께 내려받는다.
        const supabasePosts = await fetchPostsSupabase(user?.id || null);

        const allPosts = getCombinedPosts(supabasePosts);

        // 메인 피드 기준(24h 우선·부족 시 72h 보강) + 장소별 집계 → 실시간 핫플 좌상단 태그와 공유
        const posts = selectPostsForPlaceStats(allPosts);
        const placeStats = buildPlaceStatsMap(posts);
        const transformPost = (post) => transformPostForHotFeed(post, placeStats);
        const transformedAll = posts.map(transformPost);

        // "지금 여기는": 최신순 정렬 후 상위 20개
        const byLatest = [...transformedAll].sort((a, b) => {
            const tA = a.timestamp || a.createdAt || a.time || 0;
            const tB = b.timestamp || b.createdAt || b.time || 0;
            const dateA = typeof tA === 'number' ? tA : new Date(tA).getTime();
            const dateB = typeof tB === 'number' ? tB : new Date(tB).getTime();
            return dateB - dateA;
        });
        setRealtimeData(byLatest.slice(0, 20));

        // "실시간 핫플": 더보기(/crowded-place)와 동일하게 48h + 핫니스 랭킹
        const posts48 = filterActivePosts48(allPosts);
        const transformed48 = posts48.map(transformPost);
        const preFiltered = transformed48.filter((p) => {
            const hasLikes = (p.likes || 0) > 0;
            const isRecent = p.time && (p.time.includes('방금') || p.time.includes('분 전') || p.time.includes('시간 전'));
            return hasLikes || isRecent;
        });
        const toRank = preFiltered.length > 0 ? preFiltered : transformed48;
        const rankedPlaces = rankHotspotPlaces(toRank, { verifyFirst: true, maxItems: 50 });
        const crowdedRanked = rankedPlaces
            .filter((p) => p?.representative?.id)
            .map((p) => ({
                ...p.representative,
                _rank: p.rank,
                _impactLabel: p.warning || `컴퍼스 ${p.compassCount}명 동시 중계 중`,
                _compassCount: p.compassCount,
                _placeKey: p.key,
                accuracyCount: getPostAccuracyCount(p.representative.id),
            }));
        const crowdedFallback = transformed48.slice(0, 50).map((p) => ({
            ...p,
            accuracyCount: getPostAccuracyCount(p.id),
        }));
        const crowdedFinal = crowdedRanked.length > 0 ? crowdedRanked : crowdedFallback;
        setCrowdedData(crowdedFinal);

        // 추천 여행지: 현재는 Supabase/로컬에서 집계한 posts 기반으로 계산
        const recs = getRecommendedRegions(allPosts, selectedRecommendTag);
        const recommendedSlice = recs.slice(0, 10);
        setRecommendedData(recommendedSlice);
        setAllPostsForRecommend(allPosts);

        const realtimeSlice = byLatest.slice(0, 20);
        saveMainFeedSnapshotLast({
            realtimeData: realtimeSlice,
            crowdedData: crowdedFinal,
            recommendedData: recommendedSlice,
            allPostsForRecommend: allPosts,
        });
    }, [user?.id]);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            await loadMockData();
        } catch (err) {
            logger.error('메인 피드 로딩 중 오류 (fallback로 계속 진행):', err);
        } finally {
            setLoading(false);
        }
    }, [loadMockData]);

    // 메인: 현지 상황 질문(텍스트) 미리보기 최대 2개
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const rows = await fetchQuestionPostsSupabase({ limit: 2, currentUserId: user?.id || null });
            if (!cancelled) setAskSituationPreview(Array.isArray(rows) ? rows : []);
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            const mags = await listPublishedMagazines();
            if (alive) setPublishedMagazines(Array.isArray(mags) ? mags : []);
        };
        load();
        const onUpdated = () => load();
        window.addEventListener('magazinesUpdated', onUpdated);
        return () => {
            alive = false;
            window.removeEventListener('magazinesUpdated', onUpdated);
        };
    }, []);

    const magazineCards = useMemo(() => {
        if (!Array.isArray(publishedMagazines) || publishedMagazines.length === 0) return [];
        const posts = Array.isArray(allPostsForRecommend) ? allPostsForRecommend : [];
        const byRecency = (a, b) => {
            const now = Date.now();
            const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
            const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
            return tb - ta;
        };
        // 매거진별 cover 선택은 posts 전체 스캔을 반복하지 않도록,
        // "필요한 location 후보들"에 대해서만 1회 패스에서 best cover를 뽑는다.
        const locCandidates = publishedMagazines
            .map((m) => {
                const firstSection = Array.isArray(m?.sections) ? m.sections[0] : null;
                return String(firstSection?.location || m?.title || '').trim();
            })
            .filter(Boolean);
        const uniqueLocs = Array.from(new Set(locCandidates));
        const locLower = uniqueLocs.map((x) => x.toLowerCase());
        const coverByLocLower = new Map(locLower.map((l) => [l, { ts: -1, raw: '' }]));

        const hasMedia = (p) =>
            (Array.isArray(p?.images) && p.images.length > 0) ||
            (Array.isArray(p?.videos) && p.videos.length > 0) ||
            p?.image ||
            p?.thumbnail;
        posts.forEach((p) => {
            if (!hasMedia(p)) return;
            const loc = String(p?.location || '').toLowerCase();
            const place = String(p?.placeName || '').toLowerCase();
            const detailed = String(p?.detailedLocation || '').toLowerCase();
            const hay = `${loc}\n${place}\n${detailed}`;
            const ts = new Date(p?.timestamp || p?.createdAt || Date.now()).getTime();
            for (const l of locLower) {
                if (!l) continue;
                if (!hay.includes(l)) continue;
                const prev = coverByLocLower.get(l);
                if (!prev || ts > prev.ts) {
                    const raw = p?.images?.[0] || p?.image || p?.thumbnail || '';
                    coverByLocLower.set(l, { ts, raw: raw || '' });
                }
            }
        });

        const pickCoverByLocation = (locationText) => {
            const key = String(locationText || '').trim();
            if (!key) return '';
            const entry = coverByLocLower.get(key.toLowerCase());
            const raw = entry?.raw || '';
            return raw ? getDisplayImageUrl(raw, MAIN_FEED_IMAGE_OPTS) : '';
        };
        return publishedMagazines
            .map((m) => {
                const firstSection = Array.isArray(m?.sections) ? m.sections[0] : null;
                const loc = String(firstSection?.location || m?.title || '').trim();
                const cover = pickCoverByLocation(loc);
                return { magazine: m, cover };
            })
            .sort((a, b) => {
                const ta = new Date(a?.magazine?.createdAt || a?.magazine?.created_at || 0).getTime();
                const tb = new Date(b?.magazine?.createdAt || b?.magazine?.created_at || 0).getTime();
                return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
            })
            .slice(0, 6);
    }, [publishedMagazines, allPostsForRecommend]);

    const crowdedIdsKey = useMemo(() => crowdedData.map((p) => String(p.id)).join(','), [crowdedData]);

    const hotFeedPost = useMemo(() => {
        if (!crowdedData.length) return null;
        const i = hotFeedSlideIndex % crowdedData.length;
        return crowdedData[i];
    }, [crowdedData, hotFeedSlideIndex]);

    // 추천 여행지(가로 카드): 카드마다 allPostsForRecommend.filter/sort를 반복하지 않도록 한번만 인덱싱
    const recommendedPlaceBundle = useMemo(() => {
        const items = Array.isArray(recommendedData) ? recommendedData : [];
        const posts = Array.isArray(allPostsForRecommend) ? allPostsForRecommend : [];
        const keys = items
            .map((it) => String(it?.placeName || it?.title || it?.regionName || '').trim())
            .filter(Boolean);
        const uniqueKeys = Array.from(new Set(keys));

        const byKey = new Map();
        uniqueKeys.forEach((k) => byKey.set(k, { placePosts: [], feedPosts: [], mainSrc: '', topImages: [] }));

        if (uniqueKeys.length === 0) return byKey;

        // posts를 1회만 순회: post마다 문자열 조합 1회 생성 후 key들과 매칭
        const keyLower = uniqueKeys.map((k) => k.toLowerCase());
        const keyByLower = new Map(keyLower.map((kl, i) => [kl, uniqueKeys[i]]));

        if (posts.length > 0) {
            posts.forEach((p) => {
                const loc = String(p?.location || '');
                const place = String(p?.placeName || '');
                const detailed = String(p?.detailedLocation || '');
                const hayLower = `${loc}\n${place}\n${detailed}`.toLowerCase();

                for (const kl of keyLower) {
                    const k = keyByLower.get(kl);
                    if (!k) continue;
                    if (loc === k || place === k || detailed === k || hayLower.includes(kl)) {
                        const bucket = byKey.get(k);
                        if (bucket) bucket.placePosts.push(p);
                    }
                }
            });
        }

        // key별 feedPosts 정렬 1회
        for (const [, bucket] of byKey.entries()) {
            bucket.feedPosts = [...bucket.placePosts].sort((a, b) => {
                const ta = new Date(a.timestamp || a.createdAt || a.photoDate || 0).getTime();
                const tb = new Date(b.timestamp || b.createdAt || b.photoDate || 0).getTime();
                return tb - ta;
            });
        }

        // 대표 이미지 1회 계산 (기존 우선순위 유지)
        items.forEach((it) => {
            const placeKey = String(it?.placeName || it?.title || it?.regionName || '').trim();
            if (!placeKey) return;
            const bucket = byKey.get(placeKey);
            if (!bucket) return;
            const rawImages = [
                it?.liveImage || it?.image,
                ...bucket.placePosts.flatMap((p) => (p.images && p.images.length ? p.images : [p.thumbnail || p.image].filter(Boolean))),
            ].filter(Boolean).slice(0, 5);
            const displayImages = rawImages.map((u) => getDisplayImageUrl(u, MAIN_FEED_IMAGE_OPTS)).filter(Boolean);
            bucket.topImages = displayImages;
            bucket.mainSrc = displayImages[0] || 'https://images.unsplash.com/photo-1548115184-bc65ae4986cf?w=800&q=80';
        });

        return byKey;
    }, [recommendedData, allPostsForRecommend]);

    useEffect(() => {
        let cancelled = false;
        const post = hotFeedPost;
        const firstVideo = post && Array.isArray(post.videos) && post.videos.length > 0 ? post.videos[0] : '';
        if (!post || !firstVideo) {
            setHotFeedVideoPoster(null);
            return;
        }
        const still = getMapThumbnailUri(post);
        if (still) {
            setHotFeedVideoPoster(null);
            return;
        }

        const capture = async () => {
            try {
                const url = getDisplayImageUrl(firstVideo);
                if (!url) return;
                const video = document.createElement('video');
                video.crossOrigin = 'anonymous';
                video.muted = true;
                video.playsInline = true;
                video.preload = 'auto';
                video.src = url;

                await new Promise((resolve, reject) => {
                    const onLoaded = () => resolve();
                    const onErr = () => reject(new Error('video load failed'));
                    video.addEventListener('loadeddata', onLoaded, { once: true });
                    video.addEventListener('error', onErr, { once: true });
                });

                const w = Math.max(1, video.videoWidth || 0);
                const h = Math.max(1, video.videoHeight || 0);
                if (!w || !h) return;

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(video, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                if (!cancelled) setHotFeedVideoPoster(dataUrl);
            } catch {
                if (!cancelled) setHotFeedVideoPoster(null);
            }
        };

        capture();
        return () => {
            cancelled = true;
        };
    }, [hotFeedPost]);

    // 새로고침 직후: 직전 성공 응답을 세션에서 즉시 복원 → 이미지 요청이 한 템포 빠르게 시작됨
    useLayoutEffect(() => {
        if (hydratedFromSessionRef.current) return;
        const snap = loadMainFeedSnapshotLast();
        if (!snap) return;
        hydratedFromSessionRef.current = true;
        if (Array.isArray(snap.realtimeData) && snap.realtimeData.length > 0) {
            setRealtimeData(snap.realtimeData);
        }
        if (Array.isArray(snap.crowdedData) && snap.crowdedData.length > 0) {
            setCrowdedData(snap.crowdedData);
        }
        if (Array.isArray(snap.recommendedData)) {
            setRecommendedData(snap.recommendedData);
        }
        if (Array.isArray(snap.allPostsForRecommend) && snap.allPostsForRecommend.length > 0) {
            setAllPostsForRecommend(snap.allPostsForRecommend);
        }
    }, []);

    useEffect(() => {
        const cleanup = preloadMainFeedImageUrls(realtimeData, crowdedData);
        return typeof cleanup === 'function' ? cleanup : undefined;
    }, [realtimeData, crowdedData]);

    const hotFeedCardProps = useMemo(
        () => {
            const cp = buildHotFeedCardProps(hotFeedPost, weatherByRegion);
            if (!cp) return null;
            // ✅ 더보기(/crowded-place)와 동일하게: 장소 AI 블러브를 "설명"으로 우선 사용
            const placeKey = String(hotFeedPost?._placeKey || cp.title || '').trim();
            if (!placeKey) return cp;
            const tagsRaw = Array.isArray(hotFeedPost?.reasonTags) && hotFeedPost.reasonTags.length > 0
                ? hotFeedPost.reasonTags
                : (Array.isArray(hotFeedPost?.aiHotTags) ? hotFeedPost.aiHotTags : []);
            const tags = (tagsRaw || [])
                .map((t) => String(t || '').replace(/#/g, '').trim())
                .filter(Boolean)
                .slice(0, 3)
                .map((t) => (t.startsWith('#') ? t : `#${t}`));
            const aiBlurb = generatePlaceAiBlurb(placeKey, {
                tags,
                cityDong: cp.cityDongLine || '',
                tier: cp.hotReasonLabel || '',
            });
            return {
                ...cp,
                captionForCard: String(aiBlurb || '').trim() || cp.captionForCard,
            };
        },
        [hotFeedPost, weatherByRegion]
    );

    // 실시간 핫플: "장소 자체" 설명을 AI로 생성 (사용자 제보 문장 통합)
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                const cp = hotFeedCardProps;
                const post = hotFeedPost;
                const placeKey = String(post?._placeKey || cp?.title || '').trim();
                if (!placeKey) {
                    setHotplaceAiDescription('');
                    return;
                }
                const norm = normalizePlaceIdentityKey(placeKey);
                const pool = Array.isArray(crowdedData) ? crowdedData : [];
                const userCaptions = pool
                    .filter((p) => normalizePlaceIdentityKey(String(p?._placeKey || p?.placeName || p?.location || '').trim()) === norm)
                    .map((p) => String(p?.note || p?.content || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .slice(0, 6);

                const tagsRaw = Array.isArray(post?.reasonTags) && post.reasonTags.length > 0
                    ? post.reasonTags
                    : (Array.isArray(post?.aiHotTags) ? post.aiHotTags : []);
                const tags = (tagsRaw || [])
                    .map((t) => String(t || '').replace(/[#_]/g, ' ').replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .slice(0, 6);

                const desc = await fetchPlaceDescription({
                    placeKey,
                    regionHint: cp?.cityDongLine || post?.region || '',
                    tier: cp?.hotReasonLabel || '',
                    tags,
                    userCaptions,
                    cacheSalt: norm,
                });
                if (!cancelled) {
                    setHotplaceAiDescription(String(desc || '').trim());
                }
            } catch {
                if (!cancelled) setHotplaceAiDescription('');
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [hotFeedPost, hotFeedCardProps, crowdedData]);

    useEffect(() => {
        setHotFeedSlideIndex(0);
    }, [crowdedIdsKey]);

    // 핫플이 여러 개일 때 순차(라운드로빈) 자동 전환 (너무 빠르면 UX가 불안정해 보여 속도 완화)
    useEffect(() => {
        if (crowdedData.length <= 1) return undefined;
        const id = setInterval(() => {
            setHotFeedSlideIndex((n) => (n + 1) % crowdedData.length);
        }, 9000);
        return () => clearInterval(id);
    }, [crowdedData.length, crowdedIdsKey]);

    useEffect(() => {
        setHotFeedSocialIdx(0);
    }, [hotFeedPost?.id, crowdedIdsKey]);

    // 조회수·좋아요·사진 찍는 중 문구 순차 표시 (전환 속도 완화)
    useEffect(() => {
        if (!hotFeedPost) return undefined;
        const id = setInterval(() => {
            setHotFeedSocialIdx((i) => (i + 1) % 3);
        }, 4800);
        return () => clearInterval(id);
    }, [hotFeedPost?.id]);

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

        const res = await toggleLikeForPost({ postId: post.id, userId: user.id, likedBefore: prevLiked });
        if (res?.success) {
            const finalLiked = !!res.isLiked;
            const finalCount = typeof res.likesCount === 'number' ? res.likesCount : optimisticCount;
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
        if (res?.reason && res.reason !== 'non_uuid') {
            alert(res.reason === 'no_session' ? '로그인 세션이 없어요. 다시 로그인 후 시도해 주세요.' : '좋아요 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
    }, [user?.id, requireLogin]);

    useEffect(() => {
        fetchPosts();
        setUnreadNotificationCount(getUnreadCount());
    }, [fetchPosts]);

    // 진행 중 래플 존재 여부: 메인 상단 "래플" 버튼 강조 + 점 표시
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const { ongoing } = await fetchRafflesForUi();
                if (cancelled) return;
                setHasOngoingRaffle(Array.isArray(ongoing) && ongoing.length > 0);
            } catch {
                if (!cancelled) setHasOngoingRaffle(false);
            }
        };
        load();
        const onVis = () => {
            if (document.visibilityState === 'visible') load();
        };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVis);
        };
    }, []);

    // 메인 화면으로 돌아올 때마다 목록 재조회 (좋아요·댓글 DB 반영 확인)
    const prevPathRef = useRef('');
    useEffect(() => {
        if (location.pathname === '/') {
            if (prevPathRef.current !== '/') fetchPosts();
            prevPathRef.current = '/';
        } else {
            prevPathRef.current = location.pathname;
        }
    }, [location.pathname, fetchPosts]);

    // 상세/피드 등 다른 화면에서 좋아요 반영 시 메인 목록 동기화
    useEffect(() => {
        const onPostLikeUpdated = (e) => {
            const { postId, likesCount, isLiked } = e.detail || {};
            if (!postId) return;
            const id = String(postId);
            const updateLikes = (p) => {
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
            };
            setRealtimeData((prev) => prev.map(updateLikes));
            setCrowdedData((prev) => prev.map(updateLikes));
            setRecommendedData((prev) => prev.map(updateLikes));
            setAllPostsForRecommend((prev) => (Array.isArray(prev) ? prev.map(updateLikes) : prev));
        };
        window.addEventListener('postLikeUpdated', onPostLikeUpdated);
        return () => window.removeEventListener('postLikeUpdated', onPostLikeUpdated);
    }, []);

    // 상세에서 댓글 반영 시 메인 목록의 해당 게시물 댓글 수 동기화
    useEffect(() => {
        const onPostCommentsUpdated = (e) => {
            const { postId, comments } = e.detail || {};
            if (!postId || !Array.isArray(comments)) return;
            const id = String(postId);
            const updateComments = (p) => (p && String(p.id) === id ? { ...p, comments } : p);
            setRealtimeData((prev) => prev.map(updateComments));
            setCrowdedData((prev) => prev.map(updateComments));
            setRecommendedData((prev) => prev.map(updateComments));
            setAllPostsForRecommend((prev) => (Array.isArray(prev) ? prev.map(updateComments) : prev));
        };
        window.addEventListener('postCommentsUpdated', onPostCommentsUpdated);
        return () => window.removeEventListener('postCommentsUpdated', onPostCommentsUpdated);
    }, []);

    // 관리자가 게시물 삭제 시 메인에서 즉시 제거 후 DB 기준으로 다시 불러오기
    useEffect(() => {
        const onAdminDeletedPost = (e) => {
            const postId = e.detail?.postId ? String(e.detail.postId) : null;
            if (postId) {
                setRealtimeData((prev) => prev.filter((p) => p && String(p.id) !== postId));
                setCrowdedData((prev) => prev.filter((p) => p && String(p.id) !== postId));
                setRecommendedData((prev) => prev.filter((p) => p && String(p.id) !== postId));
                setAllPostsForRecommend((prev) => (Array.isArray(prev) ? prev.filter((p) => p && String(p.id) !== postId) : prev));
            }
            fetchPosts();
        };
        window.addEventListener('adminDeletedPost', onAdminDeletedPost);
        return () => window.removeEventListener('adminDeletedPost', onAdminDeletedPost);
    }, [fetchPosts]);

    // 탭/창 포커스 복귀 시 목록 다시 불러오기 (다른 탭에서 관리자가 삭제한 경우 반영)
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') fetchPosts();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchPosts]);

    // 업로드 직후·기타 화면에서 posts 갱신 시 피드 즉시 재로드
    useEffect(() => {
        const onPostsUpdated = () => {
            fetchPosts();
        };
        window.addEventListener('postsUpdated', onPostsUpdated);
        return () => window.removeEventListener('postsUpdated', onPostsUpdated);
    }, [fetchPosts]);

    // 게시물에 날씨가 없을 때 지역 기준으로 기온 조회 (카드에 기온 표시용)
    // ⚠️ 업로드 시각 기준으로 "고정"하려면, 조회 시 base_time을 post.captured_at(또는 post.created_at) 기준으로 계산해야 함.
    // 현재 getWeatherByRegion은 "현재 시각" 기반이므로, 아래는 fallback(레거시)로만 사용하고
    // 우선 업로드 시점에 weatherSnapshot을 저장하는 경로를 강화합니다(UploadScreen/DB 저장 쪽).
    useEffect(() => {
        const targets = [];
        const seen = new Set();
        [...realtimeData, ...crowdedData].forEach((p) => {
            if (!p || p.weather || p.weatherSnapshot) return;
            const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
            if (!r) return;
            const at = p.photoDate || p.captured_at || p.capturedAt || p.createdAt || p.timestamp || p.time || null;
            const ms = at ? new Date(at).getTime() : 0;
            const key = ms ? `${r}::${ms}` : r;
            if (seen.has(key)) return;
            if (weatherByRegion?.[key]) return;
            seen.add(key);
            targets.push({ region: r, at: ms || null, key });
        });
        if (targets.length === 0) return;
        let cancelled = false;
        const map = {};
        Promise.all(
            targets.map(async ({ region, at, key }) => {
                try {
                    // 레거시 fallback: 게시물에 스냅샷(weather)이 없을 때만 "현재 날씨"를 채워준다.
                    // 과거 시각(at) 조회는 기상청/프록시 제한(최근 1일 등) 때문에 실패할 수 있어 사용하지 않는다.
                    const res = await getWeatherByRegion(region, false);
                    if (!cancelled && res?.success && res.weather) return { key, weather: res.weather };
                } catch (_) {}
                return null;
            })
        ).then((results) => {
            if (cancelled) return;
            results.forEach((r) => { if (r) map[r.key] = r.weather; });
            setWeatherByRegion((prev) => ({ ...prev, ...map }));
        });
        return () => { cancelled = true; };
    }, [realtimeData, crowdedData, weatherByRegion]);

    // 새 알림이 생기면 메인 화면에서도 배지 갱신
    useEffect(() => {
        const onCountChange = () => setUnreadNotificationCount(getUnreadCount());
        window.addEventListener('notificationCountChanged', onCountChange);
        return () => window.removeEventListener('notificationCountChanged', onCountChange);
    }, []);

    // 추천 여행지 탭 변경 시 추천 목록만 갱신 (실시간 급상승 태그는 그대로 유지)
    useEffect(() => {
        if (!allPostsForRecommend || allPostsForRecommend.length === 0) return;
        const recs = getRecommendedRegions(allPostsForRecommend, selectedRecommendTag);
        setRecommendedData(recs.slice(0, 10));
    }, [selectedRecommendTag, allPostsForRecommend]);

    useEffect(() => {
        const refresh = () => setRecommendationTypesUi(getRecommendationTypesForUi());
        window.addEventListener('recommendedFilterUiUpdated', refresh);
        const onStorage = (e) => {
            if (e.key === 'lj_recommended_filter_ui') refresh();
        };
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('recommendedFilterUiUpdated', refresh);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    useEffect(() => {
        const enabled = recommendationTypesUi.filter((t) => t.enabled !== false);
        if (enabled.length === 0) return;
        if (!enabled.some((t) => t.id === selectedRecommendTag)) {
            setSelectedRecommendTag(enabled[0].id);
        }
    }, [recommendationTypesUi, selectedRecommendTag]);

    return (
        <div className="screen-layout bg-background-light dark:bg-background-dark">
            <div
                className="screen-content"
                style={{
                    background: '#ffffff',
                }}
            >
                {/* 앱 헤더: 로고 + 검색창 + 알림 */}
                <div className="app-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '7px 16px',
                    background: '#ffffff',
                    backdropFilter: 'blur(10px)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    borderBottom: 'none',
                    boxShadow: 'none'
                }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexShrink: 0,
                        }}
                    >
                        <span
                            className="logo-text"
                            style={{
                                fontSize: '15px',
                                fontWeight: 700,
                                color: '#0f172a',
                                letterSpacing: '-0.04em',
                                lineHeight: 1.1,
                                flexShrink: 0,
                            }}
                        >
                            Live Journey
                        </span>
                        <button
                            type="button"
                            onClick={() => navigate('/raffle')}
                            style={{
                                flexShrink: 0,
                                height: 24,
                                padding: '0 14px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                borderRadius: 9999,
                                border: 'none',
                                background: hasOngoingRaffle ? 'rgba(38,198,218,0.12)' : '#F2F2F2',
                                color: hasOngoingRaffle ? '#26C6DA' : '#757575',
                                fontSize: 10,
                                fontWeight: 500,
                                letterSpacing: '-0.02em',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                width: 'auto',
                                minHeight: 24,
                                position: 'relative',
                            }}
                            aria-label="래플"
                        >
                            <span
                                className="material-symbols-outlined"
                                style={{
                                    fontSize: 14,
                                    color: hasOngoingRaffle ? '#26C6DA' : '#757575',
                                    fontWeight: 400,
                                    flexShrink: 0,
                                }}
                                aria-hidden
                            >
                                confirmation_number
                            </span>
                            래플
                            {hasOngoingRaffle && (
                                <>
                                    <span
                                        aria-label="진행 중 래플 있음"
                                        style={{
                                            position: 'absolute',
                                            top: -2,
                                            right: -2,
                                            width: 8,
                                            height: 8,
                                            borderRadius: 9999,
                                            background: '#26C6DA',
                                            border: '2px solid #ffffff',
                                            boxShadow: '0 0 0 1px rgba(38,198,218,0.25)',
                                            zIndex: 2,
                                        }}
                                    />
                                    <span
                                        aria-hidden
                                        style={{
                                            position: 'absolute',
                                            top: -2,
                                            right: -2,
                                            width: 8,
                                            height: 8,
                                            borderRadius: 9999,
                                            border: '1px solid rgba(38,198,218,0.55)',
                                            background: 'transparent',
                                            transformOrigin: 'center',
                                            animation: 'raffleDotWave 1.6s ease-out infinite',
                                            zIndex: 1,
                                            pointerEvents: 'none',
                                        }}
                                    />
                                    <style>{`
                                      @keyframes raffleDotWave {
                                        0% { transform: scale(1); opacity: 0.60; }
                                        70% { transform: scale(2.4); opacity: 0.00; }
                                        100% { transform: scale(2.4); opacity: 0.00; }
                                      }
                                    `}</style>
                                </>
                            )}
                        </button>
                    </div>
                    {/* 중앙 검색창 */}
                    <button
                        type="button"
                        onClick={() => navigate('/search')}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            maxWidth: 228,
                            height: 26,
                            marginLeft: 6,
                            marginRight: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 4px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #e2e8f0',
                            color: '#94a3b8',
                            fontSize: 12,
                            cursor: 'pointer'
                        }}
                        aria-label="검색으로 이동"
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            어디로 떠나볼까요?
                        </span>
                        <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#94a3b8', flexShrink: 0 }}>search</span>
                    </button>
                    <button
                        onClick={() => navigate('/notifications')}
                        className="icon-btn"
                        style={{ minWidth: 40, minHeight: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                        aria-label="알림"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
                        {unreadNotificationCount > 0 && (
                            <span className="noti-badge" aria-label="새 알림">
                                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* 상단 배너는 현재 사용하지 않음 */}

                <div style={{ padding: '2px 16px 6px', background: '#ffffff' }}>
                    <div style={{ padding: '0 0 2px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>지금 여기는</h2>
                        </div>
                        <button
                            onClick={() => navigate('/realtime-feed')}
                            className="border-none bg-transparent text-primary hover:text-primary-dark dark:hover:text-primary-soft text-sm font-semibold cursor-pointer py-1.5 px-2.5 min-h-[36px] flex items-center gap-1"
                        >
                            <span>더보기</span>
                        </button>
                    </div>
                    <div
                    style={{ display: 'flex', gap: '6px', padding: '0 0 4px 0', overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', cursor: 'grab', background: '#ffffff' }}
                        className="hide-scrollbar"
                        onMouseDown={handleDragStart}
                    >
                        {realtimeData.map((post, rtIndex) => {
                            // 동영상 우선 체크: videos 배열이 있으면 첫 번째 동영상 사용
                            let firstVideo = null;
                            if (post.videos) {
                                if (Array.isArray(post.videos) && post.videos.length > 0) {
                                    firstVideo = getDisplayImageUrl(post.videos[0], { ...MAIN_FEED_IMAGE_OPTS, allowBlob: true });
                                } else if (typeof post.videos === 'string' && post.videos.trim()) {
                                    firstVideo = getDisplayImageUrl(post.videos, { ...MAIN_FEED_IMAGE_OPTS, allowBlob: true });
                                }
                            }
                            
                            // 동영상이 없을 때만 이미지 사용
                            const rawFirstImage = Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || '');
                            const firstImage = firstVideo
                                ? null
                                : getDisplayImageUrl(rawFirstImage, MAIN_FEED_IMAGE_OPTS);
                            const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
                            const fixedAt = post.photoDate || post.captured_at || post.capturedAt || post.createdAt || post.timestamp || post.time || null;
                            const snap = getValidWeatherSnapshot(post);
                            const weather =
                                snap ||
                                post.weatherSnapshot ||
                                post.weather ||
                                (weatherByRegion
                                    ? weatherByRegion[`${regionKey}::${fixedAt ? new Date(fixedAt).getTime() : ''}`]
                                    : null) ||
                                weatherByRegion[regionKey] ||
                                null;
                            const hasWeather = weather && (weather.icon || weather.temperature);
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const commentCount = Math.max(
                                0,
                                Number(post.commentCount ?? post.commentsCount ?? (Array.isArray(post.comments) ? post.comments.length : 0)) || 0
                            );
                            const status = getPhotoStatusFromPost(post);
                            const formatHotTag = (t) => {
                                const raw = String(t || '').replace(/#/g, '').replace(/_/g, ' ').trim();
                                if (!raw) return '';
                                return raw.startsWith('#') ? raw : `#${raw}`;
                            };
                            return (
                                <div
                                    key={post.id}
                                    onClick={withDragCheck(() => {
                                        const idx = realtimeData.findIndex((p) => String(p?.id) === String(post?.id));
                                        navigate(`/post/${post.id}`, {
                                            state: {
                                                post,
                                                allPosts: realtimeData,
                                                currentPostIndex: idx >= 0 ? idx : 0,
                                            },
                                        });
                                    })}
                                    style={{
                                        minWidth: '52%',
                                        width: '52%',
                                        overflow: 'visible',
                                        flexShrink: 0,
                                        cursor: 'pointer',
                                        scrollSnapAlign: 'start',
                                        scrollSnapStop: 'always'
                                    }}
                                >
                                    <div style={{ width: '100%', height: '228px', background: '#e5e7eb', position: 'relative', borderRadius: '14px', overflow: 'hidden', marginBottom: '2px' }}>
                                        {firstVideo ? (
                                            <video
                                                ref={(el) => {
                                                    if (el) {
                                                        videoRefs.current.set(`realtime-${post.id}`, el);
                                                    } else {
                                                        videoRefs.current.delete(`realtime-${post.id}`);
                                                    }
                                                }}
                                                data-video-id={`realtime-${post.id}`}
                                                src={firstVideo}
                                                poster={firstImage || getDisplayImageUrl(Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || ''), MAIN_FEED_IMAGE_OPTS) || undefined}
                                                muted
                                                loop
                                                playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : firstImage ? (
                                            <FastImage
                                                rawUrl={rawFirstImage}
                                                opts={MAIN_FEED_IMAGE_OPTS}
                                                alt={post.location}
                                                loading={rtIndex < 6 ? 'eager' : 'lazy'}
                                                decoding="async"
                                                fetchPriority={rtIndex < 3 ? 'high' : 'auto'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : null}
                                        {/* 실시간 인증 배지 - 좌측 상단 */}
                                        {status !== 'NONE' && (
                                            <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}>
                                                <StatusBadge status={status} />
                                            </div>
                                        )}
                                    </div>
                                    {/* 사진 정보 하단 — 설명만 표시 */}
                                    <div style={{ padding: '4px 10px 6px', minHeight: '100px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexShrink: 0 }}>
                                            <div style={{ color: '#111827', fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                                {post.location || '어딘가의 지금'}
                                            </div>
                                            <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
                                                {getTimeAgo(post.photoDate || post.timestamp || post.createdAt || post.time)}
                                            </span>
                                        </div>
                                        {(post.content || post.note) && (
                                            <div style={{ color: '#4b5563', fontSize: '13px', lineHeight: 1.45, marginTop: '6px', height: '2.9em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                {post.content || post.note}
                                            </div>
                                        )}
                                        {(hasWeather || (Array.isArray(post.reasonTags) && post.reasonTags.length > 0) || (!post.reasonTags?.length && Array.isArray(post.aiHotTags) && post.aiHotTags.length > 0)) && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 8,
                                                    marginTop: 6,
                                                    width: '100%',
                                                    minWidth: 0,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'row',
                                                        flexWrap: 'nowrap',
                                                        gap: 6,
                                                        flex: 1,
                                                        minWidth: 0,
                                                        alignItems: 'center',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    {Array.isArray(post.reasonTags) && post.reasonTags.length > 0
                                                        ? post.reasonTags.slice(0, 2).map((tag) => (
                                                            <span
                                                                key={String(tag)}
                                                                style={{
                                                                    fontSize: '11px',
                                                                    fontWeight: 800,
                                                                    color: '#0f172a',
                                                                    background: 'rgba(38, 198, 218, 0.14)',
                                                                    border: '1px solid rgba(38, 198, 218, 0.30)',
                                                                    padding: '3px 9px',
                                                                    borderRadius: '999px',
                                                                    flex: '1 1 0px',
                                                                    width: 0,
                                                                    minWidth: 0,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                }}
                                                            >
                                                                {formatHotTag(tag)}
                                                            </span>
                                                        ))
                                                        : !post.reasonTags?.length && Array.isArray(post.aiHotTags) && post.aiHotTags.length > 0
                                                          ? post.aiHotTags.slice(0, 2).map((tag) => (
                                                                <span
                                                                    key={String(tag)}
                                                                    style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: 800,
                                                                        color: '#0f172a',
                                                                        background: 'rgba(38, 198, 218, 0.14)',
                                                                        border: '1px solid rgba(38, 198, 218, 0.30)',
                                                                        padding: '3px 9px',
                                                                        borderRadius: '999px',
                                                                    flex: '1 1 0px',
                                                                    width: 0,
                                                                    minWidth: 0,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                    }}
                                                                >
                                                                    {formatHotTag(tag)}
                                                                </span>
                                                            ))
                                                          : null}
                                                </div>
                                                {hasWeather && (
                                                    <div
                                                        style={{
                                                            flexShrink: 0,
                                                            background: 'rgba(15,23,42,0.08)',
                                                            padding: '3px 8px',
                                                            borderRadius: '999px',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            color: '#374151',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {weather.icon && <span>{weather.icon}</span>}
                                                        {weather.temperature && <span>{weather.temperature}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 메인 컨텐츠 */}
                <div style={{ padding: '2px 16px 20px', background: '#ffffff', minHeight: '100%' }}>

                        {/* 실시간 핫플 — 이미지 4:3 세로 비중 + 섹션 여백 */}
                        <div style={{ marginBottom: '22px', paddingTop: 0, paddingBottom: '20px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 5px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>실시간 핫플</h3>
                                <button
                                    type="button"
                                    onClick={() => navigate('/crowded-place')}
                                    className="border-none bg-transparent text-primary hover:text-primary-dark dark:hover:text-primary-soft text-sm font-semibold cursor-pointer py-1.5 px-2 min-h-[36px] flex items-center gap-0.5"
                                >
                                    <span>더보기</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                                </button>
                            </div>
                            {!hotFeedCardProps ? (
                                <div style={{ textAlign: 'center', padding: '12px 12px', color: '#94a3b8', fontSize: '14px' }}>
                                    아직 실시간 핫플 게시물이 없어요.
                                </div>
                            ) : (
                                (() => {
                                    const { post } = hotFeedCardProps;
                                    const slideIdx = crowdedData.length ? hotFeedSlideIndex % crowdedData.length : 0;
                                    const socialText = getHotFeedSocialLine(hotFeedCardProps, hotFeedSocialIdx);
                                    return (
                                        <HotFeedCard
                                            key={`${post.id}-${slideIdx}`}
                                            imageUrlOpts={MAIN_FEED_IMAGE_OPTS}
                                            cardProps={hotFeedCardProps}
                                            socialText={socialText}
                                            onCardClick={withDragCheck(() => {
                                                const idx = crowdedData.findIndex((p) => String(p?.id) === String(post?.id));
                                                navigate(`/post/${post.id}`, {
                                                    state: {
                                                        post,
                                                        allPosts: crowdedData,
                                                        currentPostIndex: idx >= 0 ? idx : 0,
                                                    },
                                                });
                                            })}
                                            showLike={false}
                                            videoPosterUrl={hotFeedVideoPoster}
                                            placeDescription={hotplaceAiDescription}
                                        />
                                    );
                                })()
                            )}
                        </div>

                        {/* 현지 상황 물어보기 — 텍스트 전용 질문 리스트 */}
                        <div style={{ marginBottom: '18px', paddingBottom: '14px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>지금 여기 어때요?</h3>
                                <button
                                    type="button"
                                    onClick={() => navigate('/ask-situation')}
                                    className="border-none bg-transparent text-primary hover:text-primary-dark dark:hover:text-primary-soft text-sm font-semibold cursor-pointer py-1.5 px-2 min-h-[36px] flex items-center gap-0.5"
                                >
                                    <span>더보기</span>
                                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                                </button>
                            </div>
                            {askSituationPreview.length === 0 ? (
                                <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid #f1f5f9', background: '#fafafa', color: '#94a3b8', fontSize: 13 }}>
                                    아직 질문이 없어요. 궁금한 현지 상황을 물어보세요!
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {askSituationPreview.slice(0, 2).map((q) => {
                                        const where = String(q.location || q.region || '').trim();
                                        const head = where ? `${where} ` : '';
                                        const text = String(q.content || q.note || '').trim();
                                        const commentCount = Math.max(0, Number(q.commentCount ?? q.commentsCount ?? 0) || 0);
                                        const right = commentCount > 0 ? `답변 ${commentCount}개` : getTimeAgo(q.photoDate || q.timestamp || q.createdAt);
                                        return (
                                            <button
                                                key={q.id}
                                                type="button"
                                            onClick={() => navigate(`/ask-situation/${q.id}`, { state: { post: q } })}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    border: '1px solid #eef2f7',
                                                    background: '#ffffff',
                                                    borderRadius: 16,
                                                    padding: '12px 12px',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 4px rgba(15,23,42,0.03)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                            {head}{text || '현지 상황이 궁금해요'}
                                                        </div>
                                                        <div style={{ marginTop: 6, fontSize: 12, color: q.hasAcceptedAnswer ? '#10b981' : '#94a3b8', fontWeight: 700 }}>
                                                            {q.hasAcceptedAnswer ? '채택 완료' : '답변 대기 중'}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700, flexShrink: 0, paddingTop: 2, whiteSpace: 'nowrap' }}>
                                                        {right}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 라이브매거진 (발행 매거진 모아보기) */}
                        <div style={{ marginBottom: '16px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#374151' }}>라이브매거진</h3>
                                <button
                                    type="button"
                                    onClick={() => navigate('/magazines')}
                                    className="border-none bg-transparent text-primary hover:text-primary-dark dark:hover:text-primary-soft text-sm font-semibold cursor-pointer py-1.5 px-2.5 min-h-[36px] flex items-center gap-1"
                                >
                                    <span>더보기</span>
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 2 }}>
                                {magazineCards.map(({ magazine, cover }) => (
                                    <button
                                        key={magazine.id}
                                        type="button"
                                        onClick={() => navigate(`/magazine/${magazine.id}`, { state: { magazine } })}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'stretch',
                                            borderRadius: 16,
                                            border: '1px solid #e5e7eb',
                                            background: '#ffffff',
                                            padding: 10,
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
                                        }}
                                    >
                                        <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', background: '#e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {cover ? (
                                                <img src={cover} alt="" loading="eager" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            ) : (
                                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>photo</span>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#4f46e5' }}>
                                                라이브매거진
                                            </p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {magazine.title}
                                            </p>
                                            {(magazine.subtitle || magazine.summary) && (
                                                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {magazine.subtitle || magazine.summary}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

            </div>

            {!authLoading && user && !consentLoading && !consentResolved ? (
                <ExifConsentSheet onGrant={grantExifConsent} onDecline={declineExifConsent} />
            ) : null}
            <BottomNavigation />
        </div >
    );

};

export default MainScreen;


import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getUnreadCount } from '../utils/notifications';
import { getTimeAgo, filterActivePosts48 } from '../utils/timeUtils';
import { logger } from '../utils/logger';
import { getRecommendedRegions, getRecommendationTypesForUi } from '../utils/recommendationEngine';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import './MainScreen.css';
import { getCombinedPosts } from '../utils/mockData';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri } from '../utils/postMedia';
import { getPostAccuracyCount, mergeLikedPostsFromServer } from '../utils/socialInteractions';
import { rankHotspotPosts } from '../utils/hotnessEngine';
import { applyPostLikesCountFromServer } from '../api/postsSupabase';
import { getWeatherByRegion } from '../api/weather';
import { listPublishedMagazines } from '../utils/magazinesStore';
import HotFeedCard from '../components/HotFeedCard';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';
import { buildPlaceStatsMap, selectPostsForPlaceStats, transformPostForHotFeed } from '../utils/hotFeedPostTransform';
import { useAuth } from '../contexts/AuthContext';
import { fetchLikedPostIdsSupabase } from '../api/socialSupabase';
import StatusBadge from '../components/StatusBadge';
import { getPhotoStatusFromPost } from '../utils/photoStatus';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { getLikeSnapshot, toggleLikeLocal } from '../utils/postLikesLocal';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
const MainScreen = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [selectedTag, setSelectedTag] = useState(null);
    const [popularTags, setPopularTags] = useState([]);

    const [realtimeData, setRealtimeData] = useState([]);
    const [crowdedData, setCrowdedData] = useState([]);
    const [recommendedData, setRecommendedData] = useState([]);
    const [weatherByRegion, setWeatherByRegion] = useState({});
    const [allPostsForRecommend, setAllPostsForRecommend] = useState([]);
    const [publishedMagazines, setPublishedMagazines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [hotFeedVideoPoster, setHotFeedVideoPoster] = useState(null);
    const [selectedRecommendTag, setSelectedRecommendTag] = useState('season_peak');
    const [recommendationTypesUi, setRecommendationTypesUi] = useState(() => getRecommendationTypesForUi());
    const [hotFeedSlideIndex, setHotFeedSlideIndex] = useState(0);
    const [hotFeedSocialIdx, setHotFeedSocialIdx] = useState(0);
    const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
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
        const localPosts = getUploadedPostsSafe();

        // Supabase에서 실제 게시물 불러오기 (실패 시 빈 배열)
        const supabasePosts = await fetchPostsSupabase();

        // Supabase + 로컬: 동일 id는 필드 병합(isInAppCamera·exifData 유지)
        const combined = combinePostsSupabaseAndLocal(supabasePosts, localPosts);
        // 관리자가 삭제한 게시물은 제외 (다른 탭에서 삭제했거나 이벤트를 놓친 경우)
        let deletedIds = new Set();
        try {
            const raw = sessionStorage.getItem('adminDeletedPostIds') || '[]';
            deletedIds = new Set(JSON.parse(raw));
            sessionStorage.removeItem('adminDeletedPostIds');
        } catch (_) {}
        const combinedFiltered = combined.filter((p) => p && p.id && !deletedIds.has(String(p.id)));
        const allPosts = getCombinedPosts(combinedFiltered);

        // 멀티계정: 현재 사용자 기준 좋아요 상태(post_likes)를 로컬 캐시에 반영
        try {
            const uid = user?.id ? String(user.id) : '';
            const isUuid = uid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid);
            if (isUuid) {
                const ids = allPosts
                    .map((p) => String(p.id))
                    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
                const likedIds = await fetchLikedPostIdsSupabase(uid, ids);
                if (likedIds !== null) mergeLikedPostsFromServer(ids, likedIds);
            }
        } catch (_) {}

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
        const ranked = rankHotspotPosts(toRank, { verifyFirst: true, maxItems: 100 });
        const crowdedRanked = ranked.map((r) => ({
            ...r.post,
            _rank: r.rank,
            _impactLabel: r.impactLabel,
            accuracyCount: getPostAccuracyCount(r.post.id),
        }));
        const crowdedFallback = transformed48.slice(0, 50).map((p) => ({
            ...p,
            accuracyCount: getPostAccuracyCount(p.id),
        }));
        setCrowdedData(crowdedRanked.length > 0 ? crowdedRanked : crowdedFallback);

        // 추천 여행지: 현재는 Supabase/로컬에서 집계한 posts 기반으로 계산
        const recs = getRecommendedRegions(allPosts, selectedRecommendTag);
        setRecommendedData(recs.slice(0, 10));
        setAllPostsForRecommend(allPosts);
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

        const hasMedia = (p) => (Array.isArray(p?.images) && p.images.length > 0) || p?.image || p?.thumbnail;
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
            return raw ? getDisplayImageUrl(raw) : '';
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
            const displayImages = rawImages.map((u) => getDisplayImageUrl(u)).filter(Boolean);
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

    const hotFeedCardProps = useMemo(
        () => buildHotFeedCardProps(hotFeedPost, weatherByRegion),
        [hotFeedPost, weatherByRegion]
    );

    useEffect(() => {
        setHotFeedSlideIndex(0);
    }, [crowdedIdsKey]);

    // 핫플이 여러 개일 때 순차(라운드로빈) 자동 전환
    useEffect(() => {
        if (crowdedData.length <= 1) return undefined;
        const id = setInterval(() => {
            setHotFeedSlideIndex((n) => (n + 1) % crowdedData.length);
        }, 4500);
        return () => clearInterval(id);
    }, [crowdedData.length, crowdedIdsKey]);

    useEffect(() => {
        setHotFeedSocialIdx(0);
    }, [hotFeedPost?.id, crowdedIdsKey]);

    // 조회수·좋아요·사진 찍는 중 문구 순차 표시
    useEffect(() => {
        if (!hotFeedPost) return undefined;
        const id = setInterval(() => {
            setHotFeedSocialIdx((i) => (i + 1) % 3);
        }, 2800);
        return () => clearInterval(id);
    }, [hotFeedPost?.id]);

    const handleHotFeedLike = useCallback((e, post) => {
        e.stopPropagation();
        const raw = Number(post.likes ?? post.likeCount ?? 0);
        const baseLikes = Number.isFinite(raw) ? Math.max(0, raw) : 0;
        if (!user?.id) {
            alert('로그인 후 좋아요를 누를 수 있어요.');
            return;
        }
        const next = toggleLikeLocal(post.id, user.id, baseLikes);
        if (!next) return;
        setCrowdedData((prev) =>
            prev.map((p) => (p && p.id === post.id ? { ...p, likes: next.count, likeCount: next.count } : p))
        );
    }, [user?.id]);

    useEffect(() => {
        fetchPosts();
        setUnreadNotificationCount(getUnreadCount());
    }, [fetchPosts]);

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

    // 상세에서 좋아요 반영 시 메인 목록의 해당 게시물 좋아요 수 동기화
    useEffect(() => {
        const onPostLikeUpdated = (e) => {
            const { postId, likesCount } = e.detail || {};
            if (!postId || typeof likesCount !== 'number') return;
            const id = String(postId);
            const updateLikes = (p) => (p && String(p.id) === id ? { ...p, likes: likesCount, likeCount: likesCount } : p);
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
    useEffect(() => {
        const regions = new Set();
        [...realtimeData, ...crowdedData].forEach((p) => {
            if (!p || p.weather || p.weatherSnapshot) return;
            const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
            if (!r) return;
            if (weatherByRegion?.[r]) return;
            regions.add(r);
        });
        if (regions.size === 0) return;
        let cancelled = false;
        const map = {};
        Promise.all(
            Array.from(regions).map(async (region) => {
                try {
                    const res = await getWeatherByRegion(region);
                    if (!cancelled && res?.success && res.weather) return { region, weather: res.weather };
                } catch (_) {}
                return null;
            })
        ).then((results) => {
            if (cancelled) return;
            results.forEach((r) => { if (r) map[r.region] = r.weather; });
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
                                background: '#F2F2F2',
                                color: '#757575',
                                fontSize: 10,
                                fontWeight: 500,
                                letterSpacing: '-0.02em',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                width: 'auto',
                                minHeight: 24,
                            }}
                            aria-label="래플"
                        >
                            <span
                                className="material-symbols-outlined"
                                style={{
                                    fontSize: 14,
                                    color: '#757575',
                                    fontWeight: 400,
                                    flexShrink: 0,
                                }}
                                aria-hidden
                            >
                                confirmation_number
                            </span>
                            래플
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
                        {realtimeData.map((post) => {
                            // 동영상 우선 체크: videos 배열이 있으면 첫 번째 동영상 사용
                            let firstVideo = null;
                            if (post.videos) {
                                if (Array.isArray(post.videos) && post.videos.length > 0) {
                                    firstVideo = getDisplayImageUrl(post.videos[0]);
                                } else if (typeof post.videos === 'string' && post.videos.trim()) {
                                    firstVideo = getDisplayImageUrl(post.videos);
                                }
                            }
                            
                            // 동영상이 없을 때만 이미지 사용
                            const firstImage = firstVideo ? null : getDisplayImageUrl(Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || ''));
                            const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
                            const weather = post.weatherSnapshot || post.weather || weatherByRegion[regionKey] || null;
                            const hasWeather = weather && (weather.icon || weather.temperature);
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
                            const status = getPhotoStatusFromPost(post);
                            return (
                                <div
                                    key={post.id}
                                    onClick={withDragCheck(() => navigate(`/post/${post.id}`, { state: { post, allPosts: realtimeData } }))}
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
                                                poster={firstImage || getDisplayImageUrl(Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || '')) || undefined}
                                                muted
                                                loop
                                                playsInline
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : firstImage ? (
                                            <img
                                                src={firstImage}
                                                alt={post.location}
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
                                    <div style={{ padding: '4px 10px 6px', minHeight: '88px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1, minWidth: 0 }}>
                                                    {Array.isArray(post.reasonTags) && post.reasonTags.length > 0
                                                        ? post.reasonTags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={String(tag)}
                                                                style={{
                                                                    fontSize: '10px',
                                                                    fontWeight: 600,
                                                                    color: '#4b5563',
                                                                    background: '#f3f4f6',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '6px',
                                                                    maxWidth: '100%',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {String(tag).replace(/^#/, '')}
                                                            </span>
                                                        ))
                                                        : (!post.reasonTags?.length && Array.isArray(post.aiHotTags) && post.aiHotTags.length > 0
                                                            ? post.aiHotTags.slice(0, 2).map((tag) => (
                                                                <span
                                                                    key={String(tag)}
                                                                    style={{
                                                                        fontSize: '10px',
                                                                        fontWeight: 600,
                                                                        color: '#4b5563',
                                                                        background: '#f3f4f6',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '6px',
                                                                    }}
                                                                >
                                                                    {String(tag).replace(/^#/, '')}
                                                                </span>
                                                            ))
                                                            : null)}
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
                                            cardProps={hotFeedCardProps}
                                            socialText={socialText}
                                            onCardClick={withDragCheck(() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } }))}
                                            showLike={false}
                                            videoPosterUrl={hotFeedVideoPoster}
                                        />
                                    );
                                })()
                            )}
                        </div>

                        {/* ✨ 추천 여행지 */}
                        <div style={{ marginBottom: '16px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 8px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#374151' }}>지금, 이 순간 꼭 가야 할 곳</h3>
                                </div>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    padding: '0 0 8px 0',
                                    overflowX: 'auto',
                                    scrollbarWidth: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    cursor: 'grab',
                                    scrollSnapType: 'x mandatory',
                                }}
                                className="hide-scrollbar"
                                onMouseDown={handleDragStart}
                            >
                                {recommendationTypesUi.filter((t) => t.enabled !== false).map((tag) => {
                                    const isActive = selectedRecommendTag === tag.id;
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={withDragCheck(() => setSelectedRecommendTag(tag.id))}
                                            style={{
                                                flexShrink: 0,
                                                scrollSnapAlign: 'start',
                                                padding: '6px 12px',
                                                borderRadius: 999,
                                                border: isActive ? '1px solid #26C6DA' : '1px solid #e2e8f0',
                                                backgroundColor: isActive ? 'rgba(38,198,218,0.08)' : '#ffffff',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 4,
                                                fontSize: 12,
                                                fontWeight: isActive ? 700 : 500,
                                                color: isActive ? '#0f172a' : '#64748b',
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                                transition: 'all 0.18s ease-out',
                                            }}
                                        >
                                            <span style={{ fontSize: 13, lineHeight: 1 }}>{tag.icon}</span>
                                            <span>{tag.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '10px',
                                    padding: '0 0 10px 0',
                                    overflowX: 'auto',
                                    scrollbarWidth: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    cursor: 'grab'
                                }}
                                className="hide-scrollbar"
                                onMouseDown={handleDragStart}
                            >
                                {recommendedData.map((item, idx) => {
                                    const placeKey = item.placeName || item.title || item.regionName;
                                    const bundle = recommendedPlaceBundle.get(String(placeKey || '').trim()) || null;
                                    const mainSrc = bundle?.mainSrc || 'https://images.unsplash.com/photo-1548115184-bc65ae4986cf?w=800&q=80';
                                    const placeDescription = (item.description || '').trim();
                                    const placeOneLine = String(item.placeOneLine || '').trim();
                                    const topTags = Array.isArray(item.topTags) ? item.topTags.filter(Boolean).slice(0, 5) : [];
                                    const feedPosts = bundle?.feedPosts || [];

                                    return (
                                        <div
                                            key={idx}
                                            onClick={withDragCheck(() =>
                                                navigate('/recommended-place-feed', {
                                                    state: {
                                                        placeKey,
                                                        posts: feedPosts,
                                                        placeOneLine,
                                                        placeDescription,
                                                        topTags,
                                                    },
                                                })
                                            )}
                                            style={{
                                                minWidth: '74%',
                                                width: '74%',
                                                cursor: 'pointer',
                                                overflow: 'visible',
                                                background: 'transparent',
                                            }}
                                        >
                                            <div style={{ width: '100%', height: '160px', overflow: 'hidden', borderRadius: '14px', background: '#e5e7eb' }}>
                                                <img
                                                    src={mainSrc}
                                                    alt={item.title || placeKey}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1548115184-bc65ae4986cf?w=800&q=80'; }}
                                                />
                                            </div>
                                            <div style={{ padding: '6px 2px 10px' }}>
                                                <div style={{ color: '#111827', fontSize: '14px', fontWeight: 800, marginBottom: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {placeKey}
                                                </div>
                                                {placeOneLine ? (
                                                    <div
                                                        style={{
                                                            marginTop: 4,
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            color: '#475569',
                                                            lineHeight: 1.35,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 1,
                                                            WebkitBoxOrient: 'vertical',
                                                            wordBreak: 'break-word',
                                                        }}
                                                    >
                                                        {placeOneLine}
                                                    </div>
                                                ) : null}
                                                {placeDescription ? (
                                                    <div
                                                        style={{
                                                            marginTop: 8,
                                                            color: '#334155',
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            wordBreak: 'break-word',
                                                            lineHeight: 1.55,
                                                        }}
                                                    >
                                                        {placeDescription.split('\n').map((line, li) => (
                                                            <div key={li} style={{ marginTop: li > 0 ? 4 : 0 }}>
                                                                {line}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                {topTags.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                                        {topTags.map((t) => (
                                                            <span
                                                                key={`${placeKey}-${t}`}
                                                                style={{
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                    color: '#334155',
                                                                    background: 'rgba(148,163,184,0.14)',
                                                                    border: '1px solid rgba(148,163,184,0.22)',
                                                                    padding: '3px 8px',
                                                                    borderRadius: 999,
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {/* 여행 매거진 (발행 매거진 모아보기) */}
                        <div style={{ marginBottom: '16px', background: '#ffffff' }}>
                            <div style={{ padding: '0 0 6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#374151' }}>여행 매거진</h3>
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
                                                <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                            ) : (
                                                <span className="material-symbols-outlined" style={{ color: '#94a3b8' }}>photo</span>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#4f46e5' }}>
                                                발행 매거진
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

            <BottomNavigation />
        </div >
    );

};

export default MainScreen;

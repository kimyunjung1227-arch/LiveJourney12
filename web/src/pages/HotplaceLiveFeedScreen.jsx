import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { getDisplayImageUrl } from '../api/upload';
import {
  getGridCoverDisplay,
  buildMediaItemsFromPost,
  normalizePostForMedia,
  isVideoUri,
  toMediaStr,
} from '../utils/postMedia';
import { formatExifDate } from '../utils/exifExtractor';
import { getTimeAgo } from '../utils/timeUtils';
import { follow, unfollow, isFollowing, getCurrentUserId } from '../utils/followSystem';
import { getTrustGrade, getTrustRawScore, getTrustScore } from '../utils/trustIndex';

const MOCK_PRIMARY = '#1353d8';

const getPostTimeMs = (post) => {
  const raw = post?.timestamp || post?.createdAt || post?.time || post?.photoDate;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

const getUserIdForPost = (post) => {
  const uid = post?.userId ?? post?.user?.id ?? post?.user ?? post?.authorId ?? post?.author?.id;
  return uid != null ? String(uid) : '';
};

const getUserNameForPost = (post) => {
  const who = post?.user?.username || post?.user?.name || post?.author_username || post?.username;
  return String(who || '여행자');
};

const getPlaceKeyForPost = (post) =>
  String(post?.location || post?.placeName || post?.detailedLocation || post?.region || '').trim();

const HOURS_48_MS = 48 * 60 * 60 * 1000;
const BEST_CUT_MAX = 6;

const getLikeCount = (post) => {
  const n = post?.likes ?? post?.likeCount ?? post?.likesCount;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

const getCommentCount = (post) => {
  const c = post?.comments;
  if (Array.isArray(c)) return c.length;
  const n = Number(post?.commentsCount);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const getEngagementScore = (post) => getLikeCount(post) * 2 + getCommentCount(post);

const getAvatarUrlForPost = (post) => {
  const u = post?.user;
  if (u && typeof u === 'object') {
    const raw = u.profileImage || u.avatar || u.picture;
    if (raw && String(raw).trim()) return getDisplayImageUrl(String(raw));
  }
  return null;
};

const hasExifForPost = (post) => {
  const ex = post?.exifData;
  return !!(
    post?.photoDate ||
    (ex && typeof ex === 'object' && (ex.photoDate || ex.gpsCoordinates || ex.cameraMake || ex.cameraModel))
  );
};

const getExifTagForPost = (post) => {
  const photoDate = post?.photoDate || post?.exifData?.photoDate || null;
  const ex = post?.exifData && typeof post.exifData === 'object' ? post.exifData : null;
  const cameraMake = ex?.cameraMake ? String(ex.cameraMake).trim() : '';
  const cameraModel = ex?.cameraModel ? String(ex.cameraModel).trim() : '';
  const cameraText = `${cameraMake} ${cameraModel}`.trim();

  let timeText = '';
  let fullTimeText = '';
  if (photoDate) {
    const d = new Date(photoDate);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      timeText = `${hh}:${mm}`;
      fullTimeText = d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
  }

  const dayText = photoDate ? (formatExifDate(photoDate) || '') : '';
  const parts = [dayText, timeText].filter(Boolean);
  const when = parts.join(' ');
  const text = [when, cameraText].filter(Boolean).join(' · ');
  const title = [fullTimeText ? `촬영: ${fullTimeText}` : '', cameraText ? `기기: ${cameraText}` : ''].filter(Boolean).join('\n');

  return text ? { text, title } : null;
};

const hasGpsPost = (post) =>
  !!(
    post?.coordinates ||
    (post?.latitude != null && post?.longitude != null) ||
    (Array.isArray(post?.coordinates) && post.coordinates.length >= 2)
  );

/** 베스트 컷 영역 슬라이드용: 게시물의 모든 미디어(순서 유지) */
const getHeroMediaItems = (post) => {
  if (!post) return [];
  const items = buildMediaItemsFromPost(normalizePostForMedia(post));
  if (items.length > 0) return items;
  const raw =
    (Array.isArray(post.images) && post.images[0]) || post.image || post.thumbnail || post.imageUrl || '';
  const u = toMediaStr(raw);
  if (!u) return [];
  return [{ type: isVideoUri(u) ? 'video' : 'image', uri: u }];
};

/** 베스트 컷 게시물들의 미디어를 순서대로 펼친 슬라이드 (게시물·사진 모두 좌우로 넘김) */
const buildFlatBestCutSlides = (bestCuts) => {
  const out = [];
  for (const post of bestCuts) {
    const items = getHeroMediaItems(post);
    if (items.length === 0) {
      out.push({ post, media: null, mediaIndex: 0, mediaCount: 0 });
    } else {
      items.forEach((m, mediaIndex) => {
        out.push({ post, media: m, mediaIndex, mediaCount: items.length });
      });
    }
  }
  return out;
};

export default function HotplaceLiveFeedScreen() {
  const navigate = useNavigate();
  const loc = useLocation();
  const params = useParams();
  const encoded = String(params.placeKey || '');
  const placeKey = useMemo(() => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }, [encoded]);

  const allPosts = (loc.state?.allPosts && Array.isArray(loc.state.allPosts)) ? loc.state.allPosts : [];

  const postsForPlace = useMemo(() => {
    const key = String(loc.state?.placeKey || placeKey || '').trim();
    if (!key) return [];
    return allPosts
      .filter((p) => p && getPlaceKeyForPost(p) === key)
      .sort((a, b) => getPostTimeMs(b) - getPostTimeMs(a));
  }, [allPosts, loc.state?.placeKey, placeKey]);

  const now = Date.now();

  const bestCuts = useMemo(() => {
    if (postsForPlace.length === 0) return [];
    const in48 = postsForPlace.filter((p) => now - getPostTimeMs(p) <= HOURS_48_MS);
    const pool = in48.length > 0 ? in48 : postsForPlace;
    const sorted = [...pool].sort((a, b) => {
      const d = getEngagementScore(b) - getEngagementScore(a);
      if (d !== 0) return d;
      return getPostTimeMs(b) - getPostTimeMs(a);
    });
    const seen = new Set();
    const out = [];
    for (let i = 0; i < sorted.length && out.length < BEST_CUT_MAX; i += 1) {
      const id = String(sorted[i]?.id ?? i);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(sorted[i]);
    }
    return out;
  }, [postsForPlace, now]);

  const flatSlides = useMemo(() => buildFlatBestCutSlides(bestCuts), [bestCuts]);
  const [flatIdx, setFlatIdx] = useState(0);
  const heroSwiperRef = useRef(null);
  const cardTapRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setFlatIdx(0);
  }, [bestCuts]);

  useEffect(() => {
    setFlatIdx((i) => Math.min(i, Math.max(0, flatSlides.length - 1)));
  }, [flatSlides.length]);

  const displayTitle = String(loc.state?.placeKey || placeKey || '실시간 현장').trim();
  const currentSlide = flatSlides[flatIdx] || null;
  const heroPost = currentSlide?.post ?? null;
  const heroAuthorId = heroPost ? getUserIdForPost(heroPost) : '';

  const heroMediaItems = useMemo(() => (heroPost ? getHeroMediaItems(heroPost) : []), [heroPost]);
  const heroMediaIdx = currentSlide?.mediaIndex ?? 0;

  const currentBestCutIndex = useMemo(() => {
    if (!heroPost || bestCuts.length === 0) return 0;
    const i = bestCuts.findIndex((p) => String(p?.id) === String(heroPost.id));
    return i >= 0 ? i : 0;
  }, [heroPost, bestCuts]);

  const slideToFlatIndex = (idx) => {
    const max = Math.max(0, flatSlides.length - 1);
    const next = Math.min(Math.max(0, idx), max);
    setFlatIdx(next);
    heroSwiperRef.current?.slideTo(next);
  };

  /** 각 베스트 컷 게시물이 flatSlides에서 시작하는 인덱스 (한 장짜리면 점 탭용) */
  const postFirstFlatIndex = useMemo(() => {
    const starts = [];
    let acc = 0;
    for (const post of bestCuts) {
      starts.push(acc);
      acc += Math.max(1, getHeroMediaItems(post).length);
    }
    return starts;
  }, [bestCuts]);

  const heroTrustMeta = useMemo(() => {
    if (!heroPost || !heroAuthorId) {
      return { grade: null, regionLabel: '' };
    }
    const authorPosts = allPosts.filter((p) => getUserIdForPost(p) === heroAuthorId);
    const postsArg = authorPosts.length ? authorPosts : null;
    const raw = getTrustRawScore(heroAuthorId, postsArg);
    const { grade } = getTrustGrade(raw, heroAuthorId, postsArg);
    const u = heroPost.user;
    const region =
      String(u?.region || u?.city || u?.location || '').trim() ||
      String(heroPost.region || '').trim() ||
      displayTitle.split(/[\s,·]/)[0]?.trim() ||
      '';
    return { grade, regionLabel: region || '여행' };
  }, [heroPost, heroAuthorId, allPosts, displayTitle]);

  const heroTrustIndex = useMemo(() => {
    if (!heroAuthorId || !heroPost) return null;
    const authorPosts = allPosts.filter((p) => getUserIdForPost(p) === heroAuthorId);
    return Math.round(getTrustScore(heroAuthorId, authorPosts.length ? authorPosts : null));
  }, [heroAuthorId, heroPost, allPosts]);

  const [followHero, setFollowHero] = useState(false);
  useEffect(() => {
    if (!heroAuthorId) {
      setFollowHero(false);
      return;
    }
    setFollowHero(isFollowing(null, heroAuthorId));
    const sync = () => setFollowHero(isFollowing(null, heroAuthorId));
    window.addEventListener('followsUpdated', sync);
    return () => window.removeEventListener('followsUpdated', sync);
  }, [heroAuthorId]);

  const situationPosts = useMemo(() => {
    if (!heroPost?.id) return postsForPlace;
    return postsForPlace.filter((p) => String(p.id) !== String(heroPost.id));
  }, [postsForPlace, heroPost]);

  const onSharePlace = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = displayTitle;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url);
      });
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
  };

  const heroAvatarUrl = heroPost ? getAvatarUrlForPost(heroPost) : null;

  /** 1행: 지역 + 노마드일 때만「비기너」(첨부 시안과 동일). 상위 등급은 2행에 등급명만 표시 */
  const profileLine1Suffix = heroTrustMeta.grade?.id === 'nomad' ? '비기너' : '';

  const showFollowHero = Boolean(heroAuthorId && getCurrentUserId() && getCurrentUserId() !== heroAuthorId);

  const openHeroPost = () => {
    if (!heroPost) return;
    navigate(`/post/${heroPost.id}`, { state: { post: heroPost, allPosts } });
  };

  const onHeroCardPointerDown = (e) => {
    cardTapRef.current = { x: e.clientX, y: e.clientY };
  };

  const onHeroCardPointerUp = (e) => {
    if (e.target.closest?.('button') || e.target.closest?.('.swiper-pagination')) return;
    const d = Math.hypot(e.clientX - cardTapRef.current.x, e.clientY - cardTapRef.current.y);
    if (d < 14) openHeroPost();
  };

  const onFollowHero = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!heroAuthorId) return;
    if (followHero) unfollow(heroAuthorId);
    else follow(heroAuthorId);
    setFollowHero(isFollowing(null, heroAuthorId));
  };

  return (
    <div className="screen-layout flex min-h-screen flex-col bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border-light bg-background-light/95 px-4 py-3 backdrop-blur-md dark:border-border-dark dark:bg-background-dark/95">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
            className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
          >
            <span className="material-symbols-outlined text-2xl text-text-primary-light dark:text-text-primary-dark">
              arrow_back
            </span>
          </button>
          <h1 className="font-manrope min-w-0 truncate text-[17px] font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
            {displayTitle}
          </h1>
        </div>
        <button
          type="button"
          onClick={onSharePlace}
          aria-label="더보기 및 공유"
          className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <span className="material-symbols-outlined text-text-primary-light dark:text-text-primary-dark">more_horiz</span>
        </button>
      </header>

      <div className="screen-content flex min-h-0 flex-1 flex-col overflow-y-auto pb-24 pt-3">
        <div className="px-5">
          {heroPost ? (
            <section className="mb-4" aria-labelledby="best-cut-title">
              <div className="mb-2">
                <h2
                  id="best-cut-title"
                  className="font-manrope text-[16px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100"
                >
                  실시간 베스트 컷
                </h2>
                <p className="mt-0.5 font-inter text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                  48시간 내 반응 순 · 좌우 슬라이드로 게시물·사진 보기
                </p>
              </div>

              <div
                className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                style={{ boxShadow: '0 12px 36px rgba(19, 83, 216, 0.1)' }}
              >
                <div
                  className="relative h-[min(380px,54svh)] w-full max-h-[58vh] bg-zinc-950 sm:h-[380px] sm:max-h-none"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openHeroPost();
                    }
                  }}
                  onPointerDown={onHeroCardPointerDown}
                  onPointerUp={onHeroCardPointerUp}
                  aria-label={
                    flatSlides.length > 1
                      ? '베스트 컷, 좌우로 슬라이드 · 탭하면 게시물로 이동'
                      : '베스트 컷, 탭하면 게시물로 이동'
                  }
                >
                  {flatSlides.length === 0 ? (
                    <div className="h-full w-full bg-zinc-700" />
                  ) : (
                    <Swiper
                      className="h-full w-full [&_.swiper-wrapper]:h-full [&_.swiper-slide]:h-full"
                      speed={300}
                      resistanceRatio={0.85}
                      slidesPerView={1}
                      spaceBetween={0}
                      onSwiper={(s) => {
                        heroSwiperRef.current = s;
                      }}
                      onSlideChange={(s) => setFlatIdx(s.activeIndex)}
                      initialSlide={Math.min(flatIdx, flatSlides.length - 1)}
                      key={bestCuts.map((p) => String(p?.id ?? '')).join(',')}
                    >
                      {flatSlides.map((slide, slideIndex) => (
                        <SwiperSlide key={`${slide.post?.id}-${slide.mediaIndex}-${slideIndex}`}>
                          <div className="relative h-full min-h-[min(380px,54svh)] w-full overflow-hidden bg-zinc-950 sm:min-h-[380px]">
                            {slide.media?.type === 'video' ? (
                              <video
                                src={getDisplayImageUrl(slide.media.uri)}
                                className="h-full w-full object-cover [transform:translateZ(0)]"
                                muted
                                playsInline
                                preload="metadata"
                                autoPlay={flatIdx === slideIndex}
                                loop
                              />
                            ) : slide.media ? (
                              <img
                                src={getDisplayImageUrl(slide.media.uri, { hero: true })}
                                alt=""
                                className="h-full w-full object-cover [transform:translateZ(0)]"
                                loading={slideIndex === 0 ? 'eager' : 'lazy'}
                                decoding="async"
                                fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
                                sizes="100vw"
                              />
                            ) : (
                              <div className="h-full w-full bg-zinc-700" />
                            )}
                          </div>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/30" />

                  <div className="pointer-events-none absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
                    <div
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-inter text-[10px] font-extrabold tracking-wide text-white shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${MOCK_PRIMARY} 0%, #0c3a9e 100%)`,
                        boxShadow: '0 4px 14px rgba(19, 83, 216, 0.4)',
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                        workspace_premium
                      </span>
                      베스트
                    </div>
                  </div>

                  {flatSlides.length > 1 && (
                    <div className="pointer-events-none absolute right-3 top-3 z-10 text-right sm:right-4 sm:top-4">
                      <div className="inline-flex flex-col items-end gap-0.5 rounded-xl bg-black/45 px-2.5 py-1.5 font-inter text-white shadow-sm backdrop-blur-sm">
                        <span className="text-[12px] font-bold tabular-nums leading-none">
                          {flatIdx + 1} / {flatSlides.length}
                        </span>
                        {bestCuts.length > 1 ? (
                          <span className="text-[9px] font-semibold tabular-nums text-white/85">
                            게시물 {currentBestCutIndex + 1} / {bestCuts.length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* 하단 점: 같은 게시물에 미디어가 여러 장이면 해당 미디어 기준, 아니면 베스트 컷 게시물별 */}
                  {heroMediaItems.length > 1 ? (
                    <div className="absolute bottom-[5.25rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-[5.5rem]">
                      {heroMediaItems.map((_, index) => {
                        const targetFlat = flatSlides.findIndex(
                          (s) => s.post && String(s.post.id) === String(heroPost?.id) && s.mediaIndex === index
                        );
                        return (
                          <button
                            key={String(index)}
                            type="button"
                            tabIndex={0}
                            aria-label={`사진 ${index + 1} / ${heroMediaItems.length}`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (targetFlat >= 0) slideToFlatIndex(targetFlat);
                            }}
                            className={`carousel-page-dot inline-flex min-h-0 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 leading-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                              index === heroMediaIdx
                                ? 'h-1.5 w-5 bg-white'
                                : 'h-1.5 w-1.5 bg-white/40 hover:bg-white/55'
                            }`}
                          />
                        );
                      })}
                    </div>
                  ) : bestCuts.length > 1 ? (
                    <div className="absolute bottom-[5.25rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 sm:bottom-[5.5rem]">
                      {bestCuts.map((_, index) => (
                        <button
                          key={String(index)}
                          type="button"
                          tabIndex={0}
                          aria-label={`베스트 컷 게시물 ${index + 1} / ${bestCuts.length}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const start = postFirstFlatIndex[index];
                            if (start != null) slideToFlatIndex(start);
                          }}
                          className={`carousel-page-dot inline-flex min-h-0 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 leading-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                            index === currentBestCutIndex
                              ? 'h-1.5 w-5 bg-white'
                              : 'h-1.5 w-1.5 bg-white/40 hover:bg-white/55'
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/45 to-transparent px-3 pb-2.5 pt-9 sm:px-4 sm:pb-3 sm:pt-10">
                    <div className="flex items-end gap-2 sm:gap-2.5">
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <p className="whitespace-nowrap font-manrope text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/75 drop-shadow-sm">
                          오늘의 작가
                        </p>
                        {heroAvatarUrl ? (
                          <img
                            src={heroAvatarUrl}
                            alt=""
                            className="size-9 rounded-full border-2 border-white object-cover shadow-md ring-1 ring-black/15"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-zinc-900 font-manrope text-sm font-extrabold text-white shadow-md ring-1 ring-black/20">
                            {getUserNameForPost(heroPost).slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-0.5">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0 leading-tight">
                          <span className="font-inter text-[13px] font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                            {getUserNameForPost(heroPost)}
                          </span>
                          <span className="material-symbols-outlined text-[15px] text-white/65" aria-hidden>
                            explore
                          </span>
                          <span className="font-inter text-[11px] font-semibold text-white/90">
                            {heroTrustMeta.regionLabel}
                            {profileLine1Suffix ? ` ${profileLine1Suffix}` : ''}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] leading-tight text-sky-100/95">
                          {heroTrustIndex != null ? (
                            <span className="font-inter font-bold">신뢰지수 {heroTrustIndex}</span>
                          ) : (
                            <span className="font-inter font-semibold text-white/55">신뢰지수 —</span>
                          )}
                          <span className="material-symbols-outlined text-[13px] text-sky-200/85" aria-hidden>
                            explore
                          </span>
                          {heroTrustMeta.grade?.name ? (
                            <span className="font-inter font-bold">{heroTrustMeta.grade.name}</span>
                          ) : null}
                        </div>
                      </div>
                      {showFollowHero ? (
                        <button
                          type="button"
                          onClick={onFollowHero}
                          className={`pointer-events-auto shrink-0 rounded-lg px-2.5 py-1.5 font-inter text-[10px] font-extrabold shadow-md transition-colors ${
                            followHero ? 'bg-white/25 text-white ring-1 ring-white/40' : 'text-white ring-2 ring-white/30'
                          }`}
                          style={followHero ? undefined : { backgroundColor: MOCK_PRIMARY }}
                        >
                          {followHero ? '팔로잉' : '팔로우'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section id="situation-feed-section" aria-labelledby="situation-heading">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="situation-heading" className="font-manrope text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                지금 이 시각 상황
              </h2>
              <div className="flex items-center gap-0.5 font-inter text-[10px] font-bold text-gray-400 dark:text-zinc-500">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                최근 2시간
              </div>
            </div>

            {postsForPlace.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-zinc-400">표시할 게시물이 없어요.</div>
            ) : situationPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">추가로 표시할 제보가 없어요.</p>
            ) : (
              <div id="situation-grid" className="grid grid-cols-2 gap-2">
                {situationPosts.map((post, pi) => {
                  const cover = getGridCoverDisplay(post, getDisplayImageUrl);
                  const tms = getPostTimeMs(post) || Date.now();
                  const ago = getTimeAgo(post.timestamp || post.createdAt || post.time || tms);
                  const caption = String(post.note || post.content || '').trim();
                  const gps = hasGpsPost(post);
                  const exifTag = hasExifForPost(post) ? getExifTagForPost(post) : null;
                  return (
                    <button
                      key={String(post.id)}
                      type="button"
                      onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts } })}
                      className="group text-left transition-transform active:scale-[0.98]"
                    >
                      <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-100 shadow-sm dark:bg-zinc-800">
                        {cover?.mode === 'img' && cover.src ? (
                          <img
                            src={cover.src}
                            alt=""
                            loading={pi < 4 ? 'eager' : 'lazy'}
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : cover?.mode === 'video' && cover.src ? (
                          <video
                            src={cover.src}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        {exifTag ? (
                          <div
                            className="pointer-events-none absolute left-2.5 top-2.5 z-[2] max-w-[90%] truncate rounded-full border px-2 py-1 font-inter text-[9px] font-extrabold dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100"
                            style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.14)', color: '#064e3b' }}
                            title={exifTag.title || exifTag.text}
                          >
                            {exifTag.text}
                          </div>
                        ) : (
                          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-lg bg-black/30 px-2 py-1 font-inter text-[9px] font-bold text-white backdrop-blur-md">
                            {ago}
                          </div>
                        )}
                        {gps ? (
                          <div className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-white/90 p-1 shadow-sm dark:bg-zinc-900/90">
                            <span className="material-symbols-outlined text-[14px] text-gray-700 dark:text-zinc-200">
                              gps_fixed
                            </span>
                          </div>
                        ) : null}
                      </div>
                      {caption ? (
                        <p className="line-clamp-2 px-1 font-inter text-[12px] font-medium leading-tight text-gray-700 dark:text-zinc-300">
                          {caption}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

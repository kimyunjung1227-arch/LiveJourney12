import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDisplayImageUrl } from '../api/upload';
import { getGridCoverDisplay } from '../utils/postMedia';
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

  const [bestCutIdx, setBestCutIdx] = useState(0);
  useEffect(() => {
    setBestCutIdx(0);
  }, [bestCuts]);

  const bestCutActive = bestCuts[bestCutIdx] || null;
  const goBestPrev = () => {
    if (bestCuts.length <= 1) return;
    setBestCutIdx((i) => (i - 1 + bestCuts.length) % bestCuts.length);
  };
  const goBestNext = () => {
    if (bestCuts.length <= 1) return;
    setBestCutIdx((i) => (i + 1) % bestCuts.length);
  };

  const bestCutSwipeRef = useRef({ x0: 0, pid: null, armed: false });
  const bestCutSkipNavRef = useRef(false);
  const SWIPE_PX = 48;

  const onBestCutPointerDown = (e) => {
    if (bestCuts.length <= 1) return;
    bestCutSwipeRef.current = { x0: e.clientX, pid: e.pointerId, armed: true };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onBestCutPointerUp = (e) => {
    const { x0, pid, armed } = bestCutSwipeRef.current;
    bestCutSwipeRef.current = { x0: 0, pid: null, armed: false };
    if (!armed || pid !== e.pointerId || bestCuts.length <= 1) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const dx = e.clientX - x0;
    if (Math.abs(dx) < SWIPE_PX) return;
    bestCutSkipNavRef.current = true;
    if (dx > 0) goBestPrev();
    else goBestNext();
  };

  const onBestCutPointerCancel = (e) => {
    bestCutSwipeRef.current = { x0: 0, pid: null, armed: false };
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const displayTitle = String(loc.state?.placeKey || placeKey || '실시간 현장').trim();
  const heroPost = bestCutActive || postsForPlace[0] || null;
  const heroAuthorId = heroPost ? getUserIdForPost(heroPost) : '';

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

  /** 베스트 작가의 다른 게시물(현재 히어로 제외) — 가로 스크롤 썸네일 */
  const heroAuthorGalleryPosts = useMemo(() => {
    if (!heroAuthorId || !heroPost?.id) return [];
    return allPosts
      .filter((p) => p && getUserIdForPost(p) === heroAuthorId && String(p.id) !== String(heroPost.id))
      .sort((a, b) => getPostTimeMs(b) - getPostTimeMs(a))
      .slice(0, 18);
  }, [allPosts, heroAuthorId, heroPost?.id]);

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
    if (bestCutSkipNavRef.current) {
      bestCutSkipNavRef.current = false;
      return;
    }
    navigate(`/post/${heroPost.id}`, { state: { post: heroPost, allPosts } });
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
              <div className="mb-2 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2
                    id="best-cut-title"
                    className="font-manrope text-[16px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100"
                  >
                    실시간 베스트 컷
                  </h2>
                  <p className="mt-0.5 font-inter text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                    48시간 내 반응 순 · 좌우 스와이프
                  </p>
                </div>
                {bestCuts.length > 1 ? (
                  <span
                    className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 font-inter text-[10px] font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    aria-live="polite"
                  >
                    {bestCutIdx + 1} / {bestCuts.length}
                  </span>
                ) : null}
              </div>

              <div
                className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                style={{ boxShadow: '0 12px 36px rgba(19, 83, 216, 0.1)' }}
              >
                <div
                  className="relative h-[min(300px,42svh)] w-full max-h-[46vh] bg-zinc-950 sm:h-[300px] sm:max-h-none"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openHeroPost();
                    }
                  }}
                  onPointerDown={onBestCutPointerDown}
                  onPointerUp={onBestCutPointerUp}
                  onPointerCancel={onBestCutPointerCancel}
                  onClick={openHeroPost}
                  aria-label={bestCuts.length > 1 ? '베스트 컷 사진, 탭하면 게시물로 이동 · 좌우로 넘기기' : '베스트 컷 사진, 탭하면 게시물로 이동'}
                >
                  {(() => {
                    const p = heroPost;
                    const cover = getGridCoverDisplay(p, getDisplayImageUrl);
                    const src = cover?.src || (Array.isArray(p.images) ? p.images[0] : p.image) || p.thumbnail || '';
                    const url = src ? getDisplayImageUrl(src) : '';
                    const isVideo = cover?.mode === 'video' && url;
                    return isVideo ? (
                      <video
                        src={url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        autoPlay
                        loop
                      />
                    ) : url ? (
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-700" />
                    );
                  })()}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />

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

                  {bestCuts.length > 1 ? (
                    <>
                      <div className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/25 p-1 text-white/90 backdrop-blur-sm">
                        <span className="material-symbols-outlined text-[22px]">chevron_left</span>
                      </div>
                      <div className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/25 p-1 text-white/90 backdrop-blur-sm">
                        <span className="material-symbols-outlined text-[22px]">chevron_right</span>
                      </div>
                      <div className="pointer-events-none absolute bottom-[7rem] left-0 right-0 z-10 flex justify-center gap-1.5 sm:bottom-[7.25rem]">
                        {bestCuts.map((_, i) => (
                          <span
                            key={String(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i === bestCutIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                            }`}
                            aria-hidden
                          />
                        ))}
                      </div>
                    </>
                  ) : null}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/65 to-transparent px-3 pb-3 pt-14 sm:px-4 sm:pb-3.5 sm:pt-16">
                    <div className="flex items-end gap-2.5">
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <p className="whitespace-nowrap font-manrope text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/90 drop-shadow-md">
                          오늘의 작가
                        </p>
                        {heroAvatarUrl ? (
                          <img
                            src={heroAvatarUrl}
                            alt=""
                            className="size-14 rounded-full border-[3px] border-white object-cover shadow-xl ring-2 ring-black/20"
                          />
                        ) : (
                          <div className="flex size-14 items-center justify-center rounded-full border-[3px] border-white bg-zinc-900 font-manrope text-lg font-extrabold text-white shadow-xl ring-2 ring-black/25">
                            {getUserNameForPost(heroPost).slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-0.5">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 leading-tight">
                          <span className="font-inter text-[14px] font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                            {getUserNameForPost(heroPost)}
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-white/70 drop-shadow-md" aria-hidden>
                            explore
                          </span>
                          <span className="font-inter text-[12px] font-semibold text-white/95 drop-shadow-md">
                            {heroTrustMeta.regionLabel}
                            {profileLine1Suffix ? ` ${profileLine1Suffix}` : ''}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] leading-tight text-sky-100">
                          {heroTrustIndex != null ? (
                            <span className="font-inter font-bold drop-shadow-sm">신뢰지수 {heroTrustIndex}</span>
                          ) : (
                            <span className="font-inter font-semibold text-white/55">신뢰지수 —</span>
                          )}
                          <span className="material-symbols-outlined text-[14px] text-sky-200/90" aria-hidden>
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
                          className={`pointer-events-auto shrink-0 rounded-xl px-3 py-2 font-inter text-[11px] font-extrabold shadow-lg transition-colors ${
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

                {heroAuthorGalleryPosts.length > 0 ? (
                  <div className="border-t border-zinc-200/80 bg-zinc-50/95 px-1.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/90">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <p className="font-inter text-[10px] font-extrabold text-zinc-700 dark:text-zinc-200">
                        작가의 다른 사진
                      </p>
                      <span className="font-inter text-[9px] font-semibold text-zinc-400 dark:text-zinc-500">
                        {heroAuthorGalleryPosts.length}장
                      </span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 pl-0.5 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {heroAuthorGalleryPosts.map((post) => {
                        const cover = getGridCoverDisplay(post, getDisplayImageUrl);
                        const src = cover?.src || (Array.isArray(post.images) ? post.images[0] : post.image) || post.thumbnail || '';
                        const thumb = src ? getDisplayImageUrl(src) : '';
                        return (
                          <button
                            key={String(post.id)}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/post/${post.id}`, { state: { post, allPosts } });
                            }}
                            className="relative h-14 w-[3rem] shrink-0 overflow-hidden rounded-lg bg-zinc-200 ring-1 ring-zinc-200/80 transition active:scale-95 dark:bg-zinc-800 dark:ring-zinc-600"
                          >
                            {cover?.mode === 'video' && thumb ? (
                              <video src={thumb} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                            ) : thumb ? (
                              <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
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

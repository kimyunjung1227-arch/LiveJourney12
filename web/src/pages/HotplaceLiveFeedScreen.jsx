import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDisplayImageUrl } from '../api/upload';
import { getGridCoverDisplay } from '../utils/postMedia';
import { getTimeAgo } from '../utils/timeUtils';
import { getTrustGrade, getTrustRawScore } from '../utils/trustIndex';

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

/** 좋아요 가중 + 댓글 — 베스트 컷 정렬용 */
const getEngagementScore = (post) => getLikeCount(post) * 2 + getCommentCount(post);

const getAvatarUrlForPost = (post) => {
  const u = post?.user;
  if (u && typeof u === 'object') {
    const raw = u.profileImage || u.avatar || u.picture;
    if (raw && String(raw).trim()) return getDisplayImageUrl(String(raw));
  }
  return null;
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
    if (postsForPlace.length === 0) {
      return [];
    }
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

  const bestCutAuthorTrustName = useMemo(() => {
    if (!heroPost) return null;
    const uid = getUserIdForPost(heroPost);
    const authorPosts = uid ? allPosts.filter((p) => getUserIdForPost(p) === uid) : [];
    const raw = getTrustRawScore(uid || null, authorPosts.length ? authorPosts : null);
    const { grade } = getTrustGrade(raw, uid || null, authorPosts.length ? authorPosts : null);
    return grade?.name || null;
  }, [heroPost, allPosts]);

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

  const heroDetailLine = useMemo(() => {
    if (!heroPost) return '';
    const loc = String(heroPost.detailedLocation || heroPost.placeName || displayTitle || '').trim();
    const t = getPostTimeMs(heroPost);
    const d = new Date(t);
    const clock = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
    return loc ? `${loc}, ${clock} 촬영` : `${clock} 촬영`;
  }, [heroPost, displayTitle]);

  const heroAvatarUrl = heroPost ? getAvatarUrlForPost(heroPost) : null;

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
          {String(loc.state?.placeKey || placeKey || '실시간 현장').trim()}
        </h1>
        <button
          type="button"
          onClick={onSharePlace}
          aria-label="공유"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-primary-light hover:bg-black/5 dark:text-text-primary-dark dark:hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-2xl">share</span>
        </button>
      </header>

      <div className="screen-content flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="px-4 pb-20 pt-2">
          {heroPost ? (
            <section className="mb-8" aria-labelledby="best-cut-heading">
              <h2 id="best-cut-heading" className="font-manrope mb-3 text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-white">
                실시간 베스트 컷
              </h2>

              <div className="mx-auto w-full max-w-[280px]">
                <button
                  type="button"
                  onPointerDown={onBestCutPointerDown}
                  onPointerUp={onBestCutPointerUp}
                  onPointerCancel={onBestCutPointerCancel}
                  onClick={() => {
                    if (bestCutSkipNavRef.current) {
                      bestCutSkipNavRef.current = false;
                      return;
                    }
                    navigate(`/post/${heroPost.id}`, { state: { post: heroPost, allPosts } });
                  }}
                  className="relative block w-full overflow-hidden rounded-none bg-zinc-100 aspect-[3/4] max-h-[min(48vh,400px)] dark:bg-zinc-800"
                  aria-label={bestCuts.length > 1 ? '베스트 컷 사진, 좌우로 밀어 넘기기' : '베스트 컷 사진'}
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
                      <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700" />
                    );
                  })()}
                </button>

                <button
                  type="button"
                  className="mt-3 flex w-full items-start gap-3 rounded-lg text-left transition hover:bg-zinc-50/80 dark:hover:bg-white/5"
                  onClick={() => navigate(`/post/${heroPost.id}`, { state: { post: heroPost, allPosts } })}
                >
                  {heroAvatarUrl ? (
                    <img
                      src={heroAvatarUrl}
                      alt=""
                      className="size-11 shrink-0 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-600"
                    />
                  ) : (
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-inter text-[15px] font-bold text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-600"
                      aria-hidden
                    >
                      {getUserNameForPost(heroPost).slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-inter text-[15px] font-bold text-zinc-900 dark:text-white">{getUserNameForPost(heroPost)}</span>
                      {bestCutAuthorTrustName ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 font-inter text-[10px] font-extrabold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                          신뢰도 {bestCutAuthorTrustName}
                        </span>
                      ) : null}
                    </div>
                    {heroDetailLine ? (
                      <p className="mt-1 font-inter text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{heroDetailLine}</p>
                    ) : null}
                  </div>
                </button>
              </div>
            </section>
          ) : null}

          <section id="situation-feed-section" className="mt-1" aria-labelledby="situation-heading">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h2 id="situation-heading" className="font-manrope text-lg font-extrabold text-zinc-900 dark:text-white">
                  지금 이 시각 상황
                </h2>
                <p className="font-inter mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">현지 방문객들의 실시간 기록</p>
              </div>
              <button
                type="button"
                className="font-inter shrink-0 text-[12px] font-semibold text-primary"
                onClick={() => document.getElementById('situation-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                전체보기 &gt;
              </button>
            </div>

            {postsForPlace.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">표시할 게시물이 없어요.</div>
            ) : situationPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">추가로 표시할 제보가 없어요.</p>
            ) : (
              <div
                id="situation-grid"
                className="-mx-4 grid w-[calc(100%+2rem)] grid-cols-2 gap-px bg-zinc-300 dark:bg-zinc-700"
              >
                {situationPosts.map((post, pi) => {
                  const cover = getGridCoverDisplay(post, getDisplayImageUrl);
                  const tms = getPostTimeMs(post) || Date.now();
                  const ago = getTimeAgo(post.timestamp || post.createdAt || post.time || tms);
                  return (
                    <button
                      key={String(post.id)}
                      type="button"
                      onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts } })}
                      className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900"
                    >
                      {cover?.mode === 'img' && cover.src ? (
                        <img
                          src={cover.src}
                          alt=""
                          loading={pi < 6 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : cover?.mode === 'video' && cover.src ? (
                        <video
                          src={cover.src}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : null}
                      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 font-inter text-[10px] font-bold text-white">
                        {ago}
                      </div>
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


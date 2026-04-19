import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDisplayImageUrl } from '../api/upload';
import { getGridCoverDisplay } from '../utils/postMedia';
import { formatExifDate } from '../utils/exifExtractor';
import { getTimeAgo } from '../utils/timeUtils';
import { getTrustGrade, getTrustRawScore } from '../utils/trustIndex';

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
    const note = String(heroPost.note || heroPost.content || '').trim();
    const locStr = String(heroPost.detailedLocation || heroPost.placeName || '').trim();
    const t = getPostTimeMs(heroPost);
    const d = new Date(t);
    const nowD = new Date();
    const dayLabel =
      d.toDateString() === nowD.toDateString()
        ? '오늘'
        : d.toDateString() === new Date(nowD.getTime() - 86400000).toDateString()
          ? '어제'
          : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    const clock = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const tail = note ? note.slice(0, 40) + (note.length > 40 ? '…' : '') : locStr || displayTitle;
    return `${dayLabel} ${clock} 촬영${tail ? ` · ${tail}` : ''}`;
  }, [heroPost, displayTitle]);

  const heroAvatarUrl = heroPost ? getAvatarUrlForPost(heroPost) : null;

  const heroPoints = heroPost
    ? Math.min(999, Math.max(10, getEngagementScore(heroPost) * 12 + getLikeCount(heroPost) * 3))
    : 0;
  const heroMedalHint = heroPost && getEngagementScore(heroPost) >= 2;

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

      <div className="screen-content flex-1 overflow-y-auto pb-24 pt-4">
        <div className="px-5">
          {heroPost ? (
            <section className="mb-8">
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
                className="relative w-full overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-zinc-900 dark:shadow-none"
                style={{ boxShadow: '0 0 20px rgba(19, 83, 216, 0.15)' }}
                aria-label={bestCuts.length > 1 ? '오늘의 베스트 컷, 좌우로 넘기기' : '오늘의 베스트 컷'}
              >
                <div className="relative h-[min(420px,72vh)] w-full sm:h-[420px]">
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
                      <div className="h-full w-full bg-zinc-200 dark:bg-zinc-800" />
                    );
                  })()}

                  <div className="pointer-events-none absolute left-4 top-4 z-10 flex gap-2">
                    <div
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg"
                      style={{ backgroundColor: MOCK_PRIMARY }}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>
                        workspace_premium
                      </span>
                      Today&apos;s Best
                    </div>
                  </div>

                  <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/85 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/85">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="relative shrink-0">
                          {heroAvatarUrl ? (
                            <img
                              src={heroAvatarUrl}
                              alt=""
                              className="size-10 rounded-full border-2 object-cover"
                              style={{ borderColor: `${MOCK_PRIMARY}33` }}
                            />
                          ) : (
                            <div
                              className="flex size-10 items-center justify-center rounded-full border-2 bg-blue-50 font-manrope text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                              style={{ borderColor: `${MOCK_PRIMARY}33` }}
                            >
                              {getUserNameForPost(heroPost).slice(0, 1)}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 rounded-full bg-[#FFD700] p-0.5 shadow-sm">
                            <span className="material-symbols-outlined text-[10px] font-bold text-black">star</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-inter text-[13px] font-bold text-gray-900 dark:text-zinc-100">
                            {getUserNameForPost(heroPost)}
                            {bestCutAuthorTrustName ? (
                              <span className="ml-1 text-[10px] font-normal" style={{ color: MOCK_PRIMARY }}>
                                나침반 {bestCutAuthorTrustName}
                              </span>
                            ) : null}
                          </p>
                          <p className="font-inter text-[11px] text-gray-500 dark:text-zinc-400">{heroDetailLine}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="rounded-lg bg-blue-50 px-2 py-1 dark:bg-blue-950/50">
                          <p className="font-inter text-[10px] font-bold" style={{ color: MOCK_PRIMARY }}>
                            +{heroPoints}p
                          </p>
                          <p className="font-inter text-[9px] font-medium text-blue-600 dark:text-blue-300">
                            {heroMedalHint ? '메달후보' : '라이브 포인트'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </section>
          ) : null}

          <section id="situation-feed-section" aria-labelledby="situation-heading">
            <div className="mb-5 flex items-center justify-between">
              <h2 id="situation-heading" className="font-manrope text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                지금 이 시각 상황
              </h2>
              <div className="flex items-center gap-1 font-inter text-[12px] font-bold text-gray-400 dark:text-zinc-500">
                <span className="material-symbols-outlined text-sm">schedule</span>
                최근 2시간
              </div>
            </div>

            {postsForPlace.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-zinc-400">표시할 게시물이 없어요.</div>
            ) : situationPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">추가로 표시할 제보가 없어요.</p>
            ) : (
              <div id="situation-grid" className="grid grid-cols-2 gap-3">
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

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

const pickKeywords = (posts) => {
  const map = new Map();
  const bump = (k, inc = 1) => {
    const key = String(k || '').trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + inc);
  };
  (posts || []).forEach((p) => {
    const tags = [
      ...(Array.isArray(p?.reasonTags) ? p.reasonTags : []),
      ...(Array.isArray(p?.aiHotTags) ? p.aiHotTags : []),
      ...(Array.isArray(p?.tags) ? p.tags : []),
    ];
    tags.forEach((t) => {
      const raw = String(t || '').replace(/#/g, '').replace(/_/g, ' ').trim();
      if (raw) bump(`#${raw}`, 2);
    });
    const text = `${p?.note || ''} ${p?.content || ''}`.trim();
    const hashes = text.match(/#[^\s#]+/g) || [];
    hashes.forEach((h) => bump(h.replace(/_/g, ' '), 3));
    // 가벼운 키워드 추출(과도한 NLP는 생략)
    ['만개', '절정', '사람 많', '사람 보통', '한산', '바람', '웨이팅', '줄', '혼잡', '꽃', '단풍', '야경'].forEach((k) => {
      if (text.includes(k)) bump(`#${k.replace(/\s+/g, '')}`, 1);
    });
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 3);
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
  const recent2h = useMemo(
    () => postsForPlace.filter((p) => now - getPostTimeMs(p) <= 2 * 60 * 60 * 1000),
    [postsForPlace, now],
  );
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

  const briefKeywords = useMemo(() => {
    if (!placeKey) return [];
    return pickKeywords(recent2h);
  }, [placeKey, recent2h]);

  const realtimeSituationLabel = useMemo(() => {
    if (briefKeywords.length > 0) {
      const t = briefKeywords[0].replace(/^#/, '').trim();
      return t ? `실시간: ${t}` : '실시간: 현장 제보';
    }
    return '실시간: 현장 제보';
  }, [briefKeywords]);

  const recentContributorAvatars = useMemo(() => {
    const seen = new Set();
    const urls = [];
    for (const p of recent2h) {
      const id = getUserIdForPost(p) || getUserNameForPost(p);
      if (seen.has(id)) continue;
      seen.add(id);
      const av = getAvatarUrlForPost(p);
      if (av) urls.push(av);
      if (urls.length >= 3) break;
    }
    return urls;
  }, [recent2h]);

  const uniqueRecentUserCount = useMemo(() => {
    const s = new Set();
    recent2h.forEach((p) => s.add(getUserIdForPost(p) || getUserNameForPost(p)));
    return s.size;
  }, [recent2h]);

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

  const plusMoreVisitors = Math.max(0, uniqueRecentUserCount - 3);

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
            <div className="-mx-4 mb-8 w-[calc(100%+2rem)]">
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
                className="relative block min-h-[300px] w-full overflow-hidden rounded-none bg-zinc-100 aspect-[3/4] max-h-[min(88vh,720px)] dark:bg-zinc-800"
                aria-label={bestCuts.length > 1 ? '베스트 컷, 좌우로 밀어 넘기기' : '오늘의 베스트 컷'}
              >
                {(() => {
                  const p = heroPost;
                  const cover = getGridCoverDisplay(p, getDisplayImageUrl);
                  const src = cover?.src || (Array.isArray(p.images) ? p.images[0] : p.image) || p.thumbnail || '';
                  const url = src ? getDisplayImageUrl(src) : '';
                  const isVideo = cover?.mode === 'video' && url;
                  return (
                    <>
                      {isVideo ? (
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
                        <div className="h-full w-full" />
                      )}
                      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[2] flex items-start justify-between gap-2 px-3 pt-3">
                        <span className="rounded-full bg-blue-600 px-3 py-1.5 font-inter text-[11px] font-extrabold text-white shadow-sm">
                          오늘의 베스트 컷
                        </span>
                        <span className="inline-flex max-w-[55%] items-center gap-1 rounded-full bg-teal-600/95 px-2.5 py-1.5 font-inter text-[10px] font-bold leading-tight text-white shadow-sm">
                          <span className="material-symbols-outlined shrink-0 text-[14px]">rss_feed</span>
                          <span className="truncate">{realtimeSituationLabel}</span>
                        </span>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-4 pt-20">
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0 flex-1 font-inter">
                            <p className="text-[15px] font-extrabold tracking-tight text-white drop-shadow-md">
                              Photo by {getUserNameForPost(p)}
                            </p>
                            {bestCutAuthorTrustName ? (
                              <span className="mt-1.5 inline-block rounded bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-amber-950 shadow-sm">
                                신뢰도: {bestCutAuthorTrustName}
                              </span>
                            ) : null}
                            <p className="mt-2 text-[11px] font-medium leading-snug text-white/90">{heroDetailLine}</p>
                          </div>
                          <div className="flex shrink-0 items-center">
                            <div className="flex -space-x-2">
                              {recentContributorAvatars.map((av, i) => (
                                <img
                                  key={`${av}-${i}`}
                                  src={av}
                                  alt=""
                                  className="size-9 rounded-full border-2 border-white object-cover dark:border-zinc-900"
                                />
                              ))}
                            </div>
                            {plusMoreVisitors > 0 ? (
                              <span className="ml-1 flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border-2 border-white bg-zinc-800 pl-0.5 font-inter text-[11px] font-extrabold text-white dark:border-zinc-900">
                                +{plusMoreVisitors}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </button>
            </div>
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


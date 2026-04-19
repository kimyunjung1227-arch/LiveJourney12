import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDisplayImageUrl } from '../api/upload';
import { getGridCoverDisplay } from '../utils/postMedia';
import { formatExifDate } from '../utils/exifExtractor';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxFlat,
  feedGridInfoBox,
  feedGridTitleStyle,
  feedGridDescStyle,
  feedGridMetaRow,
} from '../utils/feedGridCardStyles';

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
  const recent30m = useMemo(
    () => postsForPlace.filter((p) => now - getPostTimeMs(p) <= 30 * 60 * 1000).slice(0, 5),
    [postsForPlace, now],
  );

  const { bestCuts, bestCutsRangeLabel } = useMemo(() => {
    if (postsForPlace.length === 0) {
      return { bestCuts: [], bestCutsRangeLabel: '' };
    }
    const in48 = postsForPlace.filter((p) => now - getPostTimeMs(p) <= HOURS_48_MS);
    const pool = in48.length > 0 ? in48 : postsForPlace;
    const label = in48.length > 0 ? '최근 48시간 · 반응 순' : '이 장소 · 반응 순';
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
    return { bestCuts: out, bestCutsRangeLabel: label };
  }, [postsForPlace, now]);

  const compassCount = useMemo(() => {
    const s = new Set();
    recent2h.forEach((p) => {
      const uid = getUserIdForPost(p);
      if (uid) s.add(uid);
    });
    return s.size;
  }, [recent2h]);

  const briefKeywords = useMemo(() => {
    if (!placeKey) return [];
    return pickKeywords(recent2h);
  }, [placeKey, recent2h]);

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
        <div className="size-10 shrink-0" aria-hidden />
      </header>

      <div className="screen-content flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="px-4 pb-20 pt-3">
          {bestCuts.length > 0 && bestCutActive ? (
            <div className="pt-1">
              <div className="mb-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400/90">Best cut</p>
                  <p className="mt-0.5 text-lg font-black leading-tight text-zinc-900 dark:text-white">실시간 베스트 컷</p>
                </div>
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{bestCutsRangeLabel}</span>
              </div>

              <div className="mx-auto w-full max-w-[260px]">
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
                    navigate(`/post/${bestCutActive.id}`, { state: { post: bestCutActive, allPosts } });
                  }}
                  className="relative block h-[200px] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
                  aria-label={bestCuts.length > 1 ? '베스트 컷, 좌우로 밀어 넘기기' : '베스트 컷'}
                >
                    {(() => {
                      const p = bestCutActive;
                      const cover = getGridCoverDisplay(p, getDisplayImageUrl);
                      const src = cover?.src || (Array.isArray(p.images) ? p.images[0] : p.image) || p.thumbnail || '';
                      const url = src ? getDisplayImageUrl(src) : '';
                      const likes = getLikeCount(p);
                      const comments = getCommentCount(p);
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
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-10">
                            <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-white">
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                                  favorite
                                </span>
                                {likes}
                              </span>
                              {comments > 0 ? (
                                <span className="inline-flex shrink-0 items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[15px]">chat_bubble</span>
                                  {comments}
                                </span>
                              ) : (
                                <span className="shrink-0 truncate text-[11px] font-semibold opacity-95">{getUserNameForPost(p)}</span>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                </button>
              </div>
            </div>
          ) : null}

          {briefKeywords.length > 0 || compassCount > 0 ? (
            <div className={bestCuts.length > 0 ? 'mt-5' : 'pt-1'}>
              {briefKeywords.length > 0 ? (
                <p className="text-[12px] font-semibold leading-snug text-zinc-800 dark:text-zinc-100">{briefKeywords.join(' ')}</p>
              ) : null}
              {compassCount > 0 ? (
                <p
                  className={
                    briefKeywords.length > 0
                      ? 'mt-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400'
                      : 'text-[11px] font-medium text-zinc-500 dark:text-zinc-400'
                  }
                >
                  중계 {compassCount}명 · 2시간
                </p>
              ) : null}
            </div>
          ) : null}

          {recent30m.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-extrabold text-zinc-900 dark:text-zinc-50">방금 전</p>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">최근 30분 · 5장</p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide">
                {recent30m.map((p, ri) => {
                  const cover = getGridCoverDisplay(p, getDisplayImageUrl);
                  const src = cover?.src || (Array.isArray(p.images) ? p.images[0] : p.image) || p.thumbnail || '';
                  const url = src ? getDisplayImageUrl(src) : '';
                  return (
                    <button
                      key={String(p.id)}
                      type="button"
                      onClick={() => navigate(`/post/${p.id}`, { state: { post: p, allPosts } })}
                      className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-2xl bg-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
                    >
                      {url ? (
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                          fetchPriority={ri < 6 ? 'high' : 'auto'}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-extrabold text-zinc-900 dark:text-zinc-50">개별 피드</p>
              {postsForPlace.some(hasExifForPost) ? (
                <span
                  className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-extrabold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  title="촬영 정보(EXIF) 기반"
                >
                  EXIF 태그
                </span>
              ) : null}
            </div>

            {postsForPlace.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">표시할 게시물이 없어요.</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  rowGap: '8px',
                  columnGap: '8px',
                }}
              >
                {postsForPlace.map((post, pi) => {
                  const cover = getGridCoverDisplay(post, getDisplayImageUrl);
                  const exifTag = getExifTagForPost(post);
                  return (
                    <div
                      key={String(post.id)}
                      onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts } })}
                      style={{ ...feedGridCardBoxFlat, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                      role="presentation"
                    >
                      <div style={feedGridImageBoxFlat}>
                        {cover?.mode === 'img' && cover.src ? (
                          <img
                            src={cover.src}
                            alt=""
                            loading="eager"
                            decoding="async"
                            fetchPriority={pi < 4 ? 'high' : 'auto'}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : cover?.mode === 'video' && cover.src ? (
                          <video
                            src={cover.src}
                            muted
                            playsInline
                            preload="metadata"
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : null}
                        {hasExifForPost(post) && exifTag ? (
                          <div
                            className="absolute left-2 top-2 z-[2] max-w-[92%] rounded-full border px-2 py-1 text-[10px] font-extrabold truncate"
                            style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.14)', color: '#064e3b' }}
                            title={exifTag.title || exifTag.text}
                          >
                            {exifTag.text}
                          </div>
                        ) : null}
                      </div>

                      <div style={feedGridInfoBox}>
                        <div style={feedGridTitleStyle}>{getUserNameForPost(post)}</div>
                        {(post.content || post.note) && <div style={feedGridDescStyle}>{post.content || post.note}</div>}
                        <div style={feedGridMetaRow}>
                          <span>{new Date(getPostTimeMs(post) || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="truncate">{String(post.location || '').trim()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


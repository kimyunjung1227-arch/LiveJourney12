import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { getDisplayImageUrl } from '../api/upload';
import { getWeatherByRegion } from '../api/weather';
import {
  getGridCoverDisplay,
  buildMediaItemsFromPost,
  normalizePostForMedia,
  isVideoUri,
  toMediaStr,
} from '../utils/postMedia';
import { getTimeAgo } from '../utils/timeUtils';
import StatusBadge from '../components/StatusBadge';
import { getPhotoStatusFromPost } from '../utils/photoStatus';
import { getValidWeatherSnapshot } from '../utils/weatherSnapshot';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxFlat,
  feedGridInfoBox,
  feedGridDescStyle,
  feedGridMetaRow,
} from '../utils/feedGridCardStyles';

/** 핫플 전용: 그리드에서 사진 비중↑(세로 비율)·하단 텍스트 블록 축소 */
const hotplaceSituationImageBox = {
  ...feedGridImageBoxFlat,
  paddingBottom: '148%',
};

const hotplaceSituationInfoBox = {
  ...feedGridInfoBox,
  padding: '5px 8px 7px',
  gap: 0,
};

const hotplaceSituationDescStyle = {
  ...feedGridDescStyle,
  fontSize: '11px',
  lineHeight: 1.3,
  maxHeight: '1.35em',
  WebkitLineClamp: 1,
};
import { normalizePlaceIdentityKey } from '../utils/placeKeyNormalize';
import { SCREEN_GRID_EAGER_COUNT, SCREEN_IMAGE_HIGH_PRIORITY_COUNT } from '../utils/imgAttrs';

const HOTPLACE_PRIMARY = '#1353d8';

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
    const keyNorm = normalizePlaceIdentityKey(key);
    return allPosts
      .filter((p) => p && normalizePlaceIdentityKey(getPlaceKeyForPost(p)) === keyNorm)
      .sort((a, b) => getPostTimeMs(b) - getPostTimeMs(a));
  }, [allPosts, loc.state?.placeKey, placeKey]);

  const now = Date.now();

  /** 48시간 내 반응 순으로 정렬된 베스트컷 후보 목록 (최대 10개) */
  const bestCutPosts = useMemo(() => {
    if (postsForPlace.length === 0) return [];
    const in48 = postsForPlace.filter((p) => now - getPostTimeMs(p) <= HOURS_48_MS);
    const pool = in48.length > 0 ? in48 : postsForPlace;
    return [...pool]
      .sort((a, b) => {
        const d = getEngagementScore(b) - getEngagementScore(a);
        if (d !== 0) return d;
        return getPostTimeMs(b) - getPostTimeMs(a);
      })
      .slice(0, 10);
  }, [postsForPlace, now]);

  const [bestCutIdx, setBestCutIdx] = useState(0);
  const bestCutSwiperRef = useRef(null);
  const cardTapRef = useRef({ x: 0, y: 0 });

  // 후보 목록 자체가 바뀌면 첫 게시물로 리셋
  useEffect(() => {
    setBestCutIdx(0);
    bestCutSwiperRef.current?.slideTo(0, 0);
  }, [postsForPlace]);

  const displayTitle = String(loc.state?.placeKey || placeKey || '실시간 현장').trim();
  const heroPost = bestCutPosts[bestCutIdx] || null;
  // 베스트컷 캐러셀에 포함된 게시물 전부를 상황 그리드에서 제외
  const bestCutIds = useMemo(
    () => new Set(bestCutPosts.map((p) => String(p.id))),
    [bestCutPosts],
  );
  const situationPosts = useMemo(
    () => postsForPlace.filter((p) => !bestCutIds.has(String(p.id))),
    [postsForPlace, bestCutIds],
  );

  const [weatherByRegion, setWeatherByRegion] = useState({});

  useEffect(() => {
    const regions = new Set();
    situationPosts.forEach((p) => {
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
      results.forEach((r) => {
        if (r) map[r.region] = r.weather;
      });
      setWeatherByRegion((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [situationPosts, weatherByRegion]);

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

  const onHeroCardPointerDown = (e) => {
    cardTapRef.current = { x: e.clientX, y: e.clientY };
  };

  return (
    <div className="screen-layout flex min-h-screen flex-col bg-background-light dark:bg-background-dark">
      <style>
        {`
          .best-cut-swiper.swiper .swiper-wrapper {
            transition-timing-function: cubic-bezier(0.25, 0.8, 0.25, 1) !important;
          }
        `}
      </style>
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
              <div className="mb-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="best-cut-title"
                    className="font-manrope text-[16px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100"
                  >
                    실시간 베스트 컷
                  </h2>
                  <p className="mt-0.5 font-inter text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                    48시간 내 반응 순 베스트 {bestCutPosts.length}개 · 좌우로 게시물 넘기기
                  </p>
                </div>
                {bestCutPosts.length > 1 ? (
                  <span
                    className="shrink-0 font-inter text-[11px] font-bold text-zinc-500 dark:text-zinc-400"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {bestCutIdx + 1} / {bestCutPosts.length}
                  </span>
                ) : null}
              </div>

              <div
                className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
                style={{ boxShadow: '0 12px 36px rgba(19, 83, 216, 0.1)' }}
              >
                <Swiper
                  className="best-cut-swiper h-full w-full [&_.swiper-wrapper]:h-full [&_.swiper-slide]:h-full"
                  speed={400}
                  resistanceRatio={0.85}
                  threshold={8}
                  longSwipesRatio={0.3}
                  slidesPerView={1}
                  spaceBetween={0}
                  onSwiper={(s) => {
                    bestCutSwiperRef.current = s;
                  }}
                  onSlideChange={(s) => setBestCutIdx(s.activeIndex)}
                  key={`bestcut-list-${bestCutPosts.length}`}
                >
                  {bestCutPosts.map((bp, bpIdx) => {
                    const items = getHeroMediaItems(bp);
                    const cover = items[0];
                    const author = getUserNameForPost(bp);
                    const avatarUrl = getAvatarUrlForPost(bp);
                    return (
                      <SwiperSlide key={`bestcut-${bp.id}`}>
                        <div
                          className="relative h-[min(380px,54svh)] w-full max-h-[58vh] bg-zinc-950 sm:h-[380px] sm:max-h-none"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              navigate(`/post/${bp.id}`, { state: { post: bp, allPosts } });
                            }
                          }}
                          onPointerDown={onHeroCardPointerDown}
                          onPointerUp={(e) => {
                            if (e.target.closest?.('button') || e.target.closest?.('.swiper-pagination')) return;
                            const d = Math.hypot(e.clientX - cardTapRef.current.x, e.clientY - cardTapRef.current.y);
                            if (d < 14) navigate(`/post/${bp.id}`, { state: { post: bp, allPosts } });
                          }}
                          aria-label={`베스트 컷 ${bpIdx + 1} / ${bestCutPosts.length} · 탭하면 게시물로 이동`}
                        >
                          {!cover ? (
                            <div className="h-full w-full bg-zinc-700" />
                          ) : cover.type === 'video' ? (
                            <video
                              src={getDisplayImageUrl(cover.uri)}
                              className="h-full w-full object-cover [transform:translateZ(0)]"
                              muted
                              playsInline
                              preload="metadata"
                              autoPlay={bpIdx === bestCutIdx}
                              loop
                            />
                          ) : (
                            <img
                              src={getDisplayImageUrl(cover.uri, { hero: true })}
                              alt=""
                              className="h-full w-full object-cover [transform:translateZ(0)]"
                              loading={bpIdx === 0 ? 'eager' : 'lazy'}
                              decoding="async"
                              fetchPriority={bpIdx < SCREEN_IMAGE_HIGH_PRIORITY_COUNT ? 'high' : 'auto'}
                              sizes="100vw"
                            />
                          )}

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/30" />

                          <div className="pointer-events-none absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
                            <div
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-inter text-[10px] font-extrabold tracking-wide text-white shadow-md"
                              style={{
                                background: `linear-gradient(135deg, ${HOTPLACE_PRIMARY} 0%, #0c3a9e 100%)`,
                                boxShadow: '0 4px 14px rgba(19, 83, 216, 0.4)',
                              }}
                            >
                              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                                workspace_premium
                              </span>
                              베스트 {bpIdx + 1}
                            </div>
                          </div>

                          {items.length > 1 ? (
                            <div className="pointer-events-none absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
                              <div className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 font-inter text-[10px] font-bold text-white backdrop-blur-sm">
                                <span className="material-symbols-outlined text-[12px]">photo_library</span>
                                {items.length}
                              </div>
                            </div>
                          ) : null}

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/45 to-transparent px-3 pb-2.5 pt-8 sm:px-4 sm:pb-3 sm:pt-9">
                            <div className="pointer-events-none flex items-end gap-2 sm:gap-2.5">
                              <div className="flex shrink-0 flex-col items-center gap-1">
                                <p className="whitespace-nowrap font-manrope text-[9px] font-extrabold uppercase tracking-[0.1em] text-white/75 drop-shadow-sm">
                                  베스트 작가
                                </p>
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt=""
                                    className="size-9 rounded-full border-2 border-white object-cover shadow-md ring-1 ring-black/15"
                                  />
                                ) : (
                                  <div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-zinc-900 font-manrope text-sm font-extrabold text-white shadow-md ring-1 ring-black/20">
                                    {author.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 pb-0.5">
                                <div className="flex flex-wrap items-center gap-x-1 gap-y-0 leading-tight">
                                  <span className="font-inter text-[13px] font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
                                    {author}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] leading-tight text-sky-100/95">
                                  <span className="material-symbols-outlined text-[12px] text-sky-200/85" aria-hidden>
                                    favorite
                                  </span>
                                  <span className="font-inter font-bold">{getLikeCount(bp)}</span>
                                  <span className="material-symbols-outlined ml-1 text-[12px] text-sky-200/85" aria-hidden>
                                    chat_bubble
                                  </span>
                                  <span className="font-inter font-bold">{getCommentCount(bp)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>
              </div>

              {/* 베스트컷 페이지 인디케이터 — 5개 이하일 때만 점 */}
              {bestCutPosts.length > 1 && bestCutPosts.length <= 5 ? (
                <div className="mt-2 flex justify-center gap-1.5">
                  {bestCutPosts.map((_, idx) => (
                    <button
                      key={`bcdot-${idx}`}
                      type="button"
                      aria-label={`베스트 ${idx + 1} 으로 이동`}
                      onClick={() => bestCutSwiperRef.current?.slideTo(idx)}
                      className={`h-1.5 cursor-pointer rounded-full border-0 transition-all ${
                        idx === bestCutIdx ? 'w-5 bg-zinc-900 dark:bg-white' : 'w-1.5 bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section id="situation-feed-section" aria-labelledby="situation-heading">
            <div className="mb-2">
              <h2 id="situation-heading" className="font-manrope text-[15px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                지금 이 시각 상황
              </h2>
            </div>

            {postsForPlace.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-zinc-400">표시할 게시물이 없어요.</div>
            ) : situationPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-zinc-400">추가로 표시할 제보가 없어요.</p>
            ) : (
              <div
                id="situation-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  rowGap: '7px',
                  columnGap: '7px',
                  paddingBottom: '16px',
                }}
              >
                {situationPosts.map((post, index) => {
                  const cover = getGridCoverDisplay(post, getDisplayImageUrl);
                  const regionKey =
                    (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
                  const snap = getValidWeatherSnapshot(post);
                  const weather = snap || post.weatherSnapshot || post.weather || weatherByRegion[regionKey] || null;
                  const hasWeather = weather && (weather.icon || weather.temperature);
                  const status = getPhotoStatusFromPost(post);
                  const timeLabel =
                    post.timeLabel ||
                    getTimeAgo(post.photoDate || post.exifData?.photoDate || post.timestamp || post.createdAt || post.time);
                  const descText = (post.content || post.note || '').trim();
                  return (
                    <div
                      key={String(post.id)}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts } })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/post/${post.id}`, { state: { post, allPosts } });
                        }
                      }}
                      style={{
                        ...feedGridCardBoxFlat,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      className="transition-transform active:scale-[0.98]"
                    >
                      <div style={hotplaceSituationImageBox}>
                        {cover?.mode === 'img' && cover.src ? (
                          <img
                            src={cover.src}
                            alt=""
                            loading={index < SCREEN_GRID_EAGER_COUNT ? 'eager' : 'lazy'}
                            decoding="async"
                            fetchPriority={index < SCREEN_IMAGE_HIGH_PRIORITY_COUNT ? 'high' : 'auto'}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : cover?.mode === 'video' && cover.src ? (
                          <video
                            src={cover.src}
                            muted
                            playsInline
                            preload="metadata"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#cbd5e1',
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                              image
                            </span>
                          </div>
                        )}
                        {status !== 'NONE' && (
                          <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3 }}>
                            <StatusBadge status={status} />
                          </div>
                        )}
                      </div>

                      <div style={hotplaceSituationInfoBox}>
                        {descText ? <div style={hotplaceSituationDescStyle}>{descText}</div> : null}
                        <div style={feedGridMetaRow}>
                          <span>{timeLabel}</span>
                          {hasWeather && (weather.icon || weather.temperature) ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {weather.icon ? <span>{weather.icon}</span> : null}
                              {weather.temperature ? <span>{weather.temperature}</span> : null}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
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

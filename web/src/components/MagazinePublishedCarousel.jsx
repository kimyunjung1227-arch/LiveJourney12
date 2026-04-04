import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeAgo } from '../utils/timeUtils';
import { getMapThumbnailUri } from '../utils/postMedia';
import { mediaUrlsFromPost, normalizeSpace } from '../utils/magazinePublishedUi';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';

/** 스무스 스크롤 없음 → 한 장 단위 스냅이 덜 흐트러짐 */
const carouselRowClass =
  'flex w-full min-w-0 flex-row overflow-x-auto snap-x snap-mandatory overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none';

const MAGAZINE_DRAG_MULTIPLIER = 2.35;
/** 장소 가로 슬라이드: 살짝만 넘겨도 다음/이전 칸으로 붙도록 (bias 작을수록 민감) */
const PLACES_ROW_DRAG_MULTIPLIER = 3.6;
const PLACES_SNAP_BIAS = 0.1;

/**
 * pages = scrollLeft / pageWidth 일 때 ceil(pages - snapBias) 로 칸 결정 (bias 작을수록 짧은 스와이프에 반응)
 */
function snapIndexFromScroll(scrollLeft, pageWidth, pageCount, snapBias = 0.35) {
  if (!pageWidth || pageCount < 1) return 0;
  const maxIdx = pageCount - 1;
  const pages = scrollLeft / pageWidth;
  const i = Math.ceil(pages - snapBias);
  return Math.max(0, Math.min(i, maxIdx));
}

function snapHeroToNearestPage(el, pageCount, setIdxState) {
  if (!el || pageCount < 2) return;
  const w = el.clientWidth || el.offsetWidth;
  if (!w) return;
  const i = snapIndexFromScroll(el.scrollLeft, w, pageCount, 0.35);
  el.scrollTo({ left: i * w, behavior: 'auto' });
  setIdxState(i);
}

const collectHeroUrls = (slide, regionPosts) => {
  const set = new Set();
  if (slide?.image) set.add(slide.image);
  const posts = Array.isArray(regionPosts) ? regionPosts : [];
  posts.forEach((p) => {
    mediaUrlsFromPost(p).forEach((u) => u && set.add(u));
    const thumb = getMapThumbnailUri(p);
    if (thumb) set.add(thumb);
  });
  return [...set].filter(Boolean).slice(0, 12);
};

/** 메인 영역: 좌우 스와이프로 사진 넘김 */
function HeroRotator({ urls, resetKey, timeLabel }) {
  const safe = useMemo(() => (Array.isArray(urls) ? urls.filter(Boolean) : []), [urls]);
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef(null);

  const onHeroRelease = useCallback(
    (el) => {
      snapHeroToNearestPage(el, safe.length, setIdx);
    },
    [safe.length]
  );

  const { handleDragStart: handleHeroDragStart } = useHorizontalDragScroll(onHeroRelease, {
    dragMultiplier: MAGAZINE_DRAG_MULTIPLIER,
  });

  useEffect(() => {
    setIdx(0);
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: 0, behavior: 'auto' });
  }, [resetKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || safe.length < 2) return;
    const snap = () => snapHeroToNearestPage(el, safe.length, setIdx);
    el.addEventListener('scrollend', snap);
    const onTouchEnd = () => {
      requestAnimationFrame(() => requestAnimationFrame(snap));
    };
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('scrollend', snap);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [resetKey, safe.length]);

  const onHeroScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth || el.offsetWidth;
    if (!w || !safe.length) return;
    setIdx(snapIndexFromScroll(el.scrollLeft, w, safe.length, 0.35));
  };

  if (!safe.length) {
    return (
      <div className="relative flex min-h-[200px] w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
        <span className="material-symbols-outlined text-5xl text-zinc-400">photo</span>
      </div>
    );
  }

  const heroStripClass =
    'flex h-full w-full min-w-0 flex-row overflow-x-auto snap-x snap-mandatory overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none';

  return (
    <div className="relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      <div className="relative aspect-[3/4] max-h-[min(300px,42dvh)] w-full">
        <div
          ref={scrollRef}
          onScroll={onHeroScroll}
          onMouseDown={handleHeroDragStart}
          className={heroStripClass}
          style={{ touchAction: 'pan-x' }}
        >
          {safe.map((src, i) => (
            <div
              key={`${resetKey}-${src}-${i}`}
              className="relative h-full w-full min-w-0 shrink-0 grow-0 basis-full snap-start snap-always"
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col gap-2">
          <span className="inline-flex rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-md shadow-primary/30">
            {timeLabel}
          </span>
        </div>
        {safe.length > 1 && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
            {safe.map((_, i) => (
              <span
                key={`dot-${i}`}
                className={`block shrink-0 rounded-full transition-all duration-200 ease-out ${
                  i === idx
                    ? 'h-1.5 w-5 bg-white'
                    : 'h-1.5 w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 발행 매거진: 제목·가로 슬라이드(장소)·실시간 게시물이 한 세로 스크롤에 함께 움직임
 */
const MagazinePublishedCarousel = ({ slides, postsPerSlide = [], variant = 'list' }) => {
  const navigate = useNavigate();
  const placesRowRef = useRef(null);
  const [placeSlideIdx, setPlaceSlideIdx] = useState(0);

  const slidesStableKey = useMemo(
    () => (slides || []).map((s, i) => `${i}-${s?.sectionIndex ?? ''}-${s?.placeTitle ?? ''}`).join('|'),
    [slides]
  );

  const snapPlacesToNearest = useCallback(
    (el) => {
      const node = el || placesRowRef.current;
      if (!node || slides.length < 2) return;
      const w = node.clientWidth || node.offsetWidth;
      if (!w) return;
      const i = snapIndexFromScroll(node.scrollLeft, w, slides.length, PLACES_SNAP_BIAS);
      node.scrollTo({ left: i * w, behavior: 'auto' });
      setPlaceSlideIdx(i);
    },
    [slides.length]
  );

  const { handleDragStart: handlePlacesDragStart } = useHorizontalDragScroll(snapPlacesToNearest, {
    dragMultiplier: PLACES_ROW_DRAG_MULTIPLIER,
  });

  useEffect(() => {
    setPlaceSlideIdx(0);
    const el = placesRowRef.current;
    if (el) el.scrollTo({ left: 0, behavior: 'auto' });
  }, [slidesStableKey]);

  useEffect(() => {
    const el = placesRowRef.current;
    if (!el || slides.length < 2) return;
    const snap = () => snapPlacesToNearest(el);
    el.addEventListener('scrollend', snap);
    const onTouchEnd = () => {
      requestAnimationFrame(() => requestAnimationFrame(snap));
    };
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('scrollend', snap);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [slides.length, slidesStableKey, snapPlacesToNearest]);

  const onPlacesRowScroll = (e) => {
    const el = e.currentTarget;
    const w = el.clientWidth || el.offsetWidth;
    if (!w || !slides.length) return;
    setPlaceSlideIdx(snapIndexFromScroll(el.scrollLeft, w, slides.length, PLACES_SNAP_BIAS));
  };

  const scrollToPlaceSlide = (index) => {
    const el = placesRowRef.current;
    if (!el || !slides.length) return;
    const w = el.clientWidth || el.offsetWidth;
    if (!w) return;
    const i = Math.max(0, Math.min(index, slides.length - 1));
    el.scrollTo({ left: w * i, behavior: 'auto' });
    setPlaceSlideIdx(i);
  };

  const handleFeaturedClick = (slide) => {
    if (variant === 'detail') return;
    if (slide?.kind === 'magazine' && slide.mag?.id) {
      navigate(`/magazine/${slide.mag.id}`, { state: { magazine: slide.mag } });
    } else if (slide?.postId) {
      navigate(`/post/${slide.postId}`);
    } else {
      navigate('/search');
    }
  };

  const handleAskLight = (e, slide) => {
    e?.stopPropagation?.();
    const placeTitle = String(slide?.placeTitle || '').trim() || '이 장소';
    const askQuery = String(slide?.askQuery || slide?.placeTitle || '').trim() || placeTitle;
    navigate('/chat', {
      state: {
        magazineAsk: {
          placeTitle,
          askQuery,
          presetMessage: `${placeTitle} 지금 붐비나요? 웨이팅·주차 알려주세요.`,
        },
      },
    });
  };

  if (!slides.length) return null;

  return (
    <div className="w-full">
      <h2 className="mb-3 text-xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-50">
        {slides[0]?.magTitle}
      </h2>

      <div className="w-full min-w-0 overflow-hidden">
      <div
        ref={placesRowRef}
        onScroll={onPlacesRowScroll}
        onMouseDown={handlePlacesDragStart}
        className={carouselRowClass}
        style={{ touchAction: 'pan-x' }}
        role="region"
        aria-label="장소별 매거진 슬라이드"
      >
        {slides.map((slide, i) => {
          const regionPosts = Array.isArray(postsPerSlide[i]) ? postsPerSlide[i] : [];
          const heroUrls = collectHeroUrls(slide, regionPosts);
          const heroResetKey = `${slide.sectionIndex}-${i}`;

          const sectionHeading = slide.sectionLabel || `장소 ${(slide.sectionIndex ?? i) + 1}`;

          return (
            <div
              key={`slide-${slide.sectionIndex}-${i}`}
              className="box-border w-full min-w-0 max-w-full shrink-0 grow-0 basis-full snap-start snap-always px-0"
            >
              <article className="w-full max-w-full pb-1">
                {variant === 'detail' ? (
                  <div className="w-full max-w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-gray-900">
                    <HeroRotator urls={heroUrls} resetKey={heroResetKey} timeLabel={slide.timeLabel} />
                    <div className="p-4">
                      <p className="mb-1 m-0 text-[11px] font-extrabold uppercase tracking-wide text-primary">
                        {sectionHeading}
                      </p>
                      <h3 className="mb-1 text-base font-bold leading-snug text-gray-900 dark:text-gray-50">
                        {slide.placeTitle}
                      </h3>
                      {slide.locationInfoLine ? (
                        <p className="mb-2 m-0 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                          {slide.locationInfoLine}
                        </p>
                      ) : null}
                      <p className="mb-3 m-0 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">
                        {slide.description}
                      </p>
                      {slide.regionSummary && (
                        <div className="mb-3 rounded-lg bg-cyan-50/70 px-2.5 py-1.5 text-[11px] text-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100">
                          <span className="mr-1 font-semibold">AI 요약</span>
                          {slide.regionSummary}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleAskLight(e, slide)}
                        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/35 bg-primary/[0.07] py-2.5 px-3 text-[13px] font-semibold text-primary shadow-none transition hover:bg-primary/12 active:scale-[0.99] dark:border-primary/45 dark:bg-primary/10 dark:text-primary"
                      >
                        <span className="material-symbols-outlined text-[17px] text-primary" style={{ fontVariationSettings: '"FILL" 0' }}>
                          chat_bubble
                        </span>
                        지금 여기 장소에 대해 물어보기
                      </button>
                      {Array.isArray(slide.aroundDisplay) && slide.aroundDisplay.length > 0 ? (
                        <div className="mb-1 rounded-xl border border-zinc-100 bg-zinc-50/90 p-3 dark:border-zinc-700 dark:bg-zinc-900/45">
                          <h4 className="m-0 mb-1 text-[13px] font-bold text-gray-900 dark:text-gray-50">
                            {sectionHeading} 주변, 같이 가보면 좋은 곳
                          </h4>
                          <p className="m-0 mb-2.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                            소개해 둔 주변 명소·맛집이에요. 피드에 새 사진이 올라오면 썸네일이 갱신돼요.
                          </p>
                          <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {slide.aroundDisplay.map((ar) => (
                              <div
                                key={ar.id}
                                className="w-[132px] shrink-0 overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900/60"
                              >
                                <div className="relative aspect-[4/3] bg-zinc-200 dark:bg-zinc-800">
                                  {ar.image ? (
                                    <img src={ar.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                      <span className="material-symbols-outlined text-2xl">storefront</span>
                                    </div>
                                  )}
                                </div>
                                <div className="px-2 py-1.5">
                                  <p className="m-0 truncate text-[11px] font-bold text-gray-900 dark:text-gray-50">{ar.name}</p>
                                  {ar.desc ? (
                                    <p className="m-0 mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                                      {ar.desc}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-gray-900">
                      <HeroRotator urls={heroUrls} resetKey={heroResetKey} timeLabel={slide.timeLabel} />
                      <div className="p-4">
                        <p className="mb-1 m-0 text-[11px] font-extrabold uppercase tracking-wide text-primary">
                          {sectionHeading}
                        </p>
                        <h3 className="mb-1 text-base font-bold leading-snug text-gray-900 dark:text-gray-50">
                          {slide.placeTitle}
                        </h3>
                        {slide.locationInfoLine ? (
                          <p className="mb-2 m-0 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                            {slide.locationInfoLine}
                          </p>
                        ) : null}
                        <p className="mb-3 m-0 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">
                          {slide.description}
                        </p>
                        {slide.regionSummary && (
                          <div className="mb-3 rounded-lg bg-cyan-50/70 px-2.5 py-1.5 text-[11px] text-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100">
                            <span className="mr-1 font-semibold">AI 요약</span>
                            {slide.regionSummary}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleAskLight(e, slide)}
                          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/35 bg-primary/[0.07] py-2.5 px-3 text-[13px] font-semibold text-primary shadow-none transition hover:bg-primary/12 active:scale-[0.99] dark:border-primary/45 dark:bg-primary/10 dark:text-primary"
                        >
                          <span className="material-symbols-outlined text-[17px] text-primary" style={{ fontVariationSettings: '"FILL" 0' }}>
                            chat_bubble
                          </span>
                          지금 여기 장소에 대해 물어보기
                        </button>
                        {Array.isArray(slide.aroundDisplay) && slide.aroundDisplay.length > 0 ? (
                          <div className="mb-1 rounded-xl border border-zinc-100 bg-zinc-50/90 p-3 dark:border-zinc-700 dark:bg-zinc-900/45">
                            <h4 className="m-0 mb-1 text-[13px] font-bold text-gray-900 dark:text-gray-50">
                              {sectionHeading} 주변, 같이 가보면 좋은 곳
                            </h4>
                            <p className="m-0 mb-2.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                              소개해 둔 주변 명소·맛집이에요. 피드에 새 사진이 올라오면 썸네일이 갱신돼요.
                            </p>
                            <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {slide.aroundDisplay.map((ar) => (
                                <div
                                  key={ar.id}
                                  className="w-[132px] shrink-0 overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900/60"
                                >
                                  <div className="relative aspect-[4/3] bg-zinc-200 dark:bg-zinc-800">
                                    {ar.image ? (
                                      <img src={ar.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                        <span className="material-symbols-outlined text-2xl">storefront</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="px-2 py-1.5">
                                    <p className="m-0 truncate text-[11px] font-bold text-gray-900 dark:text-gray-50">{ar.name}</p>
                                    {ar.desc ? (
                                      <p className="m-0 mt-0.5 line-clamp-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                                        {ar.desc}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFeaturedClick(slide)}
                      className="mt-2 w-full rounded-xl py-2 text-[13px] font-semibold text-primary hover:bg-primary/5"
                    >
                      이 매거진 상세 보기
                    </button>
                  </>
                )}

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="m-0 text-[15px] font-bold text-gray-900 dark:text-gray-50">실시간 게시물</h3>
                    <button
                      type="button"
                      onClick={() => navigate('/main')}
                      className="m-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-primary/90 hover:underline"
                    >
                      전체보기
                    </button>
                  </div>
                  {regionPosts.length === 0 ? (
                    <p className="m-0 py-3 text-[12px] text-gray-500">이 장소와 맞는 사진이 아직 없어요.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {regionPosts.map((post) => {
                        const uri = getMapThumbnailUri(post);
                        const label = getTimeAgo(post.timestamp || post.createdAt);
                        const loc =
                          normalizeSpace(post.detailedLocation || post.placeName || post.location || '') ||
                          '여행 기록';
                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => navigate(`/post/${post.id}`)}
                            className="w-full overflow-hidden rounded-xl border border-zinc-100 bg-white text-left shadow-sm transition-shadow hover:shadow dark:border-zinc-800 dark:bg-gray-900"
                          >
                            <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
                              {uri ? (
                                <img src={uri} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                  <span className="material-symbols-outlined text-3xl">image</span>
                                </div>
                              )}
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-start">
                                <span className="inline-flex max-w-full truncate rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary backdrop-blur-sm dark:bg-primary/25 dark:text-primary">
                                  {label}
                                </span>
                              </div>
                            </div>
                            <div className="px-1.5 py-1.5">
                              <p className="m-0 truncate text-[12px] font-bold text-gray-900 dark:text-gray-50">{loc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            </div>
          );
        })}
      </div>
      </div>

      {/* 게시물 상세 미디어 인디케이터와 동일: 땡땡이 + 현재 막대 (밝은 배경용 zinc 톤) */}
      {slides.length > 1 && (
        <div className="mt-3 flex flex-col items-center gap-1 px-2 pb-1" aria-live="polite">
          <span className="sr-only">장소 {slides.length}곳, 현재 {placeSlideIdx + 1}번째</span>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="장소 슬라이드">
            {slides.map((_, i) => (
              <button
                key={`place-idx-${i}`}
                type="button"
                role="tab"
                aria-selected={i === placeSlideIdx}
                aria-label={`장소 ${i + 1} / ${slides.length}`}
                className={`carousel-page-dot inline-flex min-h-0 min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 leading-none transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 ${
                  i === placeSlideIdx
                    ? 'h-1.5 w-5 bg-zinc-800 dark:bg-zinc-100'
                    : 'h-1.5 w-1.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollToPlaceSlide(i);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MagazinePublishedCarousel;

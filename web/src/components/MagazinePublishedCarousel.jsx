import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { getTimeAgo } from '../utils/timeUtils';
import { getMapThumbnailUri } from '../utils/postMedia';
import { mediaUrlsFromPost, normalizeSpace } from '../utils/magazinePublishedUi';
import MagazineFieldVoices from './MagazineFieldVoices';

const SWIPER_SPEED = 280;
const SWIPER_RESISTANCE = 0.85;
const SECTION_DIV = 'border-t border-zinc-100 pt-3 mt-3 dark:border-zinc-800';
const CARD_SHELL =
  'w-full max-w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-gray-900';
const ASK_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/35 bg-primary/[0.07] py-2.5 px-3 text-[13px] font-semibold text-primary shadow-none transition hover:bg-primary/12 active:scale-[0.99] dark:border-primary/45 dark:bg-primary/10 dark:text-primary';

const collectHeroUrls = (slide, regionPosts) => {
  const set = new Set();
  if (slide?.image) set.add(slide.image);
  (Array.isArray(regionPosts) ? regionPosts : []).forEach((p) => {
    mediaUrlsFromPost(p).forEach((u) => u && set.add(u));
    const thumb = getMapThumbnailUri(p);
    if (thumb) set.add(thumb);
  });
  return [...set].filter(Boolean).slice(0, 5);
};

function HeroRotator({ urls, resetKey, timeLabel, hideMedia = false }) {
  const safe = useMemo(() => (Array.isArray(urls) ? urls.filter(Boolean).slice(0, 5) : []), [urls]);
  const swiperRef = useRef(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    swiperRef.current?.slideTo(0, 0);
  }, [resetKey]);

  return (
    <div className="relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      <div className="relative aspect-[3/4] max-h-[min(300px,42dvh)] w-full">
        <Swiper
          nested
          touchReleaseOnEdges
          key={resetKey}
          onSwiper={(s) => {
            swiperRef.current = s;
          }}
          onSlideChange={(s) => setIdx(s.activeIndex)}
          initialSlide={0}
          speed={SWIPER_SPEED}
          resistanceRatio={SWIPER_RESISTANCE}
          className="h-full w-full"
        >
          {!hideMedia && safe.length > 0 ? (
            safe.map((src, i) => (
              <SwiperSlide key={`${resetKey}-hero-${i}`} className="!flex h-full">
                <div className="relative h-full min-h-0 w-full min-w-0 flex-1 bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    draggable={false}
                  />
                </div>
              </SwiperSlide>
            ))
          ) : (
            <SwiperSlide className="!flex h-full">
              <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <div className="flex flex-col items-center gap-1 text-zinc-400">
                  <span className="material-symbols-outlined text-5xl">hide_image</span>
                  <span className="text-[11px] font-semibold">미리보기에서는 사진을 숨깁니다</span>
                </div>
              </div>
            </SwiperSlide>
          )}
        </Swiper>
        <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col gap-2">
          <span className="inline-flex rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-md shadow-primary/30">
            {timeLabel}
          </span>
        </div>
        {!hideMedia && safe.length > 1 ? (
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
            {safe.map((_, i) => (
              <span
                key={`dot-${i}`}
                className={`block shrink-0 rounded-full transition-all duration-200 ease-out ${
                  i === idx ? 'h-1.5 w-5 bg-white' : 'h-1.5 w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AroundRecommendGrid({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className={SECTION_DIV}>
      <h4 className="m-0 mb-2 text-[12px] font-bold text-gray-900 dark:text-gray-50">주변 맛집 · 명소 추천</h4>
      <div className="grid grid-cols-3 gap-2">
        {items.map((ar) => (
          <div
            key={ar.id}
            className="min-w-0 overflow-hidden rounded-md border border-zinc-100 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40"
          >
            <div className="relative h-[52px] w-full bg-zinc-100 dark:bg-zinc-800">
              {ar.image ? (
                <img src={ar.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </div>
              )}
            </div>
            <p className="m-0 px-1 py-1 text-center text-[10px] font-semibold leading-[1.3] text-gray-800 line-clamp-2 dark:text-gray-100">
              {ar.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AskPlaceButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className={ASK_BUTTON_CLASS}>
      <span
        className="material-symbols-outlined text-[17px] text-primary"
        style={{ fontVariationSettings: '"FILL" 0' }}
      >
        chat_bubble
      </span>
      <span className="flex flex-col items-center leading-tight">
        <span className="text-[13px] font-semibold">가장 많이 묻는 실시간 질문</span>
        <span className="text-[12px] font-bold">바로 물어보기</span>
      </span>
    </button>
  );
}

/** 장소 카드 공통: 제목·사진·본문·요약·현장·주변·질문 (detail / list 동일) */
function MagazinePlaceCardInner({ slide, sectionHeading, heroUrls, heroResetKey, onAskClick, hideMedia = false }) {
  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <p className="mb-1 m-0 text-[11px] font-extrabold uppercase tracking-wide text-primary">{sectionHeading}</p>
        <h3 className="m-0 text-lg font-extrabold leading-snug text-gray-900 dark:text-gray-50">
          {slide.placeTitle}
        </h3>

        <div className="mt-2 space-y-2">
          {slide.locationTitle ? (
            <div>
              <p className="m-0 text-[11px] font-bold text-gray-400 dark:text-gray-500">위치이름</p>
              <p className="m-0 text-[13px] font-semibold leading-snug text-gray-800 dark:text-gray-100">
                {slide.locationTitle}
              </p>
            </div>
          ) : null}
          {slide.locationInfoLine ? (
            <div>
              <p className="m-0 text-[11px] font-bold text-gray-400 dark:text-gray-500">위치정보</p>
              <p className="m-0 text-[12px] font-medium leading-snug text-gray-600 dark:text-gray-300">
                {slide.locationInfoLine}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={SECTION_DIV}>
        <HeroRotator urls={heroUrls} resetKey={heroResetKey} timeLabel={slide.timeLabel} hideMedia={hideMedia} />
      </div>

      <div className="px-4 pb-4">
        <section className={SECTION_DIV}>
          <h4 className="m-0 mb-2 text-[12px] font-bold text-gray-900 dark:text-gray-50">장소설명</h4>
          <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700 dark:text-gray-200">
            {slide.description}
          </p>
        </section>

        {slide.regionSummary ? (
          <section className={SECTION_DIV}>
            <div className="rounded-lg bg-cyan-50/70 px-2.5 py-2 text-[11px] leading-relaxed text-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100">
              {slide.regionSummary}
            </div>
          </section>
        ) : null}

        <section className={SECTION_DIV}>
          <MagazineFieldVoices voices={slide.fieldVoices} />
        </section>

        <section className={SECTION_DIV}>
          <AroundRecommendGrid items={slide.aroundDisplay} />
        </section>

        <div className={SECTION_DIV}>
          <AskPlaceButton onClick={onAskClick} />
        </div>
      </div>
    </>
  );
}

function RealtimePostGrid({ posts, onOpenPost, onOpenMain, hideMedia = false }) {
  if (hideMedia) return null;
  return (
    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-bold text-gray-900 dark:text-gray-50">실시간으로 올라오는 사진</h3>
        <button
          type="button"
          onClick={onOpenMain}
          className="m-0 cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-primary/90 hover:underline"
        >
          전체보기
        </button>
      </div>
      {posts.length === 0 ? (
        <p className="m-0 py-3 text-[12px] text-gray-500">이 장소와 맞는 사진이 아직 없어요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {posts.map((post) => {
            const uri = getMapThumbnailUri(post);
            const label = getTimeAgo(post.timestamp || post.createdAt);
            const loc =
              normalizeSpace(post.detailedLocation || post.placeName || post.location || '') || '여행 기록';
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => onOpenPost(post.id)}
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
  );
}

const MagazinePublishedCarousel = ({ slides, postsPerSlide = [], variant = 'list', hideMedia = false }) => {
  const navigate = useNavigate();
  const placesSwiperRef = useRef(null);
  const [placeSlideIdx, setPlaceSlideIdx] = useState(0);

  const slidesStableKey = useMemo(
    () => (slides || []).map((s, i) => `${i}-${s?.sectionIndex ?? ''}-${s?.placeTitle ?? ''}`).join('|'),
    [slides]
  );

  useEffect(() => {
    setPlaceSlideIdx(0);
    placesSwiperRef.current?.slideTo(0, 0);
  }, [slidesStableKey]);

  const scrollToPlaceSlide = useCallback((index) => {
    const s = placesSwiperRef.current;
    if (!s || !slides.length) return;
    const i = Math.max(0, Math.min(index, slides.length - 1));
    s.slideTo(i);
    setPlaceSlideIdx(i);
  }, [slides.length]);

  const handleFeaturedClick = useCallback(
    (slide) => {
      if (variant === 'detail') return;
      if (slide?.kind === 'magazine' && slide.mag?.id) {
        navigate(`/magazine/${slide.mag.id}`, { state: { magazine: slide.mag } });
      } else if (slide?.postId) {
        navigate(`/post/${slide.postId}`);
      } else {
        navigate('/search');
      }
    },
    [variant, navigate]
  );

  const handleAskLight = useCallback((e, slide) => {
    e?.stopPropagation?.();
    const placeTitle = String(slide?.placeTitle || '').trim() || '이 장소';
    const askQuery = String(slide?.askQuery || slide?.placeTitle || '').trim() || placeTitle;
    const locationInfoLine = String(slide?.locationInfoLine || '').trim();
    navigate('/chat', {
      state: {
        magazineAsk: {
          placeTitle,
          askQuery,
          locationInfoLine,
          suggestedQuestions: [
            '주차장 여유 있나요?',
            '지금 꽃 많이 피었나요?',
            '웨이팅/혼잡도 어떤가요?',
            '바람/체감온도 어때요? 겉옷 필요할까요?',
          ],
        },
      },
    });
  }, [navigate]);

  const goMain = useCallback(() => navigate('/main'), [navigate]);
  const openPost = useCallback((id) => navigate(`/post/${id}`), [navigate]);

  if (!slides.length) return null;

  return (
    <div className="w-full">
      <h2 className="mb-3 text-xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-gray-50">
        {slides[0]?.magTitle}
      </h2>

      <Swiper
        key={slidesStableKey}
        onSwiper={(sw) => {
          placesSwiperRef.current = sw;
        }}
        onSlideChange={(sw) => setPlaceSlideIdx(sw.activeIndex)}
        slidesPerView={1}
        spaceBetween={0}
        speed={SWIPER_SPEED}
        resistanceRatio={SWIPER_RESISTANCE}
        className="w-full min-w-0 overflow-hidden"
        role="region"
        aria-label="장소별 매거진 슬라이드"
      >
        {slides.map((slide, i) => {
          const regionPosts = Array.isArray(postsPerSlide[i]) ? postsPerSlide[i] : [];
          const heroUrls = collectHeroUrls(slide, regionPosts);
          const heroResetKey = `${slide.sectionIndex}-${i}`;
          const sectionHeading = slide.sectionLabel || `장소 ${(slide.sectionIndex ?? i) + 1}`;

          return (
            <SwiperSlide
              key={`slide-${slide.sectionIndex}-${i}`}
              className="!box-border w-full min-w-0 max-w-full shrink-0 px-0"
            >
              <article className="w-full max-w-full pb-1">
                {variant === 'detail' ? (
                  <div className={CARD_SHELL}>
                    <MagazinePlaceCardInner
                      slide={slide}
                      sectionHeading={sectionHeading}
                      heroUrls={heroUrls}
                      heroResetKey={heroResetKey}
                      onAskClick={(e) => handleAskLight(e, slide)}
                      hideMedia={hideMedia}
                    />
                  </div>
                ) : (
                  <>
                    <div className={CARD_SHELL}>
                      <MagazinePlaceCardInner
                        slide={slide}
                        sectionHeading={sectionHeading}
                        heroUrls={heroUrls}
                        heroResetKey={heroResetKey}
                        onAskClick={(e) => handleAskLight(e, slide)}
                        hideMedia={hideMedia}
                      />
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

                <RealtimePostGrid posts={regionPosts} onOpenPost={openPost} onOpenMain={goMain} hideMedia={hideMedia} />
              </article>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {slides.length > 1 ? (
        <div className="mt-3 flex flex-col items-center gap-1 px-2 pb-1" aria-live="polite">
          <span className="sr-only">
            장소 {slides.length}곳, 현재 {placeSlideIdx + 1}번째
          </span>
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
      ) : null}
    </div>
  );
};

export default MagazinePublishedCarousel;

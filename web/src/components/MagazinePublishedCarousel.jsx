import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeAgo } from '../utils/timeUtils';
import { getMapThumbnailUri } from '../utils/postMedia';
import { mediaUrlsFromPost, normalizeSpace } from '../utils/magazinePublishedUi';

const carouselRowClass =
  'flex w-full flex-row overflow-x-auto snap-x snap-mandatory overscroll-x-contain touch-pan-x scroll-smooth [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

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

  useEffect(() => {
    setIdx(0);
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: 0, behavior: 'auto' });
  }, [resetKey]);

  const onHeroScroll = (e) => {
    const el = e.currentTarget;
    const w = el.offsetWidth;
    if (!w || !safe.length) return;
    const i = Math.round(el.scrollLeft / w);
    setIdx(Math.max(0, Math.min(i, safe.length - 1)));
  };

  if (!safe.length) {
    return (
      <div className="relative flex min-h-[200px] w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
        <span className="material-symbols-outlined text-5xl text-zinc-400">photo</span>
      </div>
    );
  }

  const heroStripClass =
    'flex h-full w-full flex-row overflow-x-auto snap-x snap-mandatory overscroll-x-contain touch-pan-x scroll-smooth [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <div className="relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      <div className="relative aspect-[3/4] max-h-[min(300px,42dvh)] w-full">
        <div ref={scrollRef} onScroll={onHeroScroll} className={heroStripClass}>
          {safe.map((src, i) => (
            <div
              key={`${resetKey}-${src}-${i}`}
              className="relative h-full min-w-full shrink-0 snap-center snap-always"
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
          <div className="pointer-events-none absolute bottom-2 right-2 z-20 flex items-center gap-1.5">
            {safe.map((_, i) => (
              <span
                key={`dot-${i}`}
                className={`shrink-0 rounded-full transition-all duration-200 ease-out ${
                  i === idx
                    ? 'h-1.5 w-[18px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]'
                    : 'h-1.5 w-1.5 bg-white/45'
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

      <div className={carouselRowClass}>
        {slides.map((slide, i) => {
          const regionPosts = Array.isArray(postsPerSlide[i]) ? postsPerSlide[i] : [];
          const heroUrls = collectHeroUrls(slide, regionPosts);
          const heroResetKey = `${slide.sectionIndex}-${i}`;

          return (
            <div
              key={`slide-${slide.sectionIndex}-${i}`}
              className="w-full min-w-[100%] max-w-[100%] shrink-0 snap-center snap-always box-border px-0"
            >
              <article className="w-full max-w-full pb-1">
                {variant === 'detail' ? (
                  <div className="w-full max-w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-gray-900">
                    <HeroRotator urls={heroUrls} resetKey={heroResetKey} timeLabel={slide.timeLabel} />
                    <div className="p-4">
                      <h3 className="mb-2 text-base font-bold leading-snug text-gray-900 dark:text-gray-50">
                        {slide.placeTitle}
                      </h3>
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 text-[14px] font-bold text-white shadow-md shadow-primary/25 transition hover:bg-primary/90 active:scale-[0.99] dark:bg-primary dark:text-white"
                      >
                        <span className="material-symbols-outlined text-[18px] text-white">chat_bubble</span>
                        이 장소 지금 상황 물어보기
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-gray-900">
                      <HeroRotator urls={heroUrls} resetKey={heroResetKey} timeLabel={slide.timeLabel} />
                      <div className="p-4">
                        <h3 className="mb-2 text-base font-bold leading-snug text-gray-900 dark:text-gray-50">
                          {slide.placeTitle}
                        </h3>
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
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 text-[14px] font-bold text-white shadow-md shadow-primary/25 transition hover:bg-primary/90 active:scale-[0.99] dark:bg-primary dark:text-white"
                        >
                          <span className="material-symbols-outlined text-[18px] text-white">chat_bubble</span>
                          이 장소 지금 상황 물어보기
                        </button>
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
  );
};

export default MagazinePublishedCarousel;

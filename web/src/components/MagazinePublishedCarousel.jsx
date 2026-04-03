import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeAgo } from '../utils/timeUtils';
import { getMapThumbnailUri } from '../utils/postMedia';
import { normalizeSpace } from '../utils/magazinePublishedUi';

const carouselClass =
  'w-full h-full min-h-0 flex flex-row overflow-x-auto snap-x snap-mandatory overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * 발행 매거진: 장소당 한 화면(가로 스와이프로 전체 전환) + 슬라이드마다 실시간 게시물
 * @param {Array<Array>} postsPerSlide — 슬라이드 인덱스별 게시물 배열
 */
const MagazinePublishedCarousel = ({
  slides,
  postsPerSlide = [],
  activeSlideIndex,
  carouselRef,
  onCarouselScroll,
  scrollToSlide,
  variant = 'list',
}) => {
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
    const q = slide?.askQuery || '';
    if (slide?.kind === 'magazine' && slide.mag?.id) {
      if (variant === 'detail') {
        navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      } else {
        navigate(`/magazine/${slide.mag.id}`, { state: { magazine: slide.mag } });
      }
    } else {
      navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    }
  };

  const cardBlock = (slide, i) => (
    <>
      <div className="relative w-full aspect-[3/4] max-h-[min(320px,42dvh)] shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {slide.image ? (
          <img
            src={slide.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="flex h-full min-h-[160px] w-full items-center justify-center text-zinc-400">
            <span className="material-symbols-outlined text-5xl">photo</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="inline-flex rounded-full bg-amber-100/90 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 px-2 py-0.5 text-[10px] font-semibold">
            {slide.timeLabel}
          </span>
        </div>
      </div>
      <div className="p-4 shrink-0">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-50 m-0 leading-snug mb-2">{slide.placeTitle}</h3>
        <p className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-300 mb-3 m-0">{slide.description}</p>
        {slide.regionSummary && (
          <div className="mb-3 rounded-lg bg-cyan-50/70 dark:bg-cyan-950/35 px-2.5 py-1.5 text-[11px] text-cyan-900 dark:text-cyan-100">
            <p className="m-0">
              <span className="font-semibold mr-1">AI 요약</span>
              <span>{slide.regionSummary}</span>
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={(e) => handleAskLight(e, slide)}
          className="w-full py-2 px-3 rounded-xl text-[13px] font-semibold border border-primary/30 text-primary bg-white dark:bg-gray-900 dark:border-primary/40 dark:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[17px]">chat_bubble</span>
          이 장소 지금 상황 물어보기
        </button>
      </div>
    </>
  );

  if (!slides.length) return null;

  const total = slides.length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-50 leading-tight tracking-tight m-0 mb-2 shrink-0 px-0">
        {slides[0]?.magTitle}
      </h2>

      <div className="relative flex min-h-0 w-full flex-1 flex-col">
        <div ref={carouselRef} className={`${carouselClass} min-h-0 flex-1`} onScroll={onCarouselScroll}>
          {slides.map((slide, i) => {
            const regionPosts = Array.isArray(postsPerSlide[i]) ? postsPerSlide[i] : [];
            return (
              <div
                key={`slide-${slide.sectionIndex}-${i}`}
                className="flex-[0_0_100%] w-full h-full min-h-0 shrink-0 snap-center flex flex-col box-border"
              >
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-0 px-0">
                  <article className="w-full max-w-full pb-2">
                    {variant === 'detail' ? (
                      <div className="w-full max-w-full text-left rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900">
                        {cardBlock(slide, i)}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFeaturedClick(slide)}
                        className="w-full max-w-full text-left rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900 transition-transform active:scale-[0.99]"
                      >
                        {cardBlock(slide, i)}
                      </button>
                    )}

                    <div className="mt-4 px-0">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-50 m-0">실시간 게시물</h3>
                        <button
                          type="button"
                          onClick={() => navigate('/main')}
                          className="text-xs font-medium text-primary/90 hover:underline m-0 bg-transparent border-0 p-0 cursor-pointer"
                        >
                          전체보기
                        </button>
                      </div>
                      {regionPosts.length === 0 ? (
                        <p className="text-[12px] text-gray-500 py-3 m-0">이 장소와 맞는 사진이 아직 없어요.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
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
                                className="w-full text-left rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow transition-shadow"
                              >
                                <div className="relative w-full aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
                                  {uri ? (
                                    <img src={uri} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                      <span className="material-symbols-outlined text-4xl">image</span>
                                    </div>
                                  )}
                                  <div className="absolute bottom-2 left-2">
                                    <span className="inline-flex rounded-full bg-black/55 text-white px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
                                      {label}
                                    </span>
                                  </div>
                                </div>
                                <div className="px-2.5 py-2">
                                  <p className="text-[14px] font-bold text-gray-900 dark:text-gray-50 m-0 truncate">
                                    {loc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            );
          })}
        </div>

        {total > 1 && (
          <div className="shrink-0 flex flex-col items-center gap-1.5 pt-2 pb-1">
            <p className="m-0 text-[10px] font-medium text-zinc-400/90 dark:text-zinc-500 tabular-nums tracking-wide">
              장소 {activeSlideIndex + 1} · {total}
            </p>
            <div className="flex items-center justify-center gap-1">
              {slides.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  aria-label={`장소 ${i + 1}`}
                  onClick={() => scrollToSlide(i)}
                  className={`rounded-full transition-all duration-200 ${
                    i === activeSlideIndex
                      ? 'h-1 w-4 bg-primary/35 dark:bg-primary/40'
                      : 'h-1 w-1 bg-zinc-200/80 dark:bg-zinc-600/50'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MagazinePublishedCarousel;

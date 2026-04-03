import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeAgo } from '../utils/timeUtils';
import { getMapThumbnailUri } from '../utils/postMedia';
import { normalizeSpace } from '../utils/magazinePublishedUi';

const carouselClass =
  'w-full flex flex-row overflow-x-auto snap-x snap-mandatory overscroll-x-contain touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * 발행 매거진 공통 UI: 장소 슬라이드 + 실시간 게시물
 * @param {'list'|'detail'} variant — detail이면 대표 카드 탭 시 상세로 이동하지 않음
 */
const MagazinePublishedCarousel = ({
  slides,
  activeSlideIndex,
  carouselRef,
  onCarouselScroll,
  scrollToSlide,
  regionPosts,
  currentSlide,
  variant = 'list',
}) => {
  const navigate = useNavigate();

  const handleFeaturedClick = () => {
    if (variant === 'detail') return;
    const slide = currentSlide;
    if (slide?.kind === 'magazine' && slide.mag?.id) {
      navigate(`/magazine/${slide.mag.id}`, { state: { magazine: slide.mag } });
    } else if (slide?.postId) {
      navigate(`/post/${slide.postId}`);
    } else {
      navigate('/search');
    }
  };

  const handleAskLight = (e) => {
    e?.stopPropagation?.();
    const slide = currentSlide;
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

  const cardInner = (slide, i) => (
    <>
      <div className="relative w-full aspect-[3/4] max-h-[min(420px,68dvh)] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {slide.image ? (
          <img
            src={slide.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="flex h-full min-h-[200px] w-full items-center justify-center text-zinc-400">
            <span className="material-symbols-outlined text-5xl">photo</span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 px-2.5 py-0.5 text-[11px] font-bold shadow-sm">
            {slide.timeLabel}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 m-0 leading-snug mb-3">{slide.placeTitle}</h3>
        <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 mb-4 m-0">{slide.description}</p>
        {slide.regionSummary && (
          <div className="mb-4 rounded-xl bg-cyan-50/80 dark:bg-cyan-950/40 px-3 py-2 text-[12px] text-cyan-900 dark:text-cyan-100">
            <p className="m-0">
              <span className="font-semibold mr-1">AI가 분석한 지역 특징</span>
              <span>{slide.regionSummary}</span>
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleAskLight}
          className="w-full py-2.5 px-4 rounded-xl text-[14px] font-semibold border border-primary/35 text-primary bg-white dark:bg-gray-900 dark:border-primary/45 dark:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
          이 장소 지금 상황 물어보기
        </button>
      </div>
    </>
  );

  if (!slides.length) return null;

  return (
    <>
      <section className="mb-2">
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-50 leading-tight tracking-tight m-0 mb-4">
          {slides[0]?.magTitle}
        </h2>

        <div className="mb-2 w-full min-w-0">
          <div ref={carouselRef} className={carouselClass} onScroll={onCarouselScroll}>
            {slides.map((slide, i) => (
              <div
                key={`slide-${slide.sectionIndex}-${i}`}
                className="flex-[0_0_100%] w-full min-w-0 shrink-0 snap-center box-border px-0"
              >
                <article className="relative mb-2 w-full max-w-full">
                  {variant === 'detail' ? (
                    <div className="w-full max-w-full text-left rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900">
                      {cardInner(slide, i)}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleFeaturedClick}
                      className="w-full max-w-full text-left rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900 transition-transform active:scale-[0.99]"
                    >
                      {cardInner(slide, i)}
                    </button>
                  )}
                </article>
              </div>
            ))}
          </div>

          {slides.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3 mb-1">
              {slides.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  aria-label={`장소 ${i + 1}`}
                  onClick={() => scrollToSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === activeSlideIndex ? 'w-6 bg-primary' : 'w-2 bg-zinc-300 dark:bg-zinc-600'
                  }`}
                />
              ))}
            </div>
          )}
          {slides.length > 1 && (
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 m-0 mb-4">
              좌우로 밀어 다른 장소를 볼 수 있어요
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 m-0">장소 실시간 게시물</h3>
          <button
            type="button"
            onClick={() => navigate('/main')}
            className="text-sm font-semibold text-primary hover:underline m-0 bg-transparent border-0 p-0 cursor-pointer"
          >
            전체보기
          </button>
        </div>
        {regionPosts.length === 0 ? (
          <p className="text-[13px] text-gray-500 py-6">이 장소와 맞는 사진이 아직 없어요.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {regionPosts.map((post) => {
              const uri = getMapThumbnailUri(post);
              const label = getTimeAgo(post.timestamp || post.createdAt);
              const loc =
                normalizeSpace(post.detailedLocation || post.placeName || post.location || '') || '여행 기록';
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="w-full text-left rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
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
                      <span className="inline-flex rounded-full bg-black/60 text-white px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm">
                        {label}
                      </span>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-[15px] font-bold text-gray-900 dark:text-gray-50 m-0 truncate">{loc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

export default MagazinePublishedCarousel;

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import MagazinePublishedCarousel from '../components/MagazinePublishedCarousel';
import { listPublishedMagazines } from '../utils/magazinesStore';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getCombinedPosts } from '../utils/mockData';
import {
  buildMagazineListSlides,
  getGridPostsPool,
  getRegionPostsForSlide,
} from '../utils/magazinePublishedUi';

const MagazineListScreen = () => {
  const navigate = useNavigate();
  const [published, setPublished] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const carouselRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pubs = await listPublishedMagazines();
      setPublished(Array.isArray(pubs) ? pubs : []);

      const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
      const supabasePosts = await fetchPostsSupabase();
      const byId = new Map();
      [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach(
        (p) => {
          if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
        }
      );
      let deletedIds = new Set();
      try {
        const raw = sessionStorage.getItem('adminDeletedPostIds') || '[]';
        deletedIds = new Set(JSON.parse(raw));
        sessionStorage.removeItem('adminDeletedPostIds');
      } catch (_) {}
      const combinedFiltered = Array.from(byId.values()).filter(
        (p) => p && p.id && !deletedIds.has(String(p.id))
      );
      setAllPosts(getCombinedPosts(combinedFiltered));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener('magazinesUpdated', onUpdated);
    return () => {
      window.removeEventListener('magazinesUpdated', onUpdated);
    };
  }, [load]);

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [published]);

  const gridPosts = useMemo(() => getGridPostsPool(allPosts), [allPosts]);

  const slides = useMemo(
    () => buildMagazineListSlides(published, allPosts, gridPosts),
    [published, allPosts, gridPosts]
  );

  const postsPerSlide = useMemo(
    () => slides.map((slide) => getRegionPostsForSlide(slide, allPosts, gridPosts)),
    [slides, allPosts, gridPosts]
  );

  const scrollToSlide = useCallback(
    (index) => {
      const el = carouselRef.current;
      if (!el || !slides.length) return;
      const w = el.offsetWidth;
      el.scrollTo({ left: index * w, behavior: 'smooth' });
      setActiveSlideIndex(index);
    },
    [slides.length]
  );

  const onCarouselScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      const w = el.offsetWidth;
      if (!w) return;
      const idx = Math.round(el.scrollLeft / w);
      setActiveSlideIndex((prev) => {
        if (idx < 0 || idx >= slides.length) return prev;
        return idx === prev ? prev : idx;
      });
    },
    [slides.length]
  );

  const handleCardOpenMagazine = useCallback(
    (mag) => {
      navigate(`/magazine/${mag.id}`, { state: { magazine: mag } });
    },
    [navigate]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        <header className="screen-header flex-shrink-0 z-[60] flex items-center justify-center px-4 py-3 bg-white/95 dark:bg-gray-900/95 border-b border-zinc-100 dark:border-zinc-800 backdrop-blur-sm">
          <h1 className="text-[17px] font-extrabold text-text-primary-light dark:text-text-primary-dark m-0 tracking-tight">
            매거진
          </h1>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-24 max-w-full">
          {loading ? (
            <div className="py-16 text-center text-[13px] text-gray-500">불러오는 중…</div>
          ) : (
            <>
              {slides.length > 0 && (
                <div className="flex w-full shrink-0 flex-col h-[calc(100dvh-9.5rem)] min-h-[320px] max-h-[calc(100dvh-9.5rem)]">
                  <MagazinePublishedCarousel
                    variant="list"
                    slides={slides}
                    postsPerSlide={postsPerSlide}
                    activeSlideIndex={activeSlideIndex}
                    carouselRef={carouselRef}
                    onCarouselScroll={onCarouselScroll}
                    scrollToSlide={scrollToSlide}
                  />
                </div>
              )}

              {slides.length === 0 && (
                <div className="mb-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-6 text-center">
                  <p className="text-[14px] font-medium text-gray-700 dark:text-gray-200 m-0 mb-1">
                    아직 표시할 매거진이 없어요
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 m-0">
                    관리자에서 매거진을 발행하면 장소별로 슬라이드가 생겨요.
                  </p>
                </div>
              )}

              {published.length > 1 && (
                <section className="mb-6">
                  <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-50 m-0 mb-2">다른 매거진</h3>
                  <div className="flex flex-col gap-2">
                    {published.slice(1, 6).map((mag) => (
                      <button
                        key={mag.id}
                        type="button"
                        onClick={() => handleCardOpenMagazine(mag)}
                        className="flex items-center justify-between rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-gray-800/80"
                      >
                        <span className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
                          {mag.title}
                        </span>
                        <span className="material-symbols-outlined text-zinc-400 text-[20px] flex-shrink-0">
                          chevron_right
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {slides.length === 0 && (
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
                  <p className="text-[13px] text-gray-500 py-6">이 장소와 맞는 사진이 아직 없어요.</p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default MagazineListScreen;

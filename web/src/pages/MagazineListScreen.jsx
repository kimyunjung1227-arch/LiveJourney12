import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { listPublishedMagazines } from '../utils/magazinesStore';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getCombinedPosts } from '../utils/mockData';
import { getTimeAgo, filterRecentPosts } from '../utils/timeUtils';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri } from '../utils/postMedia';

const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const mediaUrlsFromPost = (p) => {
  const raw = [];
  if (Array.isArray(p?.images)) raw.push(...p.images);
  else if (p?.images) raw.push(p.images);
  if (p?.image) raw.push(p.image);
  if (p?.thumbnail) raw.push(p.thumbnail);
  const urls = raw.map((v) => getDisplayImageUrl(v)).filter(Boolean);
  return [...new Set(urls)];
};

const toSearchText = (p) =>
  [
    p?.detailedLocation,
    p?.placeName,
    p?.location,
    p?.note,
    p?.content,
    ...(Array.isArray(p?.tags) ? p.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const MagazineListScreen = () => {
  const navigate = useNavigate();
  const [published, setPublished] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const gridPosts = useMemo(() => {
    const withThumb = (Array.isArray(allPosts) ? allPosts : []).filter((p) => getMapThumbnailUri(p));
    const recent = filterRecentPosts(withThumb, 2, 72);
    const pool = recent.length >= 6 ? recent : withThumb;
    return pool.slice(0, 12);
  }, [allPosts]);

  const featured = useMemo(() => {
    const mag = published[0];
    const byRecency = (a, b) => {
      const now = Date.now();
      const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
      const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
      return tb - ta;
    };
    const posts = Array.isArray(allPosts) ? allPosts : [];

    if (mag && Array.isArray(mag.sections) && mag.sections.length > 0 && posts.length > 0) {
      const first = mag.sections[0];
      const locKey = normalizeSpace(first?.location || '');
      const uniqMedia = posts
        .filter((p) => locKey && toSearchText(p).includes(locKey.toLowerCase()))
        .sort(byRecency)
        .flatMap(mediaUrlsFromPost);
      const uniq = [...new Set(uniqMedia)].filter(Boolean);
      const fallbackImg = gridPosts[0] ? getMapThumbnailUri(gridPosts[0]) : '';
      const heroImage = uniq[0] || fallbackImg;
      return {
        kind: 'magazine',
        mag,
        title: String(mag.title || '').trim() || '여행 매거진',
        placeTitle: locKey || String(mag.title || '').trim(),
        description:
          String(first?.description || mag.subtitle || mag.summary || '').trim() ||
          'LiveJourney에 올라온 실시간 사진으로 구성된 코너예요.',
        image: heroImage,
        timeLabel: getTimeAgo(mag.created_at || mag.createdAt),
        mediaCount: uniq.length,
        askQuery: locKey || mag.title,
      };
    }

    const p0 = gridPosts[0];
    if (p0) {
      const loc =
        normalizeSpace(p0.detailedLocation || p0.placeName || p0.location || '').split(' ').slice(0, 4).join(' ') ||
        '지금 여행지';
      return {
        kind: 'feed',
        mag: null,
        title: '지금 꼭 볼 실시간 여행지',
        placeTitle: loc,
        description:
          String(p0.note || p0.content || '').trim().slice(0, 120) ||
          '라이브저니에 올라온 최근 사진을 모았어요.',
        image: getMapThumbnailUri(p0),
        timeLabel: getTimeAgo(p0.timestamp || p0.createdAt),
        mediaCount: gridPosts.length,
        askQuery: loc,
        postId: p0.id,
      };
    }

    return null;
  }, [published, allPosts, gridPosts]);

  const locationPill = useMemo(() => {
    const p = gridPosts[0];
    const loc = p?.detailedLocation || p?.placeName || p?.location || featured?.placeTitle || '';
    const short = normalizeSpace(loc).split(' ').slice(0, 3).join(' ') || '지금 여행지';
    return short;
  }, [gridPosts, featured]);

  const handleFeaturedClick = useCallback(() => {
    if (featured?.kind === 'magazine' && featured.mag?.id) {
      navigate(`/magazine/${featured.mag.id}`, { state: { magazine: featured.mag } });
    } else if (featured?.postId) {
      navigate(`/post/${featured.postId}`);
    } else {
      navigate('/search');
    }
  }, [featured, navigate]);

  const handleAskLight = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (featured?.kind === 'magazine' && featured.mag?.id) {
        navigate(`/magazine/${featured.mag.id}`, { state: { magazine: featured.mag } });
      } else {
        const q = featured?.askQuery || '';
        navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      }
    },
    [featured, navigate]
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
        <header className="screen-header flex-shrink-0 z-[60] flex items-center justify-between px-4 py-3 bg-white/95 dark:bg-gray-900/95 border-b border-zinc-100 dark:border-zinc-800 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="검색"
          >
            <span className="material-symbols-outlined text-[22px] text-gray-600 dark:text-gray-300">search</span>
          </button>
          <h1 className="text-[17px] font-extrabold text-text-primary-light dark:text-text-primary-dark m-0 tracking-tight">
            매거진
          </h1>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="프로필"
          >
            <span className="material-symbols-outlined text-[22px] text-gray-600 dark:text-gray-300">person</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
          <div className="flex items-center mb-5">
            <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5">
              <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {locationPill} <span aria-hidden="true">📍</span>
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[13px] text-gray-500">불러오는 중…</div>
          ) : (
            <>
              {featured && (
                <section className="mb-2">
                  <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-50 leading-tight tracking-tight m-0 mb-6">
                    {featured.title}
                  </h2>

                  <article className="relative mb-8">
                    <button
                      type="button"
                      onClick={handleFeaturedClick}
                      className="w-full text-left rounded-2xl overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900 transition-transform active:scale-[0.99]"
                    >
                      <div className="relative h-[min(420px,55vh)] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        {featured.image ? (
                          <img
                            src={featured.image}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-400">
                            <span className="material-symbols-outlined text-5xl">photo</span>
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                          <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 px-2.5 py-0.5 text-[11px] font-bold shadow-sm">
                            {featured.timeLabel}
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 m-0 leading-snug">
                            {featured.placeTitle}
                          </h3>
                          <div className="flex-shrink-0 rounded-lg border border-cyan-200/80 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-950/40 px-2.5 py-1 text-center">
                            <span className="block text-[9px] font-bold text-cyan-800 dark:text-cyan-200 uppercase tracking-wide">
                              Live
                            </span>
                            <span className="text-xs font-extrabold text-cyan-700 dark:text-cyan-300">
                              사진 {featured.mediaCount}장
                            </span>
                          </div>
                        </div>
                        <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 mb-4 m-0">
                          {featured.description}
                        </p>
                        <button
                          type="button"
                          onClick={handleAskLight}
                          className="w-full py-2.5 px-4 rounded-xl text-[14px] font-semibold border border-primary/35 text-primary bg-white dark:bg-gray-900 dark:border-primary/45 dark:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                          이 장소 지금 상황 물어보기
                        </button>
                      </div>
                    </button>
                  </article>
                </section>
              )}

              {!featured && (
                <div className="mb-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-6 text-center">
                  <p className="text-[14px] font-medium text-gray-700 dark:text-gray-200 m-0 mb-1">
                    아직 표시할 매거진이 없어요
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 m-0">
                    게시물이 쌓이면 이곳에 실시간 사진이 채워져요.
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
                {gridPosts.length === 0 ? (
                  <p className="text-[13px] text-gray-500 py-6">아직 올라온 사진이 없어요.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {gridPosts.map((post) => {
                      const uri = getMapThumbnailUri(post);
                      const label = getTimeAgo(post.timestamp || post.createdAt);
                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => navigate(`/post/${post.id}`)}
                          className="relative aspect-square rounded-xl overflow-hidden group bg-zinc-100 dark:bg-zinc-800 border-0 p-0 cursor-pointer w-full"
                        >
                          {uri ? (
                            <img
                              src={uri}
                              alt=""
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-100"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-400">
                              <span className="material-symbols-outlined">image</span>
                            </div>
                          )}
                          <div className="absolute bottom-1.5 left-1.5">
                            <span className="inline-flex rounded-full bg-black/55 text-white px-2 py-0.5 text-[10px] font-bold backdrop-blur-[4px]">
                              {label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default MagazineListScreen;

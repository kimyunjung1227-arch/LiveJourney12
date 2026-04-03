import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { listPublishedMagazines } from '../utils/magazinesStore';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';

const pickCoverForMagazine = (mag, posts) => {
  const firstSection = Array.isArray(mag?.sections) ? mag.sections[0] : null;
  const key = String(firstSection?.location || mag?.title || '').trim();
  if (!key) return '';
  const lower = key.toLowerCase();
  const byRecency = (a, b) => {
    const now = Date.now();
    const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
    const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
    return tb - ta;
  };
  const matched = posts
    .filter((p) => {
      const loc = String(p?.location || '').toLowerCase();
      const place = String(p?.placeName || '').toLowerCase();
      const detailed = String(p?.detailedLocation || '').toLowerCase();
      return (
        (loc && (loc.includes(lower) || lower.includes(loc))) ||
        (place && (place.includes(lower) || lower.includes(place))) ||
        (detailed && (detailed.includes(lower) || lower.includes(detailed)))
      );
    })
    .filter((p) => (Array.isArray(p?.images) && p.images.length > 0) || p?.image || p?.thumbnail)
    .sort(byRecency)[0];
  const raw = matched?.images?.[0] || matched?.image || matched?.thumbnail || '';
  return raw ? getDisplayImageUrl(raw) : '';
};

const MagazineCollectionScreen = () => {
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
      setAllPosts(getCombinedPosts(Array.from(byId.values()).filter((p) => p && p.id)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener('magazinesUpdated', onUpdated);
    return () => window.removeEventListener('magazinesUpdated', onUpdated);
  }, [load]);

  const rows = useMemo(() => {
    if (!Array.isArray(published) || !published.length) return [];
    const posts = Array.isArray(allPosts) ? allPosts : [];
    return [...published]
      .map((m) => ({
        magazine: m,
        cover: pickCoverForMagazine(m, posts),
      }))
      .sort((a, b) => {
        const ta = new Date(a?.magazine?.createdAt || a?.magazine?.created_at || 0).getTime();
        const tb = new Date(b?.magazine?.createdAt || b?.magazine?.created_at || 0).getTime();
        return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
      });
  }, [published, allPosts]);

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        <header className="screen-header flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="뒤로"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-[17px] font-extrabold text-text-primary-light dark:text-text-primary-dark m-0">
            여행 매거진
          </h1>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
          {loading ? (
            <div className="py-16 text-center text-[13px] text-gray-500">불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-6 text-center mt-2">
              <p className="text-[14px] font-medium text-gray-700 dark:text-gray-200 m-0 mb-1">
                아직 발행된 매거진이 없어요
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 m-0">발행되면 이곳에 모아 보여드릴게요.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map(({ magazine: mag, cover }) => {
                const createdDate = mag.created_at || mag.createdAt
                  ? new Date(mag.created_at || mag.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : null;
                return (
                  <button
                    key={mag.id}
                    type="button"
                    onClick={() => navigate(`/magazine/${mag.id}`, { state: { magazine: mag } })}
                    className="w-full flex text-left bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden hover:shadow-md transition-shadow min-h-[88px]"
                  >
                    <div className="w-[100px] h-[100px] flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 relative">
                      {cover ? (
                        <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <span className="material-symbols-outlined text-3xl">menu_book</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 px-3 py-3 flex flex-col justify-center min-w-0">
                      <p className="text-[11px] font-semibold text-primary m-0 mb-0.5">발행 매거진</p>
                      <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-50 leading-snug line-clamp-2 m-0">
                        {mag.title}
                      </h2>
                      {(mag.subtitle || mag.summary) && (
                        <p className="text-[12px] text-gray-600 dark:text-gray-300 line-clamp-2 mt-1 m-0">
                          {mag.subtitle || mag.summary}
                        </p>
                      )}
                      <div className="mt-auto pt-1 flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                        <span>{mag.author || 'LiveJourney'}</span>
                        {createdDate && <span>{createdDate}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default MagazineCollectionScreen;

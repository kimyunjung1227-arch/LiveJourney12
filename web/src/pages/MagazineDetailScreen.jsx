import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getMagazineTopicById } from '../utils/magazinesConfig';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getCombinedPosts } from '../utils/mockData';
import { getTimeAgo } from '../utils/timeUtils';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';
import { getLandmarksByRegion } from '../utils/regionLandmarks';
import { getCategoryChipsFromPost } from '../utils/travelCategories';

const MagazineDetailScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const state = location.state || {};

  const topic = useMemo(() => getMagazineTopicById(id), [id]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const getLocationKey = (p) =>
    normalizeSpace(p?.detailedLocation || p?.placeName || p?.location || '');
  const getRegionKey = (locKey) => normalizeSpace(locKey).split(' ')[0] || '';
  const getPostAuthor = (p) => {
    const u = p?.user;
    const username =
      (typeof u === 'string' ? u : u?.username) ||
      p?.userName ||
      p?.author?.name ||
      '여행자';
    const avatar =
      (typeof u === 'object' ? (u?.profileImage || u?.avatar || u?.photoURL) : null) ||
      p?.userAvatar ||
      null;
    return { username: String(username || '여행자'), avatar: avatar ? String(avatar) : null };
  };
  const mediaUrlsFromPost = (p) => {
    const raw = [];
    if (Array.isArray(p?.images)) raw.push(...p.images);
    else if (p?.images) raw.push(p.images);
    if (p?.image) raw.push(p.image);
    if (p?.thumbnail) raw.push(p.thumbnail);
    const urls = raw.map((v) => getDisplayImageUrl(v)).filter(Boolean);
    return [...new Set(urls)];
  };

  // 수국 등 키워드 기반으로 사용자 피드 큐레이션
  useEffect(() => {
    const load = async () => {
      if (!topic) {
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
        const supabasePosts = await fetchPostsSupabase();

        const byId = new Map();
        [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach(
          (p) => {
            if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
          }
        );
        const combined = Array.from(byId.values());
        const allPosts = getCombinedPosts(combined);

        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const keywords = (topic.tagKeywords || []).map((k) => String(k).toLowerCase());

        const filtered = allPosts
          .filter((p) => {
            const hasImage =
              (Array.isArray(p.images) && p.images.length > 0) || p.image || p.thumbnail;
            if (!hasImage) return false;

            const tsSrc = p.timestamp || p.createdAt;
            const ts = tsSrc ? new Date(tsSrc).getTime() : now;
            if (Number.isNaN(ts) || ts < sevenDaysAgo) return false;

            const joined = [
              p.note,
              p.content,
              p.location,
              p.placeName,
              ...(Array.isArray(p.tags) ? p.tags : []),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return keywords.some((kw) => kw && joined.includes(kw));
          })
          .sort((a, b) => {
            const ta = new Date(a.timestamp || a.createdAt || now).getTime();
            const tb = new Date(b.timestamp || b.createdAt || now).getTime();
            return tb - ta;
          });

        setPosts(filtered);
      } catch (e) {
        logger.error('매거진 피드 로딩 오류:', e);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [topic]);

  const locationSections = useMemo(() => {
    if (!Array.isArray(posts) || posts.length === 0) return [];

    const map = new Map();
    posts.forEach((p) => {
      const key = getLocationKey(p);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });

    const sections = Array.from(map.entries()).map(([locKey, list]) => {
      const regionKey = getRegionKey(locKey);
      const uniqMedia = [...new Set(list.flatMap(mediaUrlsFromPost))].filter(Boolean);
      const cover = uniqMedia.slice(0, 2);
      const rest = uniqMedia.slice(2);

      const first = list[0] || null;
      const { username, avatar } = first ? getPostAuthor(first) : { username: '여행자', avatar: null };
      const createdAt = first?.timestamp || first?.createdAt;
      const timeLabel = createdAt ? getTimeAgo(createdAt) : '';

      const chips = list.flatMap((p) => getCategoryChipsFromPost(p)).filter(Boolean);
      const chipMap = new Map();
      chips.forEach((c) => {
        if (c?.slug && !chipMap.has(c.slug)) chipMap.set(c.slug, c);
      });
      const topChips = Array.from(chipMap.values()).slice(0, 3);

      const landmarks = getLandmarksByRegion(regionKey);
      const around = landmarks.filter((l) => l?.name && !locKey.includes(l.name)).slice(0, 4);

      return {
        locKey,
        regionKey,
        cover,
        rest,
        author: { username, avatar, timeLabel },
        topChips,
        around,
        mediaCount: uniqMedia.length,
        postCount: list.length,
      };
    });

    return sections.sort((a, b) => (b.mediaCount - a.mediaCount) || (b.postCount - a.postCount));
  }, [posts]);

  if (!topic) {
    return (
      <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
        <div className="screen-content flex flex-col h-full">
          <div className="screen-header flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button
              onClick={() => navigate(-1)}
              className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <h1 className="text-[18px] font-bold text-text-primary-light dark:text-text-primary-dark m-0">
              여행 매거진
            </h1>
            <div className="w-10" />
          </div>
          <main className="flex-1 flex flex-col items-center justify-center px-4">
            <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-3">
              book_5
            </span>
            <p className="text-[15px] font-medium text-gray-800 dark:text-gray-100 mb-1">
              매거진 정보를 불러올 수 없어요
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center">
              메인 화면에서 다시 선택해 주세요.
            </p>
          </main>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
          {/* 헤더 */}
        <div className="screen-header flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-[18px] font-bold text-text-primary-light dark:text-text-primary-dark m-0">
            여행 매거진
          </h1>
          <div className="w-10" />
        </div>

          {/* 스크롤 가능한 본문 */}
        <main className="flex-1 overflow-y-auto">
          {/* 헤드(와이어프레임 스타일: 제목/소제목 박스) */}
          <section className="px-4 pt-4 pb-3 bg-white dark:bg-gray-900 border-b border-zinc-100 dark:border-zinc-800">
            <div className="mb-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/25 px-3 py-1 text-[12px] font-semibold text-indigo-600 dark:text-indigo-200">
                <span className="text-[14px]">{topic.emoji || '📚'}</span>
                테마 매거진
              </div>
            </div>

            <div className="border-2 border-black/90 rounded-md px-3 py-2">
              <h2 className="m-0 text-[18px] font-extrabold text-gray-900 dark:text-gray-50 leading-snug">
                {topic.title}
              </h2>
            </div>

            <div className="mt-2 border border-black/40 rounded px-3 py-2 bg-white/80 dark:bg-gray-900/60">
              <p className="m-0 text-[13px] font-medium text-gray-700 dark:text-gray-200 leading-relaxed">
                {topic.description || '현재 올라오는 정보들을 한눈에 알아봐요.'}
              </p>
            </div>
          </section>

          {/* 위치 기반 큐레이션 (TOP 7) */}
          <section className="px-0 pb-10 pt-1">
            {loading ? (
              <div className="py-10 flex items-center justify-center text-[13px] text-gray-500">
                실시간 사진을 모으는 중이에요...
              </div>
            ) : locationSections.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center text-[13px] text-gray-500 px-6">
                <p className="mb-1">아직 이 매거진에 포함되는 사진이 없어요.</p>
                <p>지금 여기를 통해 첫 번째 사진을 올려보세요.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pt-4 pb-8">
                {locationSections.slice(0, 7).map((sec, idx) => {
                  const region = sec.regionKey || '서울';
                  const coverA = sec.cover[0] || '';
                  const coverB = sec.cover[1] || '';
                  const has2 = !!coverA && !!coverB;

                  const goMore = (e) => {
                    e?.stopPropagation?.();
                    navigate(`/region/${encodeURIComponent(region)}`, {
                      state: { region: { name: region }, focusLocation: sec.locKey },
                    });
                  };

                  return (
                    <article key={sec.locKey} className="px-4">
                      <div className="mb-2">
                        <div className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                          위치정보 {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={goMore}
                          className="w-full flex items-center justify-between gap-3"
                        >
                          <h3 className="m-0 text-left min-w-0 flex-1 text-[16px] font-extrabold text-gray-900 dark:text-gray-50 truncate">
                            {sec.locKey}
                          </h3>
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white dark:bg-gray-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[12px] font-semibold text-primary">
                            더보기
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </span>
                        </button>
                      </div>

                      <div className="w-full overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_2px_14px_rgba(15,23,42,0.06)]">
                        {/* 2장 썸네일(한 썸네일) */}
                        <div className="relative w-full bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: '4/3' }}>
                          {has2 ? (
                            <div className="absolute inset-0 grid grid-cols-2">
                              <img src={coverA} alt="" className="w-full h-full object-cover" loading="lazy" />
                              <img src={coverB} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          ) : coverA ? (
                            <img src={coverA} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                              <span className="material-symbols-outlined text-5xl">image</span>
                            </div>
                          )}
                        </div>

                        {/* 이후 슬라이드(가로 스크롤) */}
                        {sec.rest.length > 0 && (
                          <div className="px-3 pt-2 pb-2">
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                              {sec.rest.slice(0, 12).map((src, i) => (
                                <img
                                  key={`${sec.locKey}-rest-${i}`}
                                  src={src}
                                  alt=""
                                  className="h-[54px] w-[54px] flex-shrink-0 rounded-xl object-cover border border-zinc-100 dark:border-zinc-800"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="px-3 pb-3">
                          {/* 업로더 프로필(가볍게) */}
                          <div className="flex items-center gap-2 pt-2">
                            {sec.author.avatar ? (
                              <img src={sec.author.avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-200" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[12px] font-bold text-gray-700">
                                {sec.author.username.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-[12px] font-semibold text-gray-900 dark:text-gray-50 truncate">
                                {sec.author.username}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {sec.author.timeLabel || '방금'}
                              </div>
                            </div>
                          </div>

                          {/* 위치에 대한 설명글(현재시제) */}
                          <p className="mt-2 text-[13px] leading-relaxed text-gray-800 dark:text-gray-100 line-clamp-2">
                            {sec.topChips.length > 0
                              ? `지금 ${sec.topChips.map((c) => c.name).join(' · ')} 정보를 확인해요.`
                              : '지금 이 위치의 현재 분위기를 확인해요.'}
                          </p>

                          {/* 주변 맛집/명소 추천 */}
                          <div className="mt-2">
                            <div className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                              위치정보 주변 맛집, 명소
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(sec.around.length > 0 ? sec.around : getLandmarksByRegion(region).slice(0, 3))
                                .slice(0, 3)
                                .map((l) => (
                                  <span
                                    key={`${sec.locKey}-around-${l.id}`}
                                    className="inline-flex items-center rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-gray-900 px-3 py-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200"
                                  >
                                    {l.name}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MagazineDetailScreen;



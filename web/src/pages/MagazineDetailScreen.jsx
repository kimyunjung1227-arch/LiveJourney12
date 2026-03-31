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
import { getPublishedMagazineById, removePublishedMagazine } from '../utils/magazinesStore';

const MagazineDetailScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const state = location.state || {};

  const topic = useMemo(() => getMagazineTopicById(id), [id]);
  const [publishedMagazine, setPublishedMagazine] = useState(null);
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      // state로 넘어온 발행 매거진이 있으면 우선 사용
      if (state?.magazine && Array.isArray(state.magazine.sections)) {
        if (alive) setPublishedMagazine(state.magazine);
        return;
      }
      // topic이 없거나, id가 pub-* 형식이면 발행 매거진 조회 시도
      const shouldTryPublished = String(id || '').startsWith('pub-') || !topic;
      if (!shouldTryPublished) return;
      const found = await getPublishedMagazineById(id);
      if (alive) setPublishedMagazine(found);
    })();
    return () => {
      alive = false;
    };
  }, [id, state?.magazine, topic]);

  // 수국 등 키워드 기반으로 사용자 피드 큐레이션
  useEffect(() => {
    const load = async () => {
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
        const combinedAllPosts = getCombinedPosts(combined);
        setAllPosts(combinedAllPosts);

        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const keywords = (topic?.tagKeywords || []).map((k) => String(k).toLowerCase());

        const base = combinedAllPosts
          .filter((p) => {
            const hasImage = (Array.isArray(p.images) && p.images.length > 0) || p.image || p.thumbnail;
            if (!hasImage) return false;
            const tsSrc = p.timestamp || p.createdAt;
            const ts = tsSrc ? new Date(tsSrc).getTime() : now;
            if (Number.isNaN(ts) || ts < sevenDaysAgo) return false;
            return true;
          })
          .sort((a, b) => {
            const ta = new Date(a.timestamp || a.createdAt || now).getTime();
            const tb = new Date(b.timestamp || b.createdAt || now).getTime();
            return tb - ta;
          });

        // 발행 매거진: 키워드 필터 없이 최근 사진 풀을 사용 (위치로 매칭)
        if (publishedMagazine) {
          setPosts(base);
        } else if (topic) {
          const filtered = base.filter((p) => {
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
          });
          setPosts(filtered);
        } else {
          setPosts(base);
        }
      } catch (e) {
        logger.error('매거진 피드 로딩 오류:', e);
        setPosts([]);
        setAllPosts([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [topic, publishedMagazine]);

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
      const sliderMedia = uniqMedia.slice(0, 19);
      const hasMoreMedia = uniqMedia.length > 19;

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

      const allTextPosts = Array.isArray(allPosts) ? allPosts : [];
      const byRecency = (a, b) => {
        const now = Date.now();
        const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
        const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
        return tb - ta;
      };
      const aroundWithImage = around
        .map((l) => {
          const keys = [l?.name, ...(Array.isArray(l?.keywords) ? l.keywords : [])]
            .filter(Boolean)
            .map((s) => String(s).toLowerCase());
          const matched = allTextPosts
            .filter((p) => keys.some((k) => k && toSearchText(p).includes(k)))
            .sort(byRecency)[0];
          const img = matched ? mediaUrlsFromPost(matched)[0] : '';
          return { ...l, image: img || '' };
        })
        .slice(0, 3);

      return {
        locKey,
        regionKey,
        sliderMedia,
        hasMoreMedia,
        author: { username, avatar, timeLabel },
        topChips,
        around: aroundWithImage,
        mediaCount: uniqMedia.length,
        postCount: list.length,
      };
    });

    return sections.sort((a, b) => (b.mediaCount - a.mediaCount) || (b.postCount - a.postCount));
  }, [posts, allPosts]);

  const publishedSections = useMemo(() => {
    if (!publishedMagazine || !Array.isArray(publishedMagazine.sections)) return [];
    const allTextPosts = Array.isArray(allPosts) ? allPosts : [];
    const byRecency = (a, b) => {
      const now = Date.now();
      const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
      const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
      return tb - ta;
    };
    const pickMediaByKeyword = (keyword) => {
      const k = String(keyword || '').trim().toLowerCase();
      if (!k) return '';
      const matched = allTextPosts
        .filter((p) => toSearchText(p).includes(k))
        .sort(byRecency)[0];
      return matched ? (mediaUrlsFromPost(matched)[0] || '') : '';
    };
    const pickMediaByLocation = (loc) => {
      const key = String(loc || '').trim().toLowerCase();
      if (!key) return [];
      const matchedPosts = allTextPosts
        .filter((p) => toSearchText(p).includes(key))
        .sort(byRecency);
      const uniq = [...new Set(matchedPosts.flatMap(mediaUrlsFromPost))].filter(Boolean);
      return uniq;
    };

    return publishedMagazine.sections
      .map((s, idx) => {
        const locKey = normalizeSpace(s?.location || '');
        const regionKey = getRegionKey(locKey);
        const uniqMedia = pickMediaByLocation(locKey);
        const sliderMedia = uniqMedia.slice(0, 19);
        const hasMoreMedia = uniqMedia.length > 19;

        const aroundNames = Array.isArray(s?.around) ? s.around : [];
        const around = aroundNames
          .map((name, ai) => {
            const id = `${idx}-${ai}`;
            const image = pickMediaByKeyword(name);
            return { id, name: String(name || '').trim(), image };
          })
          .filter((x) => x.name)
          .slice(0, 3);

        return {
          locKey,
          regionKey,
          sliderMedia,
          hasMoreMedia,
          author: { username: publishedMagazine.author || 'LiveJourney', avatar: null, timeLabel: '' },
          description: String(s?.description || '').trim(),
          around,
          mediaCount: uniqMedia.length,
          postCount: 0,
        };
      })
      .filter((x) => x.locKey);
  }, [publishedMagazine, allPosts, normalizeSpace, getRegionKey]);

  const sectionsToRender = publishedMagazine ? publishedSections : locationSections;

  if (!topic) {
    if (publishedMagazine) {
      // topic이 없고 발행 매거진이 있으면 아래 렌더로 진행
    } else {
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
  }

  const heroImage =
    Array.isArray(sectionsToRender?.[0]?.sliderMedia) && sectionsToRender[0].sliderMedia.length
      ? sectionsToRender[0].sliderMedia[0]
      : '';

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        {/* 스크롤 가능한 본문 (헤더 없이 바로 사진) */}
        <main className="flex-1 overflow-y-auto">
          {/* 상단 대표 사진 */}
          <section className="bg-black">
            <div className="relative w-full bg-gray-200 dark:bg-gray-800" style={{ aspectRatio: '4/3' }}>
              {heroImage ? (
                <img
                  src={heroImage}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <span className="material-symbols-outlined text-4xl">photo</span>
                </div>
              )}
              {publishedMagazine ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('이 매거진을 삭제할까요?')) return;
                    const res = await removePublishedMagazine(publishedMagazine.id);
                    if (!res.success) {
                      alert('삭제에 실패했습니다.');
                      return;
                    }
                    alert('삭제되었습니다.');
                    navigate('/magazine', { replace: true });
                  }}
                  className="absolute top-3 right-3 z-10 inline-flex items-center justify-center rounded-full bg-black/55 text-white w-10 h-10 backdrop-blur-[6px]"
                  aria-label="매거진 삭제"
                  title="삭제"
                >
                  <span className="material-symbols-outlined text-[22px]">delete</span>
                </button>
              ) : null}
            </div>
          </section>

          {/* 제목/개요 (사진 바깥) */}
          <section className="px-4 pt-4 pb-3 bg-white dark:bg-gray-900 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="m-0 text-[20px] font-extrabold leading-snug text-gray-900 dark:text-gray-50">
              {publishedMagazine?.title || topic.title}
            </h2>
            <p className="mt-2 mb-0 text-[13px] font-medium leading-relaxed text-gray-700 dark:text-gray-200">
              {(publishedMagazine?.subtitle || topic.description) || '지금 올라오는 현장 사진으로만 구성된 매거진이에요.'}
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>{publishedMagazine ? (publishedMagazine.author || 'LiveJourney') : 'LiveJourney'}</span>
              {publishedMagazine?.createdAt ? (
                <span>
                  {new Date(publishedMagazine.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              ) : (
                <span />
              )}
            </div>
          </section>

          {/* 위치 기반 큐레이션 (TOP 7) */}
          <section className="px-0 pb-10 pt-1">
            {loading ? (
              <div className="py-10 flex items-center justify-center text-[13px] text-gray-500">
                실시간 사진을 모으는 중이에요...
              </div>
            ) : sectionsToRender.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center text-[13px] text-gray-500 px-6">
                <p className="mb-1">아직 이 매거진에 포함되는 사진이 없어요.</p>
                <p>지금 여기를 통해 첫 번째 사진을 올려보세요.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pt-4 pb-8">
                {sectionsToRender.slice(0, 7).map((sec, index) => {
                  const region = sec.regionKey || '서울';
                  const media = Array.isArray(sec.sliderMedia) ? sec.sliderMedia : [];

                  const goMore = (e) => {
                    e?.stopPropagation?.();
                    navigate(`/region/${encodeURIComponent(region)}`, {
                      state: { region: { name: region }, focusLocation: sec.locKey },
                    });
                  };

                  // 발행 매거진일 때: 기사형(섹션 번호 + 설명 + 장소 카드)
                  if (publishedMagazine) {
                    const sectionIndexLabel = `${index + 1}`.padStart(1, ' ');
                    const aroundSpots = Array.isArray(sec.around) ? sec.around : [];
                    const mainImage = media[0] || heroImage;

                    return (
                      <article key={sec.locKey || index} className="px-4">
                        {/* 섹션 헤더: 트리플 느낌 (번호 + 간단 문구) */}
                        <div className="mb-2 flex items-center gap-2">
                          <div className="inline-flex items-center justify-center rounded-full bg-slate-900/90 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm dark:bg-white/10">
                            {sectionIndexLabel}
                          </div>
                          <div className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                            가볍게 떠나기 좋은
                          </div>
                        </div>
                        <h3 className="m-0 text-left text-[18px] font-extrabold text-gray-900 dark:text-gray-50 leading-snug">
                          {sec.locKey}
                        </h3>

                        {/* 섹션 대표 이미지 */}
                        {mainImage && (
                          <div className="mt-2 overflow-hidden rounded-[4px] border border-zinc-100 dark:border-zinc-800 shadow-[0_2px_10px_rgba(15,23,42,0.08)]">
                            <div className="w-full bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: '4/3' }}>
                              <img src={mainImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </div>
                          </div>
                        )}

                        {/* 위치 설명 (사진 바깥) */}
                        <p className="mt-3 mb-2 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">
                          {sec.description || '실시간으로 올라온 사진으로만 구성했어요.'}
                        </p>

                        {/* 점(dot) 표시 (스크린샷 느낌) */}
                        <div className="flex items-center justify-center gap-1.5 py-2">
                          {[0, 1, 2, 3].map((di) => (
                            <span
                              key={`${sec.locKey}-dot-${di}`}
                              className={`h-1.5 w-1.5 rounded-full ${di === 0 ? 'bg-slate-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                            />
                          ))}
                        </div>

                        {/* 추천 명소 리스트 (가로 카드 3개) */}
                        {aroundSpots.length > 0 && (
                          <div className="mt-3 pt-1">
                            <div className="mb-2 text-[13px] font-extrabold text-gray-900 dark:text-gray-50">
                              📍 가볍게 떠나기 좋은 {sec.locKey} 추천 명소
                            </div>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                              {aroundSpots.slice(0, 3).map((l) => (
                                <div
                                  key={`${sec.locKey}-around-${l.id}`}
                                  className="flex-shrink-0 w-[170px] bg-white dark:bg-gray-900"
                                >
                                  <div className="w-full overflow-hidden rounded-[4px] bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: '4/3' }}>
                                    {l.image ? (
                                      <img src={l.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                                        <span className="material-symbols-outlined text-[22px]">photo</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="pt-2">
                                    <div className="text-[12px] font-extrabold text-gray-900 dark:text-gray-50 truncate">
                                      {l.name}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={goMore}
                                      className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary"
                                    >
                                      자세히 보기
                                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 지역 상세로 이동 버튼 */}
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={goMore}
                            className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-gray-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[12px] font-semibold text-primary"
                          >
                            이 지역 실시간 정보 보러가기
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </button>
                        </div>
                      </article>
                    );
                  }

                  // 기본 테마 매거진: 기존 카드형 레이아웃 유지
                  return (
                    <article key={sec.locKey} className="px-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="m-0 text-left min-w-0 flex-1 text-[16px] font-extrabold text-gray-900 dark:text-gray-50 truncate">
                          {sec.locKey}
                        </h3>
                        <button
                          type="button"
                          onClick={goMore}
                          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white dark:bg-gray-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[12px] font-semibold text-primary"
                        >
                          더보기
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      </div>

                      {/* 사진 피드(한 장씩 좌우 슬라이드, 최대 19장) */}
                        <div className="w-full overflow-hidden rounded-lg bg-white dark:bg-gray-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_2px_14px_rgba(15,23,42,0.06)]">
                        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                          {(media.length ? media : ['']).slice(0, 19).map((src, i) => (
                            <div
                              key={`${sec.locKey}-slide-${i}`}
                              className="snap-center flex-shrink-0 w-full bg-gray-100 dark:bg-gray-800"
                              style={{ aspectRatio: '4/3' }}
                            >
                              {src ? (
                                <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <span className="material-symbols-outlined text-5xl">image</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 사진 정보(업로더 프로필만) */}
                        <div className="px-3 py-3">
                          <div className="flex items-center gap-2">
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
                            {sec.hasMoreMedia && (
                              <span className="ml-auto text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                                사진은 19장까지 보여줘요
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 위치 설명(사진 피드와 분리) */}
                      <div className="mt-2 px-1">
                        <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 mb-1">
                          위치에 대한 설명
                        </div>
                        <p className="m-0 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 line-clamp-2">
                          {sec.topChips.length > 0
                            ? `지금 ${sec.topChips.map((c) => c.name).join(' · ')} 정보를 확인해요.`
                            : '지금 이 위치의 현재 분위기를 확인해요.'}
                        </p>
                      </div>

                      {/* 주변 맛집/명소(가볍게, 작은 사진 3개) */}
                      <div className="mt-2 px-1">
                        <div className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                          위치 주변 맛집, 가볼만한 곳
                        </div>
                        <div className="flex gap-2">
                          {(Array.isArray(sec.around) ? sec.around : []).slice(0, 3).map((l) => (
                            <div
                              key={`${sec.locKey}-around-${l.id}`}
                              className="flex-1 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-900"
                            >
                              <div className="w-full bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: '4/3' }}>
                                {l.image ? (
                                  <img src={l.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <span className="material-symbols-outlined">photo</span>
                                  </div>
                                )}
                              </div>
                              <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">
                                {l.name}
                              </div>
                            </div>
                          ))}
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



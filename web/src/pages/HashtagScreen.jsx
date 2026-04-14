import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getTimeAgo } from '../utils/timeUtils';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import PostThumbnail from '../components/PostThumbnail';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getTags } from '../api/posts';
import { tagTranslations } from '../utils/tagTranslations';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const DEFAULT_HASHTAGS = ['바다', '힐링', '맛집', '자연', '꽃', '일출', '카페', '여행', '휴양', '등산', '야경', '축제', '해변', '산', '전통', '한옥', '감귤', '벚꽃', '단풍', '도시'];
const MAX_TAGS_SHOWN = 30;
const INITIAL_TAGS_VISIBLE = 8;

const HashtagScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [allPosts, setAllPosts] = useState([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(true);
  /** MongoDB `/posts/tags` 집계(연결 시 로컬 게시물과 병합) */
  const [serverTagStats, setServerTagStats] = useState([]);

  const scrollBodyRef = useRef(null);

  // 사용자 기반 추천: 게시물 태그 + 서버 집계 병합, 빈도순
  const allHashtags = useMemo(() => {
    const norm = (s) => String(s || '').replace(/^#+/, '').trim().toLowerCase();
    const getDisplay = (t) => (typeof t === 'string' ? t : (t?.name || t?.label || '')).replace(/^#+/, '').trim();
    const map = new Map();
    allPosts.forEach((p) => {
      const tags = [
        ...(p.tags || []).map((t) => (typeof t === 'string' ? t : (t?.name || t?.label || ''))),
        ...(p.aiLabels || []).map((l) => (typeof l === 'string' ? l : (l?.name || l?.label || '')))
      ].filter(Boolean);
      tags.forEach((raw) => {
        const n = norm(raw);
        if (!n || n.length < 2) return;
        if (!map.has(n)) map.set(n, { display: getDisplay(raw) || n, count: 0 });
        map.get(n).count += 1;
      });
    });
    (serverTagStats || []).forEach((st) => {
      const raw = st?.name;
      if (!raw) return;
      const n = norm(raw);
      if (!n || n.length < 2) return;
      const prev = map.get(n);
      const c = st.count || 0;
      if (prev) prev.count = Math.max(prev.count, c);
      else map.set(n, { display: String(raw).replace(/^#+/, '').trim() || n, count: c });
    });
    const fromPosts = Array.from(map.entries())
      .map(([n, { display, count }]) => ({ key: n, display, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_TAGS_SHOWN);
    if (fromPosts.length === 0) {
      return DEFAULT_HASHTAGS.slice(0, INITIAL_TAGS_VISIBLE).map((t) => ({ key: t.toLowerCase(), display: t, count: 0 }));
    }
    return fromPosts;
  }, [allPosts, serverTagStats]);

  // 검색어로 태그 필터
  const filteredBySearch = useMemo(() => {
    const q = (tagSearchQuery || '').trim().toLowerCase();
    if (!q) return allHashtags;
    return allHashtags.filter((h) => h.key.includes(q) || (h.display || '').toLowerCase().includes(q));
  }, [allHashtags, tagSearchQuery]);

  // 펼치기 전에는 상위 8개만, 펼치면 전체(최대 MAX_TAGS_SHOWN)
  const visibleTags = useMemo(() => {
    if (tagsExpanded) return filteredBySearch;
    return filteredBySearch.slice(0, INITIAL_TAGS_VISIBLE);
  }, [filteredBySearch, tagsExpanded]);

  // 선택된 태그의 게시물
  const tagPosts = useMemo(() => {
    if (!selectedTag) return [];
    const norm = (s) => String(s || '').replace(/^#+/, '').trim().toLowerCase();
    const getPostTags = (p) => [
      ...(p.tags || []).map((t) => (typeof t === 'string' ? t : (t?.name || t?.label || ''))),
      ...(p.aiLabels || []).map((l) => (typeof l === 'string' ? l : (l?.name || l?.label || '')))
    ];
    const target = norm(selectedTag);
    return allPosts.filter((p) => {
      const pt = getPostTags(p).map(norm).filter(Boolean);
      return pt.some((pTag) => pTag === target || (pTag.includes(target) && target.length >= 2));
    });
  }, [allPosts, selectedTag]);

  useEffect(() => {
    const load = async () => {
      const local = getUploadedPostsSafe();
      const supabase = await fetchPostsSupabase();
      const byId = new Map();
      [...(Array.isArray(supabase) ? supabase : []), ...(Array.isArray(local) ? local : [])].forEach((p) => {
        if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
      });
      setAllPosts(getCombinedPosts(Array.from(byId.values())));
      try {
        const res = await getTags();
        if (res?.success && Array.isArray(res.tags)) setServerTagStats(res.tags);
      } catch {
        /* 백엔드 없으면 로컬만 */
      }
    };
    load();
  }, []);

  // URL ?tag=바다 → 초기 선택
  useEffect(() => {
    const t = searchParams.get('tag');
    if (t && allHashtags.some((h) => h.key === t.toLowerCase() || h.display === t)) {
      setSelectedTag(t.replace(/^#+/, '').trim());
    }
  }, [searchParams, allHashtags]);

  // 스크롤 시작하면 펼치기/접기 숨김, 최상단(scrollTop 0)일 때만 다시 표시
  const handleScroll = useCallback(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    setShowExpandButton(el.scrollTop <= 0);
  }, []);

  return (
    <div className="screen-layout text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
      <div className="screen-content flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* 헤더 (고정) */}
        <div className="flex-shrink-0 flex items-center px-4 pt-4 pb-2 bg-white dark:bg-gray-900">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 shrink-0 items-center justify-center text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-black dark:text-white mr-10">태그 전체보기</h1>
        </div>

        {/* 태그 검색창 */}
        <div className="flex-shrink-0 px-4 pt-2 pb-3 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700">
            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-xl">search</span>
            <input
              type="text"
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              placeholder="태그 검색 (예: 맛집, 꽃, 웨이팅)"
              className="flex-1 bg-transparent text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none text-sm"
            />
            {tagSearchQuery && (
              <button type="button" onClick={() => setTagSearchQuery('')} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">태그를 누르면 해당 사진을 볼 수 있어요</p>
        </div>

          {/* 스크롤 영역: 태그 목록 + 선택된 태그 사진 그리드 */}
        <div
          ref={scrollBodyRef}
          onScroll={handleScroll}
          className="screen-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}
        >
          {/* 해시태그 — 게시물 상세와 동일 스타일 (스카이 링크 + 선택 시 밑줄) */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-2">해시태그</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {visibleTags.map(({ key, display, count }) => {
                const isSelected =
                  selectedTag && (selectedTag || '').replace(/^#+/, '').trim().toLowerCase() === key;
                const korean = tagTranslations[display.toLowerCase()] || display;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTag(isSelected ? null : display)}
                    className={`text-sm font-medium transition-colors text-sky-700 hover:underline dark:text-sky-400 ${
                      isSelected ? 'underline underline-offset-2 font-semibold' : ''
                    }`}
                  >
                    #{korean}
                    {count > 0 && (
                      <span className="text-xs font-normal text-sky-600/70 dark:text-sky-400/70 ml-0.5">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 펼치기 / 접기 버튼 */}
            {filteredBySearch.length > INITIAL_TAGS_VISIBLE && showExpandButton && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setTagsExpanded((prev) => !prev)}
                  className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 mx-auto block"
                >
                  {tagsExpanded ? '접기' : '펼치기'}
                </button>
              </div>
            )}
          </div>

          {selectedTag && (
            <div className="px-4 pt-2 pb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-black dark:text-white text-base font-bold">#{selectedTag} ({tagPosts.length}장)</h2>
                <button type="button" onClick={() => setSelectedTag(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary">
                  해제
                </button>
              </div>
              {tagPosts.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {tagPosts.map((post) => {
                    const id = post.id || post._id;
                    const upTime = getTimeAgo(post.timestamp || post.createdAt);
                    return (
                      <button
                        key={id || (post.timestamp || 0)}
                        type="button"
                        onClick={() => navigate(`/post/${id}`, { state: { post, allPosts: tagPosts } })}
                        className="relative aspect-square rounded overflow-hidden bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <PostThumbnail post={post} className="w-full h-full object-cover" alt="" />
                        <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white bg-black/50 px-1 py-0.5 rounded truncate text-center">
                          🕐 {upTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">이 해시태그가 달린 사진이 없습니다</p>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default HashtagScreen;

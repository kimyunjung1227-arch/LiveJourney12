import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getMagazineTopicById } from '../utils/magazinesConfig';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getCombinedPosts } from '../utils/mockData';
import { getTimeAgo } from '../utils/timeUtils';
import { getDisplayImageUrl } from '../api/upload';
import { logger } from '../utils/logger';

const MagazineDetailScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const state = location.state || {};

  const topic = useMemo(() => getMagazineTopicById(id), [id]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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
          {/* 매거진 헤드 영역 */}
          <section className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-[16px]">
                {topic.emoji || '📚'}
              </span>
              <span className="text-[12px] font-semibold text-indigo-600">
                테마 매거진
              </span>
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 dark:text-gray-50 leading-snug mb-2">
              {topic.title}
            </h2>
            {topic.description && (
              <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                {topic.description}
              </p>
            )}
          </section>

          {/* 큐레이션된 사용자 피드 (인스타 피드처럼 한 장씩 스크롤) */}
          <section className="px-0 pb-8 pt-1">
            {loading ? (
              <div className="py-10 flex items-center justify-center text-[13px] text-gray-500">
                실시간 수국 사진을 모으는 중이에요...
              </div>
            ) : posts.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center text-[13px] text-gray-500 px-6">
                <p className="mb-1">아직 이 테마에 맞는 수국 사진이 없어요.</p>
                <p>지금 여기를 통해 첫 번째 수국 사진을 올려보세요!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8 pt-3 pb-6">
                {posts.map((post) => {
                  const imageUrl = getDisplayImageUrl(
                    (Array.isArray(post.images) && post.images[0]) ||
                      post.image ||
                      post.thumbnail ||
                      ''
                  );
                  const createdAt = post.timestamp || post.createdAt;
                  const timeLabel = createdAt ? getTimeAgo(createdAt) : '';
                  const username =
                    post.user?.username ||
                    post.userName ||
                    (post.author && post.author.name) ||
                    '여행자';
                  const firstLine =
                    (post.note || post.content || '').split('\n')[0] ||
                    (post.location || '');
                  const tags = Array.isArray(post.tags)
                    ? post.tags
                        .map((t) =>
                          typeof t === 'string'
                            ? t.trim().replace(/^#/, '')
                            : String(t || '').trim()
                        )
                        .filter(Boolean)
                    : [];
                  const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                  const commentCount = Array.isArray(post.comments)
                    ? post.comments.length
                    : 0;

                  return (
                    <article
                      key={post.id}
                      className="px-4"
                    >
                      {/* 상단 텍스트 영역 */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[13px] font-semibold text-gray-700">
                              {username.charAt(0)}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-gray-900">
                                {username}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {timeLabel}
                              </div>
                            </div>
                          </div>
                        </div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-1">
                          {post.location || firstLine}
                        </h3>
                        {firstLine && (
                          <p className="text-[13px] text-gray-700 leading-snug line-clamp-2">
                            {firstLine}
                          </p>
                        )}
                        {tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 사진 영역 */}
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => navigate(`/post/${post.id}`, { state: { post } })}
                          className="block w-full rounded-2xl overflow-hidden bg-gray-200"
                        >
                          <img
                            src={imageUrl}
                            alt={post.location || firstLine || '여행 사진'}
                            className="w-full h-auto max-h-[520px] object-cover"
                          />
                        </button>
                      )}

                      {/* 좋아요/댓글 영역 */}
                      <div className="mt-2 flex items-center justify-between text-[12px] text-gray-500">
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-rose-500">
                              favorite
                            </span>
                            <span>{likeCount}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">
                              chat_bubble
                            </span>
                            <span>{commentCount}</span>
                          </span>
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



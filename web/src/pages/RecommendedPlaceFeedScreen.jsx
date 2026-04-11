import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import BottomNavigation from '../components/BottomNavigation';
import { getDisplayImageUrl } from '../api/upload';
import { getCategoryChipsFromPost } from '../utils/travelCategories';
import { getTimeAgo } from '../utils/timeUtils';
import 'swiper/css';
import 'swiper/css/pagination';

function collectMediaUrls(post) {
  const out = [];
  const push = (u) => {
    if (!u) return;
    const url = getDisplayImageUrl(u);
    if (url) out.push(url);
  };
  if (Array.isArray(post?.images)) {
    post.images.forEach(push);
  } else if (post?.image) {
    push(post.image);
  } else if (post?.thumbnail) {
    push(post.thumbnail);
  }
  if (out.length === 0 && post?.videos) {
    const v = Array.isArray(post.videos) ? post.videos[0] : post.videos;
    push(v);
  }
  return [...new Set(out)];
}

function pickTitleLine(post) {
  const note = typeof post?.note === 'string' ? post.note : '';
  const content = typeof post?.content === 'string' ? post.content : '';
  const raw = (note || content).trim();
  if (raw) return raw.split('\n')[0].slice(0, 80);
  return String(post?.placeName || post?.detailedLocation || post?.location || '현장 스냅').slice(0, 80);
}

function pickDistrictLine(post) {
  const loc = String(post?.location || '').trim();
  if (!loc) return '';
  const parts = loc.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} / ${parts.slice(1).join(' ')}`;
  return loc;
}

function starRatingFromLikes(likes) {
  const n = Number(likes) || 0;
  if (n <= 0) return { filled: 0, score: null };
  const filled = Math.min(5, Math.max(1, 1 + Math.min(4, Math.floor(n / 4))));
  const score = Math.min(5, 2.5 + Math.min(2.5, n * 0.08)).toFixed(2);
  return { filled, score };
}

/** Supabase 등에서 user가 객체 { id, username, profileImage }로 올 수 있음 — React #31 방지 */
function displayUserName(userOrAuthor) {
  if (userOrAuthor == null || userOrAuthor === '') return '여행자';
  if (typeof userOrAuthor === 'string' || typeof userOrAuthor === 'number') return String(userOrAuthor);
  if (typeof userOrAuthor === 'object') {
    if (userOrAuthor.username != null) return String(userOrAuthor.username);
    if (userOrAuthor.name != null) return String(userOrAuthor.name);
    if (userOrAuthor.displayName != null) return String(userOrAuthor.displayName);
  }
  return '여행자';
}

function displayUserAvatarSrc(userOrAuthor) {
  if (!userOrAuthor || typeof userOrAuthor !== 'object') return null;
  const raw = userOrAuthor.profileImage || userOrAuthor.avatar || userOrAuthor.photoURL;
  if (!raw) return null;
  try {
    return getDisplayImageUrl(raw);
  } catch {
    return null;
  }
}

/**
 * 꼭 가야 할 곳 → 장소별 게시물을 가벼운 카드로 연속 스크롤
 */
export default function RecommendedPlaceFeedScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const placeKey = location.state?.placeKey || '';
  const placeOneLine = location.state?.placeOneLine || '';
  const rawPosts = location.state?.posts;

  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!placeKey || !Array.isArray(rawPosts)) {
      navigate('/main', { replace: true });
    }
  }, [placeKey, rawPosts, navigate]);

  const posts = useMemo(() => {
    if (!Array.isArray(rawPosts)) return [];
    const seen = new Set();
    const list = [];
    rawPosts.forEach((p) => {
      if (!p?.id || seen.has(String(p.id))) return;
      seen.add(String(p.id));
      list.push(p);
    });
    list.sort((a, b) => {
      const ta = new Date(a.timestamp || a.createdAt || a.photoDate || 0).getTime();
      const tb = new Date(b.timestamp || b.createdAt || b.photoDate || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [rawPosts]);

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!placeKey || !Array.isArray(rawPosts)) {
    return null;
  }

  return (
    <div className="screen-layout bg-white min-h-screen flex flex-col pb-[72px]">
      <header
        className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 border-b border-slate-100 bg-white/95 backdrop-blur-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/main'))}
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="뒤로"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-bold text-slate-900 truncate leading-tight">{placeKey}</h1>
          {placeOneLine ? (
            <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-1">
              {typeof placeOneLine === 'string' ? placeOneLine : String(placeOneLine ?? '')}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pt-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        {posts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            이 장소의 게시물이 아직 없어요.
            <button
              type="button"
              className="block mx-auto mt-4 text-primary font-semibold text-sm"
              onClick={() => navigate('/upload')}
            >
              첫 사진 올리기
            </button>
          </div>
        ) : (
          posts.map((post, index) => {
            const chips = getCategoryChipsFromPost(post);
            const categoryLabel = String(chips[0]?.name || '여행');
            const mediaUrls = collectMediaUrls(post);
            const titleLine = pickTitleLine(post);
            const rawNote = post.note;
            const rawContent = post.content;
            const bodyText = (typeof rawNote === 'string' ? rawNote : typeof rawContent === 'string' ? rawContent : '')
              .trim();
            const placeName = String(post.placeName || post.detailedLocation || post.location || placeKey).trim();
            const districtLine = pickDistrictLine(post);
            const likes = Number(post.likes ?? post.likeCount ?? 0) || 0;
            const comments = Array.isArray(post.comments) ? post.comments.length : Number(post.commentCount ?? 0) || 0;
            const { filled, score } = starRatingFromLikes(likes);
            const userRaw = post.user ?? post.author;
            const userLabel = displayUserName(userRaw);
            const avatarSrc = displayUserAvatarSrc(userRaw);
            const isOpen = !!expanded[post.id];
            const longBody = bodyText.length > 140 || bodyText.split('\n').length > 3;

            return (
              <article
                key={post.id}
                className="mb-5 pb-5 border-b border-slate-100 last:border-0"
              >
                {/* 프로필 · 카테고리 */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt=""
                        className="size-10 rounded-full object-cover shrink-0 bg-slate-100"
                      />
                    ) : (
                      <div
                        className="size-10 rounded-full bg-gradient-to-br from-cyan-100 to-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0"
                        aria-hidden
                      >
                        {userLabel.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-slate-900 truncate">{userLabel}</div>
                      <div className="text-[11px] text-slate-500">
                        {getTimeAgo(post.photoDate || post.timestamp || post.createdAt || post.time) || '방금'}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                    {categoryLabel}
                  </span>
                </div>

                {/* 제목 느낌 한 줄 */}
                <p className="text-[15px] font-bold text-slate-900 leading-snug mb-2 line-clamp-2">{titleLine}</p>

                {/* 이미지 캐러셀 */}
                <div className="rounded-xl overflow-hidden bg-slate-100 aspect-square max-h-[min(92vw,360px)] mx-auto [&_.swiper]:h-full">
                  {mediaUrls.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">이미지 없음</div>
                  ) : mediaUrls.length === 1 ? (
                    <button
                      type="button"
                      className="w-full h-full block p-0 border-0 cursor-pointer"
                      onClick={() =>
                        navigate(`/post/${post.id}`, {
                          state: { post, allPosts: posts, currentPostIndex: index },
                        })
                      }
                    >
                      <img src={mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <Swiper
                      modules={[Pagination]}
                      pagination={{ clickable: true }}
                      className="h-full w-full [&_.swiper-pagination-bullet-active]:bg-white [&_.swiper-pagination-bullet]:bg-white/60"
                    >
                      {mediaUrls.map((url, i) => (
                        <SwiperSlide key={`${post.id}-m-${i}`}>
                          <button
                            type="button"
                            className="w-full aspect-square block p-0 border-0 cursor-pointer"
                            onClick={() =>
                              navigate(`/post/${post.id}`, {
                                state: { post, allPosts: posts, currentPostIndex: index },
                              })
                            }
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  )}
                </div>

                {/* 장소 한 줄 */}
                <div className="flex items-start justify-between gap-2 mt-3 mb-1">
                  <span className="text-[14px] font-bold text-slate-900 line-clamp-2 flex-1">{placeName}</span>
                  {districtLine ? (
                    <span className="text-[11px] text-slate-500 text-right shrink-0 max-w-[45%] line-clamp-2">
                      {districtLine}
                    </span>
                  ) : null}
                </div>

                {/* 별점 느낌 */}
                {score != null && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex text-amber-400 text-[14px] leading-none" aria-hidden>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s}>{s <= filled ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <span className="text-[13px] font-semibold text-slate-700">{score}</span>
                  </div>
                )}

                {/* 본문 + 더보기 */}
                {bodyText ? (
                  <div className="mt-1">
                    <p
                      className={`text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap ${
                        isOpen ? '' : 'line-clamp-3'
                      }`}
                    >
                      {bodyText}
                    </p>
                    {longBody ? (
                      <button
                        type="button"
                        className="mt-1 text-[12px] font-semibold text-cyan-600 hover:text-cyan-700"
                        onClick={() => toggleExpand(post.id)}
                      >
                        {isOpen ? '접기' : '더보기'}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* 하단 액션 */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-4 text-slate-500">
                    <span className="inline-flex items-center gap-1 text-[13px]">
                      <span className="material-symbols-outlined text-[18px]">favorite</span>
                      {likes}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[13px] hover:text-slate-800"
                      onClick={() =>
                        navigate(`/post/${post.id}`, {
                          state: { post, allPosts: posts, currentPostIndex: index },
                        })
                      }
                    >
                      <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                      {comments}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-slate-500 hover:text-slate-800"
                    onClick={() =>
                      navigate(`/post/${post.id}`, {
                        state: { post, allPosts: posts, currentPostIndex: index },
                      })
                    }
                  >
                    자세히
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}

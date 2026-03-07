import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';

const CrowdedPlaceScreen = () => {
    const navigate = useNavigate();
    const [crowdedData, setCrowdedData] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const contentRef = useRef(null);

    useEffect(() => {
        const handler = () => setRefreshKey((k) => k + 1);
        window.addEventListener('adminDeletedPost', handler);
        return () => window.removeEventListener('adminDeletedPost', handler);
    }, []);

    useEffect(() => {
        const onLike = (e) => {
            const { postId, likesCount } = e.detail || {};
            if (!postId || typeof likesCount !== 'number') return;
            const id = String(postId);
            setCrowdedData((prev) =>
                prev.map((p) => (p && String(p.id) === id ? { ...p, likes: likesCount, likeCount: likesCount } : p))
            );
        };
        const onComments = (e) => {
            const { postId, comments: nextComments } = e.detail || {};
            if (!postId || !Array.isArray(nextComments)) return;
            const id = String(postId);
            setCrowdedData((prev) =>
                prev.map((p) => (p && String(p.id) === id ? { ...p, comments: nextComments } : p))
            );
        };
        window.addEventListener('postLikeUpdated', onLike);
        window.addEventListener('postCommentsUpdated', onComments);
        return () => {
            window.removeEventListener('postLikeUpdated', onLike);
            window.removeEventListener('postCommentsUpdated', onComments);
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
            const supabasePosts = await fetchPostsSupabase();
            const byId = new Map();
            [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach((p) => {
                if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
            });
            const allPosts = getCombinedPosts(Array.from(byId.values()));
            const posts = filterActivePosts48(allPosts);

            const transformPost = (post) => {
                const firstImage = post.images?.[0] || post.image || post.thumbnail || '';
                const firstVideo = post.videos?.[0] || '';
                const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
                const commentsArr = Array.isArray(post.comments) ? post.comments : [];
                const timeStr = getTimeAgo(post.timestamp || post.createdAt || post.time);
                return {
                    ...post,
                    id: post.id,
                    image: getDisplayImageUrl(firstImage || firstVideo || ''),
                    thumbnailIsVideo: !firstImage && !!firstVideo,
                    firstVideoUrl: firstVideo ? getDisplayImageUrl(firstVideo) : null,
                    location: post.location,
                    time: timeStr,
                    content: post.note || post.content || `${post.location || '장소'}의 모습`,
                    likes: likesNum,
                    likeCount: likesNum,
                    comments: commentsArr,
                };
            };

            const transformed = posts.map(transformPost);
            const hotPosts = transformed
                .filter((p) => {
                    const hasLikes = (p.likes || 0) > 0;
                    const isRecent = p.time && (p.time.includes('방금') || p.time.includes('분 전') || p.time.includes('시간 전'));
                    return hasLikes || isRecent;
                })
                .sort((a, b) => {
                    if (b.likes !== a.likes) return b.likes - a.likes;
                    if (a.time && a.time.includes('방금')) return -1;
                    if (b.time && b.time.includes('방금')) return 1;
                    if (a.time && a.time.includes('분 전') && !(b.time && b.time.includes('분 전'))) return -1;
                    if (b.time && b.time.includes('분 전') && !(a.time && a.time.includes('분 전'))) return 1;
                    return 0;
                })
                .slice(0, 100);

            setCrowdedData(hotPosts.length > 0 ? hotPosts : transformed.slice(0, 50));
        };
        loadData();
    }, [refreshKey]);

    return (
        <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
            {/* 헤더 */}
            <header className="screen-header sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-background-light/90 dark:bg-background-dark/90 border-b border-slate-100 dark:border-slate-800 backdrop-blur">
                <button
                    onClick={() => navigate(-1)}
                    aria-label="뒤로가기"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-main dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back</span>
                </button>
                <h1 className="flex-1 text-center text-lg font-bold text-text-main dark:text-white">
                    실시간 급상승 핫플
                </h1>
                <div className="w-10" />
            </header>

            {/* 컨텐츠 */}
            <div ref={contentRef} className="screen-content flex-1 overflow-y-auto">
                {/* 상단 타이틀 섹션 */}
                <section className="px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex h-2 w-2 items-center justify-center rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">
                            Live Now
                        </span>
                    </div>
                    <h2 className="text-xl font-bold leading-tight text-text-main dark:text-white">
                        실시간 급상승 핫플
                    </h2>
                    <p className="mt-1 text-xs text-text-sub dark:text-slate-400">
                        지금 가장 핫한 여행지를 확인해보세요
                    </p>
                </section>

                {/* 실시간 핫플 피드 — 메인 화면과 동일한 게시물 목록 */}
                {crowdedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-400 dark:text-slate-500">
                        <span className="material-symbols-outlined text-5xl mb-3">local_fire_department</span>
                        <p className="text-sm mb-1">아직 실시간 핫플 게시물이 없어요</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            좋아요가 쌓이거나 최근 게시물이 생기면 이곳에 표시돼요.
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '7px',
                            padding: '0 20px 100px'
                        }}
                    >
                        {crowdedData.map((post) => {
                            const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
                            const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
                            return (
                                <div
                                    key={post.id}
                                    onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: crowdedData } })}
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                        borderRadius: '14px',
                                        background: '#fff'
                                    }}
                                >
                                    <div style={{ width: '100%', paddingBottom: '125%', height: 0, position: 'relative', background: '#e5e7eb', borderRadius: '14px', overflow: 'hidden', marginBottom: '4px' }}>
                                        {post.thumbnailIsVideo && post.firstVideoUrl ? (
                                            <video
                                                src={post.firstVideoUrl}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : post.image ? (
                                            <img
                                                src={post.image}
                                                alt={post.location}
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                                            />
                                        ) : (
                                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', borderRadius: '14px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>image</span>
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: '6px', right: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '3px 7px', borderRadius: '9999px', fontSize: '10px', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                                {likeCount}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(15,23,42,0.6)', color: '#fff', padding: '3px 7px', borderRadius: '9999px', fontSize: '10px', fontWeight: 600 }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>chat_bubble</span>
                                                {commentCount}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '6px 4px 10px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {post.location || '어딘가의 지금'}
                                        </div>
                                        {(post.content || post.note) && (
                                            <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px', lineHeight: 1.35, height: '2.6em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                {post.content || post.note}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{post.time}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 위로가기 버튼 - 프로필 버튼 바로 위, 흰색 완전 원형 */}
            <button
                type="button"
                onClick={() => {
                    if (contentRef.current) {
                        contentRef.current.scrollTop = 0;
                        if (typeof contentRef.current.scrollTo === 'function') {
                            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                    position: 'fixed',
                    bottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 20px)',
                    right: 'calc((100vw - 460px) / 2 + 20px)',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(148,163,184,0.5)',
                    boxShadow: '0 4px 14px rgba(15,23,42,0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 60
                }}
                aria-label="위로가기"
            >
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#111827' }}>north</span>
            </button>

            <BottomNavigation />
        </div>
    );
};

export default CrowdedPlaceScreen;

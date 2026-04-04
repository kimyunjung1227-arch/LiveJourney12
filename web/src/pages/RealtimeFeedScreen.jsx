
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getWeatherByRegion } from '../api/weather';
import { toggleLike, isPostLiked } from '../utils/socialInteractions';
import { updatePostLikesSupabase } from '../api/postsSupabase';
import HotFeedCard from '../components/HotFeedCard';
import { buildHotFeedCardProps, getHotFeedSocialLine } from '../utils/hotFeedCardModel';

const RealtimeFeedScreen = () => {
  const navigate = useNavigate();
  const [realtimeData, setRealtimeData] = useState([]);
  const [weatherByRegion, setWeatherByRegion] = useState({});
  const contentRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [realtimeSocialIdx, setRealtimeSocialIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRealtimeSocialIdx((i) => (i + 1) % 3), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setRealtimeSocialIdx(0);
  }, [realtimeData.length]);

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

      const formattedWithRaw = posts.map((post) => {
        const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
        const commentsArr = Array.isArray(post.comments) ? post.comments : [];
        return {
          ...post,
          id: post.id,
          location: post.location,
          time: post.timeLabel || getTimeAgo(post.timestamp || post.createdAt || post.time),
          content: post.note || post.content || `${post.location}의 모습`,
          likes: likesNum,
          likeCount: likesNum,
          comments: commentsArr,
        };
      });

      setRealtimeData(formattedWithRaw);
    };
    loadData();
  }, [refreshKey]);

  useEffect(() => {
    const regions = new Set();
    realtimeData.forEach((p) => {
      if (p && !p.weather && (p.region || p.location)) {
        const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
        if (r) regions.add(r);
      }
    });
    if (regions.size === 0) return;
    let cancelled = false;
    const map = {};
    Promise.all(
      Array.from(regions).map(async (region) => {
        try {
          const res = await getWeatherByRegion(region);
          if (!cancelled && res?.success && res.weather) return { region, weather: res.weather };
        } catch (_) {}
        return null;
      })
    ).then((results) => {
      if (cancelled) return;
      results.forEach((r) => { if (r) map[r.region] = r.weather; });
      setWeatherByRegion((prev) => ({ ...prev, ...map }));
    });
    return () => { cancelled = true; };
  }, [realtimeData]);

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
      setRealtimeData((prev) =>
        prev.map((p) => (p && String(p.id) === id ? { ...p, likes: likesCount, likeCount: likesCount } : p))
      );
    };
    const onComments = (e) => {
      const { postId, comments: nextComments } = e.detail || {};
      if (!postId || !Array.isArray(nextComments)) return;
      const id = String(postId);
      setRealtimeData((prev) =>
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

  const handleHotFeedLike = useCallback((e, post) => {
    e.stopPropagation();
    const wasLiked = isPostLiked(post.id);
    const baseLikes = typeof post.likes === 'number'
      ? post.likes
      : (typeof post.likeCount === 'number' ? post.likeCount : 0);
    const result = toggleLike(post.id, baseLikes);
    if (result.existsInStorage) {
      setRealtimeData((prev) =>
        prev.map((p) => (p && p.id === post.id ? { ...p, likes: result.newCount, likeCount: result.newCount } : p))
      );
    } else {
      const delta = wasLiked ? -1 : 1;
      updatePostLikesSupabase(post.id, delta);
      setRealtimeData((prev) =>
        prev.map((p) =>
          (p && p.id === post.id ? { ...p, likes: result.newCount, likeCount: result.newCount } : p)
        )
      );
    }
  }, []);

  return (
    <div className="screen-layout" style={{ background: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: '20px' }} />
      <header
        className="screen-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
          background: 'white',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              color: '#333',
              fontSize: 24
            }}
          >
            arrow_back
          </span>
        </button>

        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 700,
            color: '#1f2937'
          }}
        >
          지금 여기는
        </div>

        <div style={{ width: 24, height: 24 }} />
      </header>

      <div
        ref={contentRef}
        className="screen-content"
        style={{ flex: 1, overflow: 'auto', padding: '8px 16px 24px', paddingBottom: '100px' }}
      >
        {realtimeData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>schedule</span>
            <p>아직 게시물이 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-16">
            {realtimeData.map((post) => {
              const cardProps = buildHotFeedCardProps(post, weatherByRegion);
              if (!cardProps) return null;
              const socialText = getHotFeedSocialLine(cardProps, realtimeSocialIdx);
              const liked = isPostLiked(post.id);
              return (
                <HotFeedCard
                  key={post.id}
                  cardProps={cardProps}
                  socialText={socialText}
                  liked={liked}
                  onCardClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: realtimeData } })}
                  onLikeClick={handleHotFeedLike}
                />
              );
            })}
          </div>
        )}
      </div>

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
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(148,163,184,0.5)',
          boxShadow: '0 4px 14px rgba(15,23,42,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 200
        }}
        aria-label="위로가기"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#111827' }}>north</span>
      </button>

      <BottomNavigation />
    </div>
  );
};

export default RealtimeFeedScreen;

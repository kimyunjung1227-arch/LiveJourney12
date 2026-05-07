
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css';

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getWeatherByRegion } from '../api/weather';
import { getGridCoverDisplay } from '../utils/postMedia';
import StatusBadge from '../components/StatusBadge';
import { getPhotoStatusFromPost } from '../utils/photoStatus';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { useAuth } from '../contexts/AuthContext';
import { getUploadedPostsSafe } from '../utils/localStorageManager';
import { getValidWeatherSnapshot } from '../utils/weatherSnapshot';
import FastImage from '../components/FastImage';
import { MAIN_FEED_IMAGE_OPTS } from '../utils/mainFeedSnapshot';
import {
  feedGridCardBoxFlat,
  feedGridImageBoxFlat,
  feedGridInfoBox,
  feedGridTitleStyle,
  feedGridDescStyle,
  feedGridMetaRow,
} from '../utils/feedGridCardStyles';

const RealtimeFeedScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [realtimeData, setRealtimeData] = useState([]);
  const [weatherByRegion, setWeatherByRegion] = useState({});
  const contentRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const localPosts = getUploadedPostsSafe();
      const supabasePosts = await fetchPostsSupabase(user?.id || null);
      const allPosts = getCombinedPosts(combinePostsSupabaseAndLocal(supabasePosts, localPosts));
      const posts = filterActivePosts48(allPosts);

      const formattedWithRaw = posts.map((post) => {
        const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
        const commentsArr = Array.isArray(post.comments) ? post.comments : [];
        const gridCover = getGridCoverDisplay(post, getDisplayImageUrl);
        return {
          ...post,
          id: post.id,
          gridCover,
          location: post.location,
          time: post.timeLabel || getTimeAgo(post.photoDate || post.exifData?.photoDate || post.timestamp || post.createdAt || post.time),
          content: post.note || post.content || `${post.location}의 모습`,
          likes: likesNum,
          likeCount: likesNum,
          comments: commentsArr,
        };
      });

      setRealtimeData(formattedWithRaw);
    };
    loadData();
  }, [refreshKey, user?.id]);

  useEffect(() => {
    const regions = new Set();
    realtimeData.forEach((p) => {
      if (!p || p.weather || p.weatherSnapshot) return;
      const r = (p.region || p.location || '').trim().split(/\s+/)[0] || p.region || p.location;
      if (!r) return;
      // 이미 받아온 지역은 재요청하지 않음
      if (weatherByRegion?.[r]) return;
      regions.add(r);
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
  }, [realtimeData, weatherByRegion]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('adminDeletedPost', handler);
    return () => window.removeEventListener('adminDeletedPost', handler);
  }, []);

  useEffect(() => {
    const onLike = (e) => {
      const { postId, likesCount, isLiked } = e.detail || {};
      if (!postId) return;
      const id = String(postId);
      setRealtimeData((prev) =>
        prev.map((p) => {
          if (!p || String(p.id) !== id) return p;
          const next = { ...p };
          if (typeof likesCount === 'number') {
            next.likes = likesCount;
            next.likeCount = likesCount;
          }
          if (typeof isLiked === 'boolean') {
            next.likedByMe = isLiked;
          }
          return next;
        })
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

  useEffect(() => {
    if (realtimeData.length > 0) {
      setVisibleCount(Math.min(8, realtimeData.length));
    }
  }, [realtimeData.length]);

  const displayedPosts = useMemo(() => {
    if (!realtimeData || realtimeData.length === 0) return [];
    return Array.from({ length: visibleCount }, (_, index) => {
      const srcIndex = index % realtimeData.length;
      return realtimeData[srcIndex];
    });
  }, [realtimeData, visibleCount]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        setVisibleCount((prev) => prev + 4);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col relative"
    >
      <header
        className="screen-header sticky top-0 z-[100] flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-background-light px-4 py-2.5 dark:border-border-dark dark:bg-background-dark"
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ color: '#333', fontSize: 24 }}>
            arrow_back
          </span>
        </button>

        <div className="flex-1 text-center text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          지금 여기는
        </div>

        <div className="w-10 shrink-0" aria-hidden />
      </header>

      <div
        ref={contentRef}
        className="screen-content flex-1 overflow-auto bg-background-light px-4 pb-24 pt-3 dark:bg-background-dark"
      >
        {realtimeData.length === 0 ? (
          <div className="py-16 text-center text-text-secondary-light dark:text-text-secondary-dark">
            <span className="material-symbols-outlined mb-4 block text-5xl opacity-60">schedule</span>
            <p className="text-sm">아직 게시물이 없어요</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              rowGap: '7px',
              columnGap: '7px',
              paddingBottom: '16px',
            }}
          >
            {displayedPosts.map((post, index) => {
              // 메인 "지금 여기는" 카드와 동일: 동영상 우선, 없으면 이미지(FastImage)
              let firstVideo = null;
              if (post.videos) {
                if (Array.isArray(post.videos) && post.videos.length > 0) {
                  firstVideo = getDisplayImageUrl(post.videos[0], { ...MAIN_FEED_IMAGE_OPTS, allowBlob: true });
                } else if (typeof post.videos === 'string' && post.videos.trim()) {
                  firstVideo = getDisplayImageUrl(post.videos, { ...MAIN_FEED_IMAGE_OPTS, allowBlob: true });
                }
              }
              const rawFirstImage = Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : (post.image || post.thumbnail || '');
              const firstImage = firstVideo ? null : getDisplayImageUrl(rawFirstImage, MAIN_FEED_IMAGE_OPTS);

              const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
              const snap = getValidWeatherSnapshot(post);
              const weather = snap || post.weatherSnapshot || post.weather || weatherByRegion[regionKey] || null;
              const hasWeather = weather && (weather.icon || weather.temperature);
              const status = getPhotoStatusFromPost(post);

              return (
                <div
                  key={`${post.id}-${index}`}
                  onClick={() => {
                    const idx = realtimeData.findIndex((p) => String(p?.id) === String(post?.id));
                    navigate(`/post/${post.id}`, {
                      state: {
                        post,
                        allPosts: realtimeData,
                        currentPostIndex: idx >= 0 ? idx : 0,
                      },
                    });
                  }}
                  style={{
                    ...feedGridCardBoxFlat,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={feedGridImageBoxFlat}>
                    {firstVideo ? (
                      <video
                        src={firstVideo}
                        poster={firstImage || getDisplayImageUrl(rawFirstImage, MAIN_FEED_IMAGE_OPTS) || undefined}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : rawFirstImage ? (
                      <FastImage
                        rawUrl={rawFirstImage}
                        opts={MAIN_FEED_IMAGE_OPTS}
                        alt={post.location}
                        loading={index < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={index < 3 ? 'high' : 'auto'}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>image</span>
                      </div>
                    )}
                    {status !== 'NONE' && (
                      <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3 }}>
                        <StatusBadge status={status} />
                      </div>
                    )}
                  </div>

                  <div style={feedGridInfoBox}>
                    <div style={feedGridTitleStyle}>{post.location || '어딘가의 지금'}</div>
                    {(post.content || post.note) && (
                      <div style={feedGridDescStyle}>{post.content || post.note}</div>
                    )}
                    <div style={feedGridMetaRow}>
                      <span>{post.time}</span>
                      {hasWeather && (weather.icon || weather.temperature) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {weather.icon && <span>{weather.icon}</span>}
                          {weather.temperature && <span>{weather.temperature}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
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
          zIndex: 200,
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

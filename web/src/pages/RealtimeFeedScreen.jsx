
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { filterRecentPosts, filterActivePosts48, getTimeAgo } from '../utils/timeUtils';
import './MainScreen.css'; // MainScreen 스타일 재사용

import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getWeatherByRegion } from '../api/weather';
import { getGridCoverDisplay } from '../utils/postMedia';
import {
  feedGridImageBox,
  feedGridInfoBox,
  feedGridTitleStyle,
  feedGridDescStyle,
  feedGridMetaRow,
} from '../utils/feedGridCardStyles';

const RealtimeFeedScreen = () => {
  const navigate = useNavigate();
  const [realtimeData, setRealtimeData] = useState([]);
  const [currentUserCount, setCurrentUserCount] = useState(0);
  const [weatherByRegion, setWeatherByRegion] = useState({});
  const contentRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(8); // 2×4 = 8개부터 시작
  const [refreshKey, setRefreshKey] = useState(0);

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

      const uniqueUserIds = new Set();
      posts.forEach(post => {
        const userId = post.userId || (typeof post.user === 'string' ? post.user : post.user?.id) || post.user;
        if (userId) uniqueUserIds.add(String(userId));
      });
      setCurrentUserCount(uniqueUserIds.size);

      const formattedWithRaw = posts.map((post) => {
        const likesNum = Number(post.likes ?? post.likeCount ?? 0) || 0;
        const commentsArr = Array.isArray(post.comments) ? post.comments : [];
        const gridCover = getGridCoverDisplay(post, getDisplayImageUrl);
        return {
          ...post,
          id: post.id,
          gridCover,
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

  // 날씨가 없는 게시물은 지역 기준으로 기온 조회
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

  // 관리자가 게시물 삭제 시 목록 다시 불러오기
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('adminDeletedPost', handler);
    return () => window.removeEventListener('adminDeletedPost', handler);
  }, []);

  // 상세에서 좋아요/댓글 변경 시 목록 수치 동기화 (메인과 동일하게)
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

  // 데이터가 바뀌면 처음부터 다시 8개 노출
  useEffect(() => {
    if (realtimeData.length > 0) {
      setVisibleCount(Math.min(8, realtimeData.length));
    }
  }, [realtimeData.length]);

  // 무한 스크롤용: 보이는 개수만큼 데이터를 반복해서 채워 넣기
  const displayedPosts = useMemo(() => {
    if (!realtimeData || realtimeData.length === 0) return [];
    return Array.from({ length: visibleCount }, (_, index) => {
      const srcIndex = index % realtimeData.length;
      return realtimeData[srcIndex];
    });
  }, [realtimeData, visibleCount]);

  // 스크롤 하단 근처에서 더 많은 아이템을 추가 (무한 스크롤처럼)
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        setVisibleCount(prev => prev + 4); // 2×2 단위씩 추가
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="screen-layout" style={{ background: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* 업로드 화면과 동일하게, 상단에 여백 + 고정 헤더가 있고 그 아래만 스크롤되도록 구성 */}
      <div style={{ height: '20px' }} />
      {/* 상단 고정 영역: 뒤로가기 버튼 + \"지금 여기는\" 문구가 항상 보이는 구역 */}
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
        {/* 뒤로가기 버튼 - 항상 좌측 상단 */}
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

        {/* 중앙에 항상 보이는 "지금 여기는" 문구 */}
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

        {/* 오른쪽에 빈 공간(뒤로가기 버튼과 균형 맞추기 위한 더미) */}
        <div style={{ width: 24, height: 24 }} />
      </header>

      {/* 컨텐츠 */}
      <div
        ref={contentRef}
        className="screen-content"
        style={{ flex: 1, overflow: 'auto', padding: '16px', paddingBottom: '100px' }}
      >
        {realtimeData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>schedule</span>
            <p>아직 게시물이 없어요</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              rowGap: '7px',
              columnGap: '7px',
              paddingBottom: '16px'
            }}
          >
            {displayedPosts.map((post, index) => {
              const regionKey = (post.region || post.location || '').trim().split(/\s+/)[0] || post.region || post.location;
              const weather = post.weather || weatherByRegion[regionKey] || null;
              const hasWeather = weather && (weather.icon || weather.temperature);
              const likeCount = Number(post.likes ?? post.likeCount ?? 0) || 0;
              const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
              return (
                <div
                  key={`${post.id}-${index}`}
                  onClick={() => navigate(`/post/${post.id}`, { state: { post, allPosts: realtimeData } })}
                  style={{
                    overflow: 'visible',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={feedGridImageBox}>
                    {post.gridCover?.mode === 'img' && post.gridCover.src ? (
                      <img
                        src={post.gridCover.src}
                        alt={post.location}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                      />
                    ) : post.gridCover?.mode === 'video' && post.gridCover.src ? (
                      <video
                        src={post.gridCover.src}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '14px' }}
                      />
                    ) : (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', borderRadius: '14px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>image</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.96)', color: '#111827', padding: '4px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, boxShadow: '0 2px 6px rgba(15,23,42,0.18)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ef4444', fontVariationSettings: "'FILL' 0" }}>favorite</span>
                        <span>{likeCount}</span>
                      </span>
                    </div>
                  </div>

                  <div style={feedGridInfoBox}>
                    <div style={feedGridTitleStyle}>
                      {post.location || '어딘가의 지금'}
                    </div>
                    {(post.content || post.note) && (
                      <div style={feedGridDescStyle}>
                        {post.content || post.note}
                      </div>
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
          // 화면 전체가 아니라, 가운데 460px짜리 폰 화면 기준으로 오른쪽 정렬
          right: 'calc((100vw - 460px) / 2 + 20px)',
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.85)', // 반투명 흰색
          border: '1px solid rgba(148,163,184,0.5)', // 연한 회색 테두리
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

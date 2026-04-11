import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getRecommendedRegions, RECOMMENDATION_TYPES } from '../utils/recommendationEngine';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import './MainScreen.css';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1548115184-bc65ae4986cf?w=800&q=80';

const RecommendedPlaceScreen = () => {
  const navigate = useNavigate();
  const [selectedTag, setSelectedTag] = useState('season_peak');
  const [recommendedData, setRecommendedData] = useState([]);
  const [allPosts, setAllPosts] = useState([]);

  const loadData = useCallback(() => {
    const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const combined = getCombinedPosts(Array.isArray(localPosts) ? localPosts : []);
    setAllPosts(combined);
    const recs = getRecommendedRegions(combined, selectedTag);
    setRecommendedData(recs);
  }, [selectedTag]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark min-h-screen flex flex-col">
      {/* 헤더 */}
      <header className="screen-header" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0
      }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '12px', display: 'flex', alignItems: 'center' }}>
          <span className="material-symbols-outlined" style={{ color: '#333' }}>arrow_back</span>
        </button>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#1f2937' }}>지금, 이 순간 꼭 가야 할 곳</h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
            최근 24시간 제보 우선 · 순위는 최신순 · 신선도에 따라 점수 감쇠
          </p>
        </div>
      </header>

      {/* 필터 탭 */}
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }} className="hide-scrollbar">
          {RECOMMENDATION_TYPES.map(tag => (
            <button
              key={tag.id}
              onClick={() => setSelectedTag(tag.id)}
              style={{
                background: selectedTag === tag.id ? '#00BCD4' : '#f1f5f9',
                color: selectedTag === tag.id ? 'white' : '#64748b',
                padding: '10px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{tag.icon}</span>
              <span>{tag.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="screen-content" style={{ flex: 1, overflow: 'auto', padding: '16px', paddingBottom: '100px' }}>
        {recommendedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>explore</span>
            <p>아직 추천 여행지가 없어요</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>사진을 올려보세요!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {recommendedData.map((item, idx) => {
              const regionPosts = allPosts.filter(p =>
                (typeof p.location === 'string' && p.location.includes(item.regionName)) ||
                (p.detailedLocation && String(p.detailedLocation).includes(item.regionName)) ||
                (p.placeName && String(p.placeName).includes(item.regionName))
              );
              const rawImages = [
                item.liveImage || item.image,
                ...regionPosts.flatMap(p => (p.images && p.images.length ? p.images : [p.thumbnail || p.image].filter(Boolean)))
              ].filter(Boolean);
              const mainImageUrl = getDisplayImageUrl(rawImages[0]) || PLACEHOLDER_IMAGE;
              const statusBadges = Array.isArray(item.statusBadges) ? item.statusBadges : [];
              const liveIndicator = item.liveIndicator && typeof item.liveIndicator === 'object' ? item.liveIndicator : null;
              const freshness = item.freshness && typeof item.freshness === 'object' ? item.freshness : null;
              const isLiveBadge = freshness?.badge === 'live';
              const timelineThumbs = Array.isArray(item.timelineThumbs) ? item.timelineThumbs : [];
              const proofSummary = item.proofSummary || '';
              const photoTimeLabel = freshness?.timeLabel || item.stats?.representativeTimeLabel || '';

              return (
                <div
                  key={idx}
                  onClick={() => navigate(`/region/${item.regionName}`)}
                  style={{
                    background: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1', background: '#eee', position: 'relative' }}>
                    <img
                      src={mainImageUrl}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMAGE; }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: isLiveBadge ? 'rgba(22, 163, 74, 0.92)' : 'rgba(234, 179, 8, 0.92)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: isLiveBadge ? '#bbf7d0' : '#fef9c3',
                          boxShadow: isLiveBadge
                            ? '0 0 0 3px rgba(34, 197, 94, 0.45)'
                            : '0 0 0 3px rgba(250, 204, 21, 0.45)',
                        }}
                      />
                      {isLiveBadge ? 'LIVE' : 'RECENT'}
                    </div>
                    {photoTimeLabel ? (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          left: 8,
                          right: 8,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: 'rgba(15, 23, 42, 0.72)',
                          color: '#f8fafc',
                          fontSize: '11px',
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      >
                        대표 사진 · {photoTimeLabel}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ padding: '12px 14px 14px', background: '#f8fafc', borderTop: '3px solid #475569', boxShadow: '0 -2px 0 0 #475569, 0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 600, color: '#64748b', fontSize: '11px' }}>{item.regionName}</span>
                      {item.stats?.lastPostTimeAgoLabel && (
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {item.stats.lastPostTimeAgoLabel} 업데이트
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.regionName}
                    </div>
                    {String(item.placeOneLine || '').trim() ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#475569',
                          lineHeight: 1.35,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          wordBreak: 'break-word',
                        }}
                      >
                        {String(item.placeOneLine || '').trim()}
                      </div>
                    ) : null}
                    {(item.description || '').trim() ? (
                      <div
                        style={{
                          marginTop: 8,
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 500,
                          wordBreak: 'break-word',
                          lineHeight: 1.55,
                        }}
                      >
                        {(item.description || '').trim().split('\n').map((line, li) => (
                          <div key={li} style={{ marginTop: li > 0 ? 4 : 0 }}>
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {liveIndicator && (liveIndicator.headline || liveIndicator.detail) && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, rgba(0,188,212,0.12) 0%, rgba(71,85,105,0.08) 100%)',
                          border: '1px solid rgba(0,188,212,0.25)',
                        }}
                      >
                        {liveIndicator.headline && (
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            {liveIndicator.headline}
                          </div>
                        )}
                        {liveIndicator.detail && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.35 }}>
                            {liveIndicator.detail}
                          </div>
                        )}
                      </div>
                    )}
                    {statusBadges.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {statusBadges.map((b, i) => (
                          <span key={`${idx}-sb-${i}`} style={{ fontSize: 10, fontWeight: 800, color: '#0f172a', background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.12)', padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                            {String(b || '').replace(/^●\s*/, '')}
                          </span>
                        ))}
                      </div>
                    )}
                    {proofSummary && (
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#334155', lineHeight: 1.35 }}>
                        {proofSummary}
                      </div>
                    )}
                    {timelineThumbs.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {timelineThumbs.slice(0, 4).map((u, i) => {
                          const src = getDisplayImageUrl(u);
                          if (!src) return null;
                          return (
                            <div key={`${idx}-tt-${i}`} style={{ width: 28, height: 28, borderRadius: 9, overflow: 'hidden', background: '#e5e7eb', flexShrink: 0 }}>
                              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
};

export default RecommendedPlaceScreen;

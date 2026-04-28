import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { fetchQuestionPostsPageSupabase } from '../api/postsSupabase';
import { getTimeAgo } from '../utils/timeUtils';
import { useAuth } from '../contexts/AuthContext';

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'near', label: '내 주변' },
  { id: 'waiting', label: '답변 대기 중' },
];

const haversineKm = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

export default function AskSituationListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null); // created_at
  const [myPos, setMyPos] = useState(null);
  const sentinelRef = useRef(null);
  const ioRef = useRef(null);
  // 고정 UI는 "앱 콘텐츠 폭(최대 720px)" 안에서만 위치시키기
  const floatingLayerStyle = useMemo(() => ({
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(720px, 100vw)',
    height: 0,
    pointerEvents: 'none',
    zIndex: 60,
  }), []);

  const ensureMyLocation = useCallback(async () => {
    if (myPos) return myPos;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const pos = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
      );
    });
    setMyPos(pos);
    return pos;
  }, [myPos]);

  const loadPage = useCallback(async ({ reset = false } = {}) => {
    if (loading) return;
    setLoading(true);
    try {
      const before = reset ? null : cursor;
      const res = await fetchQuestionPostsPageSupabase({ limit: 20, before, currentUserId: user?.id || null });
      const next = Array.isArray(res?.posts) ? res.posts : [];
      setCursor(res?.nextBefore || null);
      setItems((prev) => (reset ? next : [...prev, ...next]));
      setHasMore(next.length >= 20 && !!res?.nextBefore);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, user?.id]);

  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    void loadPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필터 변경 시 목록 재로딩
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    void loadPage({ reset: true });
  }, [filter, loadPage]);

  // 무한 스크롤
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (ioRef.current) ioRef.current.disconnect();
    ioRef.current = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (loading || !hasMore) return;
        void loadPage({ reset: false });
      },
      { root: null, rootMargin: '240px', threshold: 0 },
    );
    ioRef.current.observe(sentinelRef.current);
    return () => {
      try { ioRef.current?.disconnect(); } catch { /* ignore */ }
    };
  }, [hasMore, loading, loadPage]);

  const filtered = useMemo(() => {
    let list = Array.isArray(items) ? items : [];
    if (filter === 'waiting') {
      list = list.filter((x) => !x?.hasAcceptedAnswer);
    }
    if (filter === 'near') {
      // 내 주변: 좌표 있는 질문만, 반경 8km (없으면 빈 목록)
      if (!myPos) return [];
      list = list
        .filter((x) => x?.coordinates && Number.isFinite(x.coordinates.lat) && Number.isFinite(x.coordinates.lng))
        .map((x) => ({ ...x, _distKm: haversineKm(myPos, x.coordinates) }))
        .filter((x) => x._distKm <= 8)
        .sort((a, b) => (a._distKm ?? 0) - (b._distKm ?? 0));
    }
    return list;
  }, [filter, items, myPos]);

  useEffect(() => {
    if (filter !== 'near') return;
    void ensureMyLocation();
  }, [filter, ensureMyLocation]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 pt-12">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
        </button>
        <h1 className="text-base font-extrabold text-gray-900">현지 상황 질문들</h1>
        <div style={{ width: 36 }} />
      </header>

      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="rounded-full px-3 py-1.5 text-[12px] font-extrabold"
              style={{
                border: '1px solid',
                borderColor: filter === f.id ? 'rgba(14,165,233,0.35)' : '#e5e7eb',
                background: filter === f.id ? 'rgba(14,165,233,0.10)' : '#fff',
                color: filter === f.id ? '#0ea5e9' : '#111827',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === 'near' && !myPos ? (
          <div className="mt-2 text-[12px] text-gray-500">내 주변 질문을 보려면 위치 권한이 필요해요.</div>
        ) : null}
      </div>

      <div className="flex-1 px-4 pb-24">
        {filtered.length === 0 && !loading ? (
          <div style={{ padding: '12px 12px', borderRadius: 14, border: '1px solid #f1f5f9', background: '#fafafa', color: '#94a3b8', fontSize: 13 }}>
            표시할 질문이 없어요.
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {filtered.map((q) => {
              const where = String(q.location || q.region || '').trim();
              const head = where ? `${where} ` : '';
              const text = String(q.content || q.note || '').trim();
              const commentCount = Math.max(0, Number(q.commentCount ?? q.commentsCount ?? 0) || 0);
              const right = commentCount > 0 ? `답변 ${commentCount}개` : getTimeAgo(q.photoDate || q.timestamp || q.createdAt);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => navigate(`/ask-situation/${q.id}`, { state: { post: q } })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #eef2f7',
                    background: '#ffffff',
                    borderRadius: 16,
                    padding: '12px 12px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#111827', lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {head}{text || '현지 상황이 궁금해요'}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: q.hasAcceptedAnswer ? '#10b981' : '#94a3b8', fontWeight: 800 }}>
                        {q.hasAcceptedAnswer ? '채택 완료' : '답변 대기 중'}
                        {filter === 'near' && Number.isFinite(q._distKm) ? (
                          <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 800 }}>{`${q._distKm.toFixed(1)}km`}</span>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 800, flexShrink: 0, paddingTop: 2, whiteSpace: 'nowrap' }}>
                      {right}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {/* 중앙 로딩 문구는 UX 상 거슬려 제거. 필요 시 무한스크롤 시점에만 미세한 로딩을 표시 */}
        {loading && filtered.length > 0 ? <div className="mt-3 text-center text-[12px] text-gray-300"> </div> : null}
      </div>

      {/* FAB: 질문 작성 */}
      <div style={{ ...floatingLayerStyle, bottom: 64 }}>
        <button
          type="button"
          onClick={() => navigate('/map/ask-situation')}
          aria-label="질문 작성"
          style={{
            position: 'absolute',
            right: 16,
            bottom: 30,
            width: 46,
            height: 46,
            borderRadius: 9999,
            border: '1px solid #e2e8f0',
            background: '#f1f5f9',
            color: '#0ea5e9',
            boxShadow: '0 10px 22px rgba(15,23,42,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'wght' 300" }}>
            edit
          </span>
        </button>
      </div>

      <BottomNavigation />
    </div>
  );
}


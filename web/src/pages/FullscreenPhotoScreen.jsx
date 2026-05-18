import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconX } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import { supabase } from '../utils/supabaseClient';
import { normalizePostRow } from '../hooks/ljPostsMapping';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';

/**
 * 풀스크린 사진 뷰어.
 * - 진입 경로 A: navigate(`/photo/${postId}`, { state: { photos, startIndex } })
 * - 진입 경로 B: 직접 URL — posts에서 images로 폴백 fetch
 * - 좌상단 X로 뒤로가기 + ESC 키 동일
 * - 좌상단에 "현재/전체" 카운터
 * - 좌우 스와이프 + 마우스 드래그
 */
function FullscreenPhotoScreen() {
  const { id: postId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initial = location.state || {};
  const [photos, setPhotos] = useState(Array.isArray(initial.photos) ? initial.photos : []);
  const startIndex = Number.isInteger(initial.startIndex) ? initial.startIndex : 0;
  const [index, setIndex] = useState(startIndex);
  const scrollRef = useRef(null);
  const didInitScrollRef = useRef(false);

  // state로 못 받았으면 posts에서 폴백 fetch
  useEffect(() => {
    if (photos.length > 0) return;
    if (!postId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('id, images')
          .eq('id', postId)
          .maybeSingle();
        if (cancelled || error || !data) return;
        const normalized = normalizePostRow(data);
        if (normalized.photos && normalized.photos.length > 0) {
          setPhotos(normalized.photos);
        }
      } catch (_) {
        // 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, photos.length]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시작 인덱스로 스크롤 위치 세팅 (한 번만)
  useEffect(() => {
    if (didInitScrollRef.current) return;
    if (photos.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    el.scrollLeft = startIndex * w;
    didInitScrollRef.current = true;
  }, [photos.length, startIndex]);

  // 스크롤로 현재 index 추적
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        const idx = Math.round(el.scrollLeft / w);
        setIndex(Math.max(0, Math.min(photos.length - 1, idx)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [photos.length]);

  // 마우스 드래그 (떼면 가장 가까운 페이지로 스냅)
  const { handleDragStart } = useHorizontalDragScroll((slider) => {
    if (!slider) return;
    const w = slider.clientWidth;
    if (w === 0) return;
    const target = Math.round(slider.scrollLeft / w);
    slider.scrollTo({ left: target * w, behavior: 'smooth' });
  });

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: LJ.bgDark,
        zIndex: 999,
        fontFamily: LJ.fontStack,
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
      }}
    >
      {/* 상단 헤더: X (좌측 끝) + 현재/전체 카운터 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 16px',
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <IconX size={20} stroke={2} />
        </button>
        {photos.length > 0 && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: 0.2,
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            {Math.min(index + 1, photos.length)} / {photos.length}
          </span>
        )}
      </header>

      {/* 사진 영역 */}
      <div
        ref={scrollRef}
        className="lj-no-scrollbar"
        onMouseDown={handleDragStart}
        style={{
          flex: 1,
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          cursor: photos.length > 1 ? 'grab' : 'default',
        }}
      >
        {photos.length === 0 ? (
          <div
            style={{
              flex: '0 0 100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
            }}
          >
            사진을 불러오는 중...
          </div>
        ) : (
          photos.map((url, i) => (
            <div
              key={`${url}-${i}`}
              style={{
                flex: '0 0 100%',
                width: '100%',
                height: '100%',
                scrollSnapAlign: 'start',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '56px 0 24px', // 헤더 영역 확보
              }}
            >
              <img
                src={url}
                alt=""
                draggable="false"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  pointerEvents: 'none',
                  display: 'block',
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FullscreenPhotoScreen;

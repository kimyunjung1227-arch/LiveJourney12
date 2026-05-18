import React, { useEffect, useRef, useState } from 'react';
import { LJ } from './tokens';
import { useHorizontalDragScroll } from '../../hooks/useHorizontalDragScroll';

/**
 * 가로 스크롤-스냅 기반 사진 캐러셀.
 * - 1장이면 인디케이터 숨김
 * - 터치 스와이프 + 마우스 드래그 모두 지원
 * - 사진 중앙 하단 점 인디케이터: 현재=흰색, 비활성=반투명 회색
 */
export function PhotoCarousel({ photos = [], height = 340, onPhotoClick, alt = '' }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);

  // 마우스 드래그 — 드래그 끝에 가장 가까운 페이지로 스냅
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll((slider) => {
    if (!slider) return;
    const w = slider.clientWidth;
    if (w === 0) return;
    const target = Math.round(slider.scrollLeft / w);
    slider.scrollTo({ left: target * w, behavior: 'smooth' });
  });

  useEffect(() => {
    const el = ref.current;
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

  if (!photos || photos.length === 0) return null;

  // 드래그 직후의 클릭은 풀스크린 진입과 충돌하므로 가드
  const guardedPhotoClick = (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onPhotoClick?.(e);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 14,
        overflow: 'hidden',
        background: LJ.bgSurface,
      }}
    >
      <div
        ref={ref}
        className="lj-no-scrollbar"
        onMouseDown={handleDragStart}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          cursor: photos.length > 1 ? 'grab' : 'pointer',
        }}
      >
        {photos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={guardedPhotoClick}
            aria-label={`사진 ${i + 1} 크게 보기`}
            style={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              border: 'none',
              padding: 0,
              background: 'transparent',
              cursor: 'pointer',
              display: 'block',
            }}
          >
            <img
              src={url}
              alt={alt}
              loading="lazy"
              draggable="false"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                userSelect: 'none',
                WebkitUserDrag: 'none',
                pointerEvents: 'none',
              }}
            />
          </button>
        ))}
      </div>

      {photos.length > 1 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {photos.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  i === index ? '#fff' : 'rgba(255,255,255,0.45)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                transition: 'all 120ms ease-out',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoCarousel;

import React, { useEffect, useRef, useState } from 'react';
import { LJ } from './tokens';

/**
 * 가로 스크롤-스냅 기반 사진 캐러셀.
 * - 사진이 1장이면 인디케이터 숨김
 * - 가로 스와이프(터치)/드래그/스크롤로 페이지 전환
 * - 사진 중앙 하단에 점 인디케이터, 현재 인덱스 키컬러
 */
export function PhotoCarousel({ photos = [], height = 340, onPhotoClick, alt = '' }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);

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
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {photos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={onPhotoClick}
            aria-label={`사진 ${i + 1} 크게 보기`}
            style={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              border: 'none',
              padding: 0,
              background: 'transparent',
              cursor: onPhotoClick ? 'pointer' : 'default',
              display: 'block',
            }}
          >
            <img
              src={url}
              alt={alt}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                width: i === index ? 8 : 6,
                height: i === index ? 8 : 6,
                borderRadius: '50%',
                background: i === index ? LJ.key : 'rgba(255,255,255,0.7)',
                boxShadow:
                  i === index
                    ? '0 0 0 2px rgba(255,255,255,0.6)'
                    : '0 0 0 1px rgba(0,0,0,0.15)',
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

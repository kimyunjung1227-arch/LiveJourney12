import React, { useRef, useState } from 'react';
import { LJ } from './tokens';

/**
 * 한 장씩 슬라이드되는 사진 캐러셀 (state 기반 transform 슬라이더).
 * - 한 번의 스와이프/드래그 = 1장만 이동 (강한 플릭에도 다음 장만)
 * - 1장이면 인디케이터 숨김
 * - 터치 / 마우스 / 펜 모두 PointerEvents 로 통합 처리
 * - 인디케이터: 현재=흰색, 비활성=반투명 회색
 */
/**
 * @param {{ photos: string[], height?: number, onPhotoClick?: (i:number,e:any)=>void, alt?: string, priority?: boolean }} props
 *  priority=true면 첫 사진은 eager + fetchPriority=high (LCP 단축, 홈 첫 카드용).
 */
export function PhotoCarousel({ photos = [], height = 340, onPhotoClick, alt = '', priority = false, radius = 14 }) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lockedAxisRef = useRef(null); // 'x' | 'y' | null
  const movedRef = useRef(false);
  const activePointerIdRef = useRef(null);

  const SWIPE_COMMIT_PX = 40;
  const N = photos.length;

  if (!photos || N === 0) return null;

  const goTo = (next) => {
    setIndex(Math.max(0, Math.min(N - 1, next)));
  };

  const onPointerDown = (e) => {
    if (N <= 1) return;
    // 1차/마우스 좌클릭만
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockedAxisRef.current = null;
    movedRef.current = false;
    setIsDragging(true);
    setDragOffset(0);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!isDragging || activePointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (lockedAxisRef.current === null) {
      // 6px 이동 후 축 결정 — 세로 우세면 페이지 스크롤에 양보
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedAxisRef.current !== 'x') return;
    if (Math.abs(dx) > 5) movedRef.current = true;
    if (e.cancelable) e.preventDefault();
    // 양 끝에서는 저항 (반만 따라옴)
    let dragX = dx;
    if ((index === 0 && dx > 0) || (index === N - 1 && dx < 0)) {
      dragX = dx * 0.35;
    }
    setDragOffset(dragX);
  };

  const finishDrag = (e) => {
    if (!isDragging) return;
    if (activePointerIdRef.current != null && activePointerIdRef.current !== e?.pointerId) return;
    const dx = dragOffset;
    setIsDragging(false);
    setDragOffset(0);
    activePointerIdRef.current = null;
    if (lockedAxisRef.current === 'x' && Math.abs(dx) >= SWIPE_COMMIT_PX) {
      goTo(index + (dx < 0 ? 1 : -1));
    }
    lockedAxisRef.current = null;
    try {
      if (e?.pointerId != null) e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
    // 드래그가 클릭으로 오인되지 않도록 짧게 지연 후 해제
    setTimeout(() => { movedRef.current = false; }, 0);
  };

  const handlePhotoClick = (i) => (e) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onPhotoClick?.(i, e);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: radius,
        overflow: 'hidden',
        background: LJ.bgSurface,
      }}
    >
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          touchAction: 'pan-y',
          transform: `translate3d(calc(${-index * 100}% + ${dragOffset}px), 0, 0)`,
          transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.22, 0.7, 0.2, 1)',
          cursor: N > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          willChange: 'transform',
        }}
      >
        {photos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={handlePhotoClick(i)}
            aria-label={`사진 ${i + 1} 크게 보기`}
            style={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
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
              loading={priority && i === 0 ? 'eager' : 'lazy'}
              fetchpriority={priority && i === 0 ? 'high' : 'auto'}
              decoding="async"
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

      {N > 1 && (
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

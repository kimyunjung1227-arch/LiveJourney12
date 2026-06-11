import React, { useRef, useState } from 'react';
import { IconCrown } from '@tabler/icons-react';
import { LJ } from './tokens';
import BestCutHero from './BestCutHero';

/**
 * 베스트 컷 캐러셀 — 게시물 갯수만큼 좌우 슬라이드.
 * - PostCard 캐러셀과 동일한 PointerEvents 기반 controlled transform 슬라이더
 * - 한 번의 스와이프 = 1장만 이동
 * - 헤더(왕관 + "베스트 컷")는 캐러셀 외부에서 한 번만 노출
 */
export function BestCutsCarousel({ posts = [], onPostClick, onAuthorClick }) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lockedAxisRef = useRef(null);
  const movedRef = useRef(false);
  const activePointerIdRef = useRef(null);

  const SWIPE_COMMIT_PX = 40;
  const N = posts.length;

  if (!posts || N === 0) return null;

  const goTo = (next) => {
    setIndex(Math.max(0, Math.min(N - 1, next)));
  };

  const onPointerDown = (e) => {
    if (N <= 1) return;
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
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedAxisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedAxisRef.current !== 'x') return;
    if (Math.abs(dx) > 5) movedRef.current = true;
    if (e.cancelable) e.preventDefault();
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
    setTimeout(() => { movedRef.current = false; }, 0);
  };

  return (
    <section style={{ padding: '20px 0 0', fontFamily: LJ.fontStack }}>
      {/* 헤더: 왕관 + 베스트 컷 + 현재/총 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: '0 18px',
        }}
      >
        <IconCrown size={16} stroke={2} color={LJ.key} />
        <span style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>베스트 컷</span>
        {N > 1 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 700,
              color: LJ.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {index + 1} / {N}
          </span>
        )}
      </div>

      {/* 슬라이더 컨테이너 */}
      <div style={{ overflow: 'hidden' }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          style={{
            display: 'flex',
            width: '100%',
            touchAction: 'pan-y',
            transform: `translate3d(calc(${-index * 100}% + ${dragOffset}px), 0, 0)`,
            transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.22, 0.7, 0.2, 1)',
            cursor: N > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            willChange: 'transform',
          }}
        >
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                flex: '0 0 100%',
                minWidth: '100%',
                maxWidth: '100%',
              }}
            >
              <BestCutHero
                post={p}
                onPostClick={() => {
                  if (movedRef.current) return;
                  onPostClick?.(p);
                }}
                onAuthorClick={() => {
                  if (movedRef.current) return;
                  onAuthorClick?.(p);
                }}
                showHeader={false}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 페이지 인디케이터 — 5개 이하일 때만 점, 그 외엔 헤더의 N/M 으로 대체 */}
      {N > 1 && N <= 5 && (
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            marginTop: 12,
          }}
        >
          {posts.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === index ? LJ.key : LJ.borderLight,
                transition: 'background 160ms ease-out',
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default BestCutsCarousel;

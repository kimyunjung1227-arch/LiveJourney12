import { useRef, useCallback } from 'react';

/**
 * 검색화면 태그 슬라이드와 동일한 마우스 드래그 스크롤 훅.
 * - offsetLeft 기준으로 스크롤하여 마우스를 "따라오는" 느낌 제거
 * - walk * 1.5로 자연스러운 드래그
 * - hasMovedRef로 클릭 vs 드래그 구분
 * @param {((el: HTMLElement) => void) | undefined} onRelease — mouseup 시 호출 (가장 가까운 스냅 페이지 정렬 등)
 * @returns {{ handleDragStart: (e: MouseEvent) => void, hasMovedRef: React.MutableRefObject<boolean> }}
 */
export function useHorizontalDragScroll(onRelease) {
  const hasMovedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const scrollStartXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const handleDragStart = useCallback((e) => {
    const slider = e.currentTarget;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    scrollStartXRef.current = e.pageX;
    scrollLeftRef.current = slider.scrollLeft;
    slider.style.cursor = 'grabbing';
    slider.style.userSelect = 'none';

    const handleMouseMove = (ev) => {
      if (!isDraggingRef.current) return;
      ev.preventDefault();
      const deltaX = ev.pageX - scrollStartXRef.current;
      const walk = deltaX * 1.5;
      if (Math.abs(walk) > 5) {
        hasMovedRef.current = true;
      }
      slider.scrollLeft = scrollLeftRef.current - walk;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      slider.style.cursor = 'grab';
      slider.style.userSelect = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      try {
        onReleaseRef.current?.(slider);
      } catch (_) {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  return { handleDragStart, hasMovedRef };
}

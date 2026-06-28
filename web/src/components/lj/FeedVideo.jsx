import React, { useEffect, useRef } from 'react';

/**
 * 피드용 영상 플레이어.
 * - 스크롤 시 화면 '중앙 밴드'에 들어오면 자동재생(음소거·반복), 벗어나면 일시정지.
 * - 인라인에서는 컨트롤 바(소리/전체화면 버튼)를 숨김.
 * - 영상을 클릭하면 전체화면으로 진입하며 거기서 네이티브 컨트롤(소리·전체화면 종료)이 나옴.
 *
 * @param {{ src: string, poster?: string, objectFit?: string, style?: object }} props
 */
export function FeedVideo({ src, poster, objectFit = 'cover', style }) {
  const videoRef = useRef(null);

  // 뷰포트 중앙 밴드 감지 → 자동재생/일시정지
  useEffect(() => {
    const el = videoRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let io;
    try {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) {
            // 음소거 상태에서만 자동재생(브라우저 정책). 전체화면 중엔 건드리지 않음.
            if (el.muted) el.play?.().catch(() => {});
          } else {
            el.pause?.();
          }
        },
        // 루트(뷰포트)를 상하 35% 축소 → 화면 중앙 약 30% 밴드만 감지 영역
        { root: null, rootMargin: '-35% 0px -35% 0px', threshold: 0 }
      );
      io.observe(el);
    } catch (_) {}
    return () => {
      try { io?.disconnect(); } catch (_) {}
    };
  }, [src]);

  // 전체화면 종료 시 음소거·컨트롤 원복 후 인라인 자동재생 복귀
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const restoreInline = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) return; // 아직 전체화면 → 무시
      el.muted = true;
      el.controls = false;
      el.play?.().catch(() => {});
    };
    document.addEventListener('fullscreenchange', restoreInline);
    document.addEventListener('webkitfullscreenchange', restoreInline);
    el.addEventListener('webkitendfullscreen', restoreInline); // iOS Safari (video 전용 전체화면)
    return () => {
      document.removeEventListener('fullscreenchange', restoreInline);
      document.removeEventListener('webkitfullscreenchange', restoreInline);
      el.removeEventListener('webkitendfullscreen', restoreInline);
    };
  }, []);

  const enterFullscreen = (e) => {
    e?.stopPropagation?.();
    const el = videoRef.current;
    if (!el) return;
    // 전체화면에서는 소리 켜고 네이티브 컨트롤 노출
    el.muted = false;
    el.controls = true;
    try {
      if (typeof el.webkitEnterFullscreen === 'function' && !document.fullscreenEnabled) {
        // iOS Safari: video 전용 전체화면 API
        el.webkitEnterFullscreen();
      } else if (typeof el.requestFullscreen === 'function') {
        el.requestFullscreen();
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        el.webkitRequestFullscreen();
      } else if (typeof el.webkitEnterFullscreen === 'function') {
        el.webkitEnterFullscreen();
      }
      el.play?.().catch(() => {});
    } catch (_) {}
  };

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      onClick={enterFullscreen}
      // 컨트롤/클릭이 캐러셀 스와이프로 오인되지 않게 포인터 이벤트 분리
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        display: 'block',
        background: '#000',
        cursor: 'pointer',
        ...style,
      }}
    />
  );
}

export default FeedVideo;

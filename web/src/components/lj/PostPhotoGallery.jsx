import React from 'react';
import { LJ } from './tokens';

/**
 * 게시물 상세 사진 갤러리 — 사진 개수별 적응형 레이아웃.
 *  1장: 단일 사진 (4:3, 50vh 캡 — 한 화면에 댓글까지 보이게)
 *  2장: 정사각형 2개 가로
 *  3장: 정사각형 3개 가로
 *  4장: 2x2 정사각형
 *  5장: 상단 2개 큰 정사각형 + 하단 3개 작은 정사각형
 *  6장 이상: 2x3 정사각형(6장), 우하단에 "+N 전체보기" 오버레이
 */
export function PostPhotoGallery({ photos = [], onPhotoClick, onShowAll }) {
  if (!photos || photos.length === 0) return null;

  const handleClick = (i) => () => onPhotoClick?.(i);
  const handleShowAll = () => (onShowAll ? onShowAll() : onPhotoClick?.(5));

  const cellBase = {
    position: 'relative',
    background: LJ.bgSurface,
    overflow: 'hidden',
    borderRadius: 10,
    padding: 0,
    border: 'none',
    cursor: 'pointer',
    display: 'block',
  };

  const img = (url, alt = '') => (
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
  );

  // 1장: 4:3 단일 + 50vh 캡 (세로 긴 사진도 한 화면에 댓글까지 노출되게)
  if (photos.length === 1) {
    return (
      <button
        type="button"
        onClick={handleClick(0)}
        style={{
          ...cellBase,
          width: '100%',
          aspectRatio: '4 / 3',
          maxHeight: '50vh',
        }}
        aria-label="사진 크게 보기"
      >
        {img(photos[0])}
      </button>
    );
  }

  // 2장
  if (photos.length === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {photos.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={handleClick(i)}
            style={{ ...cellBase, aspectRatio: '1 / 1' }}
            aria-label={`사진 ${i + 1}`}
          >
            {img(url)}
          </button>
        ))}
      </div>
    );
  }

  // 3장
  if (photos.length === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {photos.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={handleClick(i)}
            style={{ ...cellBase, aspectRatio: '1 / 1' }}
            aria-label={`사진 ${i + 1}`}
          >
            {img(url)}
          </button>
        ))}
      </div>
    );
  }

  // 4장: 2x2
  if (photos.length === 4) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 6,
        }}
      >
        {photos.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={handleClick(i)}
            style={{ ...cellBase, aspectRatio: '1 / 1' }}
            aria-label={`사진 ${i + 1}`}
          >
            {img(url)}
          </button>
        ))}
      </div>
    );
  }

  // 5장: 상단 2개 큰 + 하단 3개 작은
  if (photos.length === 5) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {photos.slice(0, 2).map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={handleClick(i)}
              style={{ ...cellBase, aspectRatio: '1 / 1' }}
              aria-label={`사진 ${i + 1}`}
            >
              {img(url)}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {photos.slice(2, 5).map((url, i) => (
            <button
              key={i + 2}
              type="button"
              onClick={handleClick(i + 2)}
              style={{ ...cellBase, aspectRatio: '1 / 1' }}
              aria-label={`사진 ${i + 3}`}
            >
              {img(url)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 6장 이상: 2x3 정사각형(6장), 마지막 셀에 "+N 전체보기" 오버레이
  const visible = photos.slice(0, 6);
  const remaining = photos.length - 6;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 6,
      }}
    >
      {visible.map((url, i) => {
        const isLastOverlay = i === 5 && remaining > 0;
        return (
          <button
            key={i}
            type="button"
            onClick={isLastOverlay ? handleShowAll : handleClick(i)}
            style={{ ...cellBase, aspectRatio: '1 / 1' }}
            aria-label={isLastOverlay ? `사진 ${remaining}장 더 보기` : `사진 ${i + 1}`}
          >
            {img(url)}
            {isLastOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontFamily: LJ.fontStack,
                  gap: 2,
                  backdropFilter: 'blur(2px)',
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                  +{remaining}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>
                  전체보기
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PostPhotoGallery;

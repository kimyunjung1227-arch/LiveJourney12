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
export function PostPhotoGallery({ photos = [], media = null, onPhotoClick, onShowAll }) {
  // media({type,url})가 있으면 영상/사진 혼합, 없으면 photos(문자열)=이미지.
  const items =
    Array.isArray(media) && media.length > 0
      ? media
      : (photos || []).map((url) => ({ type: 'image', url }));
  if (items.length === 0) return null;

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

  // 미디어 1칸 렌더 — 영상이면 컨트롤 있는 video, 아니면 클릭 가능한 img.
  const cell = (item, i, style, label) => {
    if (item?.type === 'video') {
      return (
        <div key={i} style={{ ...cellBase, ...style, cursor: 'default', background: '#000' }}>
          <video
            src={item.url}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
          />
        </div>
      );
    }
    return (
      <button
        key={i}
        type="button"
        onClick={handleClick(i)}
        style={{ ...cellBase, ...style }}
        aria-label={label}
      >
        {img(item?.url)}
      </button>
    );
  };

  // 1장: 영상이면 16:9, 사진이면 4:3 단일 (둘 다 50vh 캡)
  if (items.length === 1) {
    const only = items[0];
    if (only?.type === 'video') {
      return cell(only, 0, { width: '100%', aspectRatio: '16 / 9', maxHeight: '60vh' }, '영상');
    }
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
        {img(only?.url)}
      </button>
    );
  }

  // 2장
  if (items.length === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {items.map((it, i) => cell(it, i, { aspectRatio: '1 / 1' }, `미디어 ${i + 1}`))}
      </div>
    );
  }

  // 3장
  if (items.length === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {items.map((it, i) => cell(it, i, { aspectRatio: '1 / 1' }, `미디어 ${i + 1}`))}
      </div>
    );
  }

  // 4장: 2x2
  if (items.length === 4) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 6,
        }}
      >
        {items.map((it, i) => cell(it, i, { aspectRatio: '1 / 1' }, `미디어 ${i + 1}`))}
      </div>
    );
  }

  // 5장: 상단 2개 큰 + 하단 3개 작은
  if (items.length === 5) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {items.slice(0, 2).map((it, i) => cell(it, i, { aspectRatio: '1 / 1' }, `미디어 ${i + 1}`))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {items.slice(2, 5).map((it, i) => cell(it, i + 2, { aspectRatio: '1 / 1' }, `미디어 ${i + 3}`))}
        </div>
      </div>
    );
  }

  // 6장 이상: 2x3 정사각형(6장), 마지막 셀에 "+N 전체보기" 오버레이
  const visible = items.slice(0, 6);
  const remaining = items.length - 6;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 6,
      }}
    >
      {visible.map((it, i) => {
        const isLastOverlay = i === 5 && remaining > 0;
        // 오버레이가 아닌 영상 칸은 cell()로 재생 가능하게 렌더
        if (!isLastOverlay && it?.type === 'video') {
          return cell(it, i, { aspectRatio: '1 / 1' }, `미디어 ${i + 1}`);
        }
        return (
          <button
            key={i}
            type="button"
            onClick={isLastOverlay ? handleShowAll : handleClick(i)}
            style={{ ...cellBase, aspectRatio: '1 / 1' }}
            aria-label={isLastOverlay ? `미디어 ${remaining}개 더 보기` : `미디어 ${i + 1}`}
          >
            {img(it?.url)}
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

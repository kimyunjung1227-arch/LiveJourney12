import React from 'react';
import { getDisplayImageUrl } from '../api/upload';
import { IMG_FAST } from '../utils/imgAttrs';

const VIDEO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNlNWU3ZWIiLz48cGF0aCBkPSJNMjQgMTl2MjJsMTYtMTFMMjQgMTl6IiBmaWxsPSIjOWNhOWNhIi8+PC9zdmc+';

/**
 * 게시물의 첫 미디어를 썸네일로 표시.
 * - 이미지 있음 → img
 * - 동영상만 있음 → 썸네일만 표시(재생 없음, 플레이 아이콘 placeholder)
 * - 둘 다 없음 → placeholder
 */
export default function PostThumbnail({
  post,
  className = '',
  style = {},
  alt,
  fast = false,
  loading,
  decoding,
  fetchPriority,
  ...props
}) {
  const hasImage = (post?.images && post.images.length > 0) || post?.image || post?.thumbnail || post?.imageUrl;
  const hasVideo = post?.videos && post.videos.length > 0;
  const imgUrl = hasImage
    ? getDisplayImageUrl(post.images?.[0] || post.image || post.thumbnail || post.imageUrl || '')
    : '';
  const label = alt ?? post?.location ?? '미디어';

  const baseImgProps = {
    loading: loading ?? (fast ? 'eager' : 'lazy'),
    decoding: decoding ?? 'async',
    fetchPriority: fetchPriority ?? (fast ? 'high' : 'auto'),
  };
  const imgProps = fast
    ? {
        ...IMG_FAST,
        loading: loading ?? IMG_FAST.loading,
        decoding: decoding ?? IMG_FAST.decoding,
        fetchPriority: fetchPriority ?? 'high',
      }
    : baseImgProps;

  if (hasImage && imgUrl) {
    return (
      <img
        src={imgUrl}
        alt={label}
        className={className}
        style={{ objectFit: 'cover', ...style }}
        {...imgProps}
        {...props}
      />
    );
  }

  if (hasVideo) {
    return (
      <img
        src={VIDEO_PLACEHOLDER}
        alt={label}
        className={className}
        style={{ objectFit: 'cover', ...style }}
        {...imgProps}
        {...props}
      />
    );
  }

  return (
    <div
      className={className}
      style={{ background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
      {...props}
    >
      <span className="material-symbols-outlined text-4xl text-gray-400">image</span>
    </div>
  );
}

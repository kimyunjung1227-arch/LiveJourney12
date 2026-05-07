import React, { useMemo, useState } from 'react';
import { getDisplayImageUrl } from '../api/upload';

/**
 * 메인/피드에서 "빨리 보이기" 우선:
 * - Supabase render(image transform) URL을 먼저 시도해 용량을 줄인다.
 * - render가 막혀있거나 실패하면 원본 URL로 자동 폴백한다.
 */
export default function FastImage({
  rawUrl,
  opts,
  alt = '',
  className,
  style,
  loading,
  decoding = 'async',
  fetchPriority,
  onClick,
  ...props
}) {
  const { transformed, fallback } = useMemo(() => {
    const o = opts && typeof opts === 'object' ? opts : undefined;
    const transformedUrl = getDisplayImageUrl(rawUrl, { ...o, forceTransform: true });
    const fallbackUrl = getDisplayImageUrl(rawUrl, { ...o, disableTransform: true });
    return { transformed: transformedUrl, fallback: fallbackUrl };
  }, [rawUrl, opts]);

  const [src, setSrc] = useState(transformed);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onClick={onClick}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
      {...props}
    />
  );
}


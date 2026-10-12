import React from 'react';
import { IconCrown } from '@tabler/icons-react';
import { LJ, formatExifTime } from './tokens';
import FeedVideo from './FeedVideo';
import { isVideoUri } from '../../utils/postMedia';

/**
 * 장소 페이지 베스트 컷 히어로.
 * 1) 헤더 — 왕관 + 베스트 컷
 * 2) 사진·영상 340px — 좌상단 EXIF, 하단에 작성자(아바타+이름) 오버레이
 *    영상 게시물이면 FeedVideo로 자동재생(음소거·반복), 탭하면 전체화면·소리
 * 3) 본문 (반응 박스 없음)
 */
export function BestCutHero({
  post,
  onPostClick,
  onAuthorClick,
  showHeader = true,
}) {
  if (!post) return null;
  const author = post.author || {};

  // PostCard와 동일한 규칙 — post.media(영상 우선)가 있으면 그 첫 칸을 히어로로,
  // 없으면 photo_url/cover_url 하나를 확장자로 판별해 폴백.
  const mediaList =
    Array.isArray(post.media) && post.media.length > 0
      ? post.media
      : [post.photo_url || post.cover_url]
          .filter(Boolean)
          .map((url) => ({ type: isVideoUri(url) ? 'video' : 'image', url }));
  const hero = mediaList[0] || null;
  const heroUrl = hero?.url || '';
  const isVideo = hero?.type === 'video';
  // 영상 poster — 같은 게시물의 정지 사진이 있으면 첫 프레임 로딩 전 검은 화면 방지
  const posterUrl = isVideo
    ? (post.photos || []).find((u) => u && !isVideoUri(u)) || undefined
    : undefined;

  return (
    <section style={{ padding: showHeader ? '20px 18px 0' : '0 18px', fontFamily: LJ.fontStack }}>
      {/* 1) 헤더 — showHeader=false 일 때는 캐러셀 외부에서 한 번만 그림 */}
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <IconCrown size={16} stroke={2} color={LJ.key} />
          <span style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>베스트 컷</span>
        </div>
      )}

      {/* 2) 메인 사진·영상 — 작성자 정보를 미디어 위에 오버레이 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 340,
          borderRadius: 12,
          overflow: 'hidden',
          background: isVideo ? '#000' : LJ.bgSurface,
        }}
      >
        {isVideo ? (
          <FeedVideo src={heroUrl} poster={posterUrl} />
        ) : (
          <img
            src={heroUrl}
            alt={post.place_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* 사진 전체 클릭 → 게시물 이동. 영상은 탭=전체화면 재생이라 전체 오버레이를
            두지 않고, 아래 "게시물 보기" 칩으로만 이동시킨다. */}
        {!isVideo && (
          <button
            type="button"
            onClick={onPostClick}
            aria-label="베스트 컷 게시물 보기"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        )}

        {/* 영상일 때만: 우하단 게시물 이동 칩 (EXIF 칩과 같은 톤) */}
        {isVideo && (
          <button
            type="button"
            onClick={onPostClick}
            style={{
              position: 'absolute',
              right: 10,
              bottom: 12,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '5px 10px',
              minHeight: 0,
              border: 'none',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontFamily: LJ.fontStack,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            게시물 보기
          </button>
        )}

        {/* 좌상단 EXIF */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 6,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
            {formatExifTime(post.exif_taken_at)}
          </span>
        </div>

        {/* 하단 그라데이션 + 작성자 오버레이 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '32px 12px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            onClick={onAuthorClick}
            aria-label={`${author.nickname || '작성자'} 프로필`}
            style={{
              width: 32,
              height: 32,
              minWidth: 32,
              minHeight: 32,
              flexShrink: 0,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              background: LJ.key,
              border: '2px solid rgba(255,255,255,0.9)',
              cursor: 'pointer',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 0,
              pointerEvents: 'auto',
            }}
          >
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              (author.nickname || '?').slice(0, 1)
            )}
          </button>
          <button
            type="button"
            onClick={onAuthorClick}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: LJ.fontStack,
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              pointerEvents: 'auto',
            }}
          >
            {author.nickname || '익명'}
          </button>
        </div>
      </div>

      {/* 3) 본문 (반응 박스 없이 흰 바탕 그대로) */}
      {post.body && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: LJ.textPrimary, lineHeight: 1.6 }}>
          {post.body}
        </p>
      )}
    </section>
  );
}

export default BestCutHero;

import React from 'react';
import {
  IconCrown,
  IconShieldCheck,
  IconHeart,
  IconMessage,
  IconBookmark,
} from '@tabler/icons-react';
import { LJ, formatExifTime } from './tokens';

/**
 * 장소 페이지 베스트 컷 히어로.
 * 1) 헤더 — 왕관 + 베스트 컷 + 부제
 * 2) 사진 340px — 좌상단 EXIF, 우상단 그라데이션 베스트컷 뱃지 (작성자 오버레이 없음)
 * 3) 작성자 행 — 사진 아래에 아바타 + 이름
 * 4) 본문 + 반응 박스
 */
export function BestCutHero({
  post,
  onPostClick,
  onAuthorClick,
  showHeader = true,
}) {
  if (!post) return null;
  const author = post.author || {};

  return (
    <section style={{ padding: showHeader ? '20px 18px 0' : '0 18px', fontFamily: LJ.fontStack }}>
      {/* 1) 헤더 — showHeader=false 일 때는 캐러셀 외부에서 한 번만 그림 */}
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <IconCrown size={16} stroke={2} color={LJ.key} />
          <span style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>베스트 컷</span>
          <span style={{ fontSize: 11, color: LJ.textSecondary }}>이 장소를 대표하는 한 장</span>
        </div>
      )}

      {/* 2) 메인 사진 — 작성자 오버레이 없음 */}
      <button
        type="button"
        onClick={onPostClick}
        aria-label="베스트 컷 게시물 보기"
        style={{
          position: 'relative',
          width: '100%',
          height: 340,
          borderRadius: 12,
          overflow: 'hidden',
          padding: 0,
          border: 'none',
          background: LJ.bgSurface,
          cursor: 'pointer',
          display: 'block',
        }}
      >
        <img
          src={post.photo_url}
          alt={post.place_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
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
          }}
        >
          <IconShieldCheck size={12} stroke={2} color={LJ.key} />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
            {formatExifTime(post.exif_taken_at)}
          </span>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            background: LJ.gradientBestCut,
            borderRadius: 7,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <IconCrown size={12} stroke={2} />
          베스트 컷
        </div>
      </button>

      {/* 3) 작성자 행 — 사진 아래에 정렬 (오버레이 X, "도움 N명" 제거) */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onAuthorClick}
          aria-label={`${author.nickname || '작성자'} 프로필`}
          style={{
            width: 30,
            height: 30,
            minWidth: 30,
            minHeight: 30,
            flexShrink: 0,
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: LJ.key,
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 0,
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
            fontWeight: 600,
            color: LJ.textPrimary,
          }}
        >
          {author.nickname || '익명'}
        </button>
        {post.is_on_site && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              background: LJ.keyBgLight,
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: LJ.keyTextDark,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: LJ.key }} />
            지금 현장
          </span>
        )}
      </div>

      {/* 4) 본문 + 반응 (배경 박스 없이 흰 바탕 그대로) */}
      <div style={{ marginTop: 10 }}>
        {post.body && (
          <p style={{ margin: 0, fontSize: 13, color: LJ.textPrimary, lineHeight: 1.6 }}>
            {post.body}
          </p>
        )}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${LJ.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: LJ.key }}>
            <IconHeart size={14} stroke={2} />
            {post.like_count ?? 0}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: LJ.textSecondary }}>
            <IconMessage size={14} stroke={2} />
            {post.comment_count ?? 0}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: LJ.textSecondary }}>
            <IconBookmark size={14} stroke={2} />
            {post.save_count ?? 0}
          </span>
        </div>
      </div>

    </section>
  );
}

export default BestCutHero;

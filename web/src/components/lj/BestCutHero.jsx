import React from 'react';
import {
  IconCrown,
  IconShieldCheck,
  IconHeart,
  IconMessage,
  IconBookmark,
  IconAward,
} from '@tabler/icons-react';
import { LJ, formatExifTime } from './tokens';

/**
 * 장소 페이지 베스트 컷 히어로 (4부분).
 * 1) 헤더: 왕관 + 베스트 컷 + 부제
 * 2) 사진 340px + 좌상단 EXIF + 우상단 그라데이션 뱃지 + 하단 작성자 오버레이
 * 3) 본문 + 반응 박스 (#F5F7FA)
 * 4) 영예 트러스트 카드 (키컬러 테두리)
 */
export function BestCutHero({
  post,
  onPostClick,
  onAuthorClick,
  onFollowClick,
  following = false,
  helpedCount,
}) {
  if (!post) return null;
  const author = post.author || {};

  return (
    <section style={{ padding: '20px 18px 0', fontFamily: LJ.fontStack }}>
      {/* 1) 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <IconCrown size={16} stroke={2} color={LJ.key} />
        <span style={{ fontSize: 13, fontWeight: 600, color: LJ.textPrimary }}>베스트 컷</span>
        <span style={{ fontSize: 11, color: LJ.textSecondary }}>이 장소를 대표하는 한 장</span>
      </div>

      {/* 2) 메인 사진 */}
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
        {/* EXIF */}
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
        {/* 베스트 컷 뱃지 */}
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
        {/* 하단 작성자 오버레이 */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onAuthorClick?.();
          }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '28px 14px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              minWidth: 38,
              borderRadius: '50%',
              background: LJ.key,
              border: '2px solid #fff',
              overflow: 'hidden',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {author.avatar_url ? (
              <img src={author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (author.nickname || '?').slice(0, 1)
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              {author.nickname || '익명'}
            </div>
            {typeof helpedCount === 'number' && helpedCount > 0 && (
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, marginTop: 1 }}>
                도움 {helpedCount}명
              </div>
            )}
          </div>
          {post.is_on_site && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 9px',
                background: 'rgba(77,184,232,0.25)',
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 6,
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />
              지금 현장
            </span>
          )}
        </div>
      </button>

      {/* 3) 본문 + 반응 */}
      <div
        style={{
          marginTop: 10,
          padding: 12,
          background: LJ.bgSurface,
          borderRadius: 10,
        }}
      >
        {post.body && (
          <p style={{ margin: 0, fontSize: 12, color: LJ.textPrimary, lineHeight: 1.6 }}>
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

      {/* 4) 영예 트러스트 카드 */}
      <div
        style={{
          marginTop: 12,
          padding: 13,
          background: '#fff',
          border: `1.5px solid ${LJ.key}`,
          borderRadius: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <IconAward size={22} stroke={1.8} color={LJ.key} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: LJ.textPrimary }}>
            {author.nickname || '익명'}님이 만든 영예
          </div>
          <div style={{ fontSize: 10, color: LJ.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
            이 베스트 컷으로 {Math.max(1, post.like_count + post.save_count)}명이 {post.place_name}을 결정했어요
          </div>
        </div>
        <button
          type="button"
          onClick={onFollowClick}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: following ? `1px solid ${LJ.borderLight}` : 'none',
            background: following ? '#fff' : LJ.key,
            color: following ? LJ.textSecondary : '#fff',
            fontFamily: LJ.fontStack,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {following ? '팔로잉' : '팔로우'}
        </button>
      </div>
    </section>
  );
}

export default BestCutHero;

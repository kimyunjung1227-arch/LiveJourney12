import React from 'react';
import { IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { LJ, formatRelative } from './tokens';

/**
 * 댓글 한 줄. isReply=true면 들여쓰기 + 작은 아바타.
 * is_author 또는 author.id === postAuthorId면 "작성자" 그라데이션 뱃지.
 */
export function CommentItem({
  comment,
  isReply = false,
  postAuthorId,
  onReply,
  onToggleLike,
  liked = false,
}) {
  const author = comment.author || {};
  const isAuthor =
    comment.is_author === true ||
    (postAuthorId && (author.id === postAuthorId || comment.author_id === postAuthorId));
  const avatarSize = isReply ? 24 : 30;
  const fontSize = isReply ? 12.5 : 13;
  const initial = (author.nickname || '?').slice(0, 1);

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        marginTop: isReply ? 10 : 0,
        marginLeft: isReply ? 39 : 0,
        paddingLeft: isReply ? 12 : 0,
        borderLeft: isReply ? `2px solid ${LJ.borderLight}` : 'none',
      }}
    >
      {/* 아바타 */}
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          minWidth: avatarSize,
          minHeight: avatarSize,
          flexShrink: 0,
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          background: LJ.key,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: isReply ? 11 : 12,
          fontWeight: 700,
          overflow: 'hidden',
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
          initial
        )}
      </div>

      {/* 본문 영역 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 헤더: 이름 + 작성자 뱃지 + 시간 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: isReply ? 12 : 13,
              fontWeight: 600,
              color: LJ.textPrimary,
            }}
          >
            {author.nickname || '익명'}
          </span>
          {isAuthor && <AuthorBadge />}
          <span style={{ fontSize: 10, color: LJ.textTertiary }}>
            {formatRelative(comment.created_at)}
          </span>
        </div>

        {/* 본문 */}
        <p
          style={{
            margin: '4px 0 0',
            fontSize,
            lineHeight: 1.55,
            color: LJ.textPrimary,
            wordBreak: 'break-word',
          }}
        >
          {comment.body}
        </p>

        {/* 액션: 답글 + 좋아요 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 6,
            fontSize: 11,
            color: LJ.textSecondary,
          }}
        >
          <button
            type="button"
            onClick={() => onReply?.(comment)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: LJ.textSecondary,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: LJ.fontStack,
            }}
          >
            답글
          </button>
          <button
            type="button"
            onClick={() => onToggleLike?.(comment)}
            aria-label="댓글 좋아요"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: liked ? LJ.key : LJ.textSecondary,
              fontWeight: liked ? 700 : 500,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: LJ.fontStack,
            }}
          >
            {liked ? <IconHeartFilled size={13} /> : <IconHeart size={13} stroke={1.8} />}
            {(comment.like_count ?? 0) + (liked && !comment.like_count ? 1 : 0)}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthorBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 5,
        background: LJ.gradientBestCut,
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.3,
      }}
    >
      작성자
    </span>
  );
}

export default CommentItem;

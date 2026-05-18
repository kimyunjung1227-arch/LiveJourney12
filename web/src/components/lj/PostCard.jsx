import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconShieldCheck,
  IconMapPin,
  IconHeart,
  IconHeartFilled,
  IconMessage,
  IconBookmark,
  IconBookmarkFilled,
} from '@tabler/icons-react';
import { LJ, categoryLabel, formatExifTime, formatRemaining } from './tokens';
import MoreMenuDropdown from './MoreMenuDropdown';

const BODY_PREVIEW_LINES = 4;

/**
 * 홈 피드 게시물 카드.
 * 구조: 사진(크게) → 위치명(타이틀) → 아바타+이름(글수)+남은시간 → 본문(4줄) → 반응
 * - 사진과 반응 사이 구분선 없음
 * - 위치명은 헤드라인처럼 굵게/크게
 * - 댓글 아이콘은 꼬리가 우측으로 가도록 좌우 반전
 */
export function PostCard({
  post,
  reactionState,
  photoHeight = 340,
  onToggleLike,
  onToggleSave,
}) {
  const navigate = useNavigate();
  const author = post.author || {};
  const liked = !!reactionState?.liked;
  const saved = !!reactionState?.saved;
  const likeCount = reactionState?.likeCount ?? post.like_count ?? 0;
  const saveCount = reactionState?.saveCount ?? post.save_count ?? 0;
  const commentCount = post.comment_count ?? 0;

  const goPhoto = () => navigate(`/photo/${post.id}`);
  const goAuthor = (e) => {
    e.stopPropagation();
    navigate(`/user/${author.id || post.author_id}`);
  };
  const goPlace = (e) => {
    e.stopPropagation();
    if (post.place_id) navigate(`/place/${post.place_id}`);
  };
  const goPostDetail = (e) => {
    e.stopPropagation();
    navigate(`/post/${post.id}`);
  };

  return (
    <article
      style={{
        background: LJ.bgCard,
        padding: '14px 18px 12px',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
      }}
    >
      {/* 사진 (더 크게) */}
      <button
        type="button"
        onClick={goPhoto}
        aria-label="사진 크게 보기"
        style={{
          position: 'relative',
          width: '100%',
          height: photoHeight,
          borderRadius: 14,
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
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* 좌상단 EXIF 뱃지 */}
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
          <IconShieldCheck size={13} stroke={2} color={LJ.key} />
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
            {formatExifTime(post.exif_taken_at)}
          </span>
        </div>
        {/* 우상단 카테고리 뱃지 */}
        {(post.category_raw || post.category) && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              padding: '4px 9px',
              background: '#fff',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: LJ.textPrimary,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {post.category_raw || categoryLabel(post.category)}
          </div>
        )}
      </button>

      {/* 위치명 (타이틀 — 카드의 헤드라인) */}
      {post.place_name && (
        <button
          type="button"
          onClick={goPlace}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: '14px 0 6px',
            cursor: post.place_id ? 'pointer' : 'default',
            fontFamily: LJ.fontStack,
            fontSize: 17,
            fontWeight: 700,
            color: LJ.textPrimary,
            letterSpacing: -0.3,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            textAlign: 'left',
          }}
        >
          <IconMapPin size={16} stroke={2} color={LJ.key} />
          {post.place_name}
        </button>
      )}

      {/* 작성자 행: 아바타 | 이름(N) · 남은시간 | 지금 현장 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar nickname={author.nickname} avatarUrl={author.avatar_url} size={28} onClick={goAuthor} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            color: LJ.textSecondary,
          }}
        >
          <button
            type="button"
            onClick={goAuthor}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: LJ.fontStack,
              fontSize: 13,
              fontWeight: 600,
              color: LJ.textPrimary,
            }}
          >
            {author.nickname || '작성자'}
          </button>
          {typeof author.post_count === 'number' && author.post_count > 0 && (
            <span style={{ fontSize: 12, color: LJ.textTertiary }}>({author.post_count})</span>
          )}
          <span style={{ color: LJ.textTertiary }}>·</span>
          <span>{formatRemaining(post.expires_at)}</span>
        </div>
        {post.is_on_site && <OnSiteBadge />}
      </div>

      {/* 본문 (4줄 클램프) */}
      {post.body && <ClampedBody text={post.body} />}

      {/* 반응 줄 (구분선 없음) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ReactionButton
            active={liked}
            iconOff={<IconHeart size={19} stroke={1.8} />}
            iconOn={<IconHeartFilled size={19} />}
            count={likeCount}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike?.(post.id);
            }}
            ariaLabel="좋아요"
          />
          <ReactionButton
            active={false}
            iconOff={<MessageRightTail size={19} />}
            iconOn={<MessageRightTail size={19} />}
            count={commentCount}
            onClick={goPostDetail}
            ariaLabel="댓글"
          />
          <ReactionButton
            active={saved}
            iconOff={<IconBookmark size={19} stroke={1.8} />}
            iconOn={<IconBookmarkFilled size={19} />}
            count={saveCount}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave?.(post.id);
            }}
            ariaLabel="저장"
          />
        </div>
        <MoreMenuDropdown postId={post.id} />
      </div>
    </article>
  );
}

/**
 * 댓글 아이콘 — 기본 IconMessage(꼬리 좌하단)를 좌우 반전해서 꼬리를 우측으로.
 */
function MessageRightTail({ size = 19 }) {
  return (
    <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
      <IconMessage size={size} stroke={1.8} />
    </span>
  );
}

function ClampedBody({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    setIsOverflow(ref.current.scrollHeight - 1 > ref.current.clientHeight);
  }, [text]);

  return (
    <div style={{ marginTop: 10 }}>
      <p
        ref={ref}
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: LJ.textPrimary,
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : BODY_PREVIEW_LINES,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </p>
      {isOverflow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-label={expanded ? '본문 접기' : '본문 더보기'}
          style={{
            marginTop: 4,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: LJ.textSecondary,
            fontFamily: LJ.fontStack,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          {expanded ? '접기' : '…  더보기'}
        </button>
      )}
    </div>
  );
}

function Avatar({ nickname, avatarUrl, size = 28, onClick }) {
  const initial = (nickname || '?').slice(0, 1);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${nickname || '작성자'} 프로필`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        background: LJ.key,
        border: 'none',
        cursor: 'pointer',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.42,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        initial
      )}
    </button>
  );
}

function ReactionButton({ active, iconOff, iconOn, count, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: 'transparent',
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        color: active ? LJ.key : LJ.textSecondary,
        fontFamily: LJ.fontStack,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
      }}
    >
      {active ? iconOn : iconOff}
      <span style={{ minWidth: 12 }}>{count}</span>
    </button>
  );
}

function OnSiteBadge() {
  return (
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
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          background: LJ.key,
          borderRadius: '50%',
          display: 'inline-block',
        }}
      />
      지금 현장
    </span>
  );
}

export default PostCard;

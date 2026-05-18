import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconShieldCheck,
  IconMapPin,
  IconHeart,
  IconHeartFilled,
  IconMessageCircle2,
  IconBookmark,
  IconBookmarkFilled,
} from '@tabler/icons-react';
import { LJ, categoryLabel, formatExifTime, formatRemaining } from './tokens';
import MoreMenuDropdown from './MoreMenuDropdown';

const BODY_PREVIEW_LINES = 4;

/**
 * 홈 피드 게시물 카드.
 * - 사진 280px (스펙)
 * - 본문은 4줄까지 노출, 넘치면 끝에 "…" 더보기 토글
 * - 아바타는 원형 고정 (flexShrink:0 + aspectRatio:1)
 */
export function PostCard({
  post,
  reactionState,
  photoHeight = 280,
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
        padding: '16px 18px 14px',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
      }}
    >
      {/* 사진 */}
      <button
        type="button"
        onClick={goPhoto}
        aria-label="사진 크게 보기"
        style={{
          position: 'relative',
          width: '100%',
          height: photoHeight,
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
          {categoryLabel(post.category)}
        </div>
      </button>

      {/* 작성자 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <Avatar nickname={author.nickname} avatarUrl={author.avatar_url} size={30} onClick={goAuthor} />
        <button
          type="button"
          onClick={goAuthor}
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
          {author.nickname || '작성자'}
        </button>
        {post.is_on_site && <OnSiteBadge />}
      </div>

      {/* 위치 + 남은 시간 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          fontSize: 12,
          color: LJ.textSecondary,
        }}
      >
        <IconMapPin size={13} stroke={1.8} />
        <button
          type="button"
          onClick={goPlace}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: post.place_id ? 'pointer' : 'default',
            fontFamily: LJ.fontStack,
            fontSize: 12,
            color: LJ.textSecondary,
          }}
        >
          {post.place_name}
        </button>
        <span>·</span>
        <span>{formatRemaining(post.expires_at)}</span>
      </div>

      {/* 본문 (4줄 클램프 + 더보기) */}
      {post.body && <ClampedBody text={post.body} />}

      {/* 반응 줄 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${LJ.borderLight}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ReactionButton
            active={liked}
            iconOff={<IconHeart size={18} stroke={1.8} />}
            iconOn={<IconHeartFilled size={18} />}
            count={likeCount}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike?.(post.id);
            }}
            ariaLabel="좋아요"
          />
          <ReactionButton
            active={false}
            iconOff={<IconMessageCircle2 size={18} stroke={1.8} />}
            iconOn={<IconMessageCircle2 size={18} stroke={1.8} />}
            count={commentCount}
            onClick={goPostDetail}
            ariaLabel="댓글"
          />
          <ReactionButton
            active={saved}
            iconOff={<IconBookmark size={18} stroke={1.8} />}
            iconOn={<IconBookmarkFilled size={18} />}
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
 * 4줄까지만 표시. 넘치면 텍스트 끝에 "…" 그리고 줄바꿈 후 "더보기" 버튼.
 * 펼친 뒤에는 "접기"로 토글.
 */
function ClampedBody({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflow, setIsOverflow] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    // line-clamp이 적용된 상태에서 scrollHeight > clientHeight면 잘림
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

function Avatar({ nickname, avatarUrl, size = 30, onClick }) {
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
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
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

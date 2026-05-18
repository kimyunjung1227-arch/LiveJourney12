import React from 'react';
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

/**
 * 홈 피드 일반 게시물 카드.
 * - 사진 위 EXIF 뱃지 + 카테고리 뱃지
 * - 작성자 + 지금 현장 뱃지
 * - 본문 + 반응 줄 (좋아요/댓글/저장 + 점 세개)
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
        <button
          type="button"
          onClick={goAuthor}
          aria-label={`${author.nickname || '작성자'} 프로필`}
          style={{
            width: 30,
            height: 30,
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
          }}
        >
          {author.avatar_url ? (
            <img src={author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            (author.nickname || '?').slice(0, 1)
          )}
        </button>
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

      {/* 본문 */}
      {post.body && (
        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: LJ.textPrimary,
          }}
        >
          {post.body}
        </p>
      )}

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

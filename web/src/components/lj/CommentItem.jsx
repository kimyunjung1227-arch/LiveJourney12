import React, { useEffect, useRef, useState } from 'react';
import {
  IconHeart,
  IconHeartFilled,
  IconMessageCircle2,
  IconDots,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { LJ, formatRelative } from './tokens';

/**
 * 댓글 한 줄. isReply=true면 들여쓰기 + 작은 아바타.
 * is_author 또는 author.id === postAuthorId면 "작성자" 하늘색 텍스트.
 * 댓글 작성자(currentUserId === author.id)에게는 이름 옆 점 세개로 수정/삭제 노출.
 */
export function CommentItem({
  comment,
  isReply = false,
  postAuthorId,
  currentUserId,
  onReply,
  onToggleLike,
  onEdit,
  onDelete,
  liked = false,
}) {
  const author = comment.author || {};
  const isAuthor =
    comment.is_author === true ||
    (postAuthorId && (author.id === postAuthorId || comment.author_id === postAuthorId));
  const canManage =
    !!currentUserId && (author.id === currentUserId || comment.author_id === currentUserId);
  const avatarSize = isReply ? 24 : 30;
  const fontSize = isReply ? 12.5 : 13;
  const initial = (author.nickname || '?').slice(0, 1);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body || '');

  const startEdit = () => {
    setDraft(comment.body || '');
    setEditing(true);
  };
  const saveEdit = () => {
    const next = draft.trim();
    if (next && next !== comment.body) onEdit?.(comment, next);
    setEditing(false);
  };

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
        {/* 헤더: 이름 + 작성자 + 시간 + (점 세개) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: isReply ? 12 : 13,
              fontWeight: 600,
              color: LJ.textPrimary,
            }}
          >
            {author.nickname || '익명'}
          </span>
          {isAuthor && <AuthorTag />}
          <span style={{ fontSize: 10, color: LJ.textTertiary }}>
            {formatRelative(comment.created_at)}
          </span>
          {canManage && !editing && (
            <div style={{ marginLeft: 'auto' }}>
              <CommentMenu onEdit={startEdit} onDelete={() => onDelete?.(comment)} />
            </div>
          )}
        </div>

        {/* 본문 (보기 / 편집) */}
        {editing ? (
          <div style={{ marginTop: 6 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
                border: `1px solid ${LJ.borderLight}`,
                borderRadius: 8,
                padding: '8px 10px',
                fontSize,
                lineHeight: 1.55,
                fontFamily: LJ.fontStack,
                color: LJ.textPrimary,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={saveEdit}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: 'none',
                  background: LJ.key,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: LJ.fontStack,
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 7,
                  border: `1px solid ${LJ.borderLight}`,
                  background: '#fff',
                  color: LJ.textSecondary,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: LJ.fontStack,
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
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
        )}

        {/* 액션: 답글 + 좋아요 */}
        {!editing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 6,
            }}
          >
            <button
              type="button"
              onClick={() => onReply?.(comment)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
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
              <IconMessageCircle2 size={15} stroke={1.8} />
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
                fontWeight: liked ? 700 : 600,
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: LJ.fontStack,
              }}
            >
              {liked ? <IconHeartFilled size={15} /> : <IconHeart size={15} stroke={1.8} />}
              {(comment.like_count ?? 0) + (liked && !comment.like_count ? 1 : 0)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthorTag() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: LJ.key,
        letterSpacing: 0.2,
      }}
    >
      작성자
    </span>
  );
}

function CommentMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (fn) => {
    setOpen(false);
    fn?.();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="댓글 더보기"
        style={{
          width: 24,
          height: 24,
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          color: LJ.textTertiary,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconDots size={16} stroke={1.8} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 110,
            background: '#fff',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: 6,
            zIndex: 20,
          }}
        >
          <MenuItem icon={<IconEdit size={15} stroke={1.8} />} label="수정" onClick={() => pick(onEdit)} />
          <MenuItem
            icon={<IconTrash size={15} stroke={1.8} />}
            label="삭제"
            onClick={() => pick(onDelete)}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger ? LJ.error : LJ.textPrimary,
        fontFamily: LJ.fontStack,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = LJ.bgSurface)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  );
}

export default CommentItem;

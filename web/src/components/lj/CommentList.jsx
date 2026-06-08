import React, { useState } from 'react';
import CommentItem from './CommentItem';
import { LJ } from './tokens';

/**
 * 트리 구조 댓글 렌더링 (1단계 깊이).
 * - root 댓글 + replies[]
 * - 좋아요는 로컬 상태로 시각만 토글 (백엔드 별도 필요시 확장)
 */
export function CommentList({
  comments = [],
  postAuthorId,
  currentUserId,
  onReply,
  onEditComment,
  onDeleteComment,
}) {
  const [likedMap, setLikedMap] = useState({});
  const toggleLike = (comment) => {
    setLikedMap((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }));
  };

  if (!comments.length) {
    return (
      <div
        style={{
          padding: '32px 18px',
          textAlign: 'center',
          color: LJ.textSecondary,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        아직 댓글이 없어요.
        <br />
        가장 먼저 한 마디를 남겨주세요.
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 18px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {comments.map((root) => (
        <div key={root.id}>
          <CommentItem
            comment={root}
            postAuthorId={postAuthorId}
            currentUserId={currentUserId}
            onReply={onReply}
            onToggleLike={toggleLike}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
            liked={!!likedMap[root.id]}
          />
          {(root.replies || []).map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              postAuthorId={postAuthorId}
              currentUserId={currentUserId}
              onReply={onReply}
              onToggleLike={toggleLike}
              onEdit={onEditComment}
              onDelete={onDeleteComment}
              liked={!!likedMap[reply.id]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default CommentList;

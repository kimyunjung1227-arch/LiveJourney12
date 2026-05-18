import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconShieldCheck,
  IconMapPin,
  IconHeart,
  IconHeartFilled,
  IconMessageCircle2,
  IconBookmark,
  IconBookmarkFilled,
} from '@tabler/icons-react';
import { LJ, categoryLabel, formatExifTime, formatRemaining } from '../components/lj/tokens';
import MoreMenuDropdown from '../components/lj/MoreMenuDropdown';
import ReportModal from '../components/lj/ReportModal';
import PostPhotoGallery from '../components/lj/PostPhotoGallery';
import CommentList from '../components/lj/CommentList';
import CommentInput from '../components/lj/CommentInput';
import { usePostDetail } from '../hooks/usePostDetail';
import { useReactions } from '../hooks/useReactions';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

/**
 * PostDetailScreen (라우트: /post/:id).
 * - 게시물 영역 (PostCard 유사, 사진 320px, 헤더에 점 세개)
 * - 댓글 영역 (트리, 회색 배경)
 * - 고정 하단 CommentInput
 */
function PostDetailScreen() {
  const { id: postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { post, comments, loading, addCommentLocal } = usePostDetail(postId);
  const postArr = useMemo(() => (post ? [post] : []), [post]);
  const { state, toggleLike, toggleSave } = useReactions(postArr);

  const [replyingTo, setReplyingTo] = useState(null);
  const [following, setFollowing] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const isAuthor = !!(user && post && post.author_id && user.id === post.author_id);

  const handleEdit = () => {
    if (!post) return;
    navigate(`/post/${post.id}/edit`);
  };

  const handleDelete = async () => {
    if (!post || !user) return;
    if (!window.confirm('이 게시물을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id);
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (e) {
      alert('삭제 중 문제가 발생했어요. 다시 시도해주세요.');
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = `${window.location.origin}/post/${post.id}`;
    const title = post.place_name || 'Live Journey';
    const text = post.body ? `${title} — ${post.body.slice(0, 80)}` : title;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(url);
      alert('링크를 복사했어요');
    } catch (_) {}
  };

  if (loading && !post) return <LoadingState />;
  if (!post) return <NotFoundState onBack={() => navigate(-1)} />;

  const author = post.author || {};
  const reaction = state[post.id] || {};
  const liked = !!reaction.liked;
  const saved = !!reaction.saved;
  const likeCount = reaction.likeCount ?? post.like_count ?? 0;
  const saveCount = reaction.saveCount ?? post.save_count ?? 0;
  const commentCount = post.comment_count ?? comments.length;

  const goAuthor = () => navigate(`/user/${author.id || post.author_id}`);
  const goPlace = () => post.place_id && navigate(`/place/${post.place_id}`);
  const goPhoto = () => {
    const photos =
      post.photos && post.photos.length > 0
        ? post.photos
        : [post.photo_url].filter(Boolean);
    navigate(`/photo/${post.id}`, { state: { photos, startIndex: 0 } });
  };

  const handleSubmitComment = async ({ body, parent_id }) => {
    const optimistic = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      parent_id,
      author_id: user?.id || 'guest',
      author: {
        id: user?.id || 'guest',
        nickname: user?.user_metadata?.nickname || user?.email?.split('@')[0] || '나',
        avatar_url: user?.user_metadata?.avatar_url || null,
      },
      body,
      like_count: 0,
      created_at: new Date().toISOString(),
    };
    addCommentLocal(optimistic);
    setReplyingTo(null);

    if (!user) return; // 비로그인은 낙관적 표시만
    try {
      await supabase.from('post_comments').insert({
        post_id: post.id,
        parent_comment_id: parent_id,
        user_id: user.id,
        username: optimistic.author.nickname,
        avatar_url: optimistic.author.avatar_url,
        content: body,
      });
    } catch (_) {
      // 실패해도 UI 유지 (개발 편의)
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          background: '#fff',
          borderBottom: `1px solid ${LJ.borderLight}`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 6,
            borderRadius: 8,
            cursor: 'pointer',
            color: LJ.textPrimary,
            display: 'inline-flex',
          }}
        >
          <IconArrowLeft size={22} stroke={1.8} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: LJ.textPrimary }}>게시물</span>
        <MoreMenuDropdown
          postId={post.id}
          size={20}
          isAuthor={isAuthor}
          onShare={handleShare}
          onReport={() => setShowReport(true)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </header>

      {/* 게시물 영역 */}
      <article style={{ padding: '16px 18px 14px' }}>
        {/* 사진 갤러리 (개수별 적응형 레이아웃) */}
        <div style={{ position: 'relative' }}>
          <PostPhotoGallery
            photos={post.photos && post.photos.length > 0 ? post.photos : [post.photo_url].filter(Boolean)}
            onPhotoClick={(i) =>
              navigate(`/photo/${post.id}`, {
                state: {
                  photos: post.photos && post.photos.length > 0 ? post.photos : [post.photo_url].filter(Boolean),
                  startIndex: i,
                },
              })
            }
            onShowAll={() =>
              navigate(`/photo/${post.id}`, {
                state: {
                  photos: post.photos && post.photos.length > 0 ? post.photos : [post.photo_url].filter(Boolean),
                  startIndex: 5,
                },
              })
            }
          />
        </div>

        {/* 위치명 (헤드라인 — 제목처럼) */}
        {post.place_name && (
          <button
            type="button"
            onClick={goPlace}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: '14px 0 8px',
              cursor: post.place_id ? 'pointer' : 'default',
              fontFamily: LJ.fontStack,
              fontSize: 18,
              fontWeight: 700,
              color: LJ.textPrimary,
              letterSpacing: -0.3,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              textAlign: 'left',
            }}
          >
            <IconMapPin size={17} stroke={2} color={LJ.key} />
            {post.place_name}
          </button>
        )}

        {/* 작성자 + 팔로우 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginTop: 14,
          }}
        >
          <button
            type="button"
            onClick={goAuthor}
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
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
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
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              (author.nickname || '?').slice(0, 1)
            )}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={goAuthor}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  color: LJ.textPrimary,
                  fontFamily: LJ.fontStack,
                }}
              >
                {author.nickname || '작성자'}
              </button>
              {post.is_on_site && <OnSiteBadge />}
              <span style={{ fontSize: 11, color: LJ.textTertiary }}>·</span>
              <span style={{ fontSize: 11, color: LJ.textSecondary }}>
                {formatRemaining(post.expires_at)}
              </span>
            </div>
          </div>
          <FollowButton following={following} onClick={() => setFollowing((v) => !v)} />
        </div>

        {/* 본문 */}
        {post.body && (
          <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: LJ.textPrimary }}>
            {post.body}
          </p>
        )}

        {/* 반응 줄 — 좋아요/저장은 홈에서, 여기는 댓글 카운트만 노출 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${LJ.borderLight}`,
          }}
        >
          <DetailReactionBtn
            active={false}
            iconOff={<IconMessageCircle2 size={20} stroke={1.8} />}
            iconOn={<IconMessageCircle2 size={20} stroke={1.8} />}
            count={commentCount}
            ariaLabel="댓글"
          />
        </div>
      </article>

      {/* 댓글 영역 (흰 배경) */}
      <section style={{ background: '#fff', flex: 1 }}>
        <div
          style={{
            padding: '14px 18px 6px',
            fontSize: 13,
            fontWeight: 600,
            color: LJ.textPrimary,
          }}
        >
          댓글 {commentCount}
        </div>
        <CommentList
          comments={comments}
          postAuthorId={author.id || post.author_id}
          onReply={setReplyingTo}
        />
      </section>

      {/* 고정 하단 입력 */}
      <CommentInput
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSubmit={handleSubmitComment}
      />

      {showReport && (
        <ReportModal postId={post.id} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

function DetailReactionBtn({ active, iconOff, iconOn, count, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: 'none',
        padding: 2,
        cursor: onClick ? 'pointer' : 'default',
        color: active ? LJ.key : LJ.textSecondary,
        fontFamily: LJ.fontStack,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
      }}
    >
      {active ? iconOn : iconOff}
      <span>{count}</span>
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
        }}
      />
      지금 현장
    </span>
  );
}

function FollowButton({ following, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        border: following ? `1px solid ${LJ.borderLight}` : 'none',
        background: following ? '#fff' : LJ.key,
        color: following ? LJ.textSecondary : '#fff',
        fontFamily: LJ.fontStack,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {following ? '팔로잉' : '팔로우'}
    </button>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: LJ.fontStack,
        color: LJ.textSecondary,
        fontSize: 13,
      }}
    >
      게시물을 불러오는 중...
    </div>
  );
}

function NotFoundState({ onBack }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: LJ.fontStack,
        padding: 24,
      }}
    >
      <p style={{ color: LJ.textPrimary, fontSize: 15, fontWeight: 600 }}>
        게시물을 찾을 수 없어요
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{
          padding: '10px 18px',
          background: LJ.key,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        돌아가기
      </button>
    </div>
  );
}

export default PostDetailScreen;

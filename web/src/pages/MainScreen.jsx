import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconBell } from '@tabler/icons-react';
import BottomNavigation from '../components/BottomNavigation';
import { LJ } from '../components/lj/tokens';
import EmptyState from '../components/lj/EmptyState';
import PostCard from '../components/lj/PostCard';
import { useHomeFeed } from '../hooks/useHomeFeed';
import { useReactions } from '../hooks/useReactions';
import { useNotifications } from '../hooks/useNotifications';

/**
 * HomeScreen (라우트: /, /main).
 * - 헤더 + 무한 스크롤 피드.
 * - 카테고리 필터는 검색 화면으로 이동.
 */
function MainScreen() {
  const navigate = useNavigate();
  const { posts, loading, loadingMore, hasMore, loadMore } = useHomeFeed('all');
  const { state, toggleLike, toggleSave } = useReactions(posts);
  const { notifications } = useNotifications({ limit: 30 });
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // 무한 스크롤 sentinel
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) loadMore();
        });
      },
      { rootMargin: '400px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        paddingBottom: 80,
      }}
    >
      {/* 헤더: 로고 + 검색/알림 아이콘 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: LJ.key,
            letterSpacing: -0.3,
          }}
        >
          Live Journey
        </h1>
        {/* 검색버튼은 알림보다 약간 왼쪽으로, 두 버튼 모두 32px 같은 높이로 vertical-center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={() => navigate('/search')}
            aria-label="검색"
            style={{
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 2px',
              background: 'transparent',
              border: 'none',
              borderBottom: `1.5px solid ${LJ.borderLight}`,
              color: LJ.textSecondary,
              fontFamily: LJ.fontStack,
              fontSize: 12.5,
              fontWeight: 500,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            <span>어디로 떠나볼까요?</span>
            <IconSearch size={18} stroke={2} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
            style={{
              position: 'relative',
              height: 32,
              width: 32,
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: LJ.textSecondary,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconBell size={18} stroke={2} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 0,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: '#FF3B30',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #fff',
                  boxSizing: 'border-box',
                  letterSpacing: 0,
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 피드 */}
      {loading && posts.length === 0 ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyFeed onUpload={() => navigate('/upload')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {posts.map((post, idx) => (
            <React.Fragment key={post.id}>
              <PostCard
                post={post}
                reactionState={state[post.id]}
                onToggleLike={toggleLike}
                onToggleSave={toggleSave}
                priority={idx === 0}
              />
              <div style={{ height: 1, background: LJ.borderLight, margin: '0 18px' }} />
            </React.Fragment>
          ))}

          {/* 무한 스크롤 sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div
              style={{
                padding: '20px 0',
                textAlign: 'center',
                color: LJ.textSecondary,
                fontSize: 12,
              }}
            >
              불러오는 중...
            </div>
          )}
          {!hasMore && (
            <div
              style={{
                padding: '24px 0 16px',
                textAlign: 'center',
                color: LJ.textTertiary,
                fontSize: 11,
              }}
            >
              여기까지 라이브 사진을 모두 봤어요
            </div>
          )}
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}

function IconButton({ children, onClick, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 6,
        borderRadius: 8,
        color: LJ.textSecondary,
        cursor: 'pointer',
        display: 'inline-flex',
      }}
    >
      {children}
    </button>
  );
}

function FeedSkeleton() {
  return (
    <div style={{ padding: 18 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
            border: `1px solid ${LJ.borderLight}`,
          }}
        >
          <div
            style={{
              height: 200,
              background: LJ.bgSurface,
              borderRadius: 10,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              height: 12,
              background: LJ.bgSurface,
              borderRadius: 4,
              width: '40%',
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 12,
              background: LJ.bgSurface,
              borderRadius: 4,
              width: '80%',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyFeed({ onUpload }) {
  return (
    <EmptyState
      padding="72px 24px"
      title={
        <>
          첫 한 장이
          <br />
          라이브저니의 시작
        </>
      }
      description={
        <>
          지금 있는 곳을 사진으로 남기면
          <br />
          같은 곳을 궁금해하는 누군가에게 닿아요
        </>
      }
      actionLabel="사진 한 장 올리기"
      onAction={onUpload}
    />
  );
}

export default MainScreen;

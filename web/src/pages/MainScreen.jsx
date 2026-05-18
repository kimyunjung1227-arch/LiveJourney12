import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconBell, IconCamera } from '@tabler/icons-react';
import BottomNavigation from '../components/BottomNavigation';
import { LJ } from '../components/lj/tokens';
import CategoryFilter from '../components/lj/CategoryFilter';
import PostCard from '../components/lj/PostCard';
import { useHomeFeed } from '../hooks/useHomeFeed';
import { useReactions } from '../hooks/useReactions';

/**
 * HomeScreen (라우트: /, /main).
 * - 헤더 + 카테고리 필터 + 무한 스크롤 피드.
 * - 라이브 카운트 박스는 사용자 요청으로 제거.
 */
function MainScreen() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { posts, loading, loadingMore, hasMore, loadMore } = useHomeFeed(selectedCategory);
  const { state, toggleLike, toggleSave } = useReactions(posts);

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
            fontSize: 17,
            fontWeight: 600,
            color: LJ.key,
            letterSpacing: -0.3,
          }}
        >
          Live Journey
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => navigate('/search')}
            aria-label="검색"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 2px 6px',
              background: 'transparent',
              border: 'none',
              borderBottom: `1.5px solid ${LJ.borderLight}`,
              color: LJ.textSecondary,
              fontFamily: LJ.fontStack,
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <span>어디로 떠나볼까요?</span>
            <IconSearch size={18} stroke={1.7} />
          </button>
          <IconButton aria-label="알림" onClick={() => navigate('/notifications')}>
            <IconBell size={20} stroke={1.7} />
          </IconButton>
        </div>
      </header>

      {/* 카테고리 필터 */}
      <div style={{ background: '#fff' }}>
        <CategoryFilter selected={selectedCategory} onChange={setSelectedCategory} />
      </div>

      {/* 피드 */}
      {loading && posts.length === 0 ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyFeed onUpload={() => navigate('/upload')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {posts.map((post) => (
            <React.Fragment key={post.id}>
              <PostCard
                post={post}
                reactionState={state[post.id]}
                onToggleLike={toggleLike}
                onToggleSave={toggleSave}
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
    <div
      style={{
        padding: '72px 24px',
        textAlign: 'center',
        color: LJ.textSecondary,
        fontFamily: LJ.fontStack,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: LJ.keyBgLight,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: LJ.key,
        }}
      >
        <IconCamera size={28} stroke={1.8} />
      </div>
      <p
        style={{
          margin: 0,
          color: LJ.textPrimary,
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.4,
        }}
      >
        첫 한 장이
        <br />
        라이브저니의 시작
      </p>
      <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
        지금 있는 곳을 사진으로 남기면
        <br />
        같은 곳을 궁금해하는 누군가에게 닿아요
      </p>
      <button
        type="button"
        onClick={onUpload}
        style={{
          marginTop: 18,
          padding: '12px 20px',
          background: LJ.key,
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontFamily: LJ.fontStack,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        사진 한 장 올리기
      </button>
    </div>
  );
}

export default MainScreen;

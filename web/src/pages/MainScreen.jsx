import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconBell } from '@tabler/icons-react';
import BottomNavigation from '../components/BottomNavigation';
import { LJ } from '../components/lj/tokens';
import CategoryFilter from '../components/lj/CategoryFilter';
import PostCard from '../components/lj/PostCard';
import { useHomeFeed } from '../hooks/useHomeFeed';
import { useReactions } from '../hooks/useReactions';

/**
 * HomeScreen (라우트: /main, / 도 동일하게 매핑).
 * 스펙: 헤더 → 라이브 인디케이터 → 카테고리 필터 → PostCard 피드.
 */
function MainScreen() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { posts, liveCount, loading } = useHomeFeed(selectedCategory);
  const { state, toggleLike, toggleSave } = useReactions(posts);

  return (
    <div
      style={{
        background: LJ.bgSurface,
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        paddingBottom: 80,
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          background: '#fff',
          borderBottom: `1px solid ${LJ.borderLight}`,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IconButton aria-label="검색" onClick={() => navigate('/search')}>
            <IconSearch size={21} stroke={1.8} />
          </IconButton>
          <IconButton aria-label="알림" onClick={() => navigate('/notifications')}>
            <IconBell size={21} stroke={1.8} />
          </IconButton>
        </div>
      </header>

      {/* 라이브 인디케이터 */}
      <div
        style={{
          background: LJ.keyBgLight,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: LJ.key,
            boxShadow: '0 0 0 4px rgba(77, 184, 232, 0.2)',
            display: 'inline-block',
          }}
        />
        <span style={{ color: LJ.keyTextDark, fontSize: 13, fontWeight: 600 }}>
          지금 {liveCount}장 라이브
        </span>
      </div>

      {/* 카테고리 필터 */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${LJ.borderLight}` }}>
        <CategoryFilter selected={selectedCategory} onChange={setSelectedCategory} />
      </div>

      {/* 피드 */}
      {loading && posts.length === 0 ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyFeed />
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
              <div style={{ height: 8, background: LJ.bgSurface }} />
            </React.Fragment>
          ))}
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
        color: LJ.textPrimary,
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

function EmptyFeed() {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        color: LJ.textSecondary,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      지금 이 카테고리에 라이브 사진이 없어요.
      <br />
      당신의 한 장이 누군가에게 닿을 거예요.
    </div>
  );
}

export default MainScreen;

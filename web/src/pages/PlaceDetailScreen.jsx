import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconBookmark, IconBookmarkFilled, IconShare3 } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import BestCutHero from '../components/lj/BestCutHero';
import PlacePhotoGrid from '../components/lj/PlacePhotoGrid';
import PlaceCTA from '../components/lj/PlaceCTA';
import { usePlaceDetail } from '../hooks/usePlaceDetail';

/**
 * 장소 페이지 (/place/:placeId).
 * 단순화: 헤더 → BestCutHero → 사진 그리드(베스트컷 제외) → CTA
 * (상태박스 / 카테고리 필터 제거)
 */
function PlaceDetailScreen() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { place, bestCut, posts, loading } = usePlaceDetail(placeId);
  const [bookmarked, setBookmarked] = useState(false);
  const [following, setFollowing] = useState(false);

  // 그리드는 베스트 컷 제외 (BestCutHero에 이미 큰 사진으로 노출)
  const gridPosts = bestCut ? posts.filter((p) => p.id !== bestCut.id) : posts;

  const handleShare = async () => {
    const url = window.location.href;
    const title = place?.name || 'Live Journey';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(url);
      alert('링크를 복사했어요');
    } catch (_) {}
  };

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        paddingBottom: 24,
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
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
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: LJ.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {place?.name || '장소'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => setBookmarked((v) => !v)}
            aria-label="북마크"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              color: bookmarked ? LJ.key : LJ.textSecondary,
              display: 'inline-flex',
            }}
          >
            {bookmarked ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} stroke={1.8} />}
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="공유"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              borderRadius: 8,
              cursor: 'pointer',
              color: LJ.textSecondary,
              display: 'inline-flex',
            }}
          >
            <IconShare3 size={20} stroke={1.8} />
          </button>
        </div>
      </header>

      {/* 베스트 컷 히어로 (있을 때만) */}
      {bestCut && (
        <BestCutHero
          post={bestCut}
          onPostClick={() => navigate(`/post/${bestCut.id}`)}
          onAuthorClick={() => navigate(`/user/${bestCut.author?.id || bestCut.author_id}`)}
          onFollowClick={() => setFollowing((v) => !v)}
          following={following}
          helpedCount={bestCut.like_count + bestCut.save_count}
        />
      )}

      {/* 사진 그리드 */}
      {loading && posts.length === 0 ? (
        <div
          style={{
            padding: '40px 18px',
            textAlign: 'center',
            color: LJ.textSecondary,
            fontSize: 12,
          }}
        >
          사진을 불러오는 중...
        </div>
      ) : (
        <PlacePhotoGrid posts={gridPosts} onPhotoClick={(id) => navigate(`/post/${id}`)} />
      )}

      {/* CTA */}
      <PlaceCTA onClick={() => navigate('/upload')} />
    </div>
  );
}

export default PlaceDetailScreen;

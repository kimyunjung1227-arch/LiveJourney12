import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconDots } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useFollow } from '../hooks/useFollow';
import ProfileHeader from '../components/profile/ProfileHeader';
import BadgesBox from '../components/profile/BadgesBox';
import BestCutCarousel from '../components/profile/BestCutCarousel';
import ProfilePostsSection from '../components/profile/ProfilePostsSection';
import TravelMapView from '../components/profile/TravelMapView';
import ProfileSectionHeading from '../components/profile/ProfileSectionHeading';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { logger } from '../utils/logger';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

function UserProfileScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: me } = useAuth();
  const { data, loading } = useProfile(userId);

  const profileUser = data?.user;
  const isMe = profileUser?.is_me;
  const initialFollowing = !!profileUser?.is_following;

  const { isFollowing, pending, toggleFollow, canFollow } = useFollow({
    targetUserId: userId,
    initialFollowing,
  });

  // 내 프로필이면 /profile로 리다이렉트
  useEffect(() => {
    if (isMe) {
      navigate('/profile', { replace: true });
    }
  }, [isMe, navigate]);

  const handleShareProfile = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = {
      title: `${profileUser?.name || '프로필'} | 라이브저니`,
      text: `${profileUser?.name || '이 사용자'}의 라이브저니 프로필을 확인해보세요.`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
        // eslint-disable-next-line no-alert
        window.alert('프로필 링크를 복사했어요');
        return;
      }
      // eslint-disable-next-line no-alert
      window.prompt('이 링크를 복사해서 공유하세요', url);
    } catch (e) {
      logger.warn('프로필 공유 실패', e?.message || e);
    }
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 24 }}>
      <PageSeo {...(PAGE_SEO.userProfile || PAGE_SEO.profile)} />

      {/* 헤더: 가운데 정렬 + 좌측 뒤로가기 + 우측 점 세개 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 52,
          padding: '0 12px',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconArrowLeft size={18} color={TEXT_PRIMARY} />
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            maxWidth: 'calc(100% - 120px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {profileUser?.name || '프로필'}
        </span>
        <button
          type="button"
          onClick={handleShareProfile}
          aria-label="프로필 공유"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconDots size={20} color={TEXT_SECONDARY} />
        </button>
      </div>

      {loading ? (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : !profileUser ? (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          프로필을 불러오지 못했어요
        </div>
      ) : (
        <>
          <ProfileHeader
            user={profileUser}
            trailingSlot={
              !isMe ? (
                <FollowChip
                  isFollowing={isFollowing}
                  pending={pending}
                  canFollow={canFollow}
                  onClick={toggleFollow}
                />
              ) : null
            }
          />

          <BadgesBox user={profileUser} />

          <BestCutCarousel bestCuts={data?.best_cuts} />

          <div style={{ padding: '0 18px' }}>
            {/* 게시물 — 최신 3개 미리보기 + 전체보기 */}
            <ProfilePostsSection userId={userId} seeAllTo={`/user/${userId}/posts`} />

            {/* 여행 지도 */}
            <section style={{ marginBottom: 8 }}>
              <ProfileSectionHeading title="여행 지도" />
              <TravelMapView userId={userId} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 이름 우측에 들어가는 가벼운 팔로우 칩.
 */
function FollowChip({ isFollowing, pending, canFollow, onClick }) {
  const disabled = pending || !canFollow;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isFollowing ? '팔로잉' : '팔로우'}
      className="flex items-center justify-center gap-1"
      style={{
        padding: '0 14px',
        lineHeight: 1,
        borderRadius: 6,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: isFollowing ? `1px solid ${BORDER_LIGHT}` : 'none',
        background: isFollowing ? '#fff' : KEY,
        color: isFollowing ? TEXT_PRIMARY : '#fff',
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      {isFollowing ? '팔로잉' : '팔로우'}
    </button>
  );
}

export default UserProfileScreen;

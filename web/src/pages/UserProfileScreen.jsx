import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconDots,
  IconUserPlus,
  IconUserCheck,
  IconMessageCircle,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useFollow } from '../hooks/useFollow';
import ProfileHeader from '../components/profile/ProfileHeader';
import HonorBox from '../components/profile/HonorBox';
import BasicStats from '../components/profile/BasicStats';
import BestCutCarousel from '../components/profile/BestCutCarousel';
import ProfileTabs from '../components/profile/ProfileTabs';
import PhotoTimeline from '../components/profile/PhotoTimeline';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

function UserProfileScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: me } = useAuth();
  const { data, loading } = useProfile(userId);
  const [tab, setTab] = useState('all');

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
          <IconArrowLeft size={22} color={TEXT_PRIMARY} />
        </button>
        <span
          style={{
            fontSize: 17,
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
          aria-label="더보기"
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
          <ProfileHeader user={profileUser} />
          <BasicStats user={profileUser} />
          <HonorBox user={profileUser} />

          {!isMe && (
            <div className="flex items-center gap-2" style={{ padding: '0 18px 18px' }}>
              <button
                type="button"
                onClick={toggleFollow}
                disabled={pending || !canFollow}
                className="flex-1 flex items-center justify-center gap-1.5"
                style={{
                  height: 42,
                  borderRadius: 11,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: pending || !canFollow ? 'not-allowed' : 'pointer',
                  border: isFollowing ? `1px solid ${BORDER_LIGHT}` : 'none',
                  background: isFollowing ? '#fff' : KEY,
                  color: isFollowing ? TEXT_PRIMARY : '#fff',
                  opacity: !canFollow ? 0.5 : 1,
                }}
              >
                {isFollowing ? (
                  <>
                    <IconUserCheck size={15} stroke={2} />
                    팔로잉
                  </>
                ) : (
                  <>
                    <IconUserPlus size={15} stroke={2} />
                    팔로우
                  </>
                )}
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5"
                style={{
                  height: 42,
                  padding: '0 18px',
                  borderRadius: 11,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${BORDER_LIGHT}`,
                  background: '#fff',
                  color: TEXT_PRIMARY,
                }}
              >
                <IconMessageCircle size={15} stroke={2} />
                메시지
              </button>
            </div>
          )}

          <BestCutCarousel bestCuts={data?.best_cuts} />

          <div style={{ padding: '0 18px' }}>
            <ProfileTabs value={tab} onChange={setTab} />
          </div>

          <div style={{ padding: '0 18px' }}>
            <PhotoTimeline
              mode={tab === 'city' ? 'city' : 'all'}
              livePosts={data?.live_posts}
              archivePosts={data?.archive_posts}
              byCity={data?.by_city}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default UserProfileScreen;

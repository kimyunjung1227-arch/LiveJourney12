import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSettings, IconBookmark } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import BottomNavigation from '../components/BottomNavigation';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import ProfileHeader from '../components/profile/ProfileHeader';
import LiveGuideCard from '../components/liveGuide/LiveGuideCard';
import LiveGuideCelebration from '../components/liveGuide/LiveGuideCelebration';
import { useLiveGuide } from '../hooks/useLiveGuide';
import { useLiveGuideCelebration } from '../hooks/useLiveGuideCelebration';
import BadgesBox from '../components/profile/BadgesBox';
import BestCutCarousel from '../components/profile/BestCutCarousel';
import ProfilePostsSection from '../components/profile/ProfilePostsSection';
import TravelMapView from '../components/profile/TravelMapView';
import ProfileSectionHeading from '../components/profile/ProfileSectionHeading';
import { logger } from '../utils/logger';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';

function ProfileScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, authLoading, loginWithProvider } = useAuth();
  const userId = user?.id || null;
  const { data, loading } = useProfile(userId);
  const liveGuide = useLiveGuide(userId, { followerCount: data?.user?.follower_count });
  const { celebrateLevel, dismiss: dismissCelebration } = useLiveGuideCelebration({
    userId,
    level: liveGuide.level,
    loading: liveGuide.loading,
    enabled: isAuthenticated,
  });
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);

  const handleSocialLogin = async (provider) => {
    setLoginError('');
    setLoginPending(true);
    try {
      await loginWithProvider(provider);
    } catch (e) {
      logger.warn('소셜 로그인 실패', e?.message || e);
      setLoginError(e?.message || '로그인 중 문제가 생겼어요.');
    } finally {
      setLoginPending(false);
    }
  };

  // 로그인 안 됐을 때 — 안내 + 소셜 로그인
  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
        <PageSeo {...PAGE_SEO.profile} />
        <div
          style={{
            minHeight: 'calc(100vh - 80px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: TEXT_SECONDARY,
              fontWeight: 700,
              letterSpacing: '0.15em',
              marginBottom: 8,
            }}
          >
            LIVEJOURNEY
          </p>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              textAlign: 'center',
              lineHeight: 1.5,
              marginBottom: 28,
            }}
          >
            실시간 여행 현황 검증의 기준,
            <br />
            라이브저니
          </p>
          <div className="flex flex-col items-center gap-3 w-full" style={{ maxWidth: 320 }}>
            <button
              type="button"
              onClick={() => handleSocialLogin('Kakao')}
              disabled={loginPending}
              className="w-full"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 48,
                background: '#FEE500',
                color: '#000',
                border: 'none',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                cursor: loginPending ? 'wait' : 'pointer',
                opacity: loginPending ? 0.6 : 1,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'absolute', left: 16 }}
                aria-hidden="true"
                role="img"
              >
                {/* 검정 말풍선 배경 */}
                <path
                  d="M12 3C7.029 3 3 6.582 3 10.95c0 3.133 2.01 5.867 5 7.516v3.234c0 .276.224.5.5.5.132 0 .26-.053.354-.146L10.5 18.4c.94.134 1.924.2 2.923.2 4.971 0 9-3.582 9-7.95S16.971 3 12 3z"
                  fill="#000000"
                />
                {/* TALK 텍스트 */}
                <text
                  x="12"
                  y="14"
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="#FEE500"
                  fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                >
                  TALK
                </text>
              </svg>
              카카오로 시작하기
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              disabled={loginPending}
              className="w-full"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 48,
                background: '#fff',
                color: TEXT_PRIMARY,
                border: `1px solid ${BORDER_LIGHT}`,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                cursor: loginPending ? 'wait' : 'pointer',
                opacity: loginPending ? 0.6 : 1,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                style={{ position: 'absolute', left: 16 }}
                aria-hidden="true"
              >
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              구글로 시작하기
            </button>
          </div>
          {loginError && (
            <p style={{ marginTop: 12, fontSize: 12, color: '#D85050' }}>{loginError}</p>
          )}
        </div>
        <BottomNavigation />
      </div>
    );
  }

  // 로딩 / 데이터 미비
  if (authLoading || loading) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
        <PageSeo {...PAGE_SEO.profile} />
        <ProfileHeaderBar onSettings={() => navigate('/settings')} onSaved={() => navigate('/profile/saved')} showSettings />
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
        <BottomNavigation />
      </div>
    );
  }

  const profileUser = data?.user;
  if (!profileUser) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
        <PageSeo {...PAGE_SEO.profile} />
        <ProfileHeaderBar onSettings={() => navigate('/settings')} onSaved={() => navigate('/profile/saved')} showSettings />
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          프로필 정보를 불러오지 못했어요
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <ProfileHeaderBar onSettings={() => navigate('/settings')} onSaved={() => navigate('/profile/saved')} showSettings />

      <ProfileHeader user={profileUser} isMe liveGuide={liveGuide} />
      <LiveGuideCard data={liveGuide} />
      <BadgesBox user={profileUser} />

      <BestCutCarousel bestCuts={data?.best_cuts} />

      <div style={{ padding: '0 18px' }}>
        {/* 게시물 — 최신 3개 미리보기 + 전체보기 */}
        <ProfilePostsSection userId={userId} seeAllTo="/profile/posts" />

        {/* 여행 지도 — 프로필에서 바로 어디를 다녔는지 확인 */}
        <section style={{ marginBottom: 28 }}>
          <ProfileSectionHeading title="여행 지도" />
          <TravelMapView userId={userId} />
        </section>
        {/* 저장한 장소는 상단 '저장' 버튼(/profile/saved) 에서 사진 그리드로 본다 */}
      </div>

      <BottomNavigation />

      {celebrateLevel != null && (
        <LiveGuideCelebration level={celebrateLevel} onClose={dismissCelebration} />
      )}
    </div>
  );
}

function ProfileHeaderBar({ onSettings, onSaved, showSettings }) {
  const iconBtn = {
    width: 36,
    height: 36,
    background: 'transparent',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  };
  return (
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
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>프로필</span>
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <button type="button" onClick={onSaved} aria-label="저장한 장소" style={iconBtn}>
            <IconBookmark size={18} color={TEXT_PRIMARY} stroke={1.8} />
          </button>
          <button type="button" onClick={onSettings} aria-label="설정" style={iconBtn}>
            <IconSettings size={18} color={TEXT_PRIMARY} stroke={1.8} />
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileScreen;

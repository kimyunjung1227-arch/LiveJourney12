import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSettings } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import BottomNavigation from '../components/BottomNavigation';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import ProfileHeader from '../components/profile/ProfileHeader';
import HonorBox from '../components/profile/HonorBox';
import BasicStats from '../components/profile/BasicStats';
import BestCutCarousel from '../components/profile/BestCutCarousel';
import ProfileTabs from '../components/profile/ProfileTabs';
import PhotoTimeline from '../components/profile/PhotoTimeline';
import { logger } from '../utils/logger';
import { supabase } from '../utils/supabaseClient';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';

function ProfileScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, authLoading, loginWithProvider } = useAuth();
  const userId = user?.id || null;
  const { data, loading } = useProfile(userId);
  const [tab, setTab] = useState('all');
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
              카카오로 시작하기
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('Google')}
              disabled={loginPending}
              className="w-full"
              style={{
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
        <ProfileHeaderBar onSettings={() => navigate('/settings')} showSettings />
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
        <ProfileHeaderBar onSettings={() => navigate('/settings')} showSettings />
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
      <ProfileHeaderBar onSettings={() => navigate('/settings')} showSettings />

      <ProfileHeader user={profileUser} />
      <HonorBox user={profileUser} />
      <BasicStats user={profileUser} />

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

      <BottomNavigation />
    </div>
  );
}

function ProfileHeaderBar({ onSettings, showSettings }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${BORDER_LIGHT}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#fff',
      }}
    >
      <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>프로필</span>
      {showSettings && (
        <button
          type="button"
          onClick={onSettings}
          aria-label="설정"
          style={{
            width: 36,
            height: 36,
            background: 'transparent',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <IconSettings size={20} color={TEXT_PRIMARY} stroke={1.8} />
        </button>
      )}
    </div>
  );
}

export default ProfileScreen;

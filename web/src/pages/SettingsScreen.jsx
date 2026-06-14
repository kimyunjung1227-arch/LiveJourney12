import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconShare, IconLogout } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import SettingsGroup from '../components/settings/SettingsGroup';
import SettingsRow from '../components/settings/SettingsRow';
import ConfirmModal from '../components/settings/ConfirmModal';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { logger } from '../utils/logger';

const TEXT_PRIMARY = '#1F1F1F';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#F0F0F0';

function SettingsScreen() {
  const navigate = useNavigate();
  const { user: me, logout } = useAuth();

  const [logoutModal, setLogoutModal] = useState(false);
  const [pending, setPending] = useState(false);

  const handleShareProfile = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = me?.id ? `${origin}/user/${me.id}` : origin;
    const shareData = {
      title: '내 프로필 | 라이브저니',
      text: '내 라이브저니 프로필을 확인해보세요.',
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

  const handleLogout = async () => {
    setPending(true);
    try {
      await logout();
    } finally {
      setPending(false);
      setLogoutModal(false);
      navigate('/main', { replace: true });
    }
  };

  return (
    <div style={{ background: SURFACE, minHeight: '100vh' }}>
      <PageSeo {...(PAGE_SEO.settings || PAGE_SEO.profile)} />

      {/* 헤더 — 제목 중앙 고정 */}
      <div
        className="flex items-center"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '14px 18px',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{
            width: 32,
            height: 32,
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
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 14,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            pointerEvents: 'none',
          }}
        >
          설정
        </span>
      </div>

      <div style={{ height: 10 }} />

      <SettingsGroup>
        <SettingsRow
          icon={IconShare}
          label="프로필 공유"
          onClick={handleShareProfile}
        />
        <SettingsRow
          icon={IconLogout}
          label="로그아웃"
          showArrow={false}
          isLast
          onClick={() => setLogoutModal(true)}
        />
      </SettingsGroup>

      <div style={{ height: 32 }} />

      <ConfirmModal
        open={logoutModal}
        title="로그아웃"
        message="정말 로그아웃 하시겠어요?"
        confirmLabel={pending ? '처리 중...' : '로그아웃'}
        onConfirm={handleLogout}
        onCancel={() => setLogoutModal(false)}
      />
    </div>
  );
}

export default SettingsScreen;

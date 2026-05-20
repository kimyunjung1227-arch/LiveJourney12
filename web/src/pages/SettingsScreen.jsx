import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconUser,
  IconLock,
  IconMapPin,
  IconCrown,
  IconHelpCircle,
  IconHeart,
  IconUserOff,
  IconShieldLock,
  IconInfoCircle,
  IconFileText,
  IconMessage2,
  IconLogout,
  IconTrash,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useProfile } from '../hooks/useProfile';
import SettingsProfileCard from '../components/settings/SettingsProfileCard';
import SettingsGroup from '../components/settings/SettingsGroup';
import SettingsRow from '../components/settings/SettingsRow';
import SettingsToggleRow from '../components/settings/SettingsToggleRow';
import ConfirmModal from '../components/settings/ConfirmModal';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#F0F0F0';

const APP_VERSION = '1.0.0';

function SettingsScreen() {
  const navigate = useNavigate();
  const { user: me, logout } = useAuth();
  const { settings, loading: settingsLoading, updateSetting } = useSettings();
  const { data: profileData, loading: profileLoading } = useProfile(me?.id || null);

  const [logoutModal, setLogoutModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [pending, setPending] = useState(false);

  const settingsProfile = useMemo(() => {
    const u = profileData?.user;
    if (!u) return null;
    const handle =
      (me?.email || '').split('@')[0] ||
      (u.name && u.name.replace(/\s+/g, '').toLowerCase()) ||
      'me';
    return {
      id: u.id,
      name: u.name || '여행자',
      handle,
      avatar_color: u.avatar_color || '#4DB8E8',
      avatar_url: u.avatar_url || null,
      is_best_cut_artist: !!u.is_best_cut_artist,
    };
  }, [profileData, me?.email]);

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

  const handleDelete = async () => {
    setPending(true);
    try {
      // 추후 RPC로 교체 — 현재는 안전한 로그아웃만 수행
      await logout();
    } finally {
      setPending(false);
      setDeleteModal(false);
      navigate('/account-delete', { replace: true });
    }
  };

  return (
    <div style={{ background: SURFACE, minHeight: '100vh' }}>
      <PageSeo {...(PAGE_SEO.settings || PAGE_SEO.profile)} />

      {/* 헤더 */}
      <div
        className="flex items-center"
        style={{
          gap: 12,
          padding: '14px 18px',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
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
        <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>설정</span>
      </div>

      {/* 프로필 카드 */}
      {profileLoading ? null : settingsProfile ? (
        <SettingsProfileCard profile={settingsProfile} />
      ) : null}

      {/* 계정 */}
      <SettingsGroup label="계정">
        <SettingsRow
          icon={IconUser}
          label="계정 정보"
          onClick={() => navigate('/personal-info-edit')}
        />
        <SettingsRow
          icon={IconLock}
          label="비밀번호 변경"
          onClick={() => navigate('/password-change')}
        />
        <SettingsRow
          icon={IconMapPin}
          iconColor="#4DB8E8"
          label="위치 정보"
          subtitle="정확한 위치 · EXIF 인증에 사용"
          isLast
          onClick={() => navigate('/location-terms')}
        />
      </SettingsGroup>

      {/* 알림 */}
      <SettingsGroup label="알림">
        <SettingsToggleRow
          icon={IconCrown}
          iconBg="gradient"
          label="영예 알림"
          subtitle="베스트 컷 선정, 도움 마일스톤"
          value={!!settings?.notify_honor}
          onToggle={(v) => updateSetting('notify_honor', v)}
        />
        <SettingsToggleRow
          icon={IconHelpCircle}
          iconBg="key"
          label="질문 알림"
          subtitle="내 지역 질문 매칭, 답변 도착"
          value={!!settings?.notify_question}
          onToggle={(v) => updateSetting('notify_question', v)}
        />
        <SettingsToggleRow
          icon={IconHeart}
          iconBg="gray"
          label="활동 알림"
          subtitle="좋아요, 댓글, 저장, 팔로우"
          value={!!settings?.notify_activity}
          onToggle={(v) => updateSetting('notify_activity', v)}
          isLast
        />
      </SettingsGroup>

      {/* 개인정보 */}
      <SettingsGroup label="개인정보">
        <SettingsRow
          icon={IconUserOff}
          label="차단 목록"
          onClick={() => navigate('/settings/blocked')}
        />
        <SettingsRow
          icon={IconShieldLock}
          label="개인정보 처리방침"
          isLast
          onClick={() => navigate('/privacy-policy')}
        />
      </SettingsGroup>

      {/* 앱 정보 */}
      <SettingsGroup label="앱 정보">
        <SettingsRow
          icon={IconInfoCircle}
          label="버전"
          value={APP_VERSION}
          showArrow={false}
        />
        <SettingsRow
          icon={IconFileText}
          label="이용약관"
          onClick={() => navigate('/terms-of-service')}
        />
        <SettingsRow
          icon={IconMessage2}
          label="문의하기"
          isLast
          onClick={() => navigate('/inquiry')}
        />
      </SettingsGroup>

      {/* 위험 액션 */}
      <SettingsGroup>
        <SettingsRow
          icon={IconLogout}
          label="로그아웃"
          showArrow={false}
          onClick={() => setLogoutModal(true)}
        />
        <SettingsRow
          icon={IconTrash}
          label="회원 탈퇴"
          danger
          isLast
          onClick={() => setDeleteModal(true)}
        />
      </SettingsGroup>

      <div style={{ height: 32 }} />

      {/* 알림 로딩 중일 때는 토글이 어둠 — 그래도 깜빡임 방지를 위해 헤더 위에 안내 X */}

      <ConfirmModal
        open={logoutModal}
        title="로그아웃"
        message="정말 로그아웃 하시겠어요?"
        confirmLabel={pending ? '처리 중...' : '로그아웃'}
        onConfirm={handleLogout}
        onCancel={() => setLogoutModal(false)}
      />
      <ConfirmModal
        open={deleteModal}
        title="회원 탈퇴"
        message="탈퇴하면 모든 사진과 기록이 삭제되며 되돌릴 수 없어요. 정말 탈퇴하시겠어요?"
        confirmLabel={pending ? '처리 중...' : '탈퇴'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(false)}
      />
    </div>
  );
}

export default SettingsScreen;

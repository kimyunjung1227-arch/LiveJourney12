import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import BestCutNotice from '../components/notification/BestCutNotice';
import MilestoneNotice from '../components/notification/MilestoneNotice';
import ActivityNotice from '../components/notification/ActivityNotice';
import TimeGroupHeader from '../components/notification/TimeGroupHeader';
import BottomNavigation from '../components/BottomNavigation';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';

const ORDERED_GROUPS = ['today', 'week', 'earlier'];

function NotificationsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { notifications, loading, markAllRead, followBack } = useNotifications();

  const groups = useMemo(() => {
    const g = { today: [], week: [], earlier: [] };
    (notifications || []).forEach((n) => {
      const key = n?.time_group || 'earlier';
      (g[key] || g.earlier).push(n);
    });
    return g;
  }, [notifications]);

  const hasAny = (notifications || []).length > 0;

  const renderItem = (n) => {
    if (n.type === 'best_cut') {
      return <BestCutNotice key={n.id} notification={n} />;
    }
    if (n.type === 'milestone' && (n.data?.milestone || 0) >= 100) {
      return <MilestoneNotice key={n.id} notification={n} />;
    }
    return <ActivityNotice key={n.id} notification={n} onFollowBack={followBack} />;
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <PageSeo {...(PAGE_SEO.notifications || PAGE_SEO.profile)} />

      {/* 헤더 */}
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
        <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>알림</span>
        <button
          type="button"
          onClick={markAllRead}
          disabled={!hasAny}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: hasAny ? KEY : '#B8B8B8',
            fontSize: 12,
            fontWeight: 600,
            cursor: hasAny ? 'pointer' : 'default',
            padding: '6px 4px',
          }}
        >
          모두 읽음
        </button>
      </div>

      {/* 본문 */}
      <div style={{ padding: '4px 18px 18px' }}>
        {!isAuthenticated ? (
          <Empty primary="로그인이 필요해요" secondary="로그인하면 영예 알림을 받을 수 있어요" />
        ) : loading ? (
          <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
            불러오는 중...
          </div>
        ) : !hasAny ? (
          <Empty primary="아직 알림이 없어요" secondary="당신의 한 장이 누군가에게 도움이 되면 여기에 도착해요" />
        ) : (
          ORDERED_GROUPS.map(
            (group) =>
              groups[group].length > 0 && (
                <section key={group}>
                  <TimeGroupHeader group={group} />
                  {groups[group].map(renderItem)}
                </section>
              ),
          )
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}

function Empty({ primary, secondary }) {
  return (
    <div className="text-center" style={{ padding: '60px 16px' }}>
      <p className="m-0" style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 6 }}>
        {primary}
      </p>
      {secondary && (
        <p className="m-0" style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
          {secondary}
        </p>
      )}
    </div>
  );
}

export default NotificationsScreen;

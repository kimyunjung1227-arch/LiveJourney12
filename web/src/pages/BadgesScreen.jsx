import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { BadgeChip } from '../components/profile/BadgesBox';
import { buildBadgeGroups } from '../components/profile/badgeData';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY_DARK = '#1A6EA8';
const SECTION_LABEL = '#4A7DA8';

/**
 * 뱃지 전체보기 화면.
 * - 섹션 별로 모든 뱃지를 나열, 보유 여부와 달성 조건을 함께 표시
 */
export default function BadgesScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, authLoading } = useAuth();
  const userId = user?.id || null;
  const { data, loading } = useProfile(userId);

  const profileUser = data?.user;
  const groups = buildBadgeGroups(profileUser || {});
  const totalEarned = groups.reduce(
    (acc, g) => acc + g.items.filter((i) => i.earned).length,
    0,
  );
  const totalAll = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 18px 8px' }}>
        <h1
          className="m-0"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            letterSpacing: -0.3,
          }}
        >
          뱃지
        </h1>
        <p
          className="m-0"
          style={{
            marginTop: 4,
            fontSize: 12,
            color: TEXT_SECONDARY,
          }}
        >
          라이브저니에서 활동하며 얻을 수 있는 모든 뱃지
        </p>
        {!authLoading && isAuthenticated && profileUser && (
          <p
            className="m-0"
            style={{
              marginTop: 6,
              fontSize: 12,
              fontWeight: 700,
              color: KEY_DARK,
            }}
          >
            획득 {totalEarned} / {totalAll}
          </p>
        )}
      </div>

      {(authLoading || loading) && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      <div style={{ padding: '12px 18px 0' }}>
        {groups.map((group) => (
          <Section key={group.label} group={group} />
        ))}
      </div>
    </div>
  );
}

function Header({ onBack }) {
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
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
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
        <IconArrowLeft size={20} color={TEXT_PRIMARY} stroke={1.8} />
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>뱃지</span>
    </div>
  );
}

function Section({ group }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        className="flex items-baseline"
        style={{
          marginBottom: 12,
          gap: 8,
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          paddingBottom: 8,
        }}
      >
        <h2
          className="m-0"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SECTION_LABEL,
            letterSpacing: 0.2,
          }}
        >
          {group.label}
        </h2>
        <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{group.description}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {group.items.map((item) => (
          <BadgeCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ item }) {
  const earned = item.earned;
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{
        padding: '14px 8px',
        borderRadius: 12,
        background: earned
          ? 'linear-gradient(180deg, #F5FBFF, #FFFFFF)'
          : '#FAFAFB',
        border: earned
          ? '1px solid rgba(77, 184, 232, 0.35)'
          : '1px solid #EDEEF1',
        boxShadow: earned ? '0 2px 8px rgba(77, 184, 232, 0.12)' : 'none',
      }}
    >
      <BadgeChip item={item} size={72} />
      <p
        className="m-0"
        style={{
          marginTop: 10,
          fontSize: 12,
          fontWeight: 700,
          color: earned ? TEXT_PRIMARY : TEXT_SECONDARY,
          lineHeight: 1.3,
        }}
      >
        {item.name}
      </p>
      <p
        className="m-0"
        style={{
          marginTop: 4,
          fontSize: 10.5,
          color: TEXT_SECONDARY,
          lineHeight: 1.4,
        }}
      >
        {item.requirement || item.desc}
      </p>
      <span
        style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 700,
          color: earned ? '#1A8754' : item.upcoming ? '#A07D2A' : TEXT_SECONDARY,
          padding: '2px 8px',
          borderRadius: 999,
          background: earned ? '#E6F4EB' : item.upcoming ? '#FBF3E0' : '#F0F1F3',
        }}
      >
        {earned ? '획득' : item.upcoming ? '출시 예정' : '미획득'}
      </span>
    </div>
  );
}

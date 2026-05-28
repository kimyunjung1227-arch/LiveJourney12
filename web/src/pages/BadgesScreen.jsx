import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import {
  getCatalogByGroup,
  getPillColors,
  resolveEarnedBadges,
} from '../components/profile/badgeData';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY_DARK = '#1A6EA8';
const SECTION_LABEL = '#4A7DA8';

/**
 * 뱃지 전체보기 — 전체 카탈로그를 그룹별로 노출, 보유 여부 표시.
 */
export default function BadgesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { data, loading } = useProfile(userId);

  const profileUser = data?.user;
  const earnedKeys = Array.isArray(profileUser?.earned_badges)
    ? profileUser.earned_badges
    : [];
  const earnedSet = new Set(earnedKeys);

  const groups = getCatalogByGroup();
  const totalEarned = resolveEarnedBadges(earnedKeys).length;
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
        <p className="m-0" style={{ marginTop: 4, fontSize: 12, color: TEXT_SECONDARY }}>
          라이브저니에서 활동하며 얻을 수 있는 모든 뱃지
        </p>
        {profileUser && (
          <p
            className="m-0"
            style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: KEY_DARK }}
          >
            획득 {totalEarned} / {totalAll}
          </p>
        )}
      </div>

      {loading && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      <div style={{ padding: '12px 18px 0' }}>
        {groups.map((group) => (
          <Section
            key={group.label}
            group={group}
            earnedSet={earnedSet}
            onPick={(badge) => navigate(`/profile/badges/${badge.key}`)}
          />
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

function Section({ group, earnedSet, onPick }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        className="flex items-baseline"
        style={{
          marginBottom: 14,
          gap: 8,
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          paddingBottom: 8,
        }}
      >
        <h2
          className="m-0"
          style={{ fontSize: 14, fontWeight: 700, color: SECTION_LABEL, letterSpacing: 0.2 }}
        >
          {group.label}
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
        }}
      >
        {group.items.map((item) => {
          const earned = earnedSet.has(item.key);
          return (
            <BadgeCard
              key={item.key}
              meta={item}
              earned={earned}
              onClick={() => onPick(item)}
            />
          );
        })}
      </div>
    </div>
  );
}

function BadgeCard({ meta, earned, onClick }) {
  const pill = getPillColors(meta.tier);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center text-center"
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 4px',
      }}
    >
      <img
        src={meta.img}
        alt=""
        style={{
          width: 64,
          height: 64,
          objectFit: 'contain',
          filter: earned ? 'none' : 'grayscale(1)',
          opacity: earned ? 1 : 0.45,
        }}
      />
      <span
        style={{
          marginTop: 8,
          fontSize: 11,
          fontWeight: 700,
          color: earned ? pill.text : TEXT_SECONDARY,
          background: earned ? pill.bg : '#F1F2F4',
          border: earned ? `1px solid ${pill.border}` : '1px solid #E5E7EB',
          padding: '3px 10px',
          borderRadius: 999,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}
      >
        {meta.name}
      </span>
      <span
        style={{
          marginTop: 6,
          fontSize: 10,
          color: earned ? '#1A8754' : meta.upcoming ? '#A07D2A' : TEXT_SECONDARY,
        }}
      >
        {earned ? '획득' : meta.upcoming ? '출시 예정' : '미획득'}
      </span>
    </button>
  );
}

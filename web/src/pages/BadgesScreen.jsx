import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useEarnedBadges } from '../hooks/useEarnedBadges';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { BADGE_GROUP_ORDER, collapseEarnedToHighest } from '../components/profile/badgeData';
import { GROUP_META } from '../components/badges/badgeTheme';
import BadgeMedallion from '../components/badges/BadgeMedallion';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_MUTED = '#9AA3AB';
const BORDER_LIGHT = '#E8E8E8';
const KEY_DARK = '#1A6EA8';

/**
 * 뱃지 전체보기 — 사용자가 실제로 "획득한" 뱃지만 모아서 보여준다.
 * - 라이브저니 전체 카탈로그가 아니라 획득분만 노출 (미획득/잠금 단계는 표시하지 않음)
 * - 성장 체인은 최고 단계 1개로 묶어 1개로 카운트
 * - 개수 = 획득한 뱃지 수
 */
export default function BadgesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { data, loading } = useProfile(userId);

  const profileUser = data?.user;
  const { earnedKeys, loading: badgesLoading } = useEarnedBadges(profileUser);

  // 획득한 뱃지만 (성장 체인은 최고 단계 1개로 collapse)
  const earnedMetas = collapseEarnedToHighest(earnedKeys);
  const totalEarned = earnedMetas.length;

  // 그룹별로 묶되, 획득한 뱃지가 있는 그룹만 노출
  const groups = BADGE_GROUP_ORDER.map((group) => ({
    group,
    items: earnedMetas.filter((m) => m.group === group),
  })).filter((g) => g.items.length > 0);

  const isLoading = loading || badgesLoading;
  const go = (key) => navigate(`/profile/badges/${key}`);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 18px 8px' }}>
        <h1 className="m-0" style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}>
          획득한 뱃지
        </h1>
        <p className="m-0" style={{ marginTop: 4, fontSize: 12, color: TEXT_SECONDARY }}>
          활동을 쌓으며 직접 모은 라이브저니 뱃지
        </p>
        {profileUser && !isLoading && (
          <p className="m-0" style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: KEY_DARK }}>
            획득한 뱃지 {totalEarned}개
          </p>
        )}
      </div>

      {isLoading && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      {!isLoading && totalEarned === 0 && (
        <div className="text-center" style={{ padding: '48px 24px', color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.6 }}>
          아직 획득한 뱃지가 없어요.
          <br />
          활동을 쌓으면 자동으로 부여됩니다.
        </div>
      )}

      {!isLoading && totalEarned > 0 && (
        <div style={{ padding: '8px 18px 0' }}>
          {groups.map(({ group, items }) => (
            <GroupSection key={group} group={group} items={items} onPick={go} />
          ))}
        </div>
      )}
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
        <IconArrowLeft size={18} color={TEXT_PRIMARY} stroke={2} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>뱃지</span>
    </div>
  );
}

/** 한 그룹(섹션) = 헤더 + 카드. 카드 안에 획득한 뱃지들만 3열 그리드. */
function GroupSection({ group, items, onPick }) {
  const gm = GROUP_META[group] || { ko: group, en: '', dot: '#2BA0DC', tag: '' };

  return (
    <div style={{ marginBottom: 22 }}>
      {/* 헤더 */}
      <div className="flex items-center" style={{ marginBottom: 10, gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: gm.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{gm.ko}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 0.6 }}>{gm.en}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 0.3 }}>
          {items.length}개
        </span>
      </div>

      {/* 카드 — 흰 배경 + 옅은 보더 (파스텔 스쿼클이 대비되도록) */}
      <div style={{ background: '#fff', border: '1px solid #EFF1F4', borderRadius: 18, padding: '18px 14px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            columnGap: 8,
            rowGap: 16,
          }}
        >
          {items.map((meta) => (
            <TierItem key={meta.key} meta={meta} onClick={() => onPick(meta.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TierItem({ meta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', width: '100%' }}
    >
      <BadgeMedallion meta={meta} state="earned" size={66} />
      <span
        style={{
          marginTop: 9,
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_PRIMARY,
          lineHeight: 1.25,
          textAlign: 'center',
          wordBreak: 'keep-all',
          maxWidth: 96,
        }}
      >
        {meta.name}
      </span>
      <span
        style={{
          marginTop: 5,
          fontSize: 10.5,
          fontWeight: 700,
          padding: '2px 9px',
          borderRadius: 999,
          background: '#E3F8EC',
          color: '#1E9E5A',
          whiteSpace: 'nowrap',
        }}
      >
        달성
      </span>
    </button>
  );
}

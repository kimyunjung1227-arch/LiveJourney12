import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import { BADGE_CATALOG, getPillColors } from '../components/profile/badgeData';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const CARD_LABEL = '#6B6B6B';

/**
 * 뱃지 상세 — 현재 뱃지 + (있으면) 다음 단계 카드.
 */
export default function BadgeDetailScreen() {
  const navigate = useNavigate();
  const { badgeId } = useParams();
  const { user } = useAuth();
  const { data, loading } = useProfile(user?.id || null);

  const meta = BADGE_CATALOG[badgeId];
  const profileUser = data?.user;
  const nextMeta = meta?.next ? BADGE_CATALOG[meta.next] : null;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <Header onBack={() => navigate(-1)} />

      {loading && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      {!loading && !meta && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          뱃지를 찾을 수 없어요
        </div>
      )}

      {meta && (
        <div style={{ padding: '16px 18px 0' }}>
          <CurrentBadgeCard meta={meta} />
          {nextMeta && (
            <NextBadgeCard
              meta={nextMeta}
              user={profileUser}
              progressFn={meta.progressOf}
              target={meta.progressTarget || nextMeta.progressTarget}
            />
          )}
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
        <IconArrowLeft size={20} color={TEXT_PRIMARY} stroke={1.8} />
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>뱃지 상세</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: 18,
        borderRadius: 14,
        background: '#fff',
        border: `1px solid ${BORDER_LIGHT}`,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <p
      className="m-0"
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: CARD_LABEL,
        marginBottom: 6,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </p>
  );
}

function CurrentBadgeCard({ meta }) {
  return (
    <Card>
      <FieldLabel>현재 획득한 뱃지</FieldLabel>

      <div className="flex flex-col items-center" style={{ padding: '8px 0 4px' }}>
        <img
          src={meta.img}
          alt=""
          style={{ width: 96, height: 96, objectFit: 'contain' }}
        />
        <p
          className="m-0"
          style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}
        >
          {meta.name}
        </p>
      </div>

      <div style={{ marginTop: 18 }}>
        <FieldLabel>설명</FieldLabel>
        <p
          className="m-0"
          style={{ fontSize: 13, lineHeight: 1.55, color: TEXT_PRIMARY }}
        >
          {meta.description}
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <FieldLabel>달성 조건</FieldLabel>
        <p
          className="m-0"
          style={{ fontSize: 13, lineHeight: 1.55, color: TEXT_PRIMARY }}
        >
          {meta.requirement}
        </p>
      </div>
    </Card>
  );
}

function NextBadgeCard({ meta, user, progressFn, target }) {
  const current = typeof progressFn === 'function' ? progressFn(user) || 0 : 0;
  const goal = target || meta.progressTarget || 0;
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const remaining = Math.max(0, goal - current);
  const pill = getPillColors(meta.tier);

  return (
    <Card>
      <FieldLabel>다음 뱃지</FieldLabel>

      <div className="flex items-start" style={{ gap: 12 }}>
        <div className="flex-1 min-w-0">
          <p
            className="m-0"
            style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}
          >
            {meta.name}
          </p>

          <div style={{ marginTop: 12 }}>
            <FieldLabel>달성 조건</FieldLabel>
            <p
              className="m-0"
              style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}
            >
              다음 단계까지 {remaining > 0 ? `${remaining} 회` : '달성 완료'}
              {goal > 0 ? ` 남음 (목표 ${goal})` : ''}
            </p>
          </div>
        </div>

        <img
          src={meta.img}
          alt=""
          style={{ width: 60, height: 60, objectFit: 'contain', flexShrink: 0 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <FieldLabel>진행 사항</FieldLabel>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: '#EEF2F5',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              background: KEY,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <p
          className="m-0"
          style={{ marginTop: 8, fontSize: 12, color: TEXT_SECONDARY }}
        >
          현재 {current} / 목표 {goal} 회
        </p>
      </div>

      <span
        style={{
          display: 'inline-block',
          marginTop: 12,
          fontSize: 10,
          fontWeight: 700,
          color: pill.text,
          background: pill.bg,
          border: `1px solid ${pill.border}`,
          padding: '3px 10px',
          borderRadius: 999,
        }}
      >
        {meta.group}
      </span>
    </Card>
  );
}

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconLock } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useEarnedBadges } from '../hooks/useEarnedBadges';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import {
  BADGE_CATALOG,
  getPillColors,
  getChainForBadge,
  highestEarnedInChain,
  nextInChain,
  isGrowthBadge,
} from '../components/profile/badgeData';
import BadgeMedallion from '../components/badges/BadgeMedallion';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';

/**
 * 뱃지 상세.
 * - 성장형(영예/베스트 컷/도움 마일스톤): 현재 단계 + 다음 단계 카드
 * - 비성장형(카테고리/지역): 단일 카드 + 진행률
 */
export default function BadgeDetailScreen() {
  const navigate = useNavigate();
  const { badgeId } = useParams();
  const { user } = useAuth();
  const { data, loading } = useProfile(user?.id || null);
  const profileUser = data?.user;

  // 실제 활동 기반 보유 뱃지 + 진행 통계 (helped_count / best_cut_count 등)
  const { earnedKeys, stats, loading: badgesLoading } = useEarnedBadges(profileUser);
  const userWithStats = profileUser ? { ...profileUser, ...stats } : profileUser;

  const meta = BADGE_CATALOG[badgeId];
  const isLoading = loading || badgesLoading;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <Header onBack={() => navigate(-1)} />

      {isLoading && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      {!isLoading && !meta && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          뱃지를 찾을 수 없어요
        </div>
      )}

      {meta && !isLoading && (
        <DetailBody meta={meta} user={userWithStats} earnedKeys={earnedKeys} />
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
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>뱃지 상세</span>
    </div>
  );
}

/**
 * 성장형이면 chain 기반으로, 아니면 단일 뱃지로 본문 렌더.
 */
function DetailBody({ meta, user, earnedKeys }) {
  const chain = getChainForBadge(meta.key);
  const growth = isGrowthBadge(meta.key);

  if (growth && chain) {
    const currentKey = highestEarnedInChain(chain, earnedKeys);
    const nextKey = nextInChain(chain, currentKey);
    const currentMeta = currentKey ? BADGE_CATALOG[currentKey] : null;
    const nextMeta = nextKey ? BADGE_CATALOG[nextKey] : null;

    return (
      <div style={{ padding: '16px 18px 0' }}>
        {currentMeta ? (
          <CurrentBadgeCard meta={currentMeta} earned />
        ) : (
          <UnearnedCurrentCard meta={meta} chain={chain} />
        )}
        {nextMeta && (
          <NextBadgeCard
            meta={nextMeta}
            user={user}
            progressFn={
              currentMeta?.progressOf || BADGE_CATALOG[chain[0]]?.progressOf
            }
            target={
              currentMeta?.progressTarget || BADGE_CATALOG[chain[0]]?.progressTarget
            }
          />
        )}
        {!nextMeta && currentMeta && (
          <MaxStageCard />
        )}
      </div>
    );
  }

  // 비성장형 — 카테고리/지역 단일 뱃지
  const earned = earnedKeys.includes(meta.key);
  return (
    <div style={{ padding: '16px 18px 0' }}>
      <CurrentBadgeCard meta={meta} earned={earned} />
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
        color: TEXT_SECONDARY,
        marginBottom: 6,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </p>
  );
}

function CurrentBadgeCard({ meta, earned }) {
  return (
    <Card>
      <FieldLabel>{earned ? '현재 획득한 뱃지' : '이 뱃지'}</FieldLabel>

      <div className="flex flex-col items-center" style={{ padding: '8px 0 4px' }}>
        <BadgeMedallion meta={meta} state={earned ? 'earned' : 'locked'} size={120} />
        <p
          className="m-0"
          style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY }}
        >
          {meta.name}
        </p>
        {!earned && (
          <span
            style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: TEXT_SECONDARY,
            }}
          >
            <IconLock size={12} stroke={2} />
            아직 미획득
          </span>
        )}
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

/**
 * 성장형 그룹인데 아직 첫 단계도 못 얻은 상태 — "이 뱃지" 카드를 비획득 톤으로.
 */
function UnearnedCurrentCard({ meta, chain }) {
  const firstMeta = BADGE_CATALOG[chain[0]];
  return (
    <Card>
      <FieldLabel>현재 단계</FieldLabel>

      <div className="flex flex-col items-center" style={{ padding: '8px 0 4px' }}>
        <BadgeMedallion meta={firstMeta} state="locked" size={112} />
        <p
          className="m-0"
          style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: TEXT_SECONDARY }}
        >
          {meta.group}
        </p>
        <span
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: TEXT_SECONDARY,
          }}
        >
          <IconLock size={12} stroke={2} />
          아직 단계 진입 전
        </span>
      </div>

      <div style={{ marginTop: 16 }}>
        <FieldLabel>설명</FieldLabel>
        <p className="m-0" style={{ fontSize: 13, lineHeight: 1.55, color: TEXT_PRIMARY }}>
          {firstMeta.description}
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <FieldLabel>첫 단계 조건</FieldLabel>
        <p className="m-0" style={{ fontSize: 13, lineHeight: 1.55, color: TEXT_PRIMARY }}>
          {firstMeta.requirement}
        </p>
      </div>
    </Card>
  );
}

function NextBadgeCard({ meta, user, progressFn, target }) {
  const current = typeof progressFn === 'function' ? progressFn(user) || 0 : 0;
  const goal = target || meta.progressTarget || 0;
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
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
              {goal > 0 ? `다음 단계까지 ${goal} 회 달성` : '달성 완료'}
            </p>
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          <BadgeMedallion meta={meta} state="progress" pct={ratio} size={68} />
        </div>
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

function MaxStageCard() {
  return (
    <Card>
      <p
        className="m-0 text-center"
        style={{ fontSize: 13, color: TEXT_SECONDARY, padding: '12px 0' }}
      >
        최고 단계에 도달했습니다 🎖
      </p>
    </Card>
  );
}

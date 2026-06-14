import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { getCatalogByGroup, getPillColors } from '../components/profile/badgeData';
import BadgeIcon from '../components/badges/BadgeIcon';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const SECTION_LABEL = '#4A7DA8';

/**
 * 어드민 — 전체 뱃지 카탈로그 미리보기.
 * 획득 여부와 상관없이 모든 뱃지를 컬러로 노출하고,
 * 각 뱃지의 획득 조건/등급/출시 예정 여부를 함께 보여준다.
 */
export default function AdminBadgesScreen() {
  const navigate = useNavigate();
  const groups = getCatalogByGroup();
  const totalAll = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 18px 8px' }}>
        <h1
          className="m-0"
          style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}
        >
          전체 뱃지
        </h1>
        <p className="m-0" style={{ marginTop: 4, fontSize: 12, color: TEXT_SECONDARY }}>
          라이브저니에 존재하는 모든 뱃지 ({totalAll}종)
        </p>
      </div>

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
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>전체 뱃지</span>
    </div>
  );
}

function Section({ group }) {
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
        <span style={{ fontSize: 11, color: TEXT_SECONDARY }}>{group.items.length}종</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        {group.items.map((item) => (
          <BadgeCard key={item.key} meta={item} />
        ))}
      </div>
    </div>
  );
}

const TIER_LABEL = { low: '하급', mid: '중급', high: '상급' };

function BadgeCard({ meta }) {
  const pill = getPillColors(meta.tier);
  return (
    <div
      className="flex"
      style={{
        gap: 12,
        padding: 12,
        borderRadius: 16,
        border: `1px solid ${BORDER_LIGHT}`,
        background: '#fff',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <BadgeIcon motif={meta.motif} level={meta.level} size={60} growth={!!meta.chainId} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="flex items-center" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: pill.text,
              background: pill.bg,
              border: `1px solid ${pill.border}`,
              padding: '2px 8px',
              borderRadius: 999,
              lineHeight: 1.2,
            }}
          >
            {meta.name}
          </span>
          {meta.upcoming && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#A07D2A',
                background: '#FBF3DE',
                padding: '2px 6px',
                borderRadius: 999,
              }}
            >
              출시 예정
            </span>
          )}
        </div>
        <p
          className="m-0"
          style={{ marginTop: 6, fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.4 }}
        >
          {meta.description}
        </p>
        <p
          className="m-0"
          style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: TEXT_PRIMARY }}
        >
          조건: {meta.requirement}
        </p>
        <p className="m-0" style={{ marginTop: 2, fontSize: 10, color: '#9A9A9A' }}>
          등급 {TIER_LABEL[meta.tier] || meta.tier} · key: {meta.key}
        </p>
      </div>
    </div>
  );
}

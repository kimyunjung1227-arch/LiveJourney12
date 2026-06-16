import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import {
  BADGE_CATALOG,
  BADGE_GROUP_ORDER,
} from '../components/profile/badgeData';
import { GROUP_META } from '../components/badges/badgeTheme';
import BadgeMedallion from '../components/badges/BadgeMedallion';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_MUTED = '#9AA3AB';
const BORDER_LIGHT = '#E8E8E8';
const KEY_DARK = '#1A6EA8';

const TIER_LABEL = { low: '1단계', mid: '2단계', high: '3단계' };

/**
 * 어드민 — 새 뱃지 디자인(원형 크레스트 v9) 전체 갤러리.
 * - 상태(획득·진행중·잠금)와 모든 그룹·전 단계 뱃지를 실제 메달리온으로 노출.
 * - 지역은 17종 × 3단계까지 전부 — 한 화면에서 디자인 시스템을 검수.
 */
export default function AdminBadgesScreen() {
  const navigate = useNavigate();

  // 그룹별 카탈로그 (카탈로그 정의 순서 = 체인/지역별 단계 순서 유지)
  const groups = BADGE_GROUP_ORDER.map((group) => ({
    group,
    items: Object.values(BADGE_CATALOG).filter((m) => m.group === group),
  })).filter((g) => g.items.length > 0);

  const totalAll = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 48 }}>
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 18px 8px' }}>
        <h1 className="m-0" style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}>
          뱃지 디자인 갤러리
        </h1>
        <p className="m-0" style={{ marginTop: 4, fontSize: 12, color: TEXT_SECONDARY }}>
          원형 크레스트 (v9) · 전체 {totalAll}종 · 상태/단계 검수용
        </p>
      </div>

      <div style={{ padding: '8px 18px 0' }}>
        <StatesSection />
        {groups.map(({ group, items }) => (
          <GroupSection key={group} group={group} items={items} />
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
        <IconArrowLeft size={18} color={TEXT_PRIMARY} stroke={1.8} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>뱃지 디자인</span>
    </div>
  );
}

/** 상태 3종 — 획득 / 진행중 / 잠금 */
function StatesSection() {
  const sample = BADGE_CATALOG.crown_5; // 2단계 샘플
  const states = [
    { state: 'earned', label: '획득', sub: '풀컬러' },
    { state: 'progress', label: '진행중', sub: '회색조' },
    { state: 'locked', label: '잠금', sub: '미획득' },
  ];
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionHeader ko="상태" en="STATE" tag="3종" />
      <div style={{ background: '#fff', border: '1px solid #EFF1F4', borderRadius: 18, padding: '18px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 8, rowGap: 8 }}>
          {states.map(({ state, label, sub }) => (
            <div key={state} className="flex flex-col items-center" style={{ padding: '2px 0' }}>
              <BadgeMedallion meta={sample} state={state} size={78} />
              <span style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY }}>{label}</span>
              <span style={{ marginTop: 3, fontSize: 10.5, color: TEXT_MUTED, fontWeight: 600 }}>{sub}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupSection({ group, items }) {
  const gm = GROUP_META[group] || { ko: group, en: '', tag: '' };
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionHeader ko={gm.ko} en={gm.en} tag={`${items.length}종`} />
      <div style={{ background: '#fff', border: '1px solid #EFF1F4', borderRadius: 18, padding: '18px 14px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            columnGap: 8,
            rowGap: 18,
          }}
        >
          {items.map((meta) => (
            <BadgeCell key={meta.key} meta={meta} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ ko, en, tag }) {
  return (
    <div className="flex items-center" style={{ marginBottom: 10, gap: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4DB8E8', flexShrink: 0 }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{ko}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 0.6 }}>{en}</span>
      <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: KEY_DARK, letterSpacing: 0.3 }}>
        {tag}
      </span>
    </div>
  );
}

/** 카탈로그 검수용 셀 — 메달리온(획득) + 이름 + 단계 + key */
function BadgeCell({ meta }) {
  const tier = meta.chainId ? TIER_LABEL[meta.tier] || `${meta.level}단계` : '단일';
  return (
    <div className="flex flex-col items-center" style={{ padding: '2px 0' }}>
      <BadgeMedallion meta={meta} state="earned" size={66} />
      <span
        style={{
          marginTop: 9,
          fontSize: 11.5,
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
      <span style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: '#4E83AC' }}>{tier}</span>
      <span style={{ marginTop: 2, fontSize: 9, color: '#AEB6BF' }}>{meta.key}</span>
    </div>
  );
}

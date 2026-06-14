import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useEarnedBadges } from '../hooks/useEarnedBadges';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';
import {
  BADGE_CATALOG,
  CHAINS,
  BADGE_GROUP_ORDER,
  resolveEarnedBadges,
  getBadgeProgress,
} from '../components/profile/badgeData';
import { GROUP_META } from '../components/badges/badgeTheme';
import BadgeMedallion from '../components/badges/BadgeMedallion';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_MUTED = '#9AA3AB';
const BORDER_LIGHT = '#E8E8E8';
const KEY_DARK = '#1A6EA8';

/**
 * 뱃지 전체보기 — 섹션별 카드 + 3단계 진화(메달리온) + 진행 링/카운트.
 */
export default function BadgesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { data, loading } = useProfile(userId);

  const profileUser = data?.user;
  const { earnedKeys, stats, loading: badgesLoading } = useEarnedBadges(profileUser);
  const earnedSet = new Set(earnedKeys);

  const totalEarned = resolveEarnedBadges(earnedKeys).length;
  const totalAll = Object.keys(BADGE_CATALOG).length;

  const go = (key) => navigate(`/profile/badges/${key}`);

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 40 }}>
      <PageSeo {...PAGE_SEO.profile} />
      <Header onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 18px 8px' }}>
        <h1 className="m-0" style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: -0.3 }}>
          뱃지
        </h1>
        <p className="m-0" style={{ marginTop: 4, fontSize: 12, color: TEXT_SECONDARY }}>
          활동을 쌓으면 단계가 진화하는 라이브저니 뱃지
        </p>
        {profileUser && (
          <p className="m-0" style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: KEY_DARK }}>
            획득 {totalEarned} / {totalAll}
          </p>
        )}
      </div>

      {(loading || badgesLoading) && (
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      )}

      <div style={{ padding: '8px 18px 0' }}>
        {BADGE_GROUP_ORDER.map((group) => (
          <GroupSection
            key={group}
            group={group}
            stats={stats}
            earnedSet={earnedSet}
            onPick={go}
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
        <IconArrowLeft size={18} color={TEXT_PRIMARY} stroke={1.8} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>뱃지</span>
    </div>
  );
}

/** 한 그룹(섹션) = 헤더 + 카드. 카드 안에 1~N개의 단계 행. */
function GroupSection({ group, stats, earnedSet, onPick }) {
  const gm = GROUP_META[group] || { ko: group, en: '', dot: '#2BA0DC', tag: '' };
  const rows = buildRows(group, stats, earnedSet);
  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      {/* 헤더 */}
      <div className="flex items-center" style={{ marginBottom: 10, gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: gm.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{gm.ko}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 0.6 }}>{gm.en}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 0.3 }}>
          {gm.tag}
        </span>
      </div>

      {/* 카드 — 흰 배경 + 옅은 보더 (파스텔 스쿼클이 대비되도록) */}
      <div style={{ background: '#fff', border: '1px solid #EFF1F4', borderRadius: 18, padding: '18px 14px' }}>
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              columnGap: 8,
              rowGap: 16,
              marginTop: ri === 0 ? 0 : 18,
            }}
          >
            {row.map((item) => (
              <TierItem key={item.meta.key} item={item} onClick={() => onPick(item.meta.key)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 그룹을 단계 행(들)로 구성. 각 항목 = { meta, state, pct, pill } */
function buildRows(group, stats, earnedSet) {
  if (group === '지역 전문성') {
    const counts = stats?.region_counts || {};
    let activeKeys = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    if (activeKeys.length === 0) activeKeys = ['seoul']; // 미리보기
    return activeKeys
      .map((rk) => CHAINS[`region_${rk}`])
      .filter(Boolean)
      .map((chain) => chainRow(chain, stats, earnedSet));
  }

  if (group === '카테고리 전문성') {
    const items = Object.values(BADGE_CATALOG).filter((m) => m.group === group);
    const cells = items.map((meta) => singleCell(meta, stats, earnedSet));
    return chunk(cells, 3);
  }

  // 성장형 단일 체인 그룹 (영예 / 베스트 컷 / 도움)
  const chainId = chainIdForGroup(group);
  const chain = chainId ? CHAINS[chainId] : null;
  if (chain) return [chainRow(chain, stats, earnedSet)];
  return [];
}

function chainIdForGroup(group) {
  switch (group) {
    case '영예':
      return 'honor';
    case '베스트 컷 작가':
      return 'bestcut';
    case '도움 마일스톤':
      return 'help';
    default:
      return null;
  }
}

/** 체인(단계 배열) → 단계별 상태 셀 배열. 첫 미달성 = 진행중, 이후 = 잠금. */
function chainRow(chainKeys, stats, earnedSet) {
  let progressUsed = false;
  return chainKeys.map((key) => {
    const meta = BADGE_CATALOG[key];
    if (earnedSet.has(key)) return buildCell(meta, 'earned', stats);
    if (!progressUsed) {
      progressUsed = true;
      return buildCell(meta, 'progress', stats);
    }
    return buildCell(meta, 'locked', stats);
  });
}

function singleCell(meta, stats, earnedSet) {
  if (earnedSet.has(meta.key)) return buildCell(meta, 'earned', stats);
  const prog = getBadgeProgress(meta, stats);
  const state = prog && prog.current > 0 ? 'progress' : 'locked';
  return buildCell(meta, state, stats);
}

function buildCell(meta, state, stats) {
  const prog = getBadgeProgress(meta, stats);
  const pct = prog && prog.target ? prog.current / prog.target : 0;
  const pill =
    state === 'earned'
      ? { text: '달성', tone: 'green' }
      : prog
      ? { text: `${Math.min(prog.current, prog.target)}/${prog.target} ${prog.unit}`, tone: 'gray' }
      : { text: '미획득', tone: 'gray' };
  return { meta, state, pct, pill };
}

function TierItem({ item, onClick }) {
  const { meta, state, pct, pill } = item;
  const labelColor = state === 'locked' ? '#AEB6BF' : TEXT_PRIMARY;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', width: '100%' }}
    >
      <BadgeMedallion meta={meta} state={state} pct={pct} size={66} />
      <span
        style={{
          marginTop: 9,
          fontSize: 12,
          fontWeight: 700,
          color: labelColor,
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
          background: pill.tone === 'green' ? '#E3F8EC' : '#EEF0F3',
          color: pill.tone === 'green' ? '#1E9E5A' : '#7A828B',
          whiteSpace: 'nowrap',
        }}
      >
        {pill.text}
      </span>
    </button>
  );
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

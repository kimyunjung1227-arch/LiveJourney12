import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAward } from '@tabler/icons-react';

import {
  BADGE_CATALOG,
  resolveEarnedBadges,
  getPillColors,
  isGrowthGroup,
  GROWTH_CHAINS,
  highestEarnedInChain,
} from './badgeData';
import { useEarnedBadges } from '../../hooks/useEarnedBadges';

const TEXT_SECONDARY = '#6B6B6B';

/**
 * 프로필 메인의 뱃지 박스.
 * - 실제 활동(제보·좋아요·베스트컷)으로 획득한 뱃지만 표시 (아이콘 + pill 라벨)
 * - 클릭 시 /profile/badges/:badgeKey 로 이동
 */
export default function BadgesBox({ user }) {
  const navigate = useNavigate();
  const { earnedKeys, loading } = useEarnedBadges(user);
  if (!user) return null;

  const earned = collapseGrowthGroups(resolveEarnedBadges(earnedKeys), earnedKeys);

  return (
    <div style={{ padding: '0 18px', marginBottom: 16 }}>
      <div className="flex items-center" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-1.5">
          <IconAward size={14} color="#1F1F1F" stroke={2.2} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1F1F1F' }}>
            뱃지
          </span>
        </div>
      </div>

      {earned.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: TEXT_SECONDARY,
            padding: '8px 0',
          }}
        >
          {loading
            ? '활동 내역을 불러오는 중...'
            : '아직 획득한 뱃지가 없어요. 활동을 쌓으면 자동으로 부여됩니다.'}
        </div>
      ) : (
        <div className="flex flex-wrap" style={{ gap: 14 }}>
          {earned.map((meta) => (
            <EarnedBadge
              key={meta.key}
              meta={meta}
              onClick={() => navigate(`/profile/badges/${meta.key}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 성장형 그룹은 최고 단계 1개만 남기고, 비성장형은 그대로 유지.
 * - 같은 성장형 그룹 안의 다른 단계 뱃지는 제거 (중복 노출 방지)
 * - 카탈로그 등록 순서를 유지하되 성장형 대표 뱃지는 그 그룹의 첫 등장 자리에 배치
 */
function collapseGrowthGroups(earnedMetas, earnedKeys) {
  const seenGrowthGroups = new Set();
  const result = [];
  for (const meta of earnedMetas) {
    if (isGrowthGroup(meta.group)) {
      if (seenGrowthGroups.has(meta.group)) continue;
      seenGrowthGroups.add(meta.group);
      const chain = GROWTH_CHAINS[meta.group];
      const topKey = highestEarnedInChain(chain, earnedKeys);
      const topMeta = topKey ? BADGE_CATALOG[topKey] : meta;
      result.push(topMeta);
    } else {
      result.push(meta);
    }
  }
  return result;
}

/**
 * 획득 뱃지 — 아이콘 (테두리 없음) + pill 라벨.
 */
function EarnedBadge({ meta, onClick }) {
  const pill = getPillColors(meta.tier);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={meta.name}
      className="flex flex-col items-center"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        gap: 6,
      }}
    >
      <img
        src={meta.img}
        alt=""
        style={{
          width: 60 * (meta.iconScale || 1),
          height: 60 * (meta.iconScale || 1),
          objectFit: 'contain',
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: pill.text,
          background: pill.bg,
          border: `1px solid ${pill.border}`,
          padding: '4px 10px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}
      >
        {meta.name}
      </span>
    </button>
  );
}

/**
 * 전체보기 화면에서 사용하는 큰 뱃지 칩 — 외부 export 유지 (BadgesScreen 호환).
 */
export function BadgeChip({ item, size = 60 }) {
  const scaled = size * (item.iconScale || 1);
  return (
    <img
      src={item.img}
      alt=""
      style={{
        width: scaled,
        height: scaled,
        objectFit: 'contain',
        filter: item.earned ? 'none' : 'grayscale(1)',
        opacity: item.earned ? 1 : 0.45,
      }}
    />
  );
}

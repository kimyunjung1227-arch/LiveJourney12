import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAward } from '@tabler/icons-react';

import {
  BADGE_CATALOG,
  resolveEarnedBadges,
  isGrowthBadge,
  getChainForBadge,
  highestEarnedInChain,
} from './badgeData';
import BadgeChip from '../badges/BadgeChip';
import { useEarnedBadges } from '../../hooks/useEarnedBadges';

const TEXT_SECONDARY = '#6B6B6B';

/**
 * 프로필 메인의 뱃지 박스.
 * - 실제 활동(제보·좋아요·베스트컷)으로 획득한 뱃지만 표시 (SVG 문장 + pill 라벨)
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
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          {earned.map((meta) => (
            <BadgeChip
              key={meta.key}
              meta={meta}
              size="md"
              onClick={() => navigate(`/profile/badges/${meta.key}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 성장형 체인은 최고 단계 1개만 남기고, 비성장형은 그대로 유지.
 * - 같은 체인(chainId)의 다른 단계 뱃지는 제거 (중복 노출 방지)
 * - 지역 체인도 각 지역별로 1개씩 노출된다.
 */
function collapseGrowthGroups(earnedMetas, earnedKeys) {
  const seenChains = new Set();
  const result = [];
  for (const meta of earnedMetas) {
    if (isGrowthBadge(meta)) {
      if (seenChains.has(meta.chainId)) continue;
      seenChains.add(meta.chainId);
      const chain = getChainForBadge(meta.key);
      const topKey = highestEarnedInChain(chain, earnedKeys);
      const topMeta = topKey ? BADGE_CATALOG[topKey] : meta;
      result.push(topMeta);
    } else {
      result.push(meta);
    }
  }
  return result;
}


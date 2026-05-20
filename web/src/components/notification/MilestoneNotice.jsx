import React from 'react';
import { IconFlame } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';
const GRADIENT_LIGHT = 'linear-gradient(135deg, #E8F4FB, #F0F9FE)';

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '방금';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

/**
 * 마일스톤(100명+) 알림 — 옅은 그라데이션 카드.
 */
export default function MilestoneNotice({ notification }) {
  const navigate = useNavigate();
  const milestone = notification?.data?.milestone ?? 0;

  return (
    <div
      onClick={() => navigate('/profile')}
      role="button"
      tabIndex={0}
      style={{
        background: GRADIENT_LIGHT,
        border: '1.5px solid rgba(77, 184, 232, 0.3)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        cursor: 'pointer',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: GRADIENT,
          }}
        >
          <IconFlame size={22} color="white" stroke={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="m-0"
            style={{
              fontSize: 13,
              color: TEXT_PRIMARY,
              lineHeight: 1.4,
              marginBottom: 2,
            }}
          >
            <span style={{ fontWeight: 700, color: KEY_DARK }}>
              도움 {milestone}명
            </span>{' '}
            달성! 당신의 사진이 {milestone}명에게 도움이 됐어요.
          </p>
          <p className="m-0" style={{ fontSize: 10, color: TEXT_SECONDARY }}>
            {timeAgo(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

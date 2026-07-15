import React from 'react';
import { IconHeartHandshake } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const KEY_LIGHT_BG = '#EAF5FC';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#EEEEEE';

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
 * 마일스톤(100명+) 알림 — 흰 배경 카드 + 컬러 아이콘.
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
        background: '#fff',
        border: `1px solid ${BORDER_LIGHT}`,
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
            background: KEY_LIGHT_BG,
          }}
        >
          <IconHeartHandshake size={24} color={KEY} stroke={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="m-0"
            style={{
              fontSize: 14,
              color: TEXT_PRIMARY,
              lineHeight: 1.5,
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 700, color: KEY_DARK }}>
              도움 {milestone}명
            </span>{' '}
            달성! 당신의 사진이 {milestone}명에게 도움이 됐어요.
          </p>
          <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY }}>
            {timeAgo(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

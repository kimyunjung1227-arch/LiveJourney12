import React from 'react';
import { IconCrown } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDisplayImageUrl } from '../../api/upload';

const KEY_DARK = '#1A6EA8';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

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
 * 베스트 컷 선정 알림 — 풀 그라데이션 카드 + 왕관 워터마크.
 * 가장 무거운 영예 시그니처.
 */
export default function BestCutNotice({ notification }) {
  const navigate = useNavigate();
  const data = notification?.data || {};
  const helped = data.helped_count ?? 0;
  const place = data.place_name || '';
  const placeShort = place.split(' ')[0] || place;
  const thumb = notification?.post_thumbnail
    ? getDisplayImageUrl(notification.post_thumbnail)
    : '';

  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        background: GRADIENT,
      }}
    >
      {/* 왕관 워터마크 */}
      <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.15, pointerEvents: 'none' }}>
        <IconCrown size={80} color="white" stroke={2} />
      </div>

      {/* 헤더 */}
      <div className="flex items-center gap-1.5 relative" style={{ marginBottom: 10 }}>
        <IconCrown size={16} color="white" stroke={2} />
        <span style={{ fontSize: 12, color: 'white', fontWeight: 700, letterSpacing: 0.2 }}>
          베스트 컷 선정
        </span>
      </div>

      {/* 메시지 */}
      <p
        className="m-0 relative"
        style={{
          fontSize: 14.5,
          color: 'white',
          lineHeight: 1.55,
          marginBottom: 14,
        }}
      >
        {place ? `${place} 사진이 ` : '당신의 사진이 '}
        <span style={{ fontWeight: 700 }}>베스트 컷</span>이 됐어요!
        {helped > 0 && placeShort
          ? ` ${helped}명이 당신의 사진으로 ${placeShort}을(를) 결정했어요.`
          : helped > 0
          ? ` ${helped}명에게 도움이 됐어요.`
          : ''}
      </p>

      {/* 하단: 썸네일 + 시간 + 보기 */}
      <div className="flex items-center gap-2.5 relative">
        <div
          className="overflow-hidden flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: 9,
            background: 'rgba(255,255,255,0.2)',
            border: '1.5px solid rgba(255,255,255,0.4)',
          }}
        >
          {thumb && (
            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          )}
        </div>
        <div className="flex-1">
          <p className="m-0" style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
            {timeAgo(notification.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => notification.post_id && navigate(`/post/${encodeURIComponent(notification.post_id)}`)}
          style={{
            background: '#fff',
            color: KEY_DARK,
            padding: '8px 16px',
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          보기
        </button>
      </div>
    </div>
  );
}

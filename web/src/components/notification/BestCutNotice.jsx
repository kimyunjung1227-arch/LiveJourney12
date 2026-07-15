import React from 'react';
import { IconCrown } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const KEY_LIGHT_BG = '#EAF5FC';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SURFACE = '#F5F7FA';
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
      className="relative"
      style={{
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        background: '#fff',
        border: `1px solid ${BORDER_LIGHT}`,
      }}
    >
      {/* 헤더 — 왕관 아이콘에 색을 실어 강조 */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 24, height: 24, borderRadius: 999, background: KEY_LIGHT_BG }}
        >
          <IconCrown size={15} color={KEY} stroke={2} />
        </div>
        <span style={{ fontSize: 12, color: KEY_DARK, fontWeight: 700, letterSpacing: 0.2 }}>
          베스트 컷 선정
        </span>
      </div>

      {/* 메시지 */}
      <p
        className="m-0"
        style={{
          fontSize: 14.5,
          color: TEXT_PRIMARY,
          lineHeight: 1.55,
          marginBottom: 14,
        }}
      >
        {place ? `${place} 사진이 ` : '당신의 사진이 '}
        <span style={{ fontWeight: 700, color: KEY_DARK }}>베스트 컷</span>이 됐어요!
        {helped > 0 && placeShort
          ? ` ${helped}명이 당신의 사진으로 ${placeShort}을(를) 결정했어요.`
          : helped > 0
          ? ` ${helped}명에게 도움이 됐어요.`
          : ''}
      </p>

      {/* 하단: 썸네일 + 시간 + 보기 */}
      <div className="flex items-center gap-2.5">
        <div
          className="overflow-hidden flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: 9,
            background: SURFACE,
            border: `1px solid ${BORDER_LIGHT}`,
          }}
        >
          {thumb && (
            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          )}
        </div>
        <div className="flex-1">
          <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY }}>
            {timeAgo(notification.created_at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => notification.post_id && navigate(`/post/${encodeURIComponent(notification.post_id)}`)}
          style={{
            background: KEY,
            color: '#fff',
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

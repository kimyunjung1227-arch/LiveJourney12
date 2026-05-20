import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconHeart,
  IconBookmark,
  IconFlame,
  IconPhoto,
  IconBell,
} from '@tabler/icons-react';
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
 * 일반 활동 알림 — 가장 많이 쓰는 행 컴포넌트.
 * type별 메시지/아바타/우측 위젯 분기.
 */
export default function ActivityNotice({ notification, onFollowBack }) {
  const navigate = useNavigate();
  const { type, actor, data = {}, post_thumbnail, is_read, i_follow_back, message } = notification;
  const name = actor?.name || '여행자';

  const renderAvatar = () => {
    if (type === 'like') {
      return (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 46, height: 46, borderRadius: 999, background: KEY }}
        >
          <IconHeart size={19} color="white" stroke={2} />
        </div>
      );
    }
    if (type === 'save') {
      return (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 46, height: 46, borderRadius: 999, background: KEY }}
        >
          <IconBookmark size={19} color="white" stroke={2} />
        </div>
      );
    }
    if (type === 'milestone') {
      return (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 46, height: 46, borderRadius: 999, background: KEY }}
        >
          <IconFlame size={19} color="white" stroke={2} />
        </div>
      );
    }
    if (type === 'system') {
      return (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 46, height: 46, borderRadius: 999, background: '#9CA3AF' }}
        >
          <IconBell size={19} color="white" stroke={2} />
        </div>
      );
    }
    if (type === 'post' && !actor) {
      // actor 없는 post 알림은 사진 아이콘으로 폴백
      return (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 46, height: 46, borderRadius: 999, background: KEY }}
        >
          <IconPhoto size={19} color="white" stroke={2} />
        </div>
      );
    }
    // 사람 아바타
    return (
      <div
        className="flex items-center justify-center flex-shrink-0 text-white font-semibold"
        style={{
          width: 46,
          height: 46,
          borderRadius: 999,
          background: actor?.avatar_color || KEY,
          fontSize: 17,
        }}
      >
        {String(name).charAt(0).toUpperCase() || '·'}
      </div>
    );
  };

  const renderMessage = () => {
    switch (type) {
      case 'best_answer':
        return (
          <>
            <span style={{ fontWeight: 600 }}>{name}</span>님이 당신의 답변을{' '}
            <span style={{ fontWeight: 700, color: KEY_DARK }}>베스트 답변</span>으로
            선정했어요
          </>
        );
      case 'question_answered':
        return (
          <>
            <span style={{ fontWeight: 600 }}>{name}</span>님이 당신의 질문에{' '}
            <span style={{ fontWeight: 700, color: KEY_DARK }}>사진으로 답변</span>했어요
          </>
        );
      case 'like': {
        const count = data?.count || 1;
        const firstName = data?.actors?.[0]?.name || name;
        return count > 1 ? (
          <>
            <span style={{ fontWeight: 600 }}>{firstName}</span>님 외{' '}
            <span style={{ fontWeight: 600 }}>{count - 1}명</span>이 좋아해요
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>{name}</span>님이 좋아해요
          </>
        );
      }
      case 'save': {
        const count = data?.count || 1;
        const firstName = data?.actors?.[0]?.name || name;
        return count > 1 ? (
          <>
            <span style={{ fontWeight: 600 }}>{firstName}</span>님 외{' '}
            <span style={{ fontWeight: 600 }}>{count - 1}명</span>이 저장했어요
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>{name}</span>님이 저장했어요
          </>
        );
      }
      case 'comment':
        return (
          <>
            <span style={{ fontWeight: 600 }}>{name}</span>님이 댓글을 남겼어요
            {data?.comment_text ? `: "${data.comment_text}"` : ''}
          </>
        );
      case 'follow':
        return (
          <>
            <span style={{ fontWeight: 600 }}>{name}</span>님이 회원님을{' '}
            <span style={{ fontWeight: 600 }}>팔로우</span>하기 시작했어요
          </>
        );
      case 'milestone': {
        const milestone = data?.milestone || 0;
        return (
          <>
            <span style={{ fontWeight: 700, color: KEY_DARK }}>
              도움 {milestone}명
            </span>{' '}
            달성!
          </>
        );
      }
      case 'post':
        if (actor) {
          return (
            <>
              <span style={{ fontWeight: 600 }}>{name}</span>님이 새 게시물을 올렸어요
            </>
          );
        }
        return <>{message || '새 게시물이 올라왔어요'}</>;
      case 'system':
        return <>{message || '새 소식이 도착했어요'}</>;
      default:
        return <>{message || '새 알림이 있어요'}</>;
    }
  };

  const handleClick = () => {
    switch (type) {
      case 'best_answer':
      case 'question_answered':
        if (notification.question_id) {
          navigate(`/question/${encodeURIComponent(notification.question_id)}`);
        }
        break;
      case 'follow':
        if (actor?.id) {
          navigate(`/user/${encodeURIComponent(actor.id)}`);
        }
        break;
      case 'milestone':
        navigate('/profile');
        break;
      default:
        if (notification.post_id) {
          navigate(`/post/${encodeURIComponent(notification.post_id)}`);
        }
    }
  };

  const thumbUrl = post_thumbnail ? getDisplayImageUrl(post_thumbnail) : '';
  const showThumbRight = type !== 'follow' && !!thumbUrl;

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      className="flex items-center"
      style={{
        gap: 12,
        cursor: 'pointer',
        borderRadius: 10,
        background: is_read ? 'transparent' : KEY_LIGHT_BG,
        padding: '12px 10px',
        marginBottom: 2,
        borderBottom: `1px solid ${BORDER_LIGHT}`,
      }}
    >
      {renderAvatar()}

      <div className="flex-1 min-w-0">
        <p
          className="m-0"
          style={{
            fontSize: 14,
            color: TEXT_PRIMARY,
            lineHeight: 1.5,
            marginBottom: 4,
            wordBreak: 'break-word',
          }}
        >
          {renderMessage()}
        </p>
        <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY }}>
          {timeAgo(notification.created_at)}
        </p>
      </div>

      {type === 'follow' ? (
        !i_follow_back && actor?.id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFollowBack && onFollowBack(actor.id);
            }}
            style={{
              background: KEY,
              color: 'white',
              padding: '8px 16px',
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            팔로우
          </button>
        )
      ) : showThumbRight ? (
        <div
          className="overflow-hidden flex-shrink-0"
          style={{ width: 46, height: 46, borderRadius: 8, background: SURFACE }}
        >
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
    </div>
  );
}

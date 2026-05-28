import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClock, IconMapPin, IconPhoto } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const KEY_LIGHT = '#E8F4FB';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SURFACE = '#F5F7FA';

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

export default function QuestionListCard({ question }) {
  const navigate = useNavigate();
  const initial = String(question?.author?.name || '?').trim().charAt(0).toUpperCase() || '·';

  return (
    <button
      type="button"
      onClick={() => navigate(`/question/${encodeURIComponent(question.id)}`)}
      className="text-left w-full"
      style={{
        background: SURFACE,
        borderRadius: 12,
        padding: '13px 15px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="rounded-full overflow-hidden text-white font-semibold flex items-center justify-center flex-shrink-0"
          style={{
            width: 30,
            height: 30,
            fontSize: 12,
            background: question?.author?.avatar_color || KEY,
          }}
        >
          {question?.author?.avatar_url ? (
            <img
              src={getDisplayImageUrl(question.author.avatar_url)}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>
              {question?.author?.name || '익명'}
            </span>
            <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>·</span>
            <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>
              {timeAgo(question?.created_at)}
            </span>
          </div>
          <p
            className="m-0"
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: TEXT_PRIMARY,
              marginBottom: 10,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {question?.body}
          </p>
          <div className="flex items-center gap-2.5 flex-wrap">
            {question?.is_answered ? (
              <div
                className="flex items-center gap-1"
                style={{ background: 'white', borderRadius: 7, padding: '2px 8px' }}
              >
                <IconPhoto size={11} color={KEY} />
                <span style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600 }}>
                  {question.answer_count || 0}장 답변
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1"
                style={{ background: KEY_LIGHT, borderRadius: 7, padding: '2px 8px' }}
              >
                <IconClock size={11} color={KEY} />
                <span style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600 }}>
                  답변 기다림
                </span>
              </div>
            )}
            {question?.place_name && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{ fontSize: 10, color: TEXT_SECONDARY }}
              >
                <IconMapPin size={10} color={TEXT_SECONDARY} />
                {question.place_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

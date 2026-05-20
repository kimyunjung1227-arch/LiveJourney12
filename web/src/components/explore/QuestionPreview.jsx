import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconHelpCircle,
  IconChevronRight,
  IconPhoto,
  IconClock,
} from '@tabler/icons-react';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const KEY_LIGHT = '#E8F4FB';
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

export default function QuestionPreview({ title, questions, onSeeAll }) {
  const navigate = useNavigate();
  const list = Array.isArray(questions) ? questions : [];
  if (list.length === 0) return null;

  const q = list[0];
  const initial = String(q?.author?.name || '?').trim().charAt(0).toUpperCase() || '·';

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-1.5">
          <IconHelpCircle size={16} color={KEY} />
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            {title}
          </p>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="flex items-center gap-0.5"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: TEXT_SECONDARY,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          전체 보기
          <IconChevronRight size={12} color={TEXT_SECONDARY} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/question/${encodeURIComponent(q.id)}`)}
        className="w-full text-left"
        style={{
          background: SURFACE,
          borderRadius: 11,
          padding: '12px 14px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div className="flex items-start gap-2.5">
          <div
            className="flex items-center justify-center flex-shrink-0 text-white font-semibold rounded-full"
            style={{
              width: 28,
              height: 28,
              background: q?.author?.avatar_color || KEY,
              fontSize: 11,
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY }}>
                {q?.author?.name || '익명'}
              </span>
              <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>·</span>
              <span style={{ fontSize: 9, color: TEXT_SECONDARY }}>
                {timeAgo(q.created_at)}
              </span>
            </div>
            <p
              className="m-0"
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: TEXT_PRIMARY,
                marginBottom: 8,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {q.body}
            </p>
            {q.is_answered ? (
              <div
                className="flex items-center gap-1"
                style={{
                  padding: '2px 8px',
                  borderRadius: 7,
                  background: 'white',
                  width: 'fit-content',
                }}
              >
                <IconPhoto size={11} color={KEY} />
                <span style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600 }}>
                  {q.answer_count}장 답변
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1"
                style={{
                  padding: '2px 8px',
                  borderRadius: 7,
                  background: KEY_LIGHT,
                  width: 'fit-content',
                }}
              >
                <IconClock size={11} color={KEY} />
                <span style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600 }}>
                  답변 기다림
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

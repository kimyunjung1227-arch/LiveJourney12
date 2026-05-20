import React from 'react';

const KEY_LIGHT = '#E8F4FB';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';

/**
 * 정보 입력(업로드) 화면 상단 옅은 질문 배너.
 */
export default function QuestionBanner({ question }) {
  if (!question) return null;
  const name = question.author_name || '여행자';
  const initial = String(name).trim().charAt(0).toUpperCase() || '·';

  return (
    <div
      className="flex items-center"
      style={{
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: KEY_LIGHT,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0 text-white font-semibold"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          fontSize: 13,
          background: question.author_avatar_color || '#4DB8E8',
        }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="m-0"
          style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600, marginBottom: 1 }}
        >
          {name}님 질문에 답하기
        </p>
        <p
          className="m-0 truncate"
          style={{ fontSize: 12, color: TEXT_PRIMARY }}
        >
          {question.body}
        </p>
      </div>
    </div>
  );
}

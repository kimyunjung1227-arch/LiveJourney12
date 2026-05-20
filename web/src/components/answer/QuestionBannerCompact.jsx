import React from 'react';
import { IconHelpCircle } from '@tabler/icons-react';

/**
 * 카메라 화면 상단에 띄우는 반투명 질문 배너.
 */
export default function QuestionBannerCompact({ question }) {
  if (!question) return null;

  return (
    <div
      className="flex items-center"
      style={{
        gap: 10,
        padding: '11px 13px',
        borderRadius: 12,
        background: 'rgba(77, 184, 232, 0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.25)',
        }}
      >
        <IconHelpCircle size={17} color="white" stroke={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="m-0"
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 600,
            marginBottom: 1,
          }}
        >
          {question.author_name || '여행자'}님 질문에 답하는 중
        </p>
        <p
          className="m-0 truncate"
          style={{
            fontSize: 12,
            color: 'white',
            fontWeight: 600,
          }}
        >
          {question.body}
        </p>
      </div>
    </div>
  );
}

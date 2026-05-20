import React from 'react';

const LABELS = {
  today: '오늘',
  week: '이번 주',
  earlier: '이전',
};

export default function TimeGroupHeader({ group }) {
  return (
    <p
      className="m-0"
      style={{
        fontSize: 12,
        color: '#1F1F1F',
        fontWeight: 700,
        marginTop: 18,
        marginBottom: 8,
        letterSpacing: 0.2,
      }}
    >
      {LABELS[group] || group}
    </p>
  );
}

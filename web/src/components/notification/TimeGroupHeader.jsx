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
        fontSize: 11,
        color: '#6B6B6B',
        fontWeight: 600,
        marginTop: 14,
        marginBottom: 10,
        letterSpacing: 0.2,
      }}
    >
      {LABELS[group] || group}
    </p>
  );
}

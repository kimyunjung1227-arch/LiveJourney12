import React from 'react';

function BoldParts({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={j} style={{ fontWeight: 700, color: '#0f172a' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={j}>{part}</React.Fragment>;
  });
}

/**
 * 추천 장소 소개: \n\n 문단 구분 + **강조** 마크다운 스타일
 */
export default function PlaceDescriptionRich({ text, style, className }) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const paragraphs = raw.split(/\n\n+/).filter(Boolean);
  return (
    <div className={className} style={style}>
      {paragraphs.map((para, i) => (
        <p
          key={i}
          style={{
            margin: i === 0 ? 0 : '0.65em 0 0 0',
            lineHeight: 1.6,
          }}
        >
          <BoldParts text={para} />
        </p>
      ))}
    </div>
  );
}

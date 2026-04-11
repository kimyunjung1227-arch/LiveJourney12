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
 * @param {{ lineClamp?: number }} props — 지정 시 해당 줄 수만 표시(말줄임)
 */
export default function PlaceDescriptionRich({ text, style, className, lineClamp }) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const paragraphs = raw.split(/\n\n+/).filter(Boolean);
  const n = Number(lineClamp);
  const useClamp = Number.isFinite(n) && n > 0;

  if (useClamp) {
    const flat = paragraphs.join('\n\n');
    return (
      <div
        className={className}
        style={{
          ...style,
          display: '-webkit-box',
          WebkitLineClamp: n,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.55,
        }}
      >
        <BoldParts text={flat} />
      </div>
    );
  }

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

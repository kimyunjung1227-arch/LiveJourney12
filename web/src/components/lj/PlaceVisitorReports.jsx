import React, { useState } from 'react';
import { LJ, formatExifTime } from './tokens';
import { getPostLiveTimeMs } from '../../utils/placeLiveStatus';

const COLLAPSED_COUNT = 3;

/**
 * 방문자 제보 — 이 장소 게시물의 본문 텍스트만 모아 보여 준다.
 * 사진이 아니라 "지금 어떤지"를 말로 확인하는 영역이라 텍스트가 있는 게시물만 쓴다.
 */
export function PlaceVisitorReports({ posts = [], onSelect }) {
  const [expanded, setExpanded] = useState(false);

  const items = (Array.isArray(posts) ? posts : [])
    .filter((p) => String(p?.body || '').trim())
    .sort((a, b) => getPostLiveTimeMs(b) - getPostLiveTimeMs(a));

  if (items.length === 0) return null;

  const shown = expanded ? items.slice(0, 12) : items.slice(0, COLLAPSED_COUNT);

  return (
    <section style={{ padding: '22px 18px 0', fontFamily: LJ.fontStack }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: LJ.textPrimary }}>방문자 제보</h2>
        <span style={{ fontSize: 11, color: LJ.textTertiary, fontWeight: 500 }}>{items.length}건</span>
      </div>

      <div style={{ marginTop: 10, borderTop: `1px solid ${LJ.borderLight}` }}>
        {shown.map((p) => {
          const timeIso = getPostLiveTimeMs(p) ? new Date(getPostLiveTimeMs(p)).toISOString() : '';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect?.(p)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${LJ.borderLight}`,
                cursor: 'pointer',
                fontFamily: LJ.fontStack,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: LJ.textPrimary,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {String(p.body).trim()}
              </p>
              <div style={{ marginTop: 5, fontSize: 11, color: LJ.textTertiary, fontWeight: 500 }}>
                {p.author?.nickname || '익명'}
                {timeIso ? ` · ${formatExifTime(timeIso)}` : ''}
              </div>
            </button>
          );
        })}
      </div>

      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '9px 0',
            background: '#fff',
            border: `1px solid ${LJ.borderLight}`,
            borderRadius: 8,
            color: LJ.textSecondary,
            fontFamily: LJ.fontStack,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {expanded ? '접기' : `제보 ${Math.min(items.length, 12) - COLLAPSED_COUNT}건 더 보기`}
        </button>
      )}
    </section>
  );
}

export default PlaceVisitorReports;

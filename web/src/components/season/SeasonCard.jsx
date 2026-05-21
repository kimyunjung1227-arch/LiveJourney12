import React from 'react';
import { useNavigate } from 'react-router-dom';

const KEY = '#4DB8E8';

function peakDateLabel(iso) {
  if (!iso) return '진행 중';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '진행 중';
  return `절정 ~${d.getMonth() + 1}/${d.getDate()}`;
}

function startDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} 시작`;
}

export default function SeasonCard({ card, status }) {
  const navigate = useNavigate();
  const isUpcoming = status === 'upcoming';
  const height = isUpcoming ? 110 : 130;
  const titleSize = isUpcoming ? 16 : 18;
  const start = card.cover_color_start || '#87CEEB';
  const end = card.cover_color_end || '#4DB8E8';

  let badge = null;
  if (status === 'peak') {
    badge = (
      <div
        className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md"
        style={{ background: 'linear-gradient(135deg, #4DB8E8, #1A6EA8)' }}
      >
        <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>
          {card.peak_label || peakDateLabel(card.peak_ends_at || card.ends_at)}
        </span>
      </div>
    );
  } else if (status === 'soon') {
    badge = (
      <div
        className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md"
        style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>
          {startDateLabel(card.starts_at)} · D-{card.d_day ?? '?'}
        </span>
      </div>
    );
  } else {
    badge = (
      <div
        className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>
          {card.period_label}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/season/${encodeURIComponent(card.id)}`)}
      className="relative overflow-hidden w-full text-left"
      style={{
        height,
        borderRadius: 14,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: `linear-gradient(135deg, ${start}, ${end})`,
      }}
    >
      {badge}
      <div className="absolute" style={{ bottom: 12, left: 14, right: 14 }}>
        <p
          className="m-0"
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            color: 'white',
            marginBottom: 4,
            textShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        >
          {card.title}
        </p>
        {status === 'peak' ? (
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: 5,
                height: 5,
                background: KEY,
                borderRadius: '50%',
                boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.5)',
              }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}>
              실시간 {card.live_count || 0}장
              {card.primary_place ? ` · ${card.primary_place} 외` : ''}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}>
            {card.primary_place ? `${card.primary_place} · ` : ''}
            {card.period_label}
          </span>
        )}
      </div>
    </button>
  );
}

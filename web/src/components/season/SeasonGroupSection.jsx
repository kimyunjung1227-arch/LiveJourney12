import React from 'react';
import { IconClockHour3, IconCalendarPlus } from '@tabler/icons-react';
import SeasonCard from './SeasonCard';

const META = {
  peak: { label: '지금 절정', color: '#1A6EA8' },
  soon: { label: '곧 시작', color: '#1F1F1F', Icon: IconClockHour3, iconColor: '#4DB8E8' },
  upcoming: { label: '예정', color: '#6B6B6B', Icon: IconCalendarPlus, iconColor: '#6B6B6B' },
};

export default function SeasonGroupSection({ status, cards }) {
  if (!cards || cards.length === 0) return null;
  const meta = META[status];

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 14 }}>
        {status === 'peak' ? (
          <div
            style={{
              width: 6,
              height: 6,
              background: '#4DB8E8',
              borderRadius: '50%',
              boxShadow: '0 0 0 3px rgba(77, 184, 232, 0.25)',
            }}
          />
        ) : (
          meta.Icon && <meta.Icon size={15} color={meta.iconColor} />
        )}
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>
          {meta.label}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <SeasonCard key={card.id} card={card} status={status} />
        ))}
      </div>
    </div>
  );
}

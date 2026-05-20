import React from 'react';
import { IconChevronRight } from '@tabler/icons-react';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const DIVIDER = '#F5F7FA';
const DANGER = '#E05555';

export default function SettingsRow({
  icon: Icon,
  label,
  subtitle,
  value,
  showArrow = true,
  iconColor = TEXT_SECONDARY,
  danger = false,
  isLast = false,
  onClick,
}) {
  const labelColor = danger ? DANGER : TEXT_PRIMARY;
  const iconStrokeColor = danger ? DANGER : iconColor;
  const interactive = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className="flex items-center"
      style={{
        gap: 12,
        padding: '14px 18px',
        cursor: interactive ? 'pointer' : 'default',
        borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`,
      }}
    >
      {Icon && <Icon size={19} color={iconStrokeColor} stroke={1.8} />}
      <div className="flex-1 min-w-0">
        <p className="m-0" style={{ fontSize: 14, color: labelColor }}>
          {label}
        </p>
        {subtitle && (
          <p
            className="m-0"
            style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {value ? (
        <span style={{ fontSize: 13, color: TEXT_TERTIARY }}>{value}</span>
      ) : showArrow && !danger ? (
        <IconChevronRight size={17} color={TEXT_TERTIARY} />
      ) : null}
    </div>
  );
}

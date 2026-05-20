import React from 'react';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const DIVIDER = '#F5F7FA';
const TOGGLE_OFF = '#E8E8E8';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

const ICON_BG_STYLE = {
  gradient: { background: GRADIENT },
  key: { background: KEY },
  gray: { background: '#B8B8B8' },
};

export default function SettingsToggleRow({
  icon: Icon,
  iconBg = 'key',
  label,
  subtitle,
  value,
  onToggle,
  isLast = false,
}) {
  const bgStyle = ICON_BG_STYLE[iconBg] || ICON_BG_STYLE.key;

  return (
    <div
      className="flex items-center"
      style={{
        gap: 12,
        padding: '14px 18px',
        borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}`,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          ...bgStyle,
        }}
      >
        {Icon && <Icon size={16} color="white" stroke={2} />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="m-0" style={{ fontSize: 14, color: TEXT_PRIMARY, marginBottom: 1 }}>
          {label}
        </p>
        {subtitle && (
          <p className="m-0" style={{ fontSize: 11, color: TEXT_SECONDARY }}>
            {subtitle}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggle(!value)}
        aria-pressed={!!value}
        className="relative flex-shrink-0"
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: value ? KEY : TOGGLE_OFF,
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div
          className="absolute bg-white"
          style={{
            top: 2,
            left: value ? 20 : 2,
            width: 22,
            height: 22,
            borderRadius: 999,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  );
}

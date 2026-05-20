import React from 'react';

const TEXT_SECONDARY = '#6B6B6B';

export default function SettingsGroup({ label, children, style }) {
  return (
    <div style={{ marginBottom: 10, ...(style || {}) }}>
      {label && (
        <p
          className="m-0"
          style={{
            fontSize: 11,
            color: TEXT_SECONDARY,
            fontWeight: 600,
            marginBottom: 8,
            marginLeft: 20,
            marginTop: 8,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </p>
      )}
      <div style={{ background: '#fff' }}>{children}</div>
    </div>
  );
}

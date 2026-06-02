import React from 'react';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';

/**
 * 프로필 세로 섹션 제목.
 *
 * @param {object} props
 * @param {string} props.title 섹션 제목
 * @param {string} [props.subtitle] 보조 설명(한 줄)
 */
export default function ProfileSectionHeading({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="m-0" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>
        {title}
      </p>
      {subtitle && (
        <p className="m-0" style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

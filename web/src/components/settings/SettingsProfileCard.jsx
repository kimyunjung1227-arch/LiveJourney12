import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCrown } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#E8E8E8';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

export default function SettingsProfileCard({ profile }) {
  const navigate = useNavigate();
  if (!profile) return null;
  const initial = String(profile.name || '?').trim().charAt(0).toUpperCase() || '·';
  const avatarUrl = profile.avatar_url ? getDisplayImageUrl(profile.avatar_url) : '';

  return (
    <div
      className="flex items-center"
      style={{
        background: '#fff',
        padding: '18px',
        gap: 14,
        marginBottom: 10,
      }}
    >
      <div
        className="relative flex items-center justify-center flex-shrink-0 overflow-hidden text-white font-bold"
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: profile.avatar_color || KEY,
          fontSize: 22,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
        {profile.is_best_cut_artist && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              right: -2,
              bottom: -2,
              width: 20,
              height: 20,
              borderRadius: 999,
              background: GRADIENT,
              border: '2px solid white',
            }}
          >
            <IconCrown size={10} color="white" stroke={2.2} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="m-0 truncate"
          style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 2 }}
        >
          {profile.name}
        </p>
        <p
          className="m-0 truncate"
          style={{ fontSize: 12, color: TEXT_SECONDARY }}
        >
          @{profile.handle || ''}
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate('/profile/edit')}
        className="flex-shrink-0"
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER_LIGHT}`,
          padding: '8px 14px',
          borderRadius: 9,
          fontSize: 12,
          fontWeight: 600,
          color: TEXT_PRIMARY,
          cursor: 'pointer',
        }}
      >
        프로필 편집
      </button>
    </div>
  );
}

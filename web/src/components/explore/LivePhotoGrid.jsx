import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPhoto, IconShieldCheck } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#E8E8E8';

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '방금';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

export default function LivePhotoGrid({ photos, total }) {
  const navigate = useNavigate();
  const list = Array.isArray(photos) ? photos : [];
  const safeTotal = Number.isFinite(total) ? total : list.length;
  const visible = list.slice(0, 6);
  const extra = Math.max(0, safeTotal - 6);
  const showOverlayOnLast = visible.length === 6 && extra > 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-1.5">
          <IconPhoto size={16} color={KEY} />
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            실시간 사진
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div
            style={{
              width: 5,
              height: 5,
              background: KEY,
              borderRadius: 999,
              boxShadow: '0 0 0 2px rgba(77, 184, 232, 0.3)',
            }}
          />
          <span style={{ fontSize: 10, color: KEY_DARK, fontWeight: 600 }}>
            방금 업데이트
          </span>
        </div>
      </div>

      {list.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{
            padding: '32px 16px',
            borderRadius: 11,
            background: SURFACE,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            아직 실시간 사진이 없어요
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {visible.map((photo, idx) => {
            const isLast = idx === 5;
            const overlay = isLast && showOverlayOnLast;
            const url = photo.thumbnail_url ? getDisplayImageUrl(photo.thumbnail_url) : '';
            return (
              <button
                key={photo.post_id}
                type="button"
                onClick={() => navigate(`/post/${encodeURIComponent(photo.post_id)}`)}
                className="relative overflow-hidden"
                style={{
                  aspectRatio: '4 / 5',
                  borderRadius: 12,
                  background: SURFACE,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {url && (
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                )}
                <div
                  className="absolute flex items-center gap-1"
                  style={{
                    top: 7,
                    left: 7,
                    padding: '3px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                  }}
                >
                  <IconShieldCheck size={11} color={KEY} stroke={2.4} />
                  <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>
                    {timeAgo(photo.exif_taken_at) || '방금'}
                  </span>
                </div>
                {overlay && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.4)' }}
                  >
                    <span style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>
                      +{extra}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

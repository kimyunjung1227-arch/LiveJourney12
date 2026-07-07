import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCrown } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';
import { useHorizontalDragScroll } from '../../hooks/useHorizontalDragScroll';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

/**
 * 베스트 컷 가로 캐러셀.
 */
export default function BestCutCarousel({ bestCuts }) {
  const navigate = useNavigate();
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();
  const list = Array.isArray(bestCuts) ? bestCuts : [];

  if (list.length === 0) return null;

  const guardedClick = (handler) => (e) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler();
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="flex items-center gap-1.5" style={{ padding: '0 18px', marginBottom: 12 }}>
        <IconCrown size={15} color={KEY} stroke={2} />
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          베스트 컷 · {list.length}개
        </p>
      </div>

      <div
        onMouseDown={handleDragStart}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        style={{
          padding: '0 18px 4px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {list.map((cut) => {
          const url = cut.thumbnail_url ? getDisplayImageUrl(cut.thumbnail_url) : '';
          return (
            <button
              key={cut.post_id}
              type="button"
              onClick={guardedClick(() => navigate(`/post/${encodeURIComponent(cut.post_id)}`))}
              className="flex-shrink-0 overflow-hidden text-left"
              style={{
                width: 120,
                height: 150,
                borderRadius: 11,
                border: `1.5px solid ${KEY}`,
                background: '#F5F7FA',
                padding: 0,
                cursor: 'pointer',
                position: 'relative',
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
              {/* 베스트 뱃지 */}
              <div
                className="absolute flex items-center gap-1"
                style={{
                  top: 6,
                  right: 6,
                  padding: '3px 7px',
                  borderRadius: 6,
                  background: GRADIENT,
                }}
              >
                <IconCrown size={9} color="white" stroke={2} />
                <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>베스트</span>
              </div>
              {/* 하단 그라데이션 + 장소명 + 도움 */}
              <div
                className="absolute left-0 right-0 bottom-0"
                style={{
                  padding: '14px 8px 8px',
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
                }}
              >
                {cut.place_name && (
                  <p
                    className="m-0 truncate"
                    style={{ fontSize: 11, color: 'white', fontWeight: 600 }}
                  >
                    {cut.place_name}
                  </p>
                )}
                <p
                  className="m-0"
                  style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}
                >
                  도움 {cut.helped_count || 0}명
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

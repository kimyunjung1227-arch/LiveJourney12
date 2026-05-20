import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconFlame, IconChevronRight } from '@tabler/icons-react';
import { getDisplayImageUrl } from '../../api/upload';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';
const BORDER_LIGHT = '#E8E8E8';
const HOT_BG = '#FFE8E8';
const HOT_TEXT = '#E05555';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

/**
 * 핫플 순위 리스트 (공통). 도시 페이지는 is_hot 뱃지, 카테고리 페이지는 도시 표시.
 */
export default function HotPlaceList({ title, places, onSeeAll, showCity = false }) {
  const navigate = useNavigate();
  const list = Array.isArray(places) ? places : [];

  if (list.length === 0) {
    return (
      <div style={{ marginBottom: 24 }}>
        <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
          <IconFlame size={16} color={KEY} />
          <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
            {title}
          </p>
        </div>
        <div
          className="flex items-center justify-center"
          style={{
            padding: '20px 16px',
            borderRadius: 11,
            background: SURFACE,
            border: `1px dashed ${BORDER_LIGHT}`,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            아직 라이브 중인 장소가 없어요
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 12 }}>
        <IconFlame size={16} color={KEY} />
        <p className="m-0" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>
          {title}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {list.slice(0, 5).map((place, idx) => {
          const rank = idx + 1;
          const isFirst = rank === 1;
          const thumb = place.thumbnail_url ? getDisplayImageUrl(place.thumbnail_url) : '';
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => navigate(`/place/${encodeURIComponent(place.id)}`)}
              className="flex items-center gap-3 w-full text-left"
              style={{
                background: SURFACE,
                borderRadius: 10,
                padding: 10,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div className="relative flex-shrink-0" style={{ width: 48, height: 48 }}>
                <div
                  className="overflow-hidden"
                  style={{ width: 48, height: 48, borderRadius: 9, background: BORDER_LIGHT }}
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    top: -4,
                    left: -4,
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: isFirst ? GRADIENT : '#1F1F1F',
                    border: '2px solid white',
                  }}
                >
                  <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>
                    {rank}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5" style={{ marginBottom: 2 }}>
                  <p
                    className="m-0 truncate"
                    style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}
                  >
                    {place.name}
                  </p>
                  {place.is_hot && (
                    <span
                      style={{
                        background: HOT_BG,
                        color: HOT_TEXT,
                        fontSize: 8,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      HOT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
                  <span style={{ color: TEXT_SECONDARY }}>
                    {showCity
                      ? [place.city, place.district].filter(Boolean).join(' ')
                      : place.district || ''}
                  </span>
                  {(showCity ? place.city : place.district) && (
                    <span style={{ color: TEXT_TERTIARY }}>·</span>
                  )}
                  <span style={{ color: KEY_DARK, fontWeight: 600 }}>
                    {place.live_count || 0}장 라이브
                  </span>
                </div>
              </div>

              <IconChevronRight size={16} color={TEXT_TERTIARY} className="flex-shrink-0" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={onSeeAll}
          className="w-full"
          style={{
            padding: '10px 0',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 500,
            color: TEXT_SECONDARY,
            background: 'white',
            border: `1px solid ${BORDER_LIGHT}`,
            cursor: 'pointer',
          }}
        >
          {title} 전체 보기
        </button>
      </div>
    </div>
  );
}

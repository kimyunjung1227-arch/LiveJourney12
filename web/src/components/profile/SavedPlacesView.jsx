import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBookmarkFilled, IconMapPin, IconChevronRight } from '@tabler/icons-react';
import { useSavedPlaces } from '../../hooks/useSavedPlaces';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';
const BG_SURFACE = '#F5F7FA';

/**
 * 프로필 "저장한 장소" 탭.
 * 장소 페이지(/place/:placeId)의 북마크로 저장한 interest_places 목록.
 */
export default function SavedPlacesView({ userId }) {
  const navigate = useNavigate();
  const { places, loading, remove } = useSavedPlaces(userId);

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: TEXT_SECONDARY, fontSize: 13 }}>
        불러오는 중...
      </div>
    );
  }

  if (!places || places.length === 0) {
    return (
      <div
        style={{
          padding: '48px 16px',
          textAlign: 'center',
          color: TEXT_SECONDARY,
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, color: TEXT_PRIMARY, fontSize: 15 }}>저장한 장소가 없어요</p>
        <p style={{ marginTop: 8 }}>
          장소 페이지의 북마크 버튼을 누르면
          <br />
          여기에 모아볼 수 있어요.
        </p>
      </div>
    );
  }

  const goPlace = (placeId, name) => {
    const key = placeId || name;
    if (!key) return;
    navigate(`/place/${encodeURIComponent(key)}`);
  };

  return (
    <div style={{ paddingBottom: 8 }}>
      {places.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 0',
            borderBottom: `1px solid ${BORDER_LIGHT}`,
          }}
        >
          <button
            type="button"
            onClick={() => goPlace(p.placeId, p.name)}
            aria-label={`${p.name} 장소 보기`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flex: 1,
              minWidth: 0,
              padding: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: 12,
                overflow: 'hidden',
                background: BG_SURFACE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {p.photoUrl ? (
                <img
                  src={p.photoUrl}
                  alt={p.name}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <IconMapPin size={22} color={TEXT_SECONDARY} stroke={1.6} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.region ? `${p.region} · ` : ''}
                {p.postsCount > 0 ? `사진 ${p.postsCount}장` : '아직 사진 없음'}
              </div>
            </div>
            <IconChevronRight size={18} color={BORDER_LIGHT} stroke={2} />
          </button>

          <button
            type="button"
            onClick={() => remove(p.name)}
            aria-label="저장 해제"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              padding: 0,
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: KEY,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconBookmarkFilled size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}

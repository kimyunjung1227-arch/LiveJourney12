import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconArrowLeft,
  IconMapPin,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useKakaoPlaceSearch } from '../hooks/useKakaoPlaceSearch';

const KEY = '#4DB8E8';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const SURFACE = '#F5F7FA';

const PlaceSearchScreen = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { results, loading, search } = useKakaoPlaceSearch();

  const handleSelect = (place) => {
    navigate('/question/new', { state: { selectedPlace: place } });
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    search(v);
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: TEXT_PRIMARY }}>
      <div
        className="flex items-center gap-2.5 sticky top-0 bg-white z-20"
        style={{ padding: '14px 18px 12px', borderBottom: '1px solid #F0F0F0' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer' }}
        >
          <IconArrowLeft size={18} color={TEXT_PRIMARY} />
        </button>
        <div
          className="flex-1 flex items-center gap-2.5"
          style={{
            background: SURFACE,
            borderRadius: 11,
            padding: '10px 14px',
          }}
        >
          <IconSearch size={17} color={TEXT_SECONDARY} />
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="장소 검색 (카카오)"
            autoFocus
            className="flex-1 bg-transparent outline-none"
            style={{
              fontSize: 13,
              color: TEXT_PRIMARY,
              fontWeight: 500,
              border: 'none',
              padding: 0,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                search('');
              }}
              aria-label="검색어 지우기"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <IconX size={16} color={TEXT_SECONDARY} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 0' }}>
        {query.trim().length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              padding: '60px 24px',
              color: TEXT_SECONDARY,
            }}
          >
            <IconMapPin size={28} color={TEXT_TERTIARY} style={{ marginBottom: 10 }} />
            <p className="m-0" style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 4 }}>
              질문할 장소를 검색해보세요
            </p>
            <p className="m-0" style={{ fontSize: 11, color: TEXT_TERTIARY }}>
              카카오 장소 검색으로 어디든 추가할 수 있어요
            </p>
          </div>
        ) : loading ? (
          <div
            className="text-center"
            style={{ padding: '24px 0', fontSize: 12, color: TEXT_SECONDARY }}
          >
            검색 중...
          </div>
        ) : results.length === 0 ? (
          <div
            className="text-center"
            style={{ padding: '40px 18px', fontSize: 13, color: TEXT_SECONDARY }}
          >
            &apos;{query}&apos;에 대한 장소를 찾지 못했어요
          </div>
        ) : (
          <ul className="m-0" style={{ listStyle: 'none', padding: 0 }}>
            {results.map((place) => (
              <li key={place.kakao_id}>
                <button
                  type="button"
                  onClick={() => handleSelect(place)}
                  className="flex items-center gap-3 w-full text-left"
                  style={{
                    background: 'white',
                    border: 'none',
                    padding: '12px 18px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 38,
                      height: 38,
                      background: SURFACE,
                      borderRadius: 9,
                    }}
                  >
                    <IconMapPin size={18} color={KEY} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="m-0 truncate"
                      style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 2 }}
                    >
                      {place.name}
                    </p>
                    <p
                      className="m-0 truncate"
                      style={{ fontSize: 10, color: TEXT_SECONDARY }}
                    >
                      {place.address || [place.city, place.district].filter(Boolean).join(' ')}
                      {place.category ? ` · ${place.category}` : ''}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PlaceSearchScreen;

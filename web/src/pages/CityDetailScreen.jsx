import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconFlower,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconMoon,
  IconBuildingStore,
} from '@tabler/icons-react';
import { useCityDetail } from '../hooks/useCityDetail';
import CityHero from '../components/explore/CityHero';
import FilterChips from '../components/explore/FilterChips';
import LivePhotoGrid from '../components/explore/LivePhotoGrid';
import QuestionPreview from '../components/explore/QuestionPreview';

const CATEGORY_CHIPS = [
  { id: 'all', label: '전체' },
  { id: 'nature', label: '개화·자연', icon: IconFlower },
  { id: 'weather', label: '날씨·체감', icon: IconCloud },
  { id: 'event', label: '이벤트·축제', icon: IconCalendarEvent },
  { id: 'crowd', label: '혼잡도·대기', icon: IconUsers },
  { id: 'sunset', label: '노을·야경', icon: IconMoon },
  { id: 'business', label: '영업·운영', icon: IconBuildingStore },
];

const TEXT_SECONDARY = '#6B6B6B';

function CityDetailScreen() {
  const params = useParams();
  const navigate = useNavigate();
  const cityName = decodeURIComponent(params.cityName || params.regionName || '');
  const [category, setCategory] = useState('all');
  const { data, loading } = useCityDetail(cityName, category === 'all' ? null : category);

  // 첫 로딩이거나 데이터가 아직 없을 때만 풀스크린 안내. 칩으로 재조회될 때는 기존 데이터를 그대로 보여 깜빡임 방지.
  if (loading && !data) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh' }} className="text-center p-[18px]">
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>불러오는 중...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh' }} className="text-center p-[18px]">
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          지역 정보를 불러오지 못했어요
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <CityHero
        cityName={data.city?.name || cityName}
        liveCount={data.city?.live_count || 0}
      />
      <FilterChips chips={CATEGORY_CHIPS} selected={category} onChange={setCategory} />

      <div style={{ padding: '0 18px 24px' }}>
        <LivePhotoGrid photos={data.photos || []} total={data.photos_total || 0} />
        <QuestionPreview
          title={`${cityName} 질문`}
          questions={data.questions || []}
          onSeeAll={() =>
            navigate(`/ask-situation?city=${encodeURIComponent(cityName)}`)
          }
        />
      </div>
    </div>
  );
}

export default CityDetailScreen;

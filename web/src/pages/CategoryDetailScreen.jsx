import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategoryDetail } from '../hooks/useCategoryDetail';
import CategoryHeader from '../components/explore/CategoryHeader';
import ActivityModule from '../components/explore/ActivityModule';
import FilterChips from '../components/explore/FilterChips';
import LivePhotoGrid from '../components/explore/LivePhotoGrid';
import QuestionPreview from '../components/explore/QuestionPreview';

const CITY_CHIPS = [
  { id: 'all', label: '전국' },
  { id: '서울', label: '서울' },
  { id: '부산', label: '부산' },
  { id: '제주', label: '제주' },
  { id: '강릉', label: '강릉' },
  { id: '경주', label: '경주' },
  { id: '전주', label: '전주' },
  { id: '대구', label: '대구' },
  { id: '인천', label: '인천' },
  { id: '구미', label: '구미' },
  { id: '여수', label: '여수' },
];

const CATEGORY_LABEL = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

const TEXT_SECONDARY = '#6B6B6B';

function CategoryDetailScreen() {
  const params = useParams();
  const navigate = useNavigate();
  const categoryId = params.categoryId || params.tagId || '';
  const [city, setCity] = useState('all');
  const { data, loading } = useCategoryDetail(categoryId, city === 'all' ? null : city);

  const label = CATEGORY_LABEL[categoryId] || categoryId;

  if (loading) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        <CategoryHeader category={categoryId} />
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh' }}>
        <CategoryHeader category={categoryId} />
        <div className="text-center" style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}>
          카테고리 정보를 불러오지 못했어요
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <CategoryHeader category={categoryId} />
      <ActivityModule
        category={categoryId}
        activity={data.activity || { recent_hour: 0, today: 0, level: 'quiet' }}
      />
      <FilterChips chips={CITY_CHIPS} selected={city} onChange={setCity} />

      <div style={{ padding: '0 18px 24px' }}>
        <LivePhotoGrid photos={data.photos || []} total={data.photos_total || 0} />
        <QuestionPreview
          title={`${label} 질문`}
          questions={data.questions || []}
          onSeeAll={() =>
            navigate(`/ask-situation?category=${encodeURIComponent(categoryId)}`)
          }
        />
      </div>
    </div>
  );
}

export default CategoryDetailScreen;

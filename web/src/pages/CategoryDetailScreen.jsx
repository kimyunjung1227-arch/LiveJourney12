import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCategoryDetail } from '../hooks/useCategoryDetail';
import CategoryHeader from '../components/explore/CategoryHeader';
import ActivityModule from '../components/explore/ActivityModule';
import FilterChips from '../components/explore/FilterChips';
import LivePhotoGrid from '../components/explore/LivePhotoGrid';
import QuestionPreview from '../components/explore/QuestionPreview';

const ALL_CHIP = { id: 'all', label: '전국' };

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
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = params.categoryId || params.tagId || '';

  // ?city= 쿼리로 도시 칩 초기값을 결정 (도시 페이지에서 카테고리 칩 누르고 왔을 때 그 도시를 유지)
  const initialCity = searchParams.get('city') || 'all';
  const [city, setCity] = useState(initialCity);

  // 카테고리(URL) 또는 ?city=가 외부에서 바뀌면 동기화
  useEffect(() => {
    setCity(initialCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // 도시 칩 변경 → URL ?city= 동기화 (전국이면 쿼리 제거)
  const handleCityChange = (nextCity) => {
    setCity(nextCity);
    const next = new URLSearchParams(searchParams);
    if (nextCity === 'all') next.delete('city');
    else next.set('city', nextCity);
    setSearchParams(next, { replace: true });
  };

  const { data, loading } = useCategoryDetail(categoryId, city === 'all' ? null : city);

  const label = CATEGORY_LABEL[categoryId] || categoryId;

  // 사진이 실제로 올라온 도시만 칩으로 노출. '전국'은 항상 맨 앞.
  const cityChips = useMemo(() => {
    const list = Array.isArray(data?.cities) ? data.cities : [];
    const dynamic = list
      .filter((c) => c && c.city)
      .map((c) => ({ id: c.city, label: `${c.city} ${c.count}` }));
    // 현재 선택된 도시가 동적 목록에 없으면(데이터가 사라졌어도 칩은 유지) 보존
    if (city !== 'all' && !dynamic.some((d) => d.id === city)) {
      dynamic.push({ id: city, label: city });
    }
    return [ALL_CHIP, ...dynamic];
  }, [data?.cities, city]);

  // 첫 로딩에만 풀스크린. 도시 칩 재조회 시에는 기존 데이터를 그대로 두어 깜빡임 방지.
  if (loading && !data) {
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
      <FilterChips chips={cityChips} selected={city} onChange={handleCityChange} />

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

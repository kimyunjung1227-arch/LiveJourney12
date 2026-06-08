import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCategoryDetail } from '../hooks/useCategoryDetail';
import CategoryHeader from '../components/explore/CategoryHeader';
import LivePhotoGrid from '../components/explore/LivePhotoGrid';
import QuestionPreview from '../components/explore/QuestionPreview';

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

  // 지역 필터 제거 — 카테고리 전체를 그대로 노출.
  const { data, loading } = useCategoryDetail(categoryId, null);

  const label = CATEGORY_LABEL[categoryId] || categoryId;

  // 첫 로딩에만 풀스크린.
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

      <div style={{ padding: '18px 18px 24px' }}>
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

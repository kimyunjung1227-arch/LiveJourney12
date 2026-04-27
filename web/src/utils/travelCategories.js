/** AI 분석 결과 → 카테고리 슬러그 배열 */
export function slugsFromAnalysisResult(result) {
  if (!result) return ['scenic'];
  if (Array.isArray(result.categories) && result.categories.length > 0) {
    const s = result.categories.map((c) => c.category).filter(Boolean);
    return [...new Set(s.length ? s : ['scenic'])];
  }
  if (result.category) return [result.category];
  return ['scenic'];
}

/** 여행 게시물 카테고리 슬러그 → 표시명 (웹·백엔드 표기 통일) */
export const TRAVEL_CATEGORY_META = {
  bloom: { name: '개화정보', icon: '🌸' },
  scenic: { name: '추천장소', icon: '🏞️' },
  food: { name: '맛집정보', icon: '🍜' },
  waiting: { name: '웨이팅', icon: '⏱️' },
  landmark: { name: '명소', icon: '🏛️' },
  general: { name: '일반', icon: '📌' },
  safety: { name: '안전·주의', icon: '⚠️' }
};

/**
 * 게시물에서 카테고리 칩 목록 (다중 categories 우선, 없으면 단일 categoryName)
 */
export function getCategoryChipsFromPost(post) {
  if (Array.isArray(post?.categories) && post.categories.length > 0) {
    return post.categories.map((slug) => {
      const m = TRAVEL_CATEGORY_META[slug];
      return {
        slug,
        name: m?.name || slug,
        icon: m?.icon || ''
      };
    });
  }
  if (post?.categoryName) {
    return [
      {
        slug: post.category || 'general',
        name: post.categoryName,
        icon: post.categoryIcon || ''
      }
    ];
  }
  return [];
}

const normTag = (t) => String(t || '').replace(/^#+/, '').trim().toLowerCase();

/** 위험/주의 · 안전 뱃지용 (post_category safety 또는 키워드) */
export const isTripSafetyPost = (post) => {
  if (!post || typeof post !== 'object') return false;
  if (post?.postCategory === 'safety' || post?.category === 'safety') return true;
  if (Array.isArray(post?.categories) && post.categories.map(String).some((c) => c === 'safety')) return true;
  const tagStr = Array.isArray(post?.tags) ? post.tags.join(' ') : String(post?.tags || '');
  const block = `${tagStr} ${post?.categoryName || ''} ${post?.note || ''} ${post?.content || ''} ${post?.placeName || ''} ${post?.region || ''}`.toLowerCase();
  if (block.includes('안전·주의') || block.includes('안전주의')) return true;
  return ['#위험', '주의', '결빙', '폭우', '폭설', '인파', '밀집', '북적', '미끄', '빙판', '강풍', '낙석'].some(
    (w) => block.includes(w)
  );
};

/** 실시간 Q&A(랜선 길잡이) — 태그·플래그 기준 (서버 is_question 대비) */
export const isLiveQuestionPost = (post) => {
  if (!post) return false;
  if (post.isQuestion === true || post.is_question === true) return true;
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  if (tags.some((t) => {
    const n = normTag(t);
    return n === '질문' || n === 'qna' || n === 'liveq' || n === '라이브질문';
  })) return true;
  const c = String(post?.categoryName || post?.category || '');
  if (c.includes('질문') || c.includes('Q&A')) return true;
  return false;
};

/**
 * 추천 여행지 엔진
 * 고객들이 올린 데이터를 분석하여 추천 여행지를 생성합니다.
 * - "시간"과 "태그" 중심으로 실시간성을 최대한 반영합니다.
 */

import {
  filterRecentPosts,
  getTimeAgo,
  getPostAgeInHours,
  isPostLive,
  getRecommendationTransparencyLabel,
} from './timeUtils';

/**
 * (구) 지역 추천 → (신) 분위기/장소 추천으로 확장
 * - 호출부 호환을 위해 반환 객체 키는 기존(`regionName`, `title`)을 유지합니다.
 * - 내부 집계 단위는 "장소(placeKey)"를 우선으로 사용합니다.
 */
const normalizeText = (v) =>
  String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getPostTextBlob = (post) => {
  const tags = Array.isArray(post?.tags) ? post.tags : [];
  const aiLabels = Array.isArray(post?.aiLabels) ? post.aiLabels : [];
  const aiCats = Array.isArray(post?.aiCategories) ? post.aiCategories : [];
  const parts = [
    post?.note,
    post?.content,
    post?.location,
    post?.placeName,
    post?.detailedLocation,
    post?.categoryName,
    post?.aiCategoryName,
    post?.category,
    post?.aiCategory,
    ...aiCats,
    ...tags.map((t) => (typeof t === 'string' ? t : (t?.name || t?.label || ''))),
    ...aiLabels.map((l) => (typeof l === 'string' ? l : (l?.name || l?.label || ''))),
  ].filter(Boolean);
  return normalizeText(parts.join(' ')).replace(/#+/g, '');
};

/**
 * 추천 카드의 "장소 단위" 키 추출 (가능하면 placeName/상세명 우선)
 * - 예: "여의도 윤중로" 그대로 유지
 * - 예: "서울 여의도 윤중로" -> "여의도 윤중로" (광역 토큰 제거)
 */
const getPlaceKey = (post) => {
  const raw =
    post?.placeName ||
    post?.detailedLocation ||
    (typeof post?.location === 'string' ? post.location : (post?.location?.name || '')) ||
    post?.address ||
    '';
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '기록';

  // 광역/행정 접두 제거 (서울특별시/경기도/강원도 등) 후 나머지를 장소로
  const tokens = text.split(' ').filter(Boolean);
  if (tokens.length >= 3) {
    const t0 = tokens[0];
    const looksProvince =
      /(특별자치도|특별자치시|특별시|광역시|도)$/.test(t0) ||
      ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'].includes(t0);
    if (looksProvince) {
      return tokens.slice(1).join(' ');
    }
  }
  return text;
};

const hasCategory = (post, slug) =>
  post?.category === slug ||
  post?.aiCategory === slug ||
  (Array.isArray(post?.categories) && post.categories.includes(slug)) ||
  (Array.isArray(post?.aiCategories) && post.aiCategories.includes(slug));

const pickRepresentativeImage = (posts) => {
  const list = Array.isArray(posts) ? posts : [];
  const withImage = list
    .filter((p) => p?.images?.[0] || p?.thumbnail || p?.image)
    .slice()
    .sort((a, b) => {
      const timeA = a?.timestamp || a?.createdAt || a?.time || 0;
      const timeB = b?.timestamp || b?.createdAt || b?.time || 0;
      return timeB - timeA;
    });
  const first = withImage[0];
  if (!first) return null;
  const raw = first.images?.[0] ?? first.thumbnail ?? first.image;
  return typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null);
};

const matchesAny = (text, keywords) => {
  if (!text) return false;
  const t = normalizeText(text);
  return (keywords || []).some((kw) => t.includes(normalizeText(kw)));
};

// 테마 자체가 태그로 노출되는 것은 제거하고,
// 사용자 입력/AI 태그(테마 외) → 신호 태그 → 테마로 매핑합니다.
const THEME_TAG_BLOCKLIST = new Set([
  '지금이절정',
  '한적한아지트',
  '딥씨블루',
  '힙활기',
  '안심나들이',
].map((t) => normalizeText(t)));

const getPostSignalTokens = (post) => {
  const tags = [
    ...(Array.isArray(post?.tags) ? post.tags : []),
    ...(Array.isArray(post?.aiLabels) ? post.aiLabels : []),
  ]
    .map((x) => (typeof x === 'string' ? x : (x?.name || x?.label || '')))
    .filter(Boolean)
    .map((s) => normalizeText(String(s).replace(/^#+/, '')));

  return tags.filter((t) => t && !THEME_TAG_BLOCKLIST.has(t));
};

const THEME_SIGNALS = {
  season_peak: ['만개', '개화', '벚꽃', '단풍', '설경', '절정', '윤슬', '일출', '일몰', '풍경', '전망', '경치'],
  silent_healing: ['한적', '조용', '여유', '고즈넉', '힐링', '산책', '쉼', '쉼표', '책', '웨이팅없', '줄없'],
  deep_sea_blue: ['바다', '해변', '파도', '윤슬', '물멍', '에메랄드', '푸른', '파란', '청량', '맑은하늘'],
  lively_vibe: ['힙', '핫플', '북적', '활기', '인생샷', '축제', '공연', '버스킹', '팝업', '웨이팅', '대기'],
  night_good: ['밤', '야경', '야시장', '야간', '조명', '라이트', '빛', '불빛', '노을', '일몰', '밤바다', '루프탑'],
};

const inferThemeScoreForPost = (post) => {
  const text = getPostTextBlob(post);
  const tokens = getPostSignalTokens(post);
  const blob = `${text} ${tokens.join(' ')}`;

  const scoreBy = {};
  Object.keys(THEME_SIGNALS).forEach((themeId) => {
    const signals = THEME_SIGNALS[themeId] || [];
    let s = 0;
    signals.forEach((kw) => {
      const k = normalizeText(kw);
      if (!k) return;
      if (blob.includes(k)) s += 1;
    });
    // 카테고리 가중치 (기본 데이터 품질 보정)
    if (themeId === 'season_peak' && (hasCategory(post, 'bloom') || hasCategory(post, 'scenic') || hasCategory(post, 'landmark'))) s += 1;
    if (themeId === 'deep_sea_blue' && hasCategory(post, 'scenic')) s += 0.5;
    scoreBy[themeId] = s;
  });
  return scoreBy;
};

const KEYWORDS = {
  seasonPeak: [
    '만개', '만개함', '개화', '꽃피', '벚꽃', '매화', '유채', '수국', '코스모스', '철쭉', '튤립',
    '단풍', '절정', '눈', '설경', '눈이', '함박눈',
    '풍경', '뷰', '전망', '경치', '윤슬', '일출', '일몰',
  ],
  silentHealing: [
    '한적', '조용', '여유', '고즈넉', '힐링', '아지트', '산책', '쉼', '쉼표', '책읽',
    '웨이팅없', '대기없', '줄없',
  ],
  deepSeaBlue: [
    '바다', '해변', '해수욕장', '파도', '해안', '포구', '항구', '서핑',
    '물멍', '윤슬', '탁트', '시원', '푸른바다', '푸른', '파란', '청량', '맑음', '맑은',
  ],
  livelyVibe: [
    '활기', '힙', '핫플', '북적', '인생샷', '감성', '축제', '사람많', '분위기최고', '재밌',
    '음악', '공연', '클럽', '야시장',
  ],
};

const COASTAL_HINT_REGIONS = new Set(['부산', '제주', '강릉', '속초', '여수', '인천', '울산', '포항', '통영', '거제']);

/**
 * LiveJourney 테마 태그 풀 (10개 테마, 100개+ 후보 중)
 * - 추천 카드 태그는 반드시 이 풀에서만 선택합니다.
 * - 실제 선택은 장소별 게시물(사용자 입력/AI 분석 태그/내용) 신호 기반으로 스코어링합니다.
 */
const LIVEJOURNEY_TAG_POOL = {
  nature_bloom: [
    '실시간 개화', '꽃비 내림', '50% 개화', '단풍 절정', '낙엽 시작',
    '설경 예쁨', '윤슬 맛집', '초록초록함', '억새 물결', '몽글몽글 구름', '안개 자욱',
  ],
  crowd_wait: [
    '지금 한적함', '적당한 활기', '북적북적', '웨이팅 없음', '줄 서기 시작',
    '오픈런 필수', '입장 마감', '예약 권장', '30분 대기', '단체 몰림',
  ],
  trust_verify: [
    '방금 올라옴', '무보정 원본', '현장 인증', '트래커 추천', '실시간 날씨',
    '정보 수정됨', '실제와 같음', '팩트체크 완료', '직접 찍음', '필터 없음',
  ],
  parking_transport: [
    '주차장 널널', '주차장 만차', '초보운전 가능', '갓길 주차', '셔틀 운행',
    '뚜벅이 가능', '오르막 주의', '비포장도로', '유료 주차', '무료 주차',
  ],
  mood_space: [
    '고즈넉한', '힙한 감성', '레트로 무드', '조용한 사색', '이국적인',
    '활기 넘치는', '야경 맛집', '노을 스팟', '웅장한', '아기자기한',
  ],
  companion_target: [
    '아이와 함께', '반려동물 동반', '부모님 만족', '연인과 데이트', '프로 혼밥러',
    '우정 여행', '비즈니스 미팅', '대가족 가능', '사진가 성지', '노키즈존',
  ],
  facility_convenience: [
    '유모차 가능', '휠체어 접근', '화장실 깨끗', '콘센트 많음', '노트북 환영',
    '야외 좌석', '테라스 있음', '에어컨 빵빵', '담요 제공', '짐 보관 가능',
  ],
  food_service: [
    '현지인 단골', '재료 신선함', '가성비 최고', '친절한 응대', '양이 많음',
    '사진 잘 나옴', '혼술 환영', '디저트 강자', '콜키지 가능', '메뉴판 업데이트',
  ],
  photo_guide: [
    '인생샷 스팟', '역광 주의', '오전 방문 추천', '삼각대 필수', '숨은 포토존',
    '드레스코드', '보정 필요 없음', '전신 거울', '조명 좋음', '뷰 미쳤음',
  ],
  weather_season: [
    '비 피하기 좋음', '바람 강함', '그늘 부족', '실내 데이트', '양산 필수',
    '따뜻한 조명', '미세먼지 적음', '눈 오는 날', '덥고 습함', '쾌적한 온도',
  ],
};

const ALL_POOL_TAGS = Object.values(LIVEJOURNEY_TAG_POOL).flat();
const TAG_SET = new Set(ALL_POOL_TAGS.map((t) => normalizeText(t)));

const normalizeTagKey = (t) => normalizeText(String(t || '').replace(/^#+/, '').trim());

// 태그 후보를 스코어링할 때 사용할 키워드 신호
const TAG_SIGNALS = [
  // 1) 개화/자연
  { tag: '실시간 개화', any: ['개화', '실시간', '피었', '폈', '꽃'] },
  { tag: '꽃비 내림', any: ['꽃비', '흩날', '바람에', '떨어'] },
  { tag: '50% 개화', any: ['50%', '반쯤', '절반', '부분 개화'] },
  { tag: '단풍 절정', any: ['단풍', '가을', '절정'] },
  { tag: '낙엽 시작', any: ['낙엽', '떨어지', '잎'] },
  { tag: '설경 예쁨', any: ['설경', '눈', '눈꽃'] },
  { tag: '윤슬 맛집', any: ['윤슬', '물결', '반짝', '햇빛', '수면'] },
  { tag: '초록초록함', any: ['초록', '신록', '푸릇', '숲'] },
  { tag: '억새 물결', any: ['억새', '갈대', '물결'] },
  { tag: '몽글몽글 구름', any: ['구름', '몽글', '하늘'] },
  { tag: '안개 자욱', any: ['안개', '뿌옇', '자욱'] },

  // 2) 혼잡도/웨이팅
  { tag: '지금 한적함', any: ['한적', '조용', '사람 없음', '널널'] },
  { tag: '적당한 활기', any: ['적당', '활기', '괜찮', '적당히'] },
  { tag: '북적북적', any: ['북적', '사람 많', '혼잡', '붐빔'] },
  { tag: '웨이팅 없음', any: ['웨이팅 없음', '줄 없', '대기 없'] },
  { tag: '줄 서기 시작', any: ['줄', '대기', '웨이팅', 'queue', 'waiting'] },
  { tag: '오픈런 필수', any: ['오픈런', '오픈런 필수', '오픈 전'] },
  { tag: '입장 마감', any: ['마감', '입장 마감', '종료'] },
  { tag: '예약 권장', any: ['예약', '예약 권장', '예약 필수'] },
  { tag: '30분 대기', any: ['30분', '대기', '웨이팅'] },
  { tag: '단체 몰림', any: ['단체', '관광버스', '몰림'] },

  // 3) 신뢰/인증 (텍스트+메타)
  { tag: '무보정 원본', any: ['무보정', '원본', '필터 없음'] },
  { tag: '현장 인증', any: ['현장', '직접', '인증'] },
  { tag: '실시간 날씨', any: ['날씨', '기온', '습도', '바람', '미세먼지'] },
  { tag: '정보 수정됨', any: ['수정', '업데이트', '정정'] },
  { tag: '실제와 같음', any: ['실제', '그대로', '정확', '리얼'] },
  { tag: '팩트체크 완료', any: ['팩트', '확인', '체크', '검증'] },
  { tag: '직접 찍음', any: ['직접 찍', '직접촬영', '내가 찍'] },
  { tag: '필터 없음', any: ['필터 없음', '무필터', '필터안씀'] },

  // 4) 주차/교통
  { tag: '주차장 널널', any: ['주차 널널', '주차 여유', '주차 가능'] },
  { tag: '주차장 만차', any: ['만차', '주차 어려움', '주차 힘듦'] },
  { tag: '초보운전 가능', any: ['초보', '운전', '길 쉬움'] },
  { tag: '셔틀 운행', any: ['셔틀', '셔틀버스'] },
  { tag: '뚜벅이 가능', any: ['뚜벅', '대중교통', '지하철', '버스'] },
  { tag: '오르막 주의', any: ['오르막', '경사', '언덕'] },
  { tag: '비포장도로', any: ['비포장', '흙길', '자갈길'] },
  { tag: '유료 주차', any: ['유료 주차', '주차요금', '주차비'] },
  { tag: '무료 주차', any: ['무료 주차', '무료'] },

  // 5) 무드
  { tag: '고즈넉한', any: ['고즈넉', '조용', '차분'] },
  { tag: '힙한 감성', any: ['힙', '핫플', '트렌디'] },
  { tag: '레트로 무드', any: ['레트로', '빈티지', '옛날'] },
  { tag: '이국적인', any: ['이국', '해외', '외국'] },
  { tag: '활기 넘치는', any: ['활기', '북적', '사람 많'] },
  { tag: '야경 맛집', any: ['야경', '밤', '조명'] },
  { tag: '노을 스팟', any: ['노을', '일몰', '석양'] },
  { tag: '웅장한', any: ['웅장', '규모', '장관'] },
  { tag: '아기자기한', any: ['아기자기', '귀엽', '소품'] },

  // 6) 동행
  { tag: '아이와 함께', any: ['아이', '유아', '키즈', '아기'] },
  { tag: '반려동물 동반', any: ['반려', '강아지', '반려견', '펫'] },
  { tag: '부모님 만족', any: ['부모님', '어른', '효도'] },
  { tag: '연인과 데이트', any: ['데이트', '연인', '커플'] },
  { tag: '우정 여행', any: ['친구', '우정', '여행'] },
  { tag: '대가족 가능', any: ['가족', '대가족', '단체'] },
  { tag: '사진가 성지', any: ['사진', '촬영', '카메라', '포토'] },
  { tag: '노키즈존', any: ['노키즈', '노키즈존'] },

  // 7) 시설/편의
  { tag: '유모차 가능', any: ['유모차'] },
  { tag: '휠체어 접근', any: ['휠체어', '장애인'] },
  { tag: '화장실 깨끗', any: ['화장실', '깨끗'] },
  { tag: '콘센트 많음', any: ['콘센트', '충전'] },
  { tag: '노트북 환영', any: ['노트북', '작업'] },
  { tag: '야외 좌석', any: ['야외', '야외석'] },
  { tag: '테라스 있음', any: ['테라스'] },
  { tag: '에어컨 빵빵', any: ['에어컨', '시원'] },
  { tag: '담요 제공', any: ['담요'] },
  { tag: '짐 보관 가능', any: ['짐', '보관'] },

  // 8) 미식/서비스
  { tag: '현지인 단골', any: ['현지인', '단골'] },
  { tag: '재료 신선함', any: ['신선', '재료'] },
  { tag: '가성비 최고', any: ['가성비', '저렴'] },
  { tag: '친절한 응대', any: ['친절'] },
  { tag: '양이 많음', any: ['양 많', '푸짐'] },
  { tag: '디저트 강자', any: ['디저트', '케이크', '빵'] },
  { tag: '콜키지 가능', any: ['콜키지'] },
  { tag: '메뉴판 업데이트', any: ['메뉴', '업데이트'] },

  // 9) 사진/촬영
  { tag: '인생샷 스팟', any: ['인생샷', '포토존', '사진 맛집'] },
  { tag: '역광 주의', any: ['역광'] },
  { tag: '오전 방문 추천', any: ['오전', '아침'] },
  { tag: '삼각대 필수', any: ['삼각대'] },
  { tag: '숨은 포토존', any: ['숨은', '포토존'] },
  { tag: '보정 필요 없음', any: ['무보정', '보정 필요 없음'] },
  { tag: '조명 좋음', any: ['조명', '빛'] },
  { tag: '뷰 미쳤음', any: ['뷰', '전망', '경치'] },

  // 10) 날씨/계절
  { tag: '비 피하기 좋음', any: ['비', '우천', '실내'] },
  { tag: '바람 강함', any: ['바람', '강풍'] },
  { tag: '그늘 부족', any: ['그늘', '햇빛'] },
  { tag: '실내 데이트', any: ['실내', '비', '데이트'] },
  { tag: '양산 필수', any: ['양산', '햇빛', '자외선'] },
  { tag: '따뜻한 조명', any: ['따뜻한 조명', '조명'] },
  { tag: '미세먼지 적음', any: ['미세먼지', '공기'] },
  { tag: '눈 오는 날', any: ['눈', '강설'] },
  { tag: '덥고 습함', any: ['덥', '습', '후덥'] },
  { tag: '쾌적한 온도', any: ['쾌적', '선선', '적당한 온도'] },
];

const scoreTagsFromPool = (placeKey, postsForPlace, stat) => {
  const blob = (Array.isArray(postsForPlace) ? postsForPlace : []).map((p) => getPostTextBlob(p)).join(' ');
  const scores = new Map(); // key -> {tag, score}
  const bump = (tag, s) => {
    const key = normalizeTagKey(tag);
    if (!key || !TAG_SET.has(key)) return;
    const prev = scores.get(key);
    const next = (prev?.score || 0) + s;
    scores.set(key, { tag, score: next });
  };

  // 신뢰/실시간성: 메타 기반
  const lastMin = stat?.lastPostAgeMinutes ?? null;
  if (typeof lastMin === 'number' && lastMin <= 20) bump('방금 올라옴', 8);
  if (stat?.isLive) bump('현장 인증', 5);

  // EXIF/verifiedLocation 등 "직접/현장" 신호
  const hasExif = (Array.isArray(postsForPlace) ? postsForPlace : []).some((p) => !!(p?.exifData?.photoDate || p?.photoDate));
  const hasVerified = (Array.isArray(postsForPlace) ? postsForPlace : []).some((p) => !!p?.verifiedLocation);
  if (hasExif || hasVerified) {
    bump('직접 찍음', 6);
    bump('팩트체크 완료', 2);
  }

  // 텍스트/태그 신호
  TAG_SIGNALS.forEach((r) => {
    const ok = matchesAny(blob, r.any);
    if (ok) bump(r.tag, 6);
  });

  // 날씨 태그: 업로드 시 자동태그(날씨/기온 등)가 포함되면 강화
  if (matchesAny(blob, ['맑음', '흐림', '비', '눈', '강풍', '안개', '자외선', '미세먼지', '기온', '습도'])) {
    bump('실시간 날씨', 5);
    bump('쾌적한 온도', 2);
  }

  // 혼잡도/웨이팅: 최근 1h/3h 게시물 수가 많으면 활기/북적 쪽 가중
  if ((stat?.recent1hCount || 0) >= 4) bump('북적북적', 4);
  if ((stat?.recent1hCount || 0) <= 1) bump('지금 한적함', 3);

  // 후보가 너무 적으면 풀에서 결정적으로 채움 (항상 풀 내 태그)
  const list = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  if (list.length >= 6) return list;

  // 부족하면 테마별 기본 채움(장소 키 기반으로 다양하게)
  const seed = String(placeKey || '');
  const defaults = [
    ...LIVEJOURNEY_TAG_POOL.nature_bloom,
    ...LIVEJOURNEY_TAG_POOL.crowd_wait,
    ...LIVEJOURNEY_TAG_POOL.trust_verify,
    ...LIVEJOURNEY_TAG_POOL.mood_space,
    ...LIVEJOURNEY_TAG_POOL.weather_season,
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < defaults.length && list.length < 8; i += 1) {
    const t = defaults[(h + i * 17) % defaults.length];
    const key = normalizeTagKey(t);
    if (!scores.has(key)) {
      scores.set(key, { tag: t, score: 1 });
      list.push({ tag: t, score: 1 });
    }
  }
  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
};

const calculatePlaceUnitStats = (posts, placeKey) => {
  const placePosts = (Array.isArray(posts) ? posts : []).filter((post) => getPlaceKey(post) === placeKey);

  const total = placePosts.length;
  const bloomCount = placePosts.filter((p) => hasCategory(p, 'bloom')).length;
  const foodCount = placePosts.filter((p) => hasCategory(p, 'food')).length;
  const waitingCount = placePosts.filter((p) => hasCategory(p, 'waiting')).length;
  const scenicCount = placePosts.filter((p) => hasCategory(p, 'landmark') || hasCategory(p, 'scenic')).length;

  const recent3hPosts = filterRecentPosts(placePosts, 2, 3);
  const recent1hPosts = filterRecentPosts(placePosts, 2, 1);
  const recent24hPosts = filterRecentPosts(placePosts, 1, 24);
  const recent3hCount = recent3hPosts.length;
  const recent1hCount = recent1hPosts.length;
  const recent24hCount = recent24hPosts.length;

  const totalLikes = placePosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const avgLikes = total > 0 ? totalLikes / total : 0;

  const bloomRecentPosts = recent24hPosts.filter((p) => hasCategory(p, 'bloom'));
  const bloomRecentCount = bloomRecentPosts.length;

  const bloomPercentage = total > 0 ? (bloomCount / total) * 100 : 0;
  const activityScore = recent3hCount * 3 + recent1hCount * 5 + avgLikes * 0.3;
  const popularityScore = total * 1.5 + avgLikes;

  const latestPost = recent24hPosts[0] || placePosts
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0);
      const timeB = new Date(b.timestamp || b.createdAt || 0);
      return timeB - timeA;
    })[0];

  const latestTimestamp = latestPost ? (latestPost.timestamp || latestPost.createdAt) : null;
  const lastPostAgeHours = latestTimestamp ? getPostAgeInHours(latestTimestamp) : null;
  const lastPostAgeMinutes = lastPostAgeHours != null ? Math.round(lastPostAgeHours * 60) : null;
  const lastPostTimeAgoLabel = latestTimestamp ? getTimeAgo(latestTimestamp) : null;
  const isLiveRegion = latestTimestamp ? isPostLive(latestTimestamp, 30) : false;

  return {
    placeKey,
    total,
    bloomCount,
    foodCount,
    waitingCount,
    scenicCount,
    recentCount: recent24hCount,
    recent3hCount,
    recent1hCount,
    recent24hCount,
    bloomRecentCount,
    avgLikes: Math.round(avgLikes * 10) / 10,
    bloomPercentage: Math.round(bloomPercentage * 10) / 10,
    activityScore: Math.round(activityScore * 10) / 10,
    popularityScore: Math.round(popularityScore * 10) / 10,
    lastPostAgeMinutes,
    lastPostTimeAgoLabel,
    isLive: isLiveRegion,
    representativeImage: pickRepresentativeImage(placePosts),
    recentPosts: recent24hPosts.slice(0, 3),
    recent1hPosts,
    recent3hPosts,
    placePosts,
  };
};

/** 라이브(초록) vs 리센트(노랑) 구분: 최신 게시물 기준 N시간 이내 */
export const LIVE_THRESHOLD_HOURS = 3;

/**
 * 필터별 Smart 24h: 정보 성격에 따라 유효 윈도(시간) 다름
 * - lively: 3~6시간 → 상한 6h
 * - season: 꽃은 24~48h까지
 * - night / 바다 / 한적: 24h
 */
export const FILTER_MAX_AGE_HOURS = {
  lively_vibe: 6,
  season_peak: 48,
  night_good: 24,
  silent_healing: 24,
  deep_sea_blue: 24,
};

/** @deprecated 호환용 — 최신 로직은 FILTER_MAX_AGE_HOURS 사용 */
export const RECOMMENDATION_FRESH_HOURS = LIVE_THRESHOLD_HOURS;

const getPostTimestamp = (post) => post?.timestamp || post?.createdAt || post?.time;

const filterPostsWithinHours = (posts, maxHours) => {
  if (!Array.isArray(posts) || maxHours <= 0) return [];
  return posts
    .filter((p) => {
      const ts = getPostTimestamp(p);
      if (!ts) return false;
      return getPostAgeInHours(ts) <= maxHours;
    })
    .sort((a, b) => {
      const tb = new Date(getPostTimestamp(b) || 0).getTime();
      const ta = new Date(getPostTimestamp(a) || 0).getTime();
      return tb - ta;
    });
};

/**
 * 신선도 감쇠: 구간 가중 + S × (1 - t/T_max) 혼합 (T_max는 필터 최대 윈도)
 */
const computeFreshnessDecay = (ageHours, filterId) => {
  const maxH = FILTER_MAX_AGE_HOURS[filterId] || 24;
  let tierMult = 1;
  let tierKey = 'live';
  let tierLabel = '라이브 · 최신 제보';

  if (filterId === 'lively_vibe') {
    if (ageHours <= LIVE_THRESHOLD_HOURS) {
      tierMult = 1;
      tierKey = 'live';
      tierLabel = '라이브 · 최근 제보';
    } else if (ageHours <= maxH) {
      tierMult = 0.55;
      tierKey = 'today';
      tierLabel = '최근 몇 시간(핫플은 빨리 변함)';
    } else {
      tierMult = 0;
      tierKey = 'none';
    }
  } else if (filterId === 'season_peak') {
    if (ageHours <= LIVE_THRESHOLD_HOURS) {
      tierMult = 1;
      tierKey = 'live';
      tierLabel = '라이브 · 최신 제보';
    } else if (ageHours <= 12) {
      tierMult = 0.7;
      tierKey = 'today';
      tierLabel = '오늘 상황';
    } else if (ageHours <= 24) {
      tierMult = 0.4;
      tierKey = 'yesterday';
      tierLabel = '어제·지난 밤 상황';
    } else if (ageHours <= maxH) {
      tierMult = 0.25;
      tierKey = 'extended';
      tierLabel = '최근 이틀 이내 제보';
    } else {
      tierMult = 0;
      tierKey = 'none';
      tierLabel = '';
    }
  } else {
    if (ageHours <= LIVE_THRESHOLD_HOURS) {
      tierMult = 1;
      tierKey = 'live';
      tierLabel = '라이브 · 최신 제보';
    } else if (ageHours <= 12) {
      tierMult = 0.7;
      tierKey = 'today';
      tierLabel = '오늘 상황';
    } else if (ageHours <= maxH) {
      tierMult = 0.4;
      tierKey = 'yesterday';
      tierLabel = '어제·지난 밤 상황';
    } else {
      tierMult = 0;
      tierKey = 'none';
    }
  }

  const tCap = Math.min(ageHours, 24);
  const linear24 = 1 - tCap / 24;
  const linearWindow = maxH > 0 ? 1 - Math.min(ageHours, maxH) / maxH : 1;
  const combined = tierMult * (0.45 + 0.35 * linear24 + 0.2 * linearWindow);
  const badge = ageHours <= LIVE_THRESHOLD_HOURS ? 'live' : 'recent';

  return {
    tierMult,
    linear24,
    linearWindow,
    combined: Math.max(0.08, combined),
    tierKey,
    tierLabel: tierLabel || '최근 제보',
    badge,
  };
};

const LJ_FILTER_ORDER = ['season_peak', 'lively_vibe', 'night_good', 'silent_healing', 'deep_sea_blue'];

/** 승자 독식: 시즌 > 실시간 > 상시 (동점 시 상위 필터 우선) */
const FILTER_WTA_PRIORITY = {
  season_peak: 1.45,
  lively_vibe: 1.28,
  night_good: 1.06,
  silent_healing: 1.0,
  deep_sea_blue: 1.0,
};

export const DEFAULT_LIVEJOURNEY_FILTER_CONFIG = {
  active_filters: [
    { id: 'season_peak', weight: 1.5, tags: ['cherry', 'flower', 'bloom'] },
    { id: 'lively_vibe', weight: 1.25, tags: ['crowd', 'hot'] },
    { id: 'night_good', weight: 1.0, tags: ['night', 'city_light'] },
    { id: 'silent_healing', weight: 1.0, tags: ['quiet', 'park', 'trail'] },
    { id: 'deep_sea_blue', weight: 1.0, tags: ['sea', 'beach', 'blue'] },
  ],
  season_key: 'auto',
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const getPostAgeHours = (post) => {
  const ts = post?.timestamp || post?.createdAt || post?.time;
  if (!ts) return 999;
  return getPostAgeInHours(ts);
};

const isCherryBloomSeason = (d = new Date()) => {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 3) return day >= 15;
  if (m === 4) return day <= 25;
  return false;
};

const CHERRY_KEYS = ['벚꽃', '개화', '만개', 'cherry', 'blossom', '벚꽃명소', '꽃놀이', '왕벚꽃'];
const PINK_WHITE_KEYS = ['pink', 'white', '분홍', '연분홍', '하얀', '흰', '화이트'];

const postHasCherrySignal = (post) => {
  const t = getPostTextBlob(post);
  return CHERRY_KEYS.some((k) => t.includes(normalizeText(k)));
};

const postPinkWhiteScore = (post) => {
  const t = getPostTextBlob(post);
  let s = 0;
  PINK_WHITE_KEYS.forEach((k) => {
    if (t.includes(normalizeText(k))) s += 1;
  });
  if (matchesAny(t, ['벚꽃', '꽃'])) s += 0.5;
  const ca = post?.colorAnalysis || post?.aiAnalysis?.colorAnalysis || post?.metadata?.colorAnalysis;
  if (ca?.isPink || ca?.isWhite) s += 1.2;
  return clamp01(s / 3);
};

const postBlueSeaScore = (post) => {
  const t = getPostTextBlob(post);
  let s = matchesAny(t, ['바다', '해변', '파도', '해안', '윤슬', '물멍', '청량', '푸른바다']) ? 0.6 : 0;
  const ca = post?.colorAnalysis || post?.aiAnalysis?.colorAnalysis || post?.metadata?.colorAnalysis;
  if (ca?.isBlue) s += 0.5;
  const rgb = ca?.dominantColor;
  if (rgb && rgb.b >= rgb.r && rgb.b >= rgb.g && rgb.b >= 110) s += 0.35;
  return clamp01(s);
};

const isNatureCategoryPost = (post) =>
  hasCategory(post, 'scenic') ||
  hasCategory(post, 'landmark') ||
  matchesAny(getPostTextBlob(post), ['숲', '산', '등산', '트레킹', '공원', '계곡', '둘레길', '숲길']);

const getCaptureHour = (post) => {
  const raw = post?.exifData?.photoDate || post?.photoDate || post?.timestamp || post?.createdAt;
  if (!raw) return null;
  const h = new Date(raw).getHours();
  return Number.isFinite(h) ? h : null;
};

const isNightCapture = (post) => {
  const h = getCaptureHour(post);
  if (h == null) return false;
  return h >= 19 || h <= 4;
};

const computeGlobalUploadContext = (stats) => {
  const counts1h = stats.map((s) => s.recent1hCount || 0);
  const mean1h = counts1h.reduce((a, b) => a + b, 0) / Math.max(1, counts1h.length);
  const counts3h = stats.map((s) => s.recent3hCount || 0);
  const mean3h = counts3h.reduce((a, b) => a + b, 0) / Math.max(1, counts3h.length);
  return { meanRecent1h: mean1h, meanRecent3h: mean3h, placeCount: stats.length };
};

/**
 * 장소 L × 필터 F 적합도 S ∈ [0,1] (필터별 독립 산출 후 WTA에 사용)
 */
const computeFilterScoresVector = (stat, globalCtx) => {
  const posts = Array.isArray(stat.placePosts) ? stat.placePosts : [];
  const recent12h = filterRecentPosts(posts, 2, 12);
  const recent3h = filterRecentPosts(posts, 2, 3);
  const recent1h = filterRecentPosts(posts, 2, 1);
  const recent24h = filterRecentPosts(posts, 1, 24);
  const recent10m = filterRecentPosts(posts, 2, 10 / 60);
  const last30m = posts.filter((p) => getPostAgeHours(p) < 0.5);
  const prev30to60 = posts.filter((p) => {
    const h = getPostAgeHours(p);
    return h >= 0.5 && h < 1;
  });

  const regionHint = (posts[0]?.region || '').split(/\s+/)[0] || '';
  const isCoastal = COASTAL_HINT_REGIONS.has(regionHint);
  const blobAll = posts.map((p) => getPostTextBlob(p)).join(' ');

  const cherryIn12 = recent12h.filter(postHasCherrySignal).length;
  const cherryRatio12h = recent12h.length ? cherryIn12 / recent12h.length : 0;
  const pinkWhiteAvg =
    recent12h.length > 0
      ? recent12h.reduce((s, p) => s + postPinkWhiteScore(p), 0) / recent12h.length
      : postPinkWhiteScore(posts[0] || {});

  const seasonBoost = isCherryBloomSeason() ? 1 : 0.32;
  const season_peak = clamp01(0.48 * cherryRatio12h + 0.3 * pinkWhiteAvg + 0.22 * seasonBoost);

  const natureHits = recent24h.filter(isNatureCategoryPost).length;
  const natureRatio = recent24h.length ? natureHits / recent24h.length : 0;
  const density3h = (stat.recent3hCount || 0) / 3;
  const crowd1h = stat.recent1hCount || 0;
  const calmCore = 1 / (1 + 0.55 * density3h + 0.42 * crowd1h);
  const crowdTextPenalty = matchesAny(blobAll, ['북적', '웨이팅', '대기', '줄', '인파']) ? 0.45 : 0;
  const silent_healing = clamp01(natureRatio * calmCore * (1 - crowdTextPenalty) + (natureRatio > 0.35 ? 0.08 : 0));

  const seaPostsScore =
    recent24h.length > 0
      ? recent24h.reduce((s, p) => s + postBlueSeaScore(p), 0) / recent24h.length
      : postBlueSeaScore(posts[0] || {});
  const seaKw = matchesAny(blobAll, ['바다', '해변', '파도', '윤슬', '물멍', '해안', '해변가']) ? 1 : 0;
  const coastalGps = posts.some((p) => {
    const ex = p?.exifData?.gpsCoordinates || p?.coordinates;
    return ex && (isCoastal || seaKw);
  });
  const deep_sea_blue = clamp01(0.38 * (isCoastal ? 1 : 0.45) + 0.42 * seaPostsScore + 0.2 * (coastalGps ? 1 : 0) + 0.15 * seaKw);

  const relToMean = (stat.recent1hCount || 0) - (globalCtx.meanRecent1h || 0);
  const relNorm = clamp01(0.5 + relToMean / Math.max(2, (globalCtx.meanRecent1h || 1) * 2));
  const velocity = last30m.length - prev30to60.length;
  const velBoost = clamp01(0.35 + velocity * 0.12);
  const livelyTheme = recent1h.filter((p) => (inferThemeScoreForPost(p).lively_vibe || 0) >= 1).length;
  const lively_vibe = clamp01(0.45 * relNorm + 0.35 * velBoost + 0.2 * clamp01(livelyTheme / Math.max(1, recent1h.length || 1)));

  const nightTagged = recent24h.filter((p) => matchesAny(getPostTextBlob(p), ['야경', '야간', '조명', '불빛', '야시장', '루프탑', '밤바다'])).length;
  const nightExif = recent24h.filter((p) => isNightCapture(p)).length;
  const nightFrac = recent24h.length ? (nightTagged + nightExif * 0.5) / recent24h.length : 0;
  const lowLight = posts.some((p) => {
    const ca = p?.colorAnalysis || p?.metadata?.colorAnalysis;
    return ca?.isDark || (ca?.brightness != null && ca.brightness < 0.38);
  });
  const night_good = clamp01(0.55 * nightFrac + 0.25 * (lowLight ? 1 : 0.35) + 0.2 * (nightTagged > 0 ? 1 : 0));

  return {
    scores: {
      season_peak,
      silent_healing,
      deep_sea_blue,
      lively_vibe,
      night_good,
    },
    extra: {
      cherryRatio12h,
      bloomPct: Math.round(cherryRatio12h * 100),
      calmCore,
      natureRatio,
      seaPostsScore,
      recent1hCount: stat.recent1hCount,
      recent10mCount: recent10m.length,
      velocity,
      nightFrac,
      isCoastal,
    },
  };
};

const mergeFilterWeights = (config) => {
  const base = {
    season_peak: 1,
    silent_healing: 1,
    deep_sea_blue: 1,
    lively_vibe: 1,
    night_good: 1,
  };
  const af = config?.active_filters;
  if (!Array.isArray(af)) return base;
  const out = { ...base };
  af.forEach((f) => {
    if (f?.id && typeof f.weight === 'number' && f.weight > 0) out[f.id] = f.weight;
  });
  return out;
};

export const loadLiveJourneyFilterConfig = () => {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_LIVEJOURNEY_FILTER_CONFIG };
    const raw = localStorage.getItem('lj_recommendation_filter_config');
    if (!raw) return { ...DEFAULT_LIVEJOURNEY_FILTER_CONFIG };
    return { ...DEFAULT_LIVEJOURNEY_FILTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LIVEJOURNEY_FILTER_CONFIG };
  }
};

const pickWinningFilter = (scores, dynamicWeights) => {
  let best = LJ_FILTER_ORDER[0];
  let bestVal = -1;
  LJ_FILTER_ORDER.forEach((fid) => {
    const w = (dynamicWeights[fid] || 1) * (FILTER_WTA_PRIORITY[fid] || 1);
    const v = (scores[fid] || 0) * w;
    if (v > bestVal) {
      bestVal = v;
      best = fid;
    }
  });
  return { winner: best, weighted: bestVal };
};

const buildLiveIndicator = (typeId, stat, extra, globalCtx, freshnessMeta) => {
  const freshnessLine = freshnessMeta?.tierLabel ? `신선도: ${freshnessMeta.tierLabel}` : '';
  if (typeId === 'season_peak') {
    const pct = Math.max(12, Math.min(100, extra.bloomPct + (isCherryBloomSeason() ? 8 : 0)));
    return {
      headline: `실시간 개화율 ${pct}%`,
      detail: [freshnessLine, '최근 12시간 태그·분홍/화이트·개화 시즌 가중'].filter(Boolean).join(' · '),
      variant: 'bloom',
    };
  }
  if (typeId === 'lively_vibe') {
    const n10 = extra.recent10mCount ?? 0;
    const n1h = extra.recent1hCount ?? 0;
    return {
      headline: `최근 1시간 ${n1h}명 업로드`,
      detail: [freshnessLine, n10 > 0 ? `방금 10분간 ${n10}건 · 가속도 반영` : '핫플은 최대 6시간 이내만 반영'].filter(Boolean).join(' · '),
      variant: 'crowd',
    };
  }
  if (typeId === 'silent_healing') {
    const calm = extra.calmCore ?? 0.5;
    const label = calm >= 0.55 ? '매우 한적함' : calm >= 0.35 ? '한적한 편' : '보통';
    const mean = globalCtx?.meanRecent3h || 1;
    const r3 = stat.recent3hCount || 0;
    const ratio = mean > 0 ? Math.round((r3 / mean) * 100) : 100;
    return {
      headline: `현재 ${label}`,
      detail: [freshnessLine, `3시간 업로드 밀도는 전체 평균 대비 약 ${ratio}%`].filter(Boolean).join(' · '),
      variant: 'quiet',
    };
  }
  if (typeId === 'deep_sea_blue') {
    const blue = Math.round((extra.seaPostsScore || 0) * 100);
    return {
      headline: `블루 톤 ${Math.max(18, blue)}%`,
      detail: [freshnessLine, '해안·키워드·이미지 블루 신호'].filter(Boolean).join(' · '),
      variant: 'sea',
    };
  }
  if (typeId === 'night_good') {
    const nf = Math.round((extra.nightFrac || 0) * 100);
    return {
      headline: `야간·야경 신호 ${Math.min(100, nf + 15)}%`,
      detail: [freshnessLine, '오늘 밤 없으면 어제 밤 제보로 안내'].filter(Boolean).join(' · '),
      variant: 'night',
    };
  }
  return { headline: '실시간 반영', detail: stat.lastPostTimeAgoLabel || '', variant: 'default' };
};

/** 대표 사진: 필터 유효 윈도 내에서 가장 최근 게시 우선(시간순 진실), 동점 시 좋아요 */
const pickRepresentativeForFilter = (stat, maxHours) => {
  const eligible = filterPostsWithinHours(stat.placePosts || [], maxHours);
  const withImg = eligible.filter((p) => p?.images?.[0] || p?.thumbnail || p?.image);
  const sorted = withImg.sort((a, b) => {
    const tb = new Date(getPostTimestamp(b) || 0).getTime();
    const ta = new Date(getPostTimestamp(a) || 0).getTime();
    if (tb !== ta) return tb - ta;
    return (Number(b?.likes) || 0) - (Number(a?.likes) || 0);
  });
  const best = sorted[0] || eligible[0];
  if (!best) return { url: null, post: null };
  const raw = best.images?.[0] ?? best.thumbnail ?? best.image;
  const url = raw ? (typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null)) : null;
  return { url, post: best };
};

/**
 * 추천 타입별 추천 장소 계산 (호환: regionName 필드 유지)
 * - 필터별 점수 벡터 → 승자 독식(WTA) → 선택된 필터에만 노출
 * - Smart 24h 윈도 + 신선도 감쇠 후 순위: 최신 게시 시각 우선, 다음 점수
 */
export const getRecommendedRegions = (posts, recommendationType = 'blooming', options = {}) => {
  const rawType = String(recommendationType || '').trim();
  const type = (() => {
    if (rawType === 'active' || rawType === 'popular' || rawType === 'food') return 'lively_vibe';
    if (rawType === 'blooming' || rawType === 'scenic') return 'season_peak';
    if (rawType === 'waiting') return 'silent_healing';
    return rawType || 'season_peak';
  })();

  const list = Array.isArray(posts) ? posts : [];
  const keys = Array.from(new Set(list.map((p) => getPlaceKey(p)).filter((k) => k && k !== '기록')));
  const stats = keys.map((k) => calculatePlaceUnitStats(list, k)).filter((s) => s.total > 0);

  const filterConfig = options.filterConfig || loadLiveJourneyFilterConfig();
  const dynamicWeights = mergeFilterWeights(filterConfig);
  const globalCtx = computeGlobalUploadContext(stats);

  const enriched = stats.map((stat) => {
    const { scores, extra } = computeFilterScoresVector(stat, globalCtx);
    const { winner, weighted } = pickWinningFilter(scores, dynamicWeights);
    const winMaxH = FILTER_MAX_AGE_HOURS[winner] ?? 24;
    const eligibleForWinner = filterPostsWithinHours(stat.placePosts || [], winMaxH);
    return {
      stat,
      scores,
      extra,
      winner,
      wtaStrength: weighted,
      hasFresh: eligibleForWinner.length > 0,
    };
  });

  const rankScoreForType = (row, typeId) => {
    const maxH = FILTER_MAX_AGE_HOURS[typeId] ?? 24;
    const eligible = filterPostsWithinHours(row.stat.placePosts || [], maxH);
    if (!eligible.length) {
      return { rankScore: 0, anchorNewestMs: 0, freshnessDecay: null, eligiblePosts: [] };
    }
    const newest = eligible[0];
    const ts = getPostTimestamp(newest);
    const ageH = getPostAgeInHours(ts);
    const freshnessDecay = computeFreshnessDecay(ageH, typeId);
    const base = row.scores[typeId] || 0;
    const w = dynamicWeights[typeId] || 1;
    const rankScore =
      base * w * freshnessDecay.combined * (1 + Math.log1p(row.stat.recent1hCount || 0) * 0.05);
    const anchorNewestMs = new Date(ts).getTime();
    return { rankScore, anchorNewestMs, freshnessDecay, eligiblePosts: eligible, repPost: newest, ageHours: ageH };
  };

  const ranked = enriched
    .filter((row) => row.winner === type && row.hasFresh)
    .map((row) => {
      const r = rankScoreForType(row, type);
      return { ...row, ...r };
    })
    .filter((row) => row.rankScore > 0 && row.eligiblePosts?.length)
    .sort((a, b) => {
      if (b.anchorNewestMs !== a.anchorNewestMs) return b.anchorNewestMs - a.anchorNewestMs;
      return b.rankScore - a.rankScore || (a.stat.lastPostAgeMinutes ?? 999999) - (b.stat.lastPostAgeMinutes ?? 999999);
    })
    .slice(0, 10);

  const buildStatusBadges = (typeId, stat, extra) => {
    const postsForPlace = Array.isArray(stat.placePosts) ? stat.placePosts : [];
    const recent = Array.isArray(stat.recent3hPosts) ? stat.recent3hPosts : postsForPlace;
    const blobAll = recent.map((p) => getPostTextBlob(p)).join(' ');

    const countKw = (kwList) => kwList.reduce((s, kw) => s + (blobAll.includes(normalizeText(kw)) ? 1 : 0), 0);
    const totalSignals = Math.max(1, recent.length);

    // 사용자 입력(노트/내용/태그) 기반 비율 산출
    const waitingHits = countKw(['웨이팅', '대기', '줄', 'queue', 'waiting']);
    const quietHits = countKw(['한적', '조용', '여유', '고즈넉', '힐링', '쉼']);
    const seasonHits = countKw(['만개', '개화', '벚꽃', '단풍', '설경', '눈', '절정']);
    const seaHits = countKw(['바다', '해변', '파도', '윤슬', '물멍', '에메랄드', '청량']);
    const parkingHits = countKw(['주차', '주차장', '주차편']);
    const nightHits = countKw(['야경', '밤', '야시장', '조명', '불빛', '야간', '루프탑', '일몰', '노을']);
    const popupHits = countKw(['팝업', '버스킹', '공연', '축제', '이벤트']);

    const quietPct = Math.max(0, Math.min(95, Math.round(70 + (quietHits / (quietHits + waitingHits + 1)) * 30)));

    const out = [];
    if (quietHits > 0 && waitingHits === 0) out.push(`● 한적함 ${quietPct}%`);
    if (waitingHits > 0) out.push('● 웨이팅 있음');
    if (seasonHits > 0) out.push('● 절정/만개');
    if (seaHits > 0) out.push('● 바다 무드');
    if (nightHits > 0) out.push('● 야경/밤 무드');
    if (parkingHits > 0) out.push('● 주차 정보');
    if (popupHits > 0) out.push('● 이벤트/공연');

    // 테마에 따라 우선순위 조정
    const prefer = {
      season_peak: ['● 절정/만개', '● 주차 정보', '● 이벤트/공연'],
      silent_healing: [`● 한적함 ${quietPct}%`, '● 주차 정보', '● 바다 무드'],
      deep_sea_blue: ['● 바다 무드', '● 주차 정보', '● 한적함'],
      lively_vibe: ['● 이벤트/공연', '● 웨이팅 있음', '● 주차 정보'],
      night_good: ['● 야경/밤 무드', '● 이벤트/공연', '● 주차 정보'],
    };

    const order = prefer[typeId] || [];
    const sorted = [
      ...order.filter((x) => out.some((v) => v.startsWith(x.replace(/\s*\d+%/, '').trim())) || out.includes(x)),
      ...out.filter((x) => !order.some((o) => x.startsWith(o.replace(/\s*\d+%/, '').trim()) || x === o)),
    ];

    const uniq = [];
    sorted.forEach((b) => { if (b && !uniq.includes(b)) uniq.push(b); });
    return uniq.slice(0, 3);
  };

  const buildTopTags = (typeId, stat, extra) => {
    const placePosts = Array.isArray(stat?.placePosts) ? stat.placePosts : [];
    const scored = scoreTagsFromPool(stat?.placeKey || stat?.regionKey || '', placePosts, stat);
    return scored.map((x) => x.tag).filter(Boolean).slice(0, 3);
  };

  const buildProof = (stat, typeId, freshPosts) => {
    const proofCount = Math.min(9, Array.isArray(freshPosts) ? freshPosts.length : 0);
    const vibeWord =
      typeId === 'silent_healing' ? '여유로움' :
      typeId === 'season_peak' ? '절정' :
      typeId === 'deep_sea_blue' ? '바다 무드' :
      typeId === 'lively_vibe' ? '힙한 분위기' :
      typeId === 'night_good' ? '야경 무드' :
      '최신성';
    if (proofCount <= 0) return { proofSummary: '', timelineThumbs: [] };

    const proofSummary = `${proofCount}명이 ‘${vibeWord}’을 인증했어요.`;

    const thumbs = (Array.isArray(freshPosts) ? freshPosts : [])
      .slice()
      .sort((a, b) => {
        const timeA = a?.timestamp || a?.createdAt || 0;
        const timeB = b?.timestamp || b?.createdAt || 0;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      })
      .map((p) => p?.images?.[0] ?? p?.thumbnail ?? p?.image ?? null)
      .filter(Boolean)
      .slice(0, 4)
      .map((raw) => (typeof raw === 'string' ? raw : (raw?.url ?? raw?.src ?? null)))
      .filter(Boolean);

    return { proofSummary, timelineThumbs: thumbs };
  };

  const toBadge = (typeId) => {
    if (typeId === 'season_peak') return '🌸 지금이 절정';
    if (typeId === 'silent_healing') return '🌿 한적한 아지트';
    if (typeId === 'deep_sea_blue') return '🌊 시원한 바다';
    if (typeId === 'lively_vibe') return '🔥 힙 & 활기';
    if (typeId === 'night_good') return '🌙 밤에 더 좋은';
    return '✨ 추천';
  };

  const getUserSnippet = (postsForPlace) => {
    const list = Array.isArray(postsForPlace) ? postsForPlace : [];
    const sorted = list.slice().sort((a, b) => {
      const ta = new Date(a?.timestamp || a?.createdAt || 0).getTime();
      const tb = new Date(b?.timestamp || b?.createdAt || 0).getTime();
      return tb - ta;
    });
    const raw = String(sorted.find((p) => (p?.note || p?.content || '').trim())?.note
      || sorted.find((p) => (p?.note || p?.content || '').trim())?.content
      || '').trim();
    if (!raw) return '';
    const single = raw.replace(/\s+/g, ' ');
    return single.length > 38 ? `${single.slice(0, 36)}…` : single;
  };

  const placeDescHash = (placeKey, typeId, salt = '') => {
    const s = `${typeId}\0${placeKey}\0${salt}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  /** 장소·필터·제보 맥락마다 다른 문장 후보 중 하나 (진짜 LLM은 아니지만 패턴 분기) */
  const pickVariedAiIntro = (typeId, placeKey, postsForPlace, h) => {
    const blob = postsForPlace.map((p) => getPostTextBlob(p)).join(' ');
    const name = placeKey || '이곳';
    const hasCherry = matchesAny(blob, ['벚꽃', '개화', '만개', '절정', '꽃']);
    const hasNight = matchesAny(blob, ['야경', '조명', '밤', '노을', '일몰', '루프탑']);
    const hasSea = matchesAny(blob, ['바다', '해변', '윤슬', '파도', '물멍', '청량']);
    const hasWalk = matchesAny(blob, ['산책', '걷기', '트레킹', '등산', '공원', '숲']);
    const hasCafe = matchesAny(blob, ['카페', '커피', '브런치', '디저트']);
    const hasFood = matchesAny(blob, ['맛집', '식당', '음식', '국밥']);

    const pick = (arr) => arr[h % arr.length];

    if (typeId === 'season_peak') {
      if (hasCherry) {
        return pick([
          `${name}—벚꽃·개화 얘기가 제보에 자주 올라와 지금이 보러 가기 좋은 타이밍으로 보여요.`,
          `${name}은(는) 꽃놀이 사진이 이어지는 곳이라, 짧게 다녀와도 계절 느낌이 확 살아요.`,
          `최근 제보 흐름상 ${name}은(는) 만개·절정 같은 말이 붙는 날이 많아요.`,
          `${name}, 지금 올라온 현장 사진만 봐도 꽃풍경이 묻어나요.`,
          `${name}은(는) 꽃 시즌 포인트로 손꼽히는 분위기예요.`,
        ]);
      }
      return pick([
        `${name}은(는) 단풍·꽃·설경 같은 시즌 감성이 제보에 잘 담기는 곳이에요.`,
        `${name}—계절 사진이 꾸준히 올라와 “지금”이 보이는 스팟이에요.`,
        `제보 맥락상 ${name}은(는) 풍경·전망을 노리기 좋은 코스로 읽혀요.`,
        `${name}, 사진 한 장만으로도 계절이 전해지는 타입의 장소예요.`,
        `${name}은(는) 시즌마다 분위기가 확 바뀌는 곳으로 정리돼요.`,
      ]);
    }
    if (typeId === 'deep_sea_blue' || hasSea) {
      return pick([
        `${name}은(는) 바다·해안 쪽 제보가 많아 파란 풍경·시원한 공기가 기대되는 곳이에요.`,
        `${name}—물멍·파도 얘기가 섞여 바다 감성이 살아 있어요.`,
        `현장 글 기준으로 ${name}은(는) 해안 산책·감성 스냅에 잘 맞아요.`,
        `${name}, 윤슬·맑은 날 풍경이 올라오기 좋은 코스예요.`,
        `${name}은(는) 탁 트인 시야가 매력이라 잠깐 멍 때리기에도 좋아요.`,
      ]);
    }
    if (typeId === 'night_good' || hasNight) {
      return pick([
        `${name}은(는) 노을·야경·조명 이야기가 붙는 밤·저녁 타이밍 스팟이에요.`,
        `${name}—해 질 무렵부터 불빛이 살아나는 분위기로 제보돼요.`,
        `${name}, 밤에 더 예쁘다는 말이 자연스럽게 나오는 곳이에요.`,
        `야간·야외 조명 포인트가 있는 ${name}, 사진 맛집으로도 읽혀요.`,
        `${name}은(는) 낮과 다른 무드가 살아서 저녁 코스로 묶기 좋아요.`,
      ]);
    }
    if (typeId === 'silent_healing') {
      return pick([
        `${name}은(는) 한적·산책·쉼 키워드가 어우러져 머리 식히기 좋은 곳이에요.`,
        `${name}—사람 붐비는 느낌보다 여유·고요 쪽 제보가 많아요.`,
        `조용히 걷기 좋다는 평이 나오는 ${name}, 생각 정리 코스로도 괜찮아요.`,
        `${name}, 숲·산·공원 흐름이 있으면 더 청량하게 읽혀요.`,
        `${name}은(는) 북적임 대신 바람 소리·여밉이 남는 타입이에요.`,
      ]);
    }
    if (typeId === 'lively_vibe') {
      return pick([
        `${name}은(는) 최근 업로드 속도가 빨라 “지금 붐빈다”는 인상이 강해요.`,
        `${name}—핫플·활기 같은 표현이 제보에 잘 붙는 곳이에요.`,
        `실시간 제보가 몰리는 ${name}, 지금 분위기를 보기엔 타이밍이 좋아요.`,
        `${name}은(는) 사람·이벤트·에너지가 한 번에 느껴지는 스팟이에요.`,
        `${name}, 갑자기 포스팅이 늘어난 흐름이면 더 눈에 띄는 장소예요.`,
      ]);
    }
    if (hasCafe) {
      return pick([
        `${name}은(는) 카페·브런치 동선과 잘 엮이는 제보가 많아요.`,
        `${name}—커피·디저트 얘기가 섞이면 반나절 코스로 묶기 좋아요.`,
      ]);
    }
    if (hasFood) {
      return pick([
        `${name}은(는) 맛집·먹거리 언급이 섞여 동선 짜기에 도움이 돼요.`,
        `${name}, 배고픈 타이밍에 같이 묶기 좋은 주변 제보가 있어요.`,
      ]);
    }
    if (hasWalk) {
      return pick([
        `${name}은(는) 걷기·둘레 코스 얘기가 있어 가볍게 돌기 좋아요.`,
        `${name}—산책로·트레킹 흔적이 있으면 만족도가 더 올라가요.`,
      ]);
    }
    return pick([
      `${name}은(는) 최신 제보 흐름을 기준으로 골라낸 추천 장소예요.`,
      `${name}, 지금 올라온 현장 글 톤이 살아 있는 곳으로 정리됐어요.`,
      `제보 패턴상 ${name}은(는) 여행 탐색에 참고하기 좋은 포인트예요.`,
    ]);
  };

  /** 방문객 한마디(짧게, 카드 3줄용) */
  const collectVisitorVoiceSnippets = (postsForPlace, maxQuotes = 3, maxLenEach = 100) => {
    const list = Array.isArray(postsForPlace) ? postsForPlace : [];
    const sorted = list.slice().sort((a, b) => {
      const ta = new Date(a?.timestamp || a?.createdAt || 0).getTime();
      const tb = new Date(b?.timestamp || b?.createdAt || 0).getTime();
      return tb - ta;
    });
    const out = [];
    const normFingerprints = [];
    for (const p of sorted) {
      let t = String(p?.note || p?.content || '').trim().replace(/\s+/g, ' ');
      t = t.replace(/#[^\s#]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.length < 8) continue;
      if (t.length > maxLenEach) t = `${t.slice(0, maxLenEach - 1)}…`;
      const n = normalizeText(t);
      let overlap = false;
      for (const fp of normFingerprints) {
        const a = n.slice(0, 24);
        const b = fp.slice(0, 24);
        if (a.length >= 12 && (n.includes(fp.slice(0, 18)) || fp.includes(a.slice(0, 18)))) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;
      normFingerprints.push(n);
      out.push(t);
      if (out.length >= maxQuotes) break;
    }
    return out;
  };

  const trimSingleLine = (s, max = 56) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
  };

  /** 사용자 글·폴백 문장을 합쳐 정확히 n줄(줄당 글자 제한, 공백 우선 분할) */
  const packTextToNLines = (rawText, nLines, maxLen) => {
    const src = String(rawText || '').replace(/\s+/g, ' ').trim();
    const fallbacks = [
      '실시간 제보가 이어지는 추천 장소예요.',
      '지금 분위기를 가늠하기 좋은 타이밍이에요.',
      '일정·동선 짜실 때 참고해 보세요.',
    ];
    if (!src) return fallbacks.slice(0, nLines).join('\n');
    const lines = [];
    let rest = src;
    for (let i = 0; i < nLines; i += 1) {
      if (!rest) {
        lines.push(fallbacks[i] || fallbacks[fallbacks.length - 1]);
        continue;
      }
      if (rest.length <= maxLen) {
        lines.push(rest);
        rest = '';
      } else {
        let cut = rest.lastIndexOf(' ', maxLen);
        if (cut < 12) cut = maxLen;
        const piece = rest.slice(0, cut).trim();
        lines.push(piece);
        rest = rest.slice(cut).trim();
      }
    }
    return lines.join('\n');
  };

  // 카드 간 태그 중복을 줄이기 위한 전역 사용 카운트 (한 번 호출 내에서만)
  const globalTagUse = new Map(); // key -> count

  const diversifyTopTags = (tags) => {
    const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
    const scored = list.map((t, idx) => {
      const key = normalizeTagKey(t);
      const used = globalTagUse.get(key) || 0;
      // 이미 많이 나온 태그일수록 뒤로
      return { t, key, score: used * 10 + idx };
    });
    scored.sort((a, b) => a.score - b.score);
    const picked = [];
    const seen = new Set();
    for (const s of scored) {
      if (picked.length >= 3) break;
      if (!s.key || seen.has(s.key)) continue;
      seen.add(s.key);
      picked.push(s.t);
    }
    picked.forEach((t) => {
      const key = normalizeText(t);
      globalTagUse.set(key, (globalTagUse.get(key) || 0) + 1);
    });
    return picked;
  };

  return ranked.map((row) => {
    const { stat, extra, rankScore, eligiblePosts, repPost, freshnessDecay, ageHours } = row;
    const maxH = FILTER_MAX_AGE_HOURS[type] ?? 24;
    const { url: liveImage, post: repPick } = pickRepresentativeForFilter(stat, maxH);
    const repForLabel = repPick || repPost;
    const repTs = getPostTimestamp(repForLabel);
    const timeLabel = getRecommendationTransparencyLabel(repTs);
    const fd = freshnessDecay || computeFreshnessDecay(ageHours ?? 0, type);
    const freshness = {
      badge: fd.badge,
      tierLabel: fd.tierLabel,
      tierKey: fd.tierKey,
      timeLabel,
      ageHours: ageHours ?? 0,
      tierMult: fd.tierMult,
      combinedDecay: fd.combined,
    };

    const { proofSummary, timelineThumbs } = buildProof(stat, type, eligiblePosts);
    const statusBadges = buildStatusBadges(type, stat, extra);
    const liveIndicator = buildLiveIndicator(type, stat, extra, globalCtx, fd);
    const topTags = diversifyTopTags(buildTopTags(type, stat, extra));
    const placePosts = Array.isArray(stat.placePosts) ? stat.placePosts : [];
    const userBlob = collectVisitorVoiceSnippets(placePosts, 8, 220).join(' ').trim();
    const introLine = pickVariedAiIntro(type, stat.placeKey, placePosts, placeDescHash(stat.placeKey, type));
    const placeOneLine = trimSingleLine(introLine, 56);
    const unifiedDescription = packTextToNLines(userBlob || introLine, 3, 46);

    return {
      regionName: stat.placeKey, // 호환 필드(실제는 placeKey)
      placeName: stat.placeKey,
      title: stat.placeKey,
      placeOneLine,
      description: unifiedDescription,
      userSnippet: '',
      topTags,
      image: liveImage,
      liveImage,
      freshness,
      badge: toBadge(type),
      statusBadges,
      liveIndicator,
      proofSummary,
      timelineThumbs,
      _score: rankScore,
      stats: {
        total: stat.total,
        recent24hCount: stat.recent24hCount,
        recent3hCount: stat.recent3hCount,
        recent1hCount: stat.recent1hCount,
        avgLikes: stat.avgLikes,
        isLive: stat.isLive,
        recommendationLive: freshness.badge === 'live',
        lastPostTimeAgoLabel: stat.lastPostTimeAgoLabel,
        representativeTimeLabel: timeLabel,
      },
    };
  });
};

/**
 * 추천 타입 목록 (분위기/테마 기반)
 */
export const RECOMMENDATION_TYPES = [
  {
    id: 'season_peak',
    name: '지금 만개한 벚꽃 명소',
    description: '놓치면 일 년을 기다려야 할, 찰나의 풍경',
    icon: '🌸'
  },
  {
    id: 'silent_healing',
    name: '생각 정리하기 좋은 지역',
    description: '북적임 대신 바람 소리만 들리는, 잠시 멈춘 동네',
    icon: '🌾'
  },
  {
    id: 'deep_sea_blue',
    name: '바다 보며 멍 때리기 좋은 곳',
    description: '가슴 뻥 뚫리는 파도 소리, 에메랄드빛 파란 맛',
    icon: '🌊'
  },
  {
    id: 'lively_vibe',
    name: '지금 사람 몰리는 핫플',
    description: '유행의 중심에서 즐기는, 기분 좋은 에너지',
    icon: '🔥'
  },
  {
    id: 'night_good',
    name: '밤에 더 좋은 장소',
    description: '낮보다 더 반짝이는, 밤에 더 좋은 장면',
    icon: '🌙'
  }
];

/**
 * 멀티모달 AI 기반 해시태그 생성 서비스
 * 4단계 파이프라인: 이미지 분석 → 상황 묘사 → 태그 생성 → 필터링
 */

const axios = require('axios');
const fs = require('fs');

// 환경 변수에서 API 키 가져오기
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// API 키가 있으면 자동으로 활성화 (별도 설정이 'false'가 아닌 경우)
const USE_AI = process.env.USE_AI_TAG_GENERATION !== 'false' && !!GEMINI_API_KEY;

const isProd = process.env.NODE_ENV === 'production';
const devLog = (...args) => {
  if (!isProd) {
    // eslint-disable-next-line no-console -- dev-only diagnostics
    console.log(...args);
  }
};
const devWarn = (...args) => {
  if (!isProd) console.warn(...args);
};

/** 서비스 공통 카테고리 (한글 표기 통일: 추천장소·개화정보·웨이팅·맛집정보) */
const CATEGORY_SLUGS = ['bloom', 'scenic', 'food', 'waiting', 'landmark', 'general'];
const CATEGORY_DISPLAY = {
  bloom: { name: '개화정보', icon: '🌸' },
  scenic: { name: '추천장소', icon: '🏞️' },
  food: { name: '맛집정보', icon: '🍜' },
  waiting: { name: '웨이팅', icon: '⏱️' },
  landmark: { name: '명소', icon: '🏛️' },
  general: { name: '일반', icon: '📌' }
};

/**
 * 이미지 캡션·위치·태그로 여행 카테고리 다중 추론 (꽃·개화 + 풍경이면 개화정보+추천장소 동시)
 */
const inferTravelCategoriesFromText = (caption, location = '', tagList = []) => {
  const text = `${caption || ''} ${location || ''} ${(tagList || []).join(' ')}`.toLowerCase();
  const out = [];
  const seen = new Set();
  const push = (slug) => {
    if (seen.has(slug)) return;
    if (!CATEGORY_SLUGS.includes(slug)) return;
    seen.add(slug);
    const m = CATEGORY_DISPLAY[slug];
    if (!m) return;
    out.push({ category: slug, categoryName: m.name, categoryIcon: m.icon });
  };

  const waitingKw = ['웨이팅', '대기', '줄서', '줄서서', '대기줄', 'queue', 'waiting', '번호표', '웨이트', '순번', '입장 대기', '예상 대기'];
  const bloomKw = ['꽃', '벚꽃', '개화', '매화', '진달래', '철쭉', '튤립', '유채', '수국', '코스모스', '해바라기', '만개', '개화기', '벚꽃길'];
  const foodKw = ['맛집', '음식', '카페', '커피', '디저트', '레스토랑', '식당', '먹거리', '요리', '메뉴', '빵', '케이크', '플레이팅', '브런치', '한식', '일식', '디너'];
  const landmarkKw = ['사찰', '박물관', '미술관', '궁궐', '성당', '유적', '유네스코', '문화재', '탑', '전망대'];
  // 일출/일몰은 캡션 오류로 잘못 붙는 경우가 많아 제외 — 시간대는 EXIF로 처리
  const scenicKw = ['다리', '강', '바다', '하늘', '도시', '풍경', '전망', '뷰', '경치', '자연', '산', '호수', '해변', '스카이라인'];

  const hasWaiting = waitingKw.some((kw) => text.includes(kw));
  const hasBloom = bloomKw.some((kw) => text.includes(kw));
  const hasFood = foodKw.some((kw) => text.includes(kw));
  const hasLandmark = landmarkKw.some((kw) => text.includes(kw));
  const hasScenic = scenicKw.some((kw) => text.includes(kw));

  if (hasWaiting) push('waiting');
  if (hasBloom) {
    push('bloom');
    push('scenic');
  }
  if (hasFood) push('food');
  if (hasLandmark) push('landmark');
  if (hasScenic && !hasBloom) push('scenic');

  if (out.length === 0) push('scenic');

  return out;
};

/** 호환용: 첫 카테고리만 */
const inferTravelCategoryFromText = (caption, location = '', tagList = []) => {
  const arr = inferTravelCategoriesFromText(caption, location, tagList);
  return arr[0] || { category: 'scenic', categoryName: CATEGORY_DISPLAY.scenic.name, categoryIcon: CATEGORY_DISPLAY.scenic.icon };
};

devLog('🔍 AI 태그 생성 설정:', { USE_AI });

/** EXIF photoDate(ISO 순간) → 한국 시각의 시(0–23) */
const hourInSeoulFromExif = (exifData) => {
  if (!exifData?.photoDate) return null;
  const d = new Date(exifData.photoDate);
  if (Number.isNaN(d.getTime())) return null;
  const h = parseInt(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }), 10);
  return Number.isFinite(h) ? h : null;
};

/** Edge 함수 analyze-tags와 동일 규칙: EXIF 시각과 모순되는 시간대 태그 제거 */
const tagConflictsWithExifHour = (tag, hour) => {
  const t = String(tag || '');
  if (/일몰|석양|노을|해질|골든아워|저녁노을/.test(t)) {
    if (hour < 18 || hour > 20) return true;
  }
  if (/야경|밤하늘|밤풍경/.test(t)) {
    if (hour >= 6 && hour <= 18) return true;
  }
  if (/블루아워/.test(t)) {
    if (hour >= 7 && hour <= 17) return true;
  }
  if (/일출|미명|동틀/.test(t)) {
    if (hour < 4 || hour > 10) return true;
  }
  if (/새벽/.test(t)) {
    if (hour < 4 || hour > 9) return true;
  }
  if (/한낮|대낮/.test(t)) {
    if (hour < 10 || hour > 16) return true;
  }
  return false;
};

const buildExifTimeRulesForPrompt = (exifData) => {
  const hour = hourInSeoulFromExif(exifData);
  if (hour === null) {
    return '\n[촬영 시각 정보 없음] 일몰·일출·야경·골든아워 등 구체적 시간대 표현은 이미지로 확실할 때만. 불확실하면 중립적으로.';
  }
  let period = '밤';
  if (hour >= 5 && hour < 11) period = '아침·오전';
  else if (hour >= 11 && hour < 14) period = '점심·낮';
  else if (hour >= 14 && hour < 18) period = '오후·낮';
  else if (hour >= 18 && hour < 21) period = '저녁(일몰 가능)';
  else if (hour >= 21 || hour < 5) period = '밤';
  const strict =
    hour >= 9 && hour <= 16
      ? ' 이 시각에는 일몰·노을·야경·일출·새벽·골든아워 태그 금지. 화면이 노랗게 보여도 금지.'
      : '';
  return `\n[EXIF 촬영 시각 최우선] 한국 시각 약 ${hour}시, ${period}.${strict} 묘사와 태그 모두 이 시각에 맞출 것.`;
};

/**
 * 이미지를 Base64로 변환 (크기 제한 체크 포함)
 * Gemini API 제한: 최대 7MB (Base64 인코딩 전 원본 기준 약 5.25MB)
 */
const imageToBase64 = async (imagePathOrUrl, mimeTypeHint = 'image/jpeg') => {
  try {
    let imageBuffer;
    let mimeType = mimeTypeHint;

    // Cloudinary/외부 URL 지원
    if (typeof imagePathOrUrl === 'string' && /^https?:\/\//i.test(imagePathOrUrl)) {
      devLog('🌐 이미지 URL 다운로드:', imagePathOrUrl.substring(0, 120) + (imagePathOrUrl.length > 120 ? '...' : ''));
      const resp = await axios.get(imagePathOrUrl, {
        responseType: 'arraybuffer',
        timeout: 20000
      });
      imageBuffer = Buffer.from(resp.data);
      mimeType = resp.headers?.['content-type'] || mimeTypeHint;
    } else {
      imageBuffer = fs.readFileSync(imagePathOrUrl);
      mimeType = mimeTypeHint;
    }

    const fileSizeMB = imageBuffer.length / (1024 * 1024);

    devLog('📏 이미지 크기 확인:');
    devLog('  원본 크기:', fileSizeMB.toFixed(2), 'MB');
    devLog('  Base64 변환 후 예상 크기:', (fileSizeMB * 1.33).toFixed(2), 'MB');

    // Gemini API 제한: 원본 이미지 7MB (Base64 변환 전)
    // 너무 작은 안전 마진 때문에 5MB 초과 이미지는 모두 막히고 있었음
    // → 실제 제한에 가깝게 7MB로 완화 (대부분의 스마트폰 사진 허용)
    const MAX_IMAGE_SIZE_MB = 7;

    if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
      devWarn(`⚠️ 이미지 크기가 너무 큼 (${fileSizeMB.toFixed(2)}MB > ${MAX_IMAGE_SIZE_MB}MB)`);
      devWarn('  Gemini API 제한: 최대 7MB (원본 기준)');
      devWarn('  이미지 리사이즈 또는 압축이 필요합니다.');
      return null;
    }

    const base64 = imageBuffer.toString('base64');
    const base64SizeMB = (base64.length * 3) / 4 / (1024 * 1024);
    devLog('  Base64 실제 크기:', base64SizeMB.toFixed(2), 'MB');

    return { base64, mimeType };
  } catch (error) {
    console.error('이미지 읽기 실패:', error);
    return null;
  }
};

/**
 * 1단계: 이미지 분석 및 상황 묘사 (Image Captioning) - Gemini 사용
 */
const generateImageCaption = async (imageBase64, mimeType = 'image/jpeg', location = '', exifData = null) => {
  devLog('🔍 generateImageCaption 호출됨');
  devLog('  USE_AI:', USE_AI);
  devLog('  GEMINI_API_KEY 존재:', !!GEMINI_API_KEY);
  devLog('  이미지 Base64 길이:', imageBase64 ? imageBase64.length : 0);
  devLog('  mime_type:', mimeType);

  if (!USE_AI || !GEMINI_API_KEY) {
    devLog('⚠️ generateImageCaption: 조건 불만족으로 종료');
    return null;
  }

  try {
    devLog('📡 Gemini API 호출 시작...');
    // EXIF 정보를 컨텍스트로 추가
    let contextInfo = '';
    if (exifData) {
      if (exifData.gpsCoordinates) {
        contextInfo += `\n위치 정보: 위도 ${exifData.gpsCoordinates.lat}, 경도 ${exifData.gpsCoordinates.lng}`;
      }
      if (exifData.photoDate) {
        const photoDate = new Date(exifData.photoDate);
        const dayOfWeek = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][photoDate.getDay()];
        const hSeoul = hourInSeoulFromExif(exifData);
        const timeLabel =
          hSeoul != null
            ? (hSeoul >= 5 && hSeoul < 11 ? '오전' : hSeoul >= 11 && hSeoul < 17 ? '낮·오후' : hSeoul >= 17 && hSeoul < 21 ? '저녁' : '밤')
            : '?';
        contextInfo += `\n촬영 시간(EXIF, 한국 시각 기준 시:${hSeoul ?? '불명'}): ${photoDate.toLocaleDateString('ko-KR')} ${dayOfWeek} ${timeLabel}`;
      }
    }
    if (location) {
      contextInfo += `\n사용자가 입력한 위치: ${location}`;
    }

    const prompt = `이 사진을 매우 상세하게 묘사해주세요. 다음 요소들을 포함해서 작성해주세요:

1. 주요 피사체 — 보이는 실제 사물·식물·건축물을 구체적으로 (예: 벚꽃, 벚꽃나무, 카페 테라스)
2. 배경과 환경
3. 분위기와 감정 (평화로운, 활기찬, 신비로운 등)
4. 색감과 조명 (따뜻한, 차가운, 밝은, 어두운 등)
5. 계절감
6. 시간대 느낌 — **반드시 아래 EXIF 촬영 시각과 일치**하게 쓰세요. 이미지가 황금빛으로 보여도 EXIF가 낮이면 일몰·야경으로 쓰지 마세요.

한국어로 자연스럽고 감성적인 문단으로 작성해주세요.${contextInfo}${buildExifTimeRulesForPrompt(exifData)}`;

    // Gemini API 호출
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    devLog('📥 Gemini API 응답 받음');
    devLog('  응답 상태:', response.status);
    devLog('  응답 구조:', JSON.stringify(response.data, null, 2).substring(0, 1000));

    if (!response.data) {
      console.error('❌ 응답 데이터가 없음');
      return null;
    }

    if (!response.data.candidates || !response.data.candidates[0]) {
      console.error('❌ 응답에 candidates가 없음:', response.data);
      if (response.data.error) {
        console.error('  Gemini API 에러:', response.data.error);
      }
      return null;
    }

    if (!response.data.candidates[0].content || !response.data.candidates[0].content.parts || !response.data.candidates[0].content.parts[0]) {
      console.error('❌ 응답 구조가 올바르지 않음:', response.data.candidates[0]);
      return null;
    }

    const caption = response.data.candidates[0].content.parts[0].text;
    devLog('✅ Gemini 이미지 캡션 생성 성공');
    devLog('  캡션 길이:', caption.length);
    devLog('  캡션 미리보기:', caption.substring(0, 100));
    return caption;
  } catch (error) {
    console.error('❌ 이미지 캡션 생성 실패:');
    console.error('  에러 메시지:', error.message);
    console.error('  응답 데이터:', JSON.stringify(error.response?.data, null, 2));
    console.error('  상태 코드:', error.response?.status);
    console.error('  전체 에러:', error);
    return null;
  }
};

/**
 * 2단계: 묘사를 바탕으로 태그 생성 (Tag Generation with Prompt Engineering) - Gemini 사용
 */
const generateTagsFromCaption = async (caption, location = '', exifData = null) => {
  devLog('🔍 generateTagsFromCaption 호출됨');
  devLog('  캡션 존재:', !!caption);
  devLog('  캡션 길이:', caption?.length || 0);
  devLog('  GEMINI_API_KEY 존재:', !!GEMINI_API_KEY);

  if (!caption || !GEMINI_API_KEY) {
    devLog('⚠️ generateTagsFromCaption: 조건 불만족으로 종료');
    return null;
  }

  try {
    devLog('📡 Gemini API 호출 시작 (태그 생성)...');
    // EXIF 정보를 컨텍스트로 추가
    let contextInfo = '';
    if (exifData?.gpsCoordinates) {
      contextInfo += `\n\n위치 정보: 위도 ${exifData.gpsCoordinates.lat}, 경도 ${exifData.gpsCoordinates.lng}`;
    }
    if (location) {
      contextInfo += `\n사용자 입력 위치: ${location}`;
    }
    contextInfo += buildExifTimeRulesForPrompt(exifData);

    const prompt = `너는 인스타그램 인기 인플루언서야. 아래 사진 묘사를 바탕으로 사람들이 많이 검색하고, '좋아요'를 많이 받을 수 있는 매력적인 한국어 해시태그 20개를 생성해줘.

**중요 규칙:**
1. 앞쪽 8개는 묘사에 나온 **실제 보이는 대상** 위주 (벚꽃·유채·건물·장소명 등). 추상어만 쌓지 않기.
2. EXIF 촬영 시각이 주어지면 일몰·일출·야경·골든아워 등 시간 태그는 그 시각과 맞을 때만.
3. 각 카테고리별로 나누어서 작성
4. 너무 긴 태그는 피하고 (최대 10자 이내)
5. 자연스럽고 트렌디한 표현 사용
6. 중복되지 않게

**카테고리별 분류:**

1. 객관적 사실 (장소, 사물 이름)
   예: 한강공원 벚꽃 카페투어

2. 분위기/감성 (느낌, 색감)
   예: 청량한 비온뒤맑음 색감맛집 분위기깡패

3. 상황/행동
   예: 주말나들이 산책스타그램 카페수혈

4. 트렌드/유행어
   예: 핫플 인생샷건짐 데일리그램

**사진 묘사:**
${caption}${contextInfo}

위 묘사를 바탕으로 각 카테고리별로 5개씩, 총 20개의 해시태그를 생성해줘. # 기호 없이 태그만 나열해줘. 한 줄에 하나씩 태그만 작성해줘.`;

    // Gemini API 호출
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const tagsText = response.data.candidates[0].content.parts[0].text;

    // 태그 추출 (다양한 형식 지원)
    const tags = tagsText
      .split(/\n|,|#/)
      .map(tag => tag.trim().replace(/^#/, '').replace(/[^\w가-힣\s]/g, ''))
      .filter(tag => tag.length >= 2 && tag.length <= 10)
      .filter(tag => /^[가-힣\s]+$/.test(tag)) // 한국어만
      .slice(0, 20);

    devLog('📥 Gemini API 응답 받음 (태그)');
    devLog('  원본 태그 텍스트:', tagsText.substring(0, 200));
    devLog('✅ Gemini 태그 생성 성공:', tags.length + '개');
    devLog('  생성된 태그:', tags);
    return tags;
  } catch (error) {
    console.error('❌ 태그 생성 실패:');
    console.error('  에러 메시지:', error.message);
    console.error('  응답 데이터:', JSON.stringify(error.response?.data, null, 2));
    console.error('  상태 코드:', error.response?.status);
    console.error('  전체 에러:', error);
    return null;
  }
};

/**
 * 3단계: 외부 데이터(Context) 주입 및 4단계: 결과 필터링
 */
const filterAndRefineTags = (tags, location = '', exifData = null) => {
  if (!tags || tags.length === 0) {
    return [];
  }

  const hourSeoul = hourInSeoulFromExif(exifData);

  // 중복 제거
  const uniqueTags = [...new Set(tags)];

  // 너무 긴 태그 제거 + EXIF 시각과 충돌하는 시간대 태그 제거
  const filteredTags = uniqueTags
    .filter((tag) => tag.length <= 10)
    .filter((tag) => hourSeoul === null || !tagConflictsWithExifHour(tag, hourSeoul));

  // 위치 정보가 있으면 관련 태그 우선순위 상승
  const locationTags = [];
  if (location) {
    const locationParts = location.split(' ');
    locationParts.forEach(part => {
      if (part.length >= 2 && part.length <= 6) {
        locationTags.push(part);
      }
    });
  }

  // EXIF 시간 정보 기반 태그 (일몰/야경 등은 넣지 않음 — 모델·추가 태그만 정제)
  const timeTags = [];
  if (hourSeoul !== null) {
    if (hourSeoul >= 5 && hourSeoul < 11) {
      timeTags.push('오전');
    } else if (hourSeoul >= 11 && hourSeoul < 17) {
      timeTags.push('오후');
    } else if (hourSeoul >= 17 && hourSeoul < 21) {
      timeTags.push('저녁');
    } else {
      timeTags.push('밤');
    }

    const photoDate = new Date(exifData.photoDate);
    const dayOfWeek = photoDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      timeTags.push('주말');
    } else {
      timeTags.push('평일');
    }
  }

  // 최종 태그 조합 (위치 태그 + 시간 태그 + AI 태그)
  const finalTags = [
    ...locationTags.slice(0, 2),
    ...timeTags.slice(0, 2),
    ...filteredTags
  ].slice(0, 15); // 최대 15개

  return finalTags;
};

/**
 * 메인 함수: 멀티모달 AI 기반 태그 생성
 */
const generateSmartTags = async (imagePathOrUrl, location = '', exifData = null, mimeTypeHint = 'image/jpeg') => {
  try {
    // AI 사용 가능 여부 확인
    devLog('🔍 generateSmartTags 호출됨');
    devLog('  USE_AI:', USE_AI);
    devLog('  GEMINI_API_KEY 존재:', !!GEMINI_API_KEY);

    if (!USE_AI || !GEMINI_API_KEY) {
      devLog('⚠️ AI 태그 생성 비활성화 또는 API 키 없음 - 기본 방식 사용');
      devLog('  USE_AI:', USE_AI);
      devLog('  GEMINI_API_KEY:', GEMINI_API_KEY ? '존재함' : '없음');
      return {
        success: false,
        tags: [],
        caption: null,
        method: 'disabled',
        message: 'AI 태그 생성이 비활성화되어 있습니다. (GEMINI_API_KEY / USE_AI_TAG_GENERATION 설정 확인)'
      };
    }

    // 이미지를 Base64로 변환
    const imageData = await imageToBase64(imagePathOrUrl, mimeTypeHint);
    if (!imageData?.base64) {
      return {
        success: false,
        tags: [],
        caption: null,
        method: 'read-failed',
        message: '이미지 처리에 실패했습니다. (파일 경로/URL 또는 이미지 크기 제한 확인)'
      };
    }

    // 1단계: 이미지 분석 및 상황 묘사
    devLog('📸 1단계: 이미지 분석 및 상황 묘사 중...');
    const caption = await generateImageCaption(imageData.base64, imageData.mimeType, location, exifData);

    if (!caption) {
      devLog('⚠️ 이미지 캡션 생성 실패 - 기본 방식 사용');
      return {
        success: false,
        tags: [],
        caption: null,
        method: 'caption-failed',
        message: 'AI 이미지 분석(캡션) 생성에 실패했습니다.'
      };
    }

    devLog('✅ 이미지 묘사 완료:', caption.substring(0, 100) + '...');

    let catsFromCaption = inferTravelCategoriesFromText(caption, location, []);

    // 2단계: 묘사를 바탕으로 태그 생성
    devLog('🏷️ 2단계: 태그 생성 중...');
    const tags = await generateTagsFromCaption(caption, location, exifData);

    if (tags && tags.length > 0) {
      catsFromCaption = inferTravelCategoriesFromText(caption, location, tags);
    }

    const primaryCat = catsFromCaption[0] || inferTravelCategoryFromText(caption, location, tags || []);
    const categoryNamesJoined = catsFromCaption.map((c) => c.categoryName).join(', ');

    if (!tags || tags.length === 0) {
      devLog('⚠️ 태그 생성 실패 — 캡션 기반 카테고리만 반환');
      return {
        success: true,
        tags: [],
        caption,
        categories: catsFromCaption,
        category: primaryCat.category,
        categoryName: categoryNamesJoined,
        categoryIcon: primaryCat.categoryIcon,
        method: 'gemini-ai',
        message: '태그 생성에 실패했으나 카테고리는 캡션 기준으로 분류했습니다.'
      };
    }

    devLog('✅ 태그 생성 완료:', tags.length + '개');

    // 3-4단계: 외부 데이터 주입 및 필터링
    const finalTags = filterAndRefineTags(tags, location, exifData);

    devLog('✅ 최종 태그:', finalTags);

    return {
      success: true,
      tags: finalTags,
      caption: caption,
      categories: catsFromCaption,
      category: primaryCat.category,
      categoryName: categoryNamesJoined,
      categoryIcon: primaryCat.categoryIcon,
      method: 'gemini-ai'
    };
  } catch (error) {
    console.error('❌ AI 태그 생성 실패:', error);
    return {
      success: false,
      tags: [],
      caption: null,
      method: 'error',
      message: 'AI 태그 생성 중 오류가 발생했습니다.'
    };
  }
};

module.exports = {
  generateSmartTags,
  generateImageCaption,
  generateTagsFromCaption,
  filterAndRefineTags,
  inferTravelCategoryFromText,
  inferTravelCategoriesFromText,
  CATEGORY_SLUGS,
  CATEGORY_DISPLAY
};

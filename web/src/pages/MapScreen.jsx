import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addNotification } from '../utils/notifications';
import { getLocationByCoordinates, getCoordinatesByLocation as getCoordsByRegion } from '../utils/locationCoordinates';
import { searchPlaceWithKakaoFirst } from '../utils/kakaoPlacesGeocode';
import { getRegionDefaultImage } from '../utils/regionDefaultImages';
import { filterRecentPosts } from '../utils/timeUtils';
import { getRecommendedRegions } from '../utils/recommendationEngine';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { logger } from '../utils/logger';
import { getMapThumbnailUri, getFirstVideoUriFromPost } from '../utils/postMedia';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import { appendSOSMission } from '../utils/sosMissionStore';
import StatusBadge from '../components/StatusBadge';
import { getPhotoStatusFromPost } from '../utils/photoStatus';

/** false면 라이브 코스(경로 만들기·저장·최근 경로) UI를 숨깁니다. */
const LIVE_COURSE_UI_ENABLED = false;

/** 지금 상황 알아보기 등록 후 스폰서 영상(모의) 재생 시간(ms) */
const SOS_AD_PLAY_DURATION_MS = 5000;

// HTML 속성에 넣을 URL/텍스트 이스케이프 (핀 img src가 깨지지 않도록)
const escapeHtmlAttr = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/** post.coordinates에서 유효한 { lat, lng }만 추출 */
function coordsFromPostObject(post) {
  const raw = post?.coordinates;
  if (!raw) return null;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/** 사전 매칭 실패 시 카카오 키워드 검색으로 좌표 보강 (서울 기본값 사용 안 함) */
async function enrichPostWithResolvedCoordinates(post) {
  const existing = coordsFromPostObject(post);
  if (existing) return { ...post, coordinates: existing };
  const locStr = [post.detailedLocation, post.placeName, post.location, post.region]
    .map((s) => (s && String(s).trim()) || '')
    .find(Boolean);
  if (!locStr) return post;
  let coords = getCoordsByRegion(locStr);
  if (!coords) {
    const geo = await searchPlaceWithKakaoFirst(locStr);
    if (geo && geo.lat != null && geo.lng != null && !Number.isNaN(Number(geo.lat)) && !Number.isNaN(Number(geo.lng))) {
      coords = { lat: Number(geo.lat), lng: Number(geo.lng) };
    }
  }
  if (!coords) return post;
  return { ...post, coordinates: coords };
}

async function enrichPostsList(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;
  return Promise.all(posts.map((p) => enrichPostWithResolvedCoordinates(p)));
}

/** 지도 핀: 정지 썸네일 우선(동영상 선행 시 poster·업로드 썸네일) */
const getPostPinImageUrl = (post) => {
  const raw = getMapThumbnailUri(post);
  return raw ? getDisplayImageUrl(raw) : '';
};

// 완성된 단어 → 추천 타입 매핑 (지도 검색 시 단어 기반 추천)
const KEYWORD_TO_RECOMMENDATION_TYPE = {
  food: ['맛집', '음식', '식당', '맛', '레스토랑', '맛집정보'],
  blooming: ['꽃', '개화', '벚꽃', '매화', '진달래', '유채꽃', '코스모스', '개화정보'],
  scenic: ['명소', '관광', '경치', '가볼만', '산', '바다', '해변', '절', '사찰', '관광지'],
  waiting: ['웨이팅', '대기', '줄', 'waiting', '웨이트'],
  popular: ['인기', '핫', '인기있는'],
  active: ['활발', '최신', '최근', '새로운']
};

const getRecommendationTypeForKeyword = (query) => {
  const q = (query || '').toLowerCase().trim();
  for (const [type, keywords] of Object.entries(KEYWORD_TO_RECOMMENDATION_TYPE)) {
    if (keywords.some(kw => q.includes(kw) || kw.includes(q))) return type;
  }
  return null;
};

const getPostTimestampMs = (post) => {
  const src = post?.photoDate || post?.timestamp || post?.createdAt || null;
  if (!src) return null;
  const date = typeof src === 'number' ? new Date(src) : new Date(String(src));
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
};

const getPostAgeHours = (post) => {
  const ts = getPostTimestampMs(post);
  if (!ts) return 0;
  return Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
};

const getMapAgeVisual = (post) => {
  const ageHours = getPostAgeHours(post);
  const ageMinutes = ageHours * 60;
  // 최신(약 8분 이내): 선명·선명도 100%
  if (ageMinutes <= 8) {
    return { imageOpacity: 1, imageFilter: 'none', label: '방금' };
  }
  // 8분~48시간: 서서히 흐려짐(불투명·채도·미세 블러 연속 보간)
  const t = Math.min(1, Math.max(0, (ageMinutes - 8) / (48 * 60 - 8)));
  const opacity = 1 - t * 0.52;
  const blurPx = t * 2.2;
  const sat = 100 - t * 32;
  const gray = t * 36;
  let label = '24시간 이내';
  if (ageHours >= 24 && ageHours < 48) label = '48시간 이내';
  if (ageHours >= 48) label = '오래된 정보';
  return {
    imageOpacity: opacity,
    imageFilter: `saturate(${sat}%) grayscale(${gray}%) blur(${blurPx}px)`,
    label
  };
};

const hasExifTag = (post) => getPhotoStatusFromPost(post) !== 'NONE';

const MAP_PIN_PLACEHOLDER_SVG =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNCIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNMjAgMTNDMTcuMjQgMTMgMTUgMTUuMjQgMTUgMThDMTUgMjAuNzYgMTcuMjQgMjMgMjAgMjNDMjIuNzYgMjMgMjUgMjAuNzYgMjUgMThDMjUgMTUuMjQgMjIuNzYgMTMgMjAgMTNaIiBmaWxsPSIjOUI5Q0E1Ii8+Cjwvc3ZnPg==';

const getUploadedPostsSafe = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const MapScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const sheetRef = useRef(null);
  const dragHandleRef = useRef(null);
  const markersRef = useRef([]);
  const currentLocationMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null); // 검색 결과 마커
  const filterScrollRef = useRef(null); // 필터 좌우 스크롤 (마우스 휠용)
  const hasDraggedFilterRef = useRef(false); // 버튼 위에서 드래그했으면 클릭 방지
  const [map, setMap] = useState(null);
  const [posts, setPosts] = useState([]);
  const [visiblePins, setVisiblePins] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]); // 필터: ['bloom', 'scenic'] 중복 선택 가능
  const [searchResults, setSearchResults] = useState([]); // 검색 결과 게시물
  const [isSearching, setIsSearching] = useState(false); // 검색 중인지 여부
  const [kakaoSearchResults, setKakaoSearchResults] = useState([]); // Kakao API 검색 결과 (관광지 등)
  const [showSearchSheet, setShowSearchSheet] = useState(false); // 검색 시트 표시 여부
  const [filteredRegions, setFilteredRegions] = useState([]); // 자동완성 필터링된 지역
  const [searchSuggestions, setSearchSuggestions] = useState([]); // 검색 제안 (지역 + 게시물)
  const [recentSearches, setRecentSearches] = useState([]); // 최근 검색 지역

  const { handleDragStart: handlePinScrollDrag, hasMovedRef: pinHasMovedRef } = useHorizontalDragScroll();

  // 추천 지역 데이터
  const recommendedRegions = useMemo(() => [
    { id: 1, name: '서울', keywords: ['도시', '쇼핑', '명동', '강남', '홍대', '경복궁', '궁궐', '한강', '야경', '카페', '맛집'] },
    { id: 2, name: '부산', keywords: ['바다', '해변', '해운대', '광안리', '야경', '횟집', '수산시장', '자갈치', '항구', '서핑'] },
    { id: 3, name: '대구', keywords: ['도시', '근대', '골목', '김광석길', '동성로', '쇼핑', '약령시', '팔공산', '치맥', '맥주'] },
    { id: 4, name: '인천', keywords: ['차이나타운', '짜장면', '월미도', '야경', '인천공항', '바다', '항구', '송도', '근대'] },
    { id: 5, name: '광주', keywords: ['도시', '무등산', '양동시장', '충장로', '예술', '문화', '민주화', '역사'] },
    { id: 6, name: '대전', keywords: ['도시', '과학', '엑스포', '성심당', '빵', '한밭수목원', '대청호', '계족산'] },
    { id: 7, name: '울산', keywords: ['공업', '항구', '대왕암공원', '간절곶', '일출', '고래', '울산대교', '태화강'] },
    { id: 8, name: '세종', keywords: ['행정', '정부', '신도시', '계획도시', '공원', '호수공원', '도담동'] },
    { id: 9, name: '수원', keywords: ['화성', '성곽', '수원갈비', '행궁', '화성행궁', '전통', '맛집'] },
    { id: 10, name: '용인', keywords: ['에버랜드', '놀이공원', '민속촌', '한국민속촌', '가족'] },
    { id: 11, name: '성남', keywords: ['도시', '판교', 'IT', '테크노', '카페'] },
    { id: 12, name: '고양', keywords: ['일산', '호수공원', '킨텍스', '전시', '꽃축제'] },
    { id: 13, name: '부천', keywords: ['도시', '만화박물관', '애니메이션', '영화'] },
    { id: 14, name: '안양', keywords: ['도시', '안양천', '예술공원'] },
    { id: 15, name: '파주', keywords: ['헤이리', '출판단지', '임진각', 'DMZ', '예술', '북카페'] },
    { id: 16, name: '평택', keywords: ['항구', '미군기지', '송탄'] },
    { id: 17, name: '화성', keywords: ['융건릉', '용주사', '제부도', '바다'] },
    { id: 18, name: '김포', keywords: ['공항', '김포공항', '한강', '애기봉'] },
    { id: 19, name: '광명', keywords: ['동굴', '광명동굴', 'KTX'] },
    { id: 20, name: '이천', keywords: ['도자기', '쌀', '온천', '세라피아'] },
    { id: 21, name: '양평', keywords: ['자연', '두물머리', '세미원', '힐링', '강', '수목원'] },
    { id: 22, name: '가평', keywords: ['남이섬', '쁘띠프랑스', '아침고요수목원', '자연', '힐링', '계곡'] },
    { id: 23, name: '포천', keywords: ['아트밸리', '허브아일랜드', '산정호수', '자연'] },
    { id: 24, name: '춘천', keywords: ['닭갈비', '호수', '남이섬', '소양강', '스카이워크', '맛집'] },
    { id: 25, name: '강릉', keywords: ['바다', '커피', '카페', '경포대', '정동진', '일출', '해변', '순두부'] },
    { id: 26, name: '속초', keywords: ['바다', '설악산', '산', '등산', '오징어', '수산시장', '아바이마을', '회'] },
    { id: 27, name: '원주', keywords: ['치악산', '등산', '산', '자연'] },
    { id: 28, name: '동해', keywords: ['바다', '해변', '추암', '촛대바위', '일출'] },
    { id: 29, name: '태백', keywords: ['산', '탄광', '눈꽃축제', '겨울', '스키'] },
    { id: 30, name: '삼척', keywords: ['바다', '동굴', '환선굴', '대금굴', '해변'] },
    { id: 31, name: '평창', keywords: ['스키', '겨울', '올림픽', '산', '용평'] },
    { id: 32, name: '양양', keywords: ['바다', '서핑', '해변', '낙산사', '하조대'] },
    { id: 33, name: '청주', keywords: ['도시', '직지', '인쇄', '상당산성', '문화'] },
    { id: 34, name: '충주', keywords: ['호수', '충주호', '탄금대', '사과', '자연'] },
    { id: 35, name: '제천', keywords: ['약초', '한방', '청풍호', '의림지', '자연'] },
    { id: 36, name: '천안', keywords: ['호두과자', '독립기념관', '역사', '맛집'] },
    { id: 37, name: '아산', keywords: ['온양온천', '온천', '현충사', '이순신', '역사'] },
    { id: 38, name: '공주', keywords: ['역사', '백제', '공산성', '무령왕릉', '전통', '문화재'] },
    { id: 39, name: '보령', keywords: ['바다', '머드', '축제', '해수욕장', '대천'] },
    { id: 40, name: '서산', keywords: ['바다', '간월암', '마애삼존불', '석불', '역사'] },
    { id: 41, name: '당진', keywords: ['바다', '왜목마을', '일출', '일몰'] },
    { id: 42, name: '부여', keywords: ['역사', '백제', '궁남지', '정림사지', '문화재', '전통'] },
    { id: 43, name: '전주', keywords: ['한옥', '전통', '한옥마을', '비빔밥', '콩나물국밥', '맛집', '한복'] },
    { id: 44, name: '군산', keywords: ['근대', '역사', '이성당', '빵', '항구', '경암동'] },
    { id: 45, name: '익산', keywords: ['역사', '백제', '미륵사지', '보석', '문화재'] },
    { id: 46, name: '정읍', keywords: ['내장산', '단풍', '산', '등산', '자연'] },
    { id: 47, name: '남원', keywords: ['춘향', '전통', '광한루', '지리산', '산'] },
    { id: 48, name: '목포', keywords: ['바다', '항구', '유달산', '갓바위', '회', '해산물'] },
    { id: 49, name: '여수', keywords: ['바다', '밤바다', '야경', '낭만', '케이블카', '오동도', '향일암'] },
    { id: 50, name: '순천', keywords: ['순천만', '정원', '갈대', '습지', '자연', '생태'] },
    { id: 51, name: '광양', keywords: ['매화', '꽃', '섬진강', '불고기', '맛집'] },
    { id: 52, name: '담양', keywords: ['대나무', '죽녹원', '메타세쿼이아', '자연', '힐링'] },
    { id: 53, name: '보성', keywords: ['녹차', '차밭', '자연', '힐링', '드라이브'] },
    { id: 54, name: '포항', keywords: ['바다', '호미곶', '일출', '과메기', '회', '항구'] },
    { id: 55, name: '경주', keywords: ['역사', '문화재', '불국사', '석굴암', '첨성대', '신라', '전통'] },
    { id: 56, name: '구미', keywords: ['공업', 'IT', '도시'] },
    { id: 57, name: '안동', keywords: ['하회마을', '전통', '한옥', '탈춤', '간고등어', '역사'] },
    { id: 58, name: '김천', keywords: ['직지사', '산', '사찰', '포도'] },
    { id: 59, name: '영주', keywords: ['부석사', '소수서원', '사찰', '역사', '전통'] },
    { id: 60, name: '창원', keywords: ['도시', '공업', '진해', '벚꽃', '축제'] },
    { id: 61, name: '진주', keywords: ['진주성', '역사', '비빔밥', '맛집', '남강'] },
    { id: 62, name: '통영', keywords: ['바다', '케이블카', '한려수도', '회', '해산물', '섬'] },
    { id: 63, name: '사천', keywords: ['바다', '해변', '항공', '공항'] },
    { id: 64, name: '김해', keywords: ['가야', '역사', '공항', '김해공항', '수로왕릉'] },
    { id: 65, name: '거제', keywords: ['바다', '섬', '해금강', '외도', '조선소'] },
    { id: 66, name: '양산', keywords: ['통도사', '사찰', '신불산', '산', '자연'] },
    { id: 67, name: '제주', keywords: ['섬', '바다', '한라산', '오름', '돌하르방', '흑돼지', '감귤', '휴양', '힐링'] },
    { id: 68, name: '서귀포', keywords: ['바다', '섬', '폭포', '정방폭포', '천지연', '감귤', '자연'] }
  ], []);

  // 한글 초성 추출 함수
  const getChosung = useCallback((str) => {
    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    let result = '';

    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i) - 44032;
      if (code > -1 && code < 11172) {
        result += CHOSUNG[Math.floor(code / 588)];
      } else {
        result += str.charAt(i);
      }
    }
    return result;
  }, []);

  // 초성 매칭 함수
  const matchChosung = useCallback((text, search) => {
    const textChosung = getChosung(text);
    const searchChosung = getChosung(search);

    return textChosung.includes(searchChosung) || textChosung.includes(search);
  }, [getChosung]);

  // 검색어 입력 핸들러 (자동완성)
  const handleSearchInput = useCallback((value) => {
    setSearchQuery(value);

    if (!value.trim()) {
      setFilteredRegions([]);
      setSearchSuggestions([]);
      return;
    }

    const query = value.trim();
    const queryLower = query.toLowerCase();
    const suggestions = [];
    const uniqueNames = new Set();

    // 단어 완성 여부 확인 (한글 2글자 이상 완성형인 경우)
    // 예: "서울", "경주" 같은 완성된 단어만 자동완성
    const isWordComplete = /[가-힣]{2,}/.test(query) || query.length >= 3;

    // 단어가 완성된 경우에만 자동완성 표시
    if (!isWordComplete) {
      // 단어가 완성되지 않았으면 자동완성 표시하지 않음
      setSearchSuggestions([]);
      setFilteredRegions([]);
      return;
    }

    // 1. 지역명 검색 (단어가 완성된 경우에만, 초성 검색 없이)
    const matchedRegions = recommendedRegions.filter(region => {
      const matchesName = region.name.toLowerCase().includes(queryLower);
      // 단어가 완성된 경우에는 초성 검색 사용하지 않음 (같은 초성을 사용하는 다른 지역 제외)
      return matchesName;
    });

    matchedRegions.forEach(region => {
      if (!uniqueNames.has(region.name)) {
        uniqueNames.add(region.name);
        suggestions.push({
          type: 'region',
          name: region.name,
          display: region.name
        });
      }
    });

    // 2. Kakao Places API로 실시간 장소 검색 (단어가 완성된 경우에만)
    // 예: "서울" 입력 시 "서울역", "서울광장" 등 "서울"로 시작하는 장소들 추천
    if (window.kakao && window.kakao.maps && window.kakao.maps.services && isWordComplete) {
      const placesService = new window.kakao.maps.services.Places();

      // 검색어로 시작하는 장소들을 찾기 위해 키워드 검색
      placesService.keywordSearch(query, (data, status) => {
        if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
          const tempKakaoSuggestions = [];
          const tempUniqueNames = new Set(uniqueNames);

          // 검색 결과를 필터링: 검색어로 시작하거나 검색어를 포함하는 장소만
          data.forEach(place => {
            const placeName = place.place_name;
            const categoryCode = place.category_group_code || '';
            const categoryName = place.category_name || '';

            // 검색어가 장소명에 포함되어 있는지 확인 (겹치는 단어 검색)
            const placeNameLower = placeName.toLowerCase();
            const queryWords = queryLower.split(/\s+/);
            const hasMatchingKeyword = queryWords.some(word =>
              placeNameLower.includes(word) || placeNameLower.startsWith(word)
            );

            if (hasMatchingKeyword && !tempUniqueNames.has(placeName)) {
              tempUniqueNames.add(placeName);

              let placeType = 'kakao_place';

              // 카테고리별 타입 설정
              if (categoryCode === 'CT1' || categoryName.includes('관광') || categoryName.includes('명소')) {
                placeType = 'tourist';
              } else if (categoryCode === 'FD6' || categoryName.includes('음식점') || categoryName.includes('레스토랑')) {
                placeType = 'restaurant';
              } else if (categoryCode === 'CE7' || categoryName.includes('카페')) {
                placeType = 'cafe';
              } else if (categoryCode === 'PO3' || categoryName.includes('공원')) {
                placeType = 'park';
              }

              tempKakaoSuggestions.push({
                type: placeType,
                name: placeName,
                display: placeName,
                address: place.address_name,
                roadAddress: place.road_address_name,
                lat: parseFloat(place.y),
                lng: parseFloat(place.x),
                category: categoryName,
                kakaoPlace: true
              });
            }
          });

          // 검색어로 시작하는 것을 우선순위로 정렬
          tempKakaoSuggestions.sort((a, b) => {
            const aStartsWith = a.name.toLowerCase().startsWith(queryLower);
            const bStartsWith = b.name.toLowerCase().startsWith(queryLower);
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            return a.name.length - b.name.length;
          });

          // Kakao 검색 결과를 기존 suggestions와 합치기
          setSearchSuggestions(prev => {
            const combined = [...prev, ...tempKakaoSuggestions];
            // 중복 제거
            const unique = [];
            const seen = new Set();
            combined.forEach(item => {
              if (!seen.has(item.name)) {
                seen.add(item.name);
                unique.push(item);
              }
            });
            return unique.slice(0, 15);
          });
        }
      });
    }

    // 3. 해시태그 검색 (#로 시작하는 경우)
    if (value.startsWith('#')) {
      const localPosts = getUploadedPostsSafe();
      const allPosts = getCombinedPosts(localPosts);
      const allTagsSet = new Set();

      allPosts.forEach(post => {
        const tags = post.tags || [];
        const aiLabels = post.aiLabels || [];

        tags.forEach(tag => {
          const tagText = typeof tag === 'string' ? tag.replace(/^#+/, '').toLowerCase() : String(tag).replace(/^#+/, '').toLowerCase();
          if (tagText && tagText.includes(queryLower.replace(/^#+/, ''))) {
            allTagsSet.add(tagText);
          }
        });

        aiLabels.forEach(label => {
          const labelText = label.name?.toLowerCase() || String(label).toLowerCase();
          if (labelText && labelText.includes(queryLower.replace(/^#+/, ''))) {
            allTagsSet.add(labelText);
          }
        });
      });

      // 해시태그 제안 추가
      Array.from(allTagsSet).slice(0, 5).forEach(tag => {
        if (!uniqueNames.has(`#${tag}`)) {
          uniqueNames.add(`#${tag}`);
          suggestions.push({
            type: 'hashtag',
            name: `#${tag}`,
            display: `#${tag}`,
            tag: tag
          });
        }
      });
    }

    // 4. 게시물에서 장소명 검색 (단어가 완성된 경우에만, Kakao 검색 결과와 중복되지 않는 것만)
    if (isWordComplete) {
      const matchingPosts = searchInPosts(value);
      const sortedPosts = [...matchingPosts].sort((a, b) => {
        const aPlaceName = (a.placeName || a.detailedLocation || a.location || '').toLowerCase();
        const bPlaceName = (b.placeName || b.detailedLocation || b.location || '').toLowerCase();
        const queryLowerForSort = value.toLowerCase().trim();

        const aStartsWith = aPlaceName.startsWith(queryLowerForSort);
        const bStartsWith = bPlaceName.startsWith(queryLowerForSort);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        return aPlaceName.length - bPlaceName.length;
      });

      sortedPosts.slice(0, 5).forEach(post => {
        const placeName = post.placeName || post.detailedLocation || post.location;
        if (placeName && !uniqueNames.has(placeName)) {
          uniqueNames.add(placeName);
          suggestions.push({
            type: 'place',
            name: placeName,
            display: `${placeName}${post.location && placeName !== post.location ? ` (${post.location})` : ''}`,
            post: post
          });
        }
      });
    }

    // 완성된 단어 기반 추천: 키워드가 추천 타입에 매핑되면 getRecommendedRegions 결과를 상단에 표시
    let recommended = [];
    if (isWordComplete) {
      const recType = getRecommendationTypeForKeyword(query);
      if (recType) {
        try {
          const localPosts = getUploadedPostsSafe();
          const allPosts = getCombinedPosts(localPosts);
          const recList = getRecommendedRegions(allPosts, recType);
          recommended = recList.map(r => ({
            type: 'recommended_region',
            regionName: r.regionName,
            title: r.title,
            display: r.badge ? `${r.title} · ${r.badge}` : r.title,
            badge: r.badge,
            description: r.description
          }));
        } catch (e) {
          logger.warn('단어 기반 추천 조회 실패:', e);
        }
      }
    }
    const recommendedNames = new Set(recommended.map(r => r.regionName));
    const others = suggestions.filter(s => !(s.name && recommendedNames.has(s.name)));
    const finalSuggestions = [...recommended, ...others].slice(0, 15);
    setSearchSuggestions(finalSuggestions);
  }, [recommendedRegions, matchChosung]);

  // 자동완성 항목 클릭 핸들러
  const handleSuggestionClick = useCallback((suggestion) => {
    const query = suggestion.regionName || suggestion.name || suggestion.title;
    setSearchQuery(query);

    // 지도 화면에서는 최근 검색어에 저장하지 않음 (검색화면에서만 저장)
    // 최근 검색 지역에 추가하지 않음

    setShowSearchSheet(false);

    // 검색 실행 - 위치로 이동
    if (suggestion.kakaoPlace && suggestion.lat && suggestion.lng) {
      // Kakao Places API에서 가져온 장소의 경우 - 직접 좌표로 이동
      if (map) {
        const position = new window.kakao.maps.LatLng(suggestion.lat, suggestion.lng);
        map.panTo(position);
        map.setLevel(3);

        // 검색 마커 표시
        createSearchMarker(position, suggestion.name, map);

        setSearchResults([]);
        setIsSearching(false);
        if (map) {
          loadPosts(map);
        }
      }
    } else if (suggestion.type === 'place' && suggestion.post) {
      void (async () => {
        const post = await enrichPostWithResolvedCoordinates(suggestion.post);
        const coords = coordsFromPostObject(post);
        if (coords && coords.lat && coords.lng && map) {
          const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
          map.panTo(position);
          map.setLevel(3);
          createSearchMarker(position, suggestion.name, map);
          setSearchResults([post]);
          setIsSearching(true);
          loadPosts(map, { forceSearch: { results: [post] } });
        }
      })();
    } else if (suggestion.type === 'recommended_region' && suggestion.regionName) {
      void (async () => {
        let coords = getCoordsByRegion(suggestion.regionName);
        if (!coords) {
          const geo = await searchPlaceWithKakaoFirst(suggestion.regionName);
          if (geo && geo.lat != null && geo.lng != null) {
            coords = { lat: Number(geo.lat), lng: Number(geo.lng) };
          }
        }
        if (!coords || !map) return;
        const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
        map.panTo(position);
        map.setLevel(4);
        createSearchMarker(position, suggestion.regionName, map);
        try {
          const localPosts = getUploadedPostsSafe();
          const allPosts = getCombinedPosts(localPosts);
          const regionPosts = allPosts.filter(p =>
            (p.location && (p.location.includes(suggestion.regionName) || p.location === suggestion.regionName)) ||
            (p.detailedLocation && (p.detailedLocation.includes(suggestion.regionName) || p.detailedLocation === suggestion.regionName))
          );
          setSearchResults(regionPosts);
          setIsSearching(true);
          loadPosts(map, { forceSearch: { results: regionPosts } });
        } catch (e) {
          logger.warn('추천 지역 게시물 로드 실패:', e);
        }
      })();
    } else if (suggestion.type === 'hashtag') {
      // 해시태그의 경우 - 해시태그 검색 실행
      setTimeout(() => {
        handleSearch({ preventDefault: () => { } });
      }, 100);
    } else {
      // 지역명 및 기타의 경우 - 검색 실행
      setTimeout(() => {
        handleSearch({ preventDefault: () => { } });
      }, 100);
    }
  }, [map, recentSearches]);

  // 최근 검색 지역 로드
  useEffect(() => {
    const savedRecentSearches = localStorage.getItem('recentSearches');
    if (savedRecentSearches) {
      try {
        setRecentSearches(JSON.parse(savedRecentSearches));
      } catch (e) {
        logger.error('최근 검색 지역 로드 실패:', e);
      }
    }
  }, []);

  // 필터 영역 마우스 휠로 좌우 스크롤 (passive: false로 preventDefault 동작)
  useEffect(() => {
    const el = filterScrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return; // 스크롤 불필요 시 휠은 페이지로 전달
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [sheetOffset, setSheetOffset] = useState(0); // 시트 오프셋 (0 = 보임, 큰 값 = 숨김)
  const [mapInitialized, setMapInitialized] = useState(false);
  const [isSheetHidden, setIsSheetHidden] = useState(false); // 시트가 완전히 숨겨졌는지 여부
  const [sheetHeight, setSheetHeight] = useState(200); // 시트의 실제 높이
  const [selectedPost, setSelectedPost] = useState(null); // 선택된 게시물 (상세화면용)
  const [selectedPinId, setSelectedPinId] = useState(null); // 지도/시트에서 선택된 핀 ID (강조 표시용)
  const [pinDetailView, setPinDetailView] = useState(null); // 지도 핀 또는 하단 시트 선택 시 보여줄 설명 카드 { post } (통일)
  const [showSOSModal, setShowSOSModal] = useState(false); // 1단계: 위치 선택 모달
  const [selectedSOSLocation, setSelectedSOSLocation] = useState(null); // 선택된 도움 요청 위치
  const [sosQuestion, setSosQuestion] = useState(''); // 궁금한 내용
  const [sosLocationSearch, setSosLocationSearch] = useState('');
  const [sosLocationSuggestions, setSosLocationSuggestions] = useState([]);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false); // 지도에서 위치 선택 중인지 여부
  const [showAdModal, setShowAdModal] = useState(false); // 등록 직후 스폰서 영상 모달
  const [adPlaybackProgress, setAdPlaybackProgress] = useState(0); // 0~100
  const sosMarkerRef = useRef(null); // 도움 요청 위치 마커
  const centerMarkerRef = useRef(null); // 지도 중심 고정 마커 (HTML 요소)
  const crosshairRef = useRef(null); // 가운데 표시선 (십자선)
  const locationPreviewMapRef = useRef(null); // 위치 미리보기 작은 지도
  const [isRouteMode, setIsRouteMode] = useState(false); // 경로 모드 활성화 여부
  const [selectedRoutePins, setSelectedRoutePins] = useState([]); // 선택된 경로 핀들
  const [savedRoute, setSavedRoute] = useState(null); // 저장된 경로 (표시용)
  const [showSavedRoutesPanel, setShowSavedRoutesPanel] = useState(false); // 최근 경로 2개 패널
  const [showRouteSavedToast, setShowRouteSavedToast] = useState(false); // 경로 저장 완료 토스트
  const routePolylineRef = useRef(null); // 경로 선 객체
  const isRouteModeRef = useRef(false); // 최신 경로 모드 상태 저장용 ref
  const setSelectedPinIdRef = useRef(() => {});
  const setPinDetailViewRef = useRef(() => {});
  /** 지도 검색 시트와 동일한 흐름: 지역·추천·제보·카카오 키워드 자동완성 */
  const handleSOSLocationInput = useCallback((value) => {
    setSosLocationSearch(value);
    if (!value.trim()) {
      setSosLocationSuggestions([]);
      return;
    }
    const query = value.trim();
    const queryLower = query.toLowerCase();
    const isWordComplete = /[가-힣]{2,}/.test(query) || query.length >= 3;
    if (!isWordComplete) {
      setSosLocationSuggestions([]);
      return;
    }

    const suggestions = [];
    const uniqueNames = new Set();

    recommendedRegions.forEach((region) => {
      if (!region.name.toLowerCase().includes(queryLower)) return;
      if (uniqueNames.has(region.name)) return;
      uniqueNames.add(region.name);
      const coords = getCoordsByRegion(region.name);
      suggestions.push({
        id: `sos-region-${region.name}`,
        type: 'region',
        name: region.name,
        display: region.name,
        lat: coords?.lat,
        lng: coords?.lng,
      });
    });

    const matchingPosts = searchInPosts(value);
    const sortedPosts = [...matchingPosts].sort((a, b) => {
      const aPlaceName = (a.placeName || a.detailedLocation || a.location || '').toLowerCase();
      const bPlaceName = (b.placeName || b.detailedLocation || b.location || '').toLowerCase();
      const q = value.toLowerCase().trim();
      const aStartsWith = aPlaceName.startsWith(q);
      const bStartsWith = bPlaceName.startsWith(q);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return aPlaceName.length - bPlaceName.length;
    });

    sortedPosts.slice(0, 6).forEach((post) => {
      const placeName = post.placeName || post.detailedLocation || post.location;
      if (!placeName || uniqueNames.has(placeName)) return;
      uniqueNames.add(placeName);
      const coords = post.coordinates || getCoordsByRegion(placeName);
      suggestions.push({
        id: `sos-post-${placeName}`,
        type: 'place',
        name: placeName,
        display: `${placeName}${post.location && post.location !== placeName ? ` (${post.location})` : ''}`,
        lat: coords?.lat,
        lng: coords?.lng,
        post,
      });
    });

    let recommended = [];
    const recType = getRecommendationTypeForKeyword(query);
    if (recType) {
      try {
        const localPosts = getUploadedPostsSafe();
        const allPosts = getCombinedPosts(localPosts);
        const recList = getRecommendedRegions(allPosts, recType);
        recommended = recList.map((r) => ({
          id: `sos-rec-${r.regionName}`,
          type: 'recommended_region',
          regionName: r.regionName,
          title: r.title,
          name: r.regionName,
          display: r.badge ? `${r.title} · ${r.badge}` : r.title,
          badge: r.badge,
        }));
      } catch (e) {
        logger.warn('SOS 추천 지역 조회 실패:', e);
      }
    }

    const recommendedNames = new Set(recommended.map((r) => r.regionName));
    const others = suggestions.filter((s) => !(s.name && recommendedNames.has(s.name)));
    const finalSuggestions = [...recommended, ...others].slice(0, 15);
    setSosLocationSuggestions(finalSuggestions);

    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      const placesService = new window.kakao.maps.services.Places();
      placesService.keywordSearch(query, (data, status) => {
        if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(data)) {
          return;
        }
        const tempKakao = [];
        const seen = new Set(uniqueNames);
        data.forEach((place) => {
          const placeName = place.place_name;
          const placeNameLower = placeName.toLowerCase();
          const queryWords = queryLower.split(/\s+/);
          const hasMatchingKeyword = queryWords.some(
            (word) => placeNameLower.includes(word) || placeNameLower.startsWith(word)
          );
          if (!hasMatchingKeyword || seen.has(placeName)) return;
          seen.add(placeName);
          const categoryCode = place.category_group_code || '';
          const categoryName = place.category_name || '';
          let placeType = 'kakao_place';
          if (categoryCode === 'CT1' || categoryName.includes('관광') || categoryName.includes('명소')) {
            placeType = 'tourist';
          } else if (categoryCode === 'FD6' || categoryName.includes('음식점')) {
            placeType = 'restaurant';
          } else if (categoryCode === 'CE7' || categoryName.includes('카페')) {
            placeType = 'cafe';
          } else if (categoryCode === 'PO3' || categoryName.includes('공원')) {
            placeType = 'park';
          }
          tempKakao.push({
            id: `sos-kakao-${placeName}-${place.x}`,
            type: placeType,
            kakaoPlace: true,
            name: placeName,
            display: placeName,
            address: place.road_address_name || place.address_name || '',
            roadAddress: place.road_address_name,
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            category: categoryName,
          });
        });
        tempKakao.sort((a, b) => {
          const aS = a.name.toLowerCase().startsWith(queryLower);
          const bS = b.name.toLowerCase().startsWith(queryLower);
          if (aS && !bS) return -1;
          if (!aS && bS) return 1;
          return a.name.length - b.name.length;
        });

        setSosLocationSuggestions((prev) => {
          const nonKakao = prev.filter((s) => !s.kakaoPlace);
          const combined = [...nonKakao, ...tempKakao];
          const uniq = [];
          const seenK = new Set();
          combined.forEach((item) => {
            const key = item.name || item.regionName;
            if (key && !seenK.has(key)) {
              seenK.add(key);
              uniq.push(item);
            }
          });
          return uniq.slice(0, 18);
        });
      });
    }
  }, [recommendedRegions, searchInPosts]);
  // isRouteMode 값이 바뀔 때마다 ref에도 반영 (마커 클릭 핸들러에서 최신 값 사용)
  useEffect(() => {
    isRouteModeRef.current = isRouteMode;
  }, [isRouteMode]);
  useEffect(() => {
    setSelectedPinIdRef.current = setSelectedPinId;
    setPinDetailViewRef.current = setPinDetailView;
  }, []);

  // 지도를 열자마자 내 위치로 나오게 하기 위해 지오로케이션 요청
  useEffect(() => {
    if (!mapInitialized) {
      const defaultLocation = { lat: 37.5665, lng: 126.9780 }; // 서울 시청

      if (navigator.geolocation) {
        // 5초 타임아웃으로 위치 정보를 가져와보고, 실패하면 서울 시청에서 시작
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            };
            logger.log('📍 초기 접속 내위치 획득 성공:', loc);
            initializeMap(loc);
            setCurrentLocation(loc);
          },
          (error) => {
            logger.warn('📍 초기 내위치 획득 실패 (서울로 대체):', error);
            // 위치 권한 거부/오류 시 기본 위치(서울)로 보여주되, 사용자에게 이유를 안내
            initializeMap(defaultLocation);
            setCurrentLocation(defaultLocation);
            try {
              // 권한 거부 등으로 인해 실제 위치가 아닌 서울로 표시된다는 안내
              alert('현재 위치 정보를 가져올 수 없어 기본 위치(서울) 지도를 먼저 보여주고 있어요.\n브라우저 위치 권한을 허용하면 더 정확한 위치가 표시됩니다.');
            } catch {
              // alert 실패는 무시
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          }
        );
      } else {
        initializeMap(defaultLocation);
        setCurrentLocation(defaultLocation);
      }
    }
  }, [mapInitialized]);

  // 화면이 열릴 때마다 내 위치로 이동
  useEffect(() => {
    if (map && currentLocation && currentLocation.lat && currentLocation.lng) {
      // 지도가 완전히 로드된 후 내 위치로 이동
      const timer = setTimeout(() => {
        const moveLatLon = new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
        map.setCenter(moveLatLon);
        map.setLevel(4); // 적절한 줌 레벨 설정
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [map, currentLocation]);

  // 현재 위치 마커 업데이트
  const updateCurrentLocationMarker = (kakaoMap, location) => {
    if (!kakaoMap || !location) return;

    // 기존 마커 제거
    if (currentLocationMarkerRef.current) {
      if (currentLocationMarkerRef.current.marker) {
        currentLocationMarkerRef.current.marker.setMap(null);
      }
      currentLocationMarkerRef.current = null;
    }

    const lat = location.lat;
    const lng = location.lng;
    const position = new window.kakao.maps.LatLng(lat, lng);

    // 현재 위치 마커 (하늘색 원점 + 파동 효과)
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        position: relative;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- 파동 1 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.25);
          animation: pulse1 2s infinite;
        "></div>
        <!-- 파동 2 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.2);
          animation: pulse2 2s infinite;
        "></div>
        <!-- 파동 3 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.15);
          animation: pulse3 2s infinite;
        "></div>
        <!-- 하늘색 원점 -->
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          background: #26C6DA;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          z-index: 1000;
          cursor: pointer;
        "></div>
      </div>
      <style>
        @keyframes pulse1 {
          0% { transform: scale(1); opacity: 0.25; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes pulse2 {
          0% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes pulse3 {
          0% { transform: scale(1); opacity: 0.15; }
          100% { transform: scale(4); opacity: 0; }
        }
      </style>
    `;

    const marker = new window.kakao.maps.CustomOverlay({
      position: position,
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 1000
    });

    marker.setMap(kakaoMap);

    // ref에 마커만 저장 (원 제거)
    currentLocationMarkerRef.current = { marker };
  };

  const initializeMap = (initialCenter) => {
    const initMap = () => {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(initMap, 100);
        return;
      }

      const container = mapRef.current;
      if (!container) return;

      const selectedPin = location.state?.selectedPin;
      const sosLocation = location.state?.sosLocation;

      // 지도 중심 좌표 결정
      let center;
      if (selectedPin) {
        center = new window.kakao.maps.LatLng(selectedPin.lat, selectedPin.lng);
        logger.log('📍 지도 초기화: 선택된 핀 위치 사용', { lat: selectedPin.lat, lng: selectedPin.lng });
      } else if (sosLocation) {
        center = new window.kakao.maps.LatLng(sosLocation.lat, sosLocation.lng);
        logger.log('📍 지도 초기화: SOS 위치 사용', { lat: sosLocation.lat, lng: sosLocation.lng });
      } else {
        center = new window.kakao.maps.LatLng(initialCenter.lat, initialCenter.lng);
        logger.log('📍 지도 초기화: 현재 위치 사용', {
          lat: initialCenter.lat.toFixed(6),
          lng: initialCenter.lng.toFixed(6)
        });
      }

      const options = {
        center: center,
        level: selectedPin ? 3 : 4
      };

      const kakaoMap = new window.kakao.maps.Map(container, options);
      setMap(kakaoMap);
      setMapInitialized(true);

      // 현재 위치 마커 추가 (항상 실제 GPS 위치 사용)
      if (initialCenter && initialCenter.lat && initialCenter.lng) {
        logger.log('📍 현재 위치 마커 추가:', {
          lat: initialCenter.lat.toFixed(6),
          lng: initialCenter.lng.toFixed(6)
        });
        // 지도가 완전히 로드된 후 마커 추가
        setTimeout(() => {
          updateCurrentLocationMarker(kakaoMap, initialCenter);
        }, 300);
      }

      // 현재 위치가 있으면 마커 표시
      if (currentLocation && currentLocation.lat && currentLocation.lng) {
        setTimeout(() => {
          updateCurrentLocationMarker(kakaoMap, currentLocation);
        }, 500);
      }

      // 게시물 로딩을 지연시켜 지도가 먼저 표시되도록 (로딩 속도 개선)
      setTimeout(() => {
        loadPosts(kakaoMap);
      }, 100);

      // 경로 모드일 때 경로 다시 그리기
      if (isRouteMode && selectedRoutePins.length >= 2) {
        setTimeout(() => drawRoute(selectedRoutePins), 500);
      }

      // 지도 범위 변경 시 보이는 핀 업데이트 (디바운싱으로 성능 개선)
      let boundsUpdateTimeout = null;
      window.kakao.maps.event.addListener(kakaoMap, 'bounds_changed', () => {
        if (boundsUpdateTimeout) clearTimeout(boundsUpdateTimeout);
        boundsUpdateTimeout = setTimeout(() => {
          updateVisiblePins(kakaoMap);
        }, 100); // 300 -> 100으로 응답성 개선
      });

      // 지도가 멈췄을 때 최종 업데이트
      window.kakao.maps.event.addListener(kakaoMap, 'idle', () => {
        updateVisiblePins(kakaoMap);
      });

      // 초기 보이는 핀 업데이트를 지연 (지도가 완전히 로드된 후)
      setTimeout(() => updateVisiblePins(kakaoMap), 1000);



    };

    initMap();
  };



  const loadPosts = async (kakaoMap, options) => {
    try {
      // 검색 중이면 검색 결과만 사용 (options.forceSearch로 한 번에 반영된 결과 전달 가능)
      const effectiveSearch = (options?.forceSearch?.results != null)
        ? { active: true, results: options.forceSearch.results }
        : (isSearching && searchResults.length > 0 ? { active: true, results: searchResults } : { active: false, results: [] });
        if (effectiveSearch.active && effectiveSearch.results.length > 0) {
        let filteredResults = [...effectiveSearch.results].filter((post) => getPostAgeHours(post) < 48);

        // 필터 적용 (중복 선택 가능)
        if (selectedFilters.length > 0) {
          filteredResults = filteredResults.filter(post => {
            const category = post.category || 'general';
            const cats = Array.isArray(post.categories) ? post.categories : [];
            const hasCat = (slug) => category === slug || cats.includes(slug);
            // 활성화된 필터 중 하나라도 매칭되면 표시 (개화 / 가볼만한 곳만 지원)
            return selectedFilters.some(filter => {
              if (filter === 'bloom') return hasCat('bloom');
              if (filter === 'scenic') return hasCat('scenic') || hasCat('landmark');
              return false;
            });
          });
        }

        const searchEnriched = await enrichPostsList(filteredResults);
        setPosts(searchEnriched);
        createMarkers(searchEnriched, kakaoMap, selectedRoutePins, selectedPinId);
        return;
      }

      const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
      const supabasePosts = await fetchPostsSupabase();
      const combined = [
        ...(Array.isArray(supabasePosts) ? supabasePosts : []),
        ...(Array.isArray(localPosts) ? localPosts : [])
      ];
      const byId = new Map();
      combined.forEach((p) => {
        if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
      });
      const allPosts = getCombinedPosts(Array.from(byId.values()));

      let validPosts = allPosts.filter(post => {
        return post.coordinates || post.location || post.detailedLocation || post.region || post.placeName;
      });
      validPosts = validPosts.filter((post) => getPostAgeHours(post) < 48);

      // 필터 적용 (중복 선택 가능)
      if (selectedFilters.length > 0) {
        validPosts = validPosts.filter(post => {
          const category = post.category || 'general';
          const cats = Array.isArray(post.categories) ? post.categories : [];
          const hasCat = (slug) => category === slug || cats.includes(slug);
          // 활성화된 필터 중 하나라도 매칭되면 표시 (개화 / 가볼만한 곳만 지원)
          return selectedFilters.some(filter => {
            if (filter === 'bloom') return hasCat('bloom');
            if (filter === 'scenic') return hasCat('scenic') || hasCat('landmark');
            return false;
          });
        });
      }

      const mapEnriched = await enrichPostsList(validPosts);
      setPosts(mapEnriched);
      createMarkers(mapEnriched, kakaoMap, selectedRoutePins, selectedPinId);
    } catch (error) {
      logger.error('게시물 로드 실패:', error);
    }
  };

  // getCoordinatesByLocation 함수 제거 - import된 getCoordsByRegion 사용

  // 장소 타입 키워드 매핑
  const placeTypeKeywords = {
    '카페': { tags: ['카페', 'coffee', 'cafe'], category: null },
    '맛집': { tags: ['맛집', 'restaurant', 'food'], category: 'food' },
    '관광지': { tags: ['관광', 'tourist', 'landmark'], category: 'landmark' },
    '공원': { tags: ['공원', 'park', 'park'], category: 'scenic' },
    '가게': { tags: ['가게', 'shop', 'store'], category: null },
    '음식점': { tags: ['음식', 'restaurant', 'food'], category: 'food' },
    '식당': { tags: ['식당', 'restaurant', 'food'], category: 'food' },
    '레스토랑': { tags: ['restaurant', 'food'], category: 'food' }
  };

  // 게시물에서 장소명 검색 (모든 필드 검색)
  function searchInPosts(query) {
    const queryLower = query.toLowerCase().trim();
    const queryWithoutHash = queryLower.replace(/^#+/, ''); // # 제거

    // 모든 게시물 가져오기
    const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const allPosts = getCombinedPosts(Array.isArray(localPosts) ? localPosts : []);

    const validPosts = allPosts.filter(post => {
      return post.coordinates || post.location || post.detailedLocation;
    });

    // 해시태그 검색 (#로 시작하거나 해시태그 형식인 경우)
    const isHashtagSearch = query.startsWith('#') || queryWithoutHash.length > 0;
    if (isHashtagSearch) {
      const hashtagResults = validPosts.filter(post => {
        const tags = post.tags || [];
        const aiLabels = post.aiLabels || [];

        // 태그와 AI 라벨에서 검색
        const allTags = [
          ...tags.map(t => typeof t === 'string' ? t.toLowerCase().replace(/^#+/, '') : String(t).toLowerCase().replace(/^#+/, '')),
          ...aiLabels.map(l => l.name?.toLowerCase() || '').filter(Boolean)
        ];

        // 정확한 태그 매칭 또는 포함 매칭
        return allTags.some(tag =>
          tag === queryWithoutHash || tag.includes(queryWithoutHash)
        );
      });

      if (hashtagResults.length > 0) {
        return hashtagResults;
      }
    }

    // 장소 타입 키워드 확인
    for (const [type, config] of Object.entries(placeTypeKeywords)) {
      if (query.includes(type)) {
        return validPosts.filter(post => {
          // 카테고리 매칭
          if (config.category && post.category === config.category) {
            return true;
          }
          // 태그 매칭
          const tags = post.tags || [];
          const aiLabels = post.aiLabels || [];
          const allLabels = [
            ...tags.map(t => typeof t === 'string' ? t.toLowerCase() : String(t).toLowerCase()),
            ...aiLabels.map(l => l.name?.toLowerCase() || '').filter(Boolean)
          ];

          return config.tags.some(tag =>
            allLabels.some(label => label.includes(tag.toLowerCase()))
          );
        });
      }
    }

    // 구체적인 장소명 검색 - 모든 필드에서 검색 (예: "경주 불국사")
    const matchingPosts = validPosts.filter(post => {
      const location = (post.location || '').toLowerCase();
      const detailedLocation = (post.detailedLocation || '').toLowerCase();
      const placeName = (post.placeName || '').toLowerCase();
      const address = (post.address || '').toLowerCase();
      const note = (post.note || '').toLowerCase();

      // 태그와 AI 라벨도 검색 대상에 포함
      const tags = post.tags || [];
      const aiLabels = post.aiLabels || [];
      const allTags = [
        ...tags.map(t => typeof t === 'string' ? t.toLowerCase().replace(/^#+/, '') : String(t).toLowerCase().replace(/^#+/, '')),
        ...aiLabels.map(l => l.name?.toLowerCase() || '').filter(Boolean)
      ];
      const tagsText = allTags.join(' ');

      // 검색어 조합 검색 (예: "경주 불국사" -> "경주"와 "불국사" 모두 포함 또는 연속 검색)
      const searchTerms = queryLower.split(/\s+/).filter(term => term.length > 0);

      // 모든 검색어가 포함되어 있는지 확인
      const allTermsMatch = searchTerms.every(term => {
        const termWithoutHash = term.replace(/^#+/, '');
        return location.includes(termWithoutHash) ||
          detailedLocation.includes(termWithoutHash) ||
          placeName.includes(termWithoutHash) ||
          address.includes(termWithoutHash) ||
          note.includes(termWithoutHash) ||
          tagsText.includes(termWithoutHash) ||
          `${location} ${detailedLocation} ${placeName}`.includes(termWithoutHash);
      });

      // 또는 단일 검색어가 포함되어 있는지 확인
      const singleTermMatch = location.includes(queryLower) ||
        detailedLocation.includes(queryLower) ||
        placeName.includes(queryLower) ||
        address.includes(queryLower) ||
        note.includes(queryLower) ||
        tagsText.includes(queryWithoutHash) ||
        `${location} ${detailedLocation} ${placeName}`.includes(queryLower);

      return allTermsMatch || singleTermMatch;
    });

    if (matchingPosts.length > 0) {
      return matchingPosts;
    }

    // 매칭되는 게시물이 없으면 빈 배열 반환
    return [];
  }

  // Kakao Places API를 사용한 장소 검색 (단일 결과)
  const searchPlaceWithKakao = (query, callback) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      callback(null);
      return;
    }

    const places = new window.kakao.maps.services.Places();

    places.keywordSearch(query, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
        const firstResult = data[0];
        callback({
          name: firstResult.place_name,
          address: firstResult.address_name,
          roadAddress: firstResult.road_address_name,
          lat: parseFloat(firstResult.y),
          lng: parseFloat(firstResult.x),
          placeUrl: firstResult.place_url
        });
      } else {
        callback(null);
      }
    });
  };

  // Kakao Places API를 사용한 관광지 다중 검색
  const searchTouristAttractionsWithKakao = (query, callback) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      callback([]);
      return;
    }

    const placesService = new window.kakao.maps.services.Places();

    // 관광지 관련 키워드 확인
    const isTouristKeyword = ['관광지', '명소', 'tourist', 'attraction', 'landmark'].some(keyword =>
      query.toLowerCase().includes(keyword.toLowerCase())
    );

    // 지역명 제거하고 실제 검색어만 사용 (예: "서울 관광지" -> "서울")
    let searchQuery = query;
    if (isTouristKeyword) {
      // 지역명 추출
      const regionMatch = query.match(/(서울|부산|대구|인천|광주|대전|울산|경주|제주|전주|강릉|속초|여수|통영|안동|수원|성남|고양|용인|평택|화성)/);
      if (regionMatch) {
        searchQuery = regionMatch[1]; // 지역명만 사용
      } else {
        // 지역명이 없으면 전체 관광지 검색
        searchQuery = '관광지';
      }
    }

    // Kakao Places API 키워드 검색 (최대 15개 결과)
    placesService.keywordSearch(searchQuery, (data, status, pagination) => {
      if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
        // 관광지 카테고리 필터링 (CT1 = 관광지)
        const touristResults = data
          .filter(place => {
            const categoryCode = place.category_group_code || '';
            const categoryName = place.category_name || '';

            // CT1 = 관광지 카테고리이거나, 카테고리명에 '관광' 또는 '명소'가 포함된 경우
            return categoryCode === 'CT1' ||
              categoryName.includes('관광') ||
              categoryName.includes('명소') ||
              isTouristKeyword; // 관광지 키워드로 검색한 경우 모두 포함
          })
          .slice(0, 15) // 최대 15개
          .map(place => ({
            name: place.place_name,
            address: place.address_name,
            roadAddress: place.road_address_name,
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            placeUrl: place.place_url,
            category: place.category_name || ''
          }));

        callback(touristResults.length > 0 ? touristResults : data.slice(0, 10));
      } else {
        callback([]);
      }
    });
  };

  // 검색 결과 마커 표시 (하늘색 원점 + 파동 애니메이션)
  const createSearchMarker = (position, placeName, kakaoMap) => {
    // 기존 검색 마커 제거
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }

    // 검색 마커 생성 (하늘색 원점 + 여러 파동 - 현재 위치와 동일한 스타일)
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        position: relative;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- 파동 1 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.25);
          animation: searchPulse1 2s infinite;
        "></div>
        <!-- 파동 2 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.2);
          animation: searchPulse2 2s infinite;
        "></div>
        <!-- 파동 3 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.15);
          animation: searchPulse3 2s infinite;
        "></div>
        <!-- 하늘색 원점 -->
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #87CEEB;
          border: 4px solid rgba(255, 255, 255, 1);
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          z-index: 10;
        "></div>
      </div>
      <style>
        @keyframes searchPulse1 {
          0% {
            transform: scale(1);
            opacity: 0.25;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
        @keyframes searchPulse2 {
          0% {
            transform: scale(1);
            opacity: 0.2;
          }
          100% {
            transform: scale(3.5);
            opacity: 0;
          }
        }
        @keyframes searchPulse3 {
          0% {
            transform: scale(1);
            opacity: 0.15;
          }
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
      </style>
    `;

    const marker = new window.kakao.maps.CustomOverlay({
      position: position,
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 10000
    });

    marker.setMap(kakaoMap);
    searchMarkerRef.current = marker;
  };

  // 검색 핸들러
  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      // 검색어가 비어있으면 검색 결과 초기화
      setSearchResults([]);
      setKakaoSearchResults([]);
      setIsSearching(false);
      // 검색 마커 제거
      if (searchMarkerRef.current) {
        searchMarkerRef.current.setMap(null);
        searchMarkerRef.current = null;
      }
      // 관광지 마커 제거
      markersRef.current.forEach(markerData => {
        if (markerData.touristPlace && markerData.overlay) {
          markerData.overlay.setMap(null);
        }
      });
      markersRef.current = markersRef.current.filter(m => !m.touristPlace);
      if (map) {
        loadPosts(map);
      }
      return;
    }

    if (!map) return;

    const query = searchQuery.trim();

    // 게시물에서 먼저 검색
    const matchingPosts = searchInPosts(query);

    if (matchingPosts.length > 0) {
      void (async () => {
        const enriched = await enrichPostsList(matchingPosts);
        setSearchResults(enriched);
        setIsSearching(true);
        const firstPost = enriched[0];
        const coords = coordsFromPostObject(firstPost);
        if (coords && coords.lat && coords.lng) {
          const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
          map.panTo(position);
          map.setLevel(3);
          createSearchMarker(position, firstPost.placeName || firstPost.location, map);
        }
        createMarkers(enriched, map, selectedRoutePins, selectedPinId);
      })();
    } else {
      // 관광지 키워드 확인
      const isTouristKeyword = ['관광지', '명소', 'tourist', 'attraction', 'landmark'].some(keyword =>
        query.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isTouristKeyword) {
        // 관광지 다중 검색
        searchTouristAttractionsWithKakao(query, (touristPlaces) => {
          if (touristPlaces && touristPlaces.length > 0) {
            setKakaoSearchResults(touristPlaces);
            setSearchResults([]);
            setIsSearching(true);

            // 모든 관광지 마커 표시
            const bounds = new window.kakao.maps.LatLngBounds();
            touristPlaces.forEach((place, index) => {
              const position = new window.kakao.maps.LatLng(place.lat, place.lng);
              bounds.extend(position);

              // 각 관광지에 마커 표시
              if (index === 0) {
                // 첫 번째 관광지 위치로 지도 이동
                map.panTo(position);
                map.setLevel(5);
              }

              // 관광지 마커 생성 (파란색으로 구분)
              const el = document.createElement('div');
              el.innerHTML = `
                <div style="
                  width: 35px;
                  height: 35px;
                  background: #2196F3;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 3px 12px rgba(33, 150, 243, 0.5);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  position: relative;
                ">
                  <span style="
                    color: white;
                    font-size: 20px;
                    font-weight: bold;
                  ">🏛️</span>
                </div>
              `;

              const marker = new window.kakao.maps.CustomOverlay({
                position: position,
                content: el,
                yAnchor: 0.5,
                xAnchor: 0.5,
                zIndex: 9000 + index
              });

              marker.setMap(map);
              // 마커 참조 저장 (나중에 제거할 수 있도록)
              if (!markersRef.current.some(m => m.touristPlace && m.touristPlace.name === place.name)) {
                markersRef.current.push({ overlay: marker, touristPlace: place, position: position });
              }
            });

            // 검색된 관광지가 모두 보이도록 지도 범위 조정
            if (touristPlaces.length > 1) {
              map.setBounds(bounds);
            }

            // 모든 게시물도 함께 표시
            if (map) {
              loadPosts(map);
            }
          } else {
            // 관광지 검색 실패 시 일반 검색 시도
            searchPlaceWithKakao(query, (place) => {
              if (place) {
                const position = new window.kakao.maps.LatLng(place.lat, place.lng);
                map.panTo(position);
                map.setLevel(3);
                createSearchMarker(position, place.name, map);
                setSearchResults([]);
                setIsSearching(false);
                if (map) {
                  loadPosts(map);
                }
              } else {
                const coords = getCoordsByRegion(query);
                if (coords) {
                  setSearchResults([]);
                  setIsSearching(false);
                  const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
                  map.panTo(position);
                  map.setLevel(4);
                  createSearchMarker(position, query, map);
                  if (map) {
                    loadPosts(map);
                  }
                } else {
                  alert('검색 결과를 찾을 수 없습니다. 다른 검색어를 입력해주세요.');
                  setSearchResults([]);
                  setIsSearching(false);
                }
              }
            });
          }
        });
      } else {
        // 일반 장소 검색
        searchPlaceWithKakao(query, (place) => {
          if (place) {
            // 검색 결과 위치로 이동
            const position = new window.kakao.maps.LatLng(place.lat, place.lng);
            map.panTo(position);
            map.setLevel(3);

            // 검색 마커 표시
            createSearchMarker(position, place.name, map);

            // 검색 결과 초기화 (Kakao 검색은 게시물이 아니므로)
            setSearchResults([]);
            setIsSearching(false);

            // 모든 게시물 표시
            if (map) {
              loadPosts(map);
            }
          } else {
            // Kakao 검색도 실패하면 기본 지역명 검색 시도
            const coords = getCoordsByRegion(query);
            if (coords) {
              setSearchResults([]);
              setIsSearching(false);
              const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);
              map.panTo(position);
              map.setLevel(4);

              // 검색 마커 표시
              createSearchMarker(position, query, map);

              if (map) {
                loadPosts(map);
              }
            } else {
              alert('검색 결과를 찾을 수 없습니다. 다른 검색어를 입력해주세요.');
              setSearchResults([]);
              setIsSearching(false);
            }
          }
        });
      }
    }
  };

  // 필터 변경 또는 선택 핀 변경 시 게시물/마커 다시 로드 (선택 핀 강조 갱신)
  useEffect(() => {
    if (map) {
      loadPosts(map);
    }
  }, [selectedFilters, map, isSearching, searchResults, selectedPinId]);

  const createMarkers = (posts, kakaoMap, routePins = [], highlightedPinId = null) => {
    // 기존 게시물 마커만 제거 (관광지 마커는 유지)
    markersRef.current = markersRef.current.filter(markerData => {
      if (markerData.overlay && !markerData.touristPlace) {
        markerData.overlay.setMap(null);
        return false;
      }
      return true;
    });

    const bounds = new window.kakao.maps.LatLngBounds();
    let hasValidMarker = false;

    // 시트에서 선택한 핀은 반드시 첫 청크에 포함되도록 정렬 (이동 후 해당 위치에 핀이 바로 보이게)
    let orderedPosts = posts;
    if (highlightedPinId && posts.length > 1) {
      const highlighted = posts.find(p => p.id === highlightedPinId);
      if (highlighted) {
        orderedPosts = [highlighted, ...posts.filter(p => p.id !== highlightedPinId)];
      }
    }

    // 성능 최적화: 게시물이 많을 때 청크 단위로 처리 (50개씩)
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < orderedPosts.length; i += CHUNK_SIZE) {
      chunks.push(orderedPosts.slice(i, i + CHUNK_SIZE));
    }

    // 첫 번째 청크는 즉시 처리, 나머지는 지연 처리
    const processChunk = (chunk, chunkIndex) => {
      chunk.forEach((post, index) => {
        const globalIndex = chunkIndex * CHUNK_SIZE + index;
        let coords = null;
        const raw = post.coordinates;
        if (raw && (raw.lat != null || raw.latitude != null) && (raw.lng != null || raw.longitude != null)) {
          coords = { lat: Number(raw.lat ?? raw.latitude), lng: Number(raw.lng ?? raw.longitude) };
        } else {
          const locStr = post.detailedLocation || post.location || post.region || post.placeName || '';
          if (locStr) coords = getCoordsByRegion(locStr);
        }
        if (!coords || Number.isNaN(coords.lat) || Number.isNaN(coords.lng)) return;
        const lat = coords.lat;
        const lng = coords.lng;

        const position = new window.kakao.maps.LatLng(lat, lng);
        bounds.extend(position);

        // 핀 썸네일: 정지 이미지 우선, 없으면 동영상 첫 프레임(비디오 태그)
        const imageUrl = getPostPinImageUrl(post);
        const rawVideoUri = !imageUrl ? getFirstVideoUriFromPost(post) : '';
        const videoDisplayUrl = rawVideoUri ? getDisplayImageUrl(rawVideoUri) : '';

        // 선택된 핀(경로) 또는 현재 강조할 핀(지도/시트 선택)인지 확인
        const isSelected = routePins.some(p => p.post.id === post.id);
        const isHighlighted = highlightedPinId && post.id === highlightedPinId;
        const useHighlight = isSelected || isHighlighted;
        const ageVisual = getMapAgeVisual(post);
        const borderColor = useHighlight ? '#26C6DA' : 'white';
        const borderWidth = useHighlight ? '3px' : '2px';
        const boxShadow = useHighlight
          ? '0 2px 8px rgba(0, 188, 212, 0.35)'
          : '0 2px 8px rgba(0,0,0,0.25)';

        const PLACEHOLDER_SVG = MAP_PIN_PLACEHOLDER_SVG;
        const mediaInner = videoDisplayUrl
          ? `<video
            class="pin-video-thumb"
            muted
            playsinline
            webkit-playsinline="true"
            preload="metadata"
            width="50"
            height="50"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              background: #f5f5f5;
              opacity: ${ageVisual.imageOpacity};
              filter: ${ageVisual.imageFilter};
            "
          ></video>`
          : `<img 
            width="50"
            height="50"
            loading="eager"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              background: #f5f5f5;
              opacity: ${ageVisual.imageOpacity};
              filter: ${ageVisual.imageFilter};
            " 
            alt="${escapeHtmlAttr(post.location || '여행지')}"
          />`;
        const el = document.createElement('div');
        el.innerHTML = `
        <button 
          class="pin-btn" 
          style="
            z-index: ${index};
            width: 50px;
            height: 50px;
            border: ${borderWidth} solid ${borderColor};
            border-radius: 4px;
            box-shadow: ${boxShadow};
            overflow: hidden;
            cursor: pointer;
            padding: 0;
            margin: 0;
            background: #f5f5f5;
            transition: transform 0.2s ease;
            position: relative;
          " 
          data-post-id="${post.id}"
        >
          ${mediaInner}
          ${isSelected ? `
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              width: 20px;
              height: 20px;
              background: #26C6DA;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              color: white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">
              ${routePins.findIndex(p => p.post.id === post.id) + 1}
            </div>
          ` : ''}
        </button>
      `;

        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';
        el.style.position = 'relative';
        el.style.zIndex = '1';

        // 이미지/동영상 src는 JS로 설정 (URL 이스케이프·깨짐 방지)
        const vidThumb = el.querySelector('video.pin-video-thumb');
        if (vidThumb && videoDisplayUrl) {
          vidThumb.src = videoDisplayUrl;
          vidThumb.onerror = function onPinVideoError() {
            this.onerror = null;
            this.style.display = 'none';
            const fallback = document.createElement('img');
            fallback.width = 50;
            fallback.height = 50;
            fallback.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            fallback.alt = '';
            fallback.src = PLACEHOLDER_SVG;
            this.parentNode?.insertBefore(fallback, this);
          };
        }
        const img = el.querySelector('img');
        if (img) {
          img.src = imageUrl || PLACEHOLDER_SVG;
          img.onerror = function onPinImgError() {
            this.onerror = null;
            this.src = PLACEHOLDER_SVG;
          };
        }

        const button = el.querySelector('button');
        if (button) {
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            // 경로 모드일 때는 경로에 추가, 아니면 해당 위치로 이동 + 간단한 상세 표시
            if (isRouteModeRef.current) {
              handlePinSelectForRoute(post, position, index);
            } else if (kakaoMap && position) {
              setSelectedPinIdRef.current(post.id);
              setPinDetailViewRef.current({ post });
              // 화면은 이동하지 않고 해당 위치에서 상세만 표시
            }
          });

          button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.15)';
            button.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
          });

          button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 3px 12px rgba(0,0,0,0.3)';
          });
        }

        // 핀 미디어 프리로드
        if (imageUrl) {
          const preload = new Image();
          preload.src = imageUrl;
        } else if (videoDisplayUrl) {
          const pre = document.createElement('video');
          pre.preload = 'metadata';
          pre.src = videoDisplayUrl;
        }

        const overlay = new window.kakao.maps.CustomOverlay({
          position: position,
          content: el,
          yAnchor: 1,
          xAnchor: 0.5,
          zIndex: 1000 + index
        });

        overlay.setMap(kakaoMap);

        markersRef.current.push({ overlay, post, position });
        hasValidMarker = true;
      });
    };

    // 첫 번째 청크는 즉시 처리
    if (chunks.length > 0) {
      processChunk(chunks[0], 0);
    }

    // 나머지 청크는 지연 처리 (지도가 먼저 표시되도록)
    chunks.slice(1).forEach((chunk, chunkIndex) => {
      setTimeout(() => {
        processChunk(chunk, chunkIndex + 1);
      }, chunkIndex * 50); // 50ms 간격으로 처리
    });

    // 선택된 핀/위치로 지도 자동 이동
    const selectedPin = location.state?.selectedPin;
    const sosLocation = location.state?.sosLocation;
    if (selectedPin) {
      kakaoMap.setCenter(new window.kakao.maps.LatLng(selectedPin.lat, selectedPin.lng));
      kakaoMap.setLevel(3);
    } else if (sosLocation) {
      kakaoMap.setCenter(new window.kakao.maps.LatLng(sosLocation.lat, sosLocation.lng));
      kakaoMap.setLevel(3);
    }
  };

  const updateVisiblePins = (kakaoMap) => {
    if (!kakaoMap) return;

    const bounds = kakaoMap.getBounds();
    const visible = markersRef.current
      .filter(markerData => {
        if (!markerData.position) return false;
        // 마커가 실제 지도 위에 있는지 확인
        if (markerData.overlay && !markerData.overlay.getMap()) return false;

        return bounds.contain(markerData.position);
      })
      .map(markerData => {
        // 사용자가 올린 정보를 우선으로 표시 (placeName > detailedLocation > note > location 순)
        const title = markerData.post.placeName || 
                     markerData.post.detailedLocation || 
                     markerData.post.note || 
                     markerData.post.location || 
                     '여행지';
        const pinImg = getPostPinImageUrl(markerData.post);
        const rawVid = !pinImg ? getFirstVideoUriFromPost(markerData.post) : '';
        const videoUrl = rawVid ? getDisplayImageUrl(rawVid) : '';
        return {
          id: markerData.post.id,
          title: title,
          image: pinImg,
          videoUrl,
          lat: markerData.position.getLat(),
          lng: markerData.position.getLng(),
          post: markerData.post
        };
      });

    // 중복 제거 및 무결성 확인
    const uniqueVisible = Array.from(new Map(visible.map(p => [p.id, p])).values());
    setVisiblePins(uniqueVisible);
  };

  const handleSheetDragStart = (e) => {
    setIsDragging(true);
    setStartY(e.type === 'mousedown' ? e.clientY : e.touches[0].clientY);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    const deltaY = clientY - startY;
    // 아래로 드래그만 허용 (양수만)
    if (deltaY > 0) {
      setSheetOffset(deltaY);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // 100px 이상 드래그하면 시트를 완전히 숨김
    const sheetElement = sheetRef.current;
    if (sheetElement) {
      const sheetHeight = sheetElement.offsetHeight;
      const threshold = sheetHeight * 0.5; // 시트 높이의 50% 이상 드래그하면 숨김

      if (sheetOffset > threshold) {
        setSheetOffset(sheetHeight + 20); // 시트를 완전히 숨김 (약간의 여유 공간 추가)
        setIsSheetHidden(true);
      } else {
        setSheetOffset(0); // 원래 위치로
        setIsSheetHidden(false);
      }
    } else {
      setSheetOffset(0);
      setIsSheetHidden(false);
    }
  };

  const handleShowSheet = () => {
    setSheetOffset(0);
    setIsSheetHidden(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove);
      document.addEventListener('touchend', handleDragEnd);

      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, sheetOffset]);

  // 시트 높이 업데이트
  useEffect(() => {
    if (sheetRef.current) {
      const updateSheetHeight = () => {
        if (sheetRef.current) {
          setSheetHeight(sheetRef.current.offsetHeight);
        }
      };
      updateSheetHeight();
      window.addEventListener('resize', updateSheetHeight);
      return () => window.removeEventListener('resize', updateSheetHeight);
    }
  }, [visiblePins]);

  const handleZoomIn = () => {
    if (map) {
      const level = map.getLevel();
      if (level > 1) {
        map.setLevel(level - 1);
      }
    }
  };

  const handleZoomOut = () => {
    if (map) {
      const level = map.getLevel();
      if (level < 14) {
        map.setLevel(level + 1);
      }
    }
  };

  const handleCenterLocation = () => {
    if (!navigator.geolocation) {
      alert('위치 정보를 사용할 수 없는 브라우저입니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const newLoc = { lat, lng, accuracy };

        setCurrentLocation(newLoc);

        if (map) {
          updateCurrentLocationMarker(map, newLoc);
          const moveLatLon = new window.kakao.maps.LatLng(lat, lng);
          map.panTo(moveLatLon);
          map.setLevel(3);
        }
        logger.log('📍 사용자 요청으로 내 위치 업데이트:', newLoc);
      },
      (error) => {
        logger.error('📍 내 위치 업데이트 실패:', error);
        alert('현재 위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSOSRequest = () => {
    setSelectedSOSLocation(null);
    setSosLocationSearch('');
    setSosQuestion('');
    setIsSelectingLocation(false);
    setShowSOSModal(true);
  };

  /** 지도에서 위치 고른 뒤 1단계 모달로 복귀 (궁금한 내용 입력 → 바로 등록) */
  const finishSOSLocationSelection = () => {
    if (!selectedSOSLocation) {
      alert('위치를 선택해주세요.');
      return;
    }
    setIsSelectingLocation(false);
    setShowSOSModal(true);
    if (map && selectedSOSLocation && window.kakao?.maps) {
      updateSOSMarker(map, selectedSOSLocation);
      map.panTo(new window.kakao.maps.LatLng(selectedSOSLocation.lat, selectedSOSLocation.lng));
      map.setLevel(4);
    }
  };

  // 도움 요청 위치 마커 업데이트 (내 위치 표시와 동일한 스타일: 하늘색 원점 + 파동)
  const updateSOSMarker = (kakaoMap, location) => {
    // 기존 마커 제거
    if (sosMarkerRef.current) {
      sosMarkerRef.current.setMap(null);
      sosMarkerRef.current = null;
    }

    const position = new window.kakao.maps.LatLng(location.lat, location.lng);

    // 내 위치 마커와 동일: 하늘색 원점 + 여러 파동
    const el = document.createElement('div');
    el.innerHTML = `
      <div style="
        position: relative;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- 파동 1 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.25);
          animation: pulse1 2s infinite;
        "></div>
        <!-- 파동 2 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.2);
          animation: pulse2 2s infinite;
        "></div>
        <!-- 파동 3 -->
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: rgba(135, 206, 250, 0.15);
          animation: pulse3 2s infinite;
        "></div>
        <!-- 하늘색 원점 -->
        <div style="
          position: relative;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #87CEEB;
          border: 4px solid rgba(255, 255, 255, 1);
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          z-index: 10;
        "></div>
      </div>
      <style>
        @keyframes pulse1 {
          0% { transform: scale(1); opacity: 0.25; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes pulse2 {
          0% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        @keyframes pulse3 {
          0% { transform: scale(1); opacity: 0.15; }
          100% { transform: scale(4); opacity: 0; }
        }
      </style>
    `;

    const overlay = new window.kakao.maps.CustomOverlay({
      position: position,
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 1000
    });

    overlay.setMap(kakaoMap);
    sosMarkerRef.current = overlay;
  };

  // 지도 중심 마커 표시/제거 (위치 선택 모드일 때)
  useEffect(() => {
    if (!mapContainerRef.current || !isSelectingLocation) {
      // 마커 및 표시선 제거
      if (centerMarkerRef.current) {
        centerMarkerRef.current.remove();
        centerMarkerRef.current = null;
      }
      if (crosshairRef.current) {
        crosshairRef.current.remove();
        crosshairRef.current = null;
      }
      return;
    }

    // 지도 컨테이너에 중심 마커 생성 (지도 위에 오버레이)
    const mapContainer = mapContainerRef.current;

    // 십자선 표시선 생성
    const crosshair = document.createElement('div');
    crosshair.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      pointer-events: none;
      z-index: 1001;
    `;
    crosshair.innerHTML = `
      <div style="
        position: relative;
        width: 100%;
        height: 100%;
      ">
        <div style="
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 2px;
          background: rgba(0, 188, 212, 0.6);
          transform: translateY(-50%);
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          top: 0;
          width: 2px;
          height: 100%;
          background: rgba(0, 188, 212, 0.6);
          transform: translateX(-50%);
        "></div>
      </div>
    `;
    mapContainer.appendChild(crosshair);
    crosshairRef.current = crosshair;

    // 핀 마커 생성
    const marker = document.createElement('div');
    marker.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      width: 36px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1002;
    `;

    marker.innerHTML = `
      <div style="
        position: relative;
        width: 0;
        height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="36" height="40" viewBox="0 0 36 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
          <path d="M18 0C12.477 0 8 4.477 8 10C8 17 18 40 18 40C18 40 28 17 28 10C28 4.477 23.523 0 18 0Z" fill="#00BCD4"/>
          <circle cx="18" cy="10" r="6" fill="#0097A7"/>
        </svg>
      </div>
    `;

    mapContainer.appendChild(marker);
    centerMarkerRef.current = marker;

    // 지도 중심이 변경될 때마다 위치 업데이트
    const handleCenterChanged = () => {
      if (!map) return;
      const center = map.getCenter();
      const location = {
        lat: center.getLat(),
        lng: center.getLng()
      };
      setSelectedSOSLocation(location);
    };

    // 초기 위치 설정
    handleCenterChanged();
    if (map && window.kakao && window.kakao.maps) {
      window.kakao.maps.event.addListener(map, 'center_changed', handleCenterChanged);
    }

    return () => {
      if (centerMarkerRef.current && mapContainer.contains(centerMarkerRef.current)) {
        centerMarkerRef.current.remove();
        centerMarkerRef.current = null;
      }
      if (crosshairRef.current && mapContainer.contains(crosshairRef.current)) {
        crosshairRef.current.remove();
        crosshairRef.current = null;
      }
      if (map && window.kakao && window.kakao.maps) {
        window.kakao.maps.event.removeListener(map, 'center_changed', handleCenterChanged);
      }
    };
  }, [map, isSelectingLocation]);

  // 위치 미리보기 지도 생성/업데이트
  useEffect(() => {
    if (!selectedSOSLocation || !showSOSModal || isSelectingLocation) {
      // 지도 제거
      if (locationPreviewMapRef.current) {
        locationPreviewMapRef.current.marker.setMap(null);
        locationPreviewMapRef.current.map = null;
        locationPreviewMapRef.current = null;
      }
      return;
    }

    const initPreviewMap = () => {
      if (!window.kakao || !window.kakao.maps) {
        setTimeout(initPreviewMap, 100);
        return;
      }

      const container = document.getElementById('location-preview-map');
      if (!container) {
        setTimeout(initPreviewMap, 100);
        return;
      }

      // 기존 지도 제거
      if (locationPreviewMapRef.current) {
        locationPreviewMapRef.current.marker.setMap(null);
        locationPreviewMapRef.current.map = null;
      }

      // 새 지도 생성
      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(selectedSOSLocation.lat, selectedSOSLocation.lng),
        level: 4
      });

      // 내 위치와 동일: 하늘색 원점 + 파동
      const markerEl = document.createElement('div');
      markerEl.innerHTML = `
        <div style="
          position: relative;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background-color: rgba(135, 206, 250, 0.25); animation: previewPulse1 2s infinite;"></div>
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background-color: rgba(135, 206, 250, 0.2); animation: previewPulse2 2s infinite;"></div>
          <div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background-color: rgba(135, 206, 250, 0.15); animation: previewPulse3 2s infinite;"></div>
          <div style="position: relative; width: 24px; height: 24px; border-radius: 50%; background-color: #87CEEB; border: 4px solid rgba(255,255,255,1); box-shadow: 0 3px 10px rgba(0,0,0,0.4); z-index: 10;"></div>
        </div>
        <style>
          @keyframes previewPulse1 { 0% { transform: scale(1); opacity: 0.25; } 100% { transform: scale(3); opacity: 0; } }
          @keyframes previewPulse2 { 0% { transform: scale(1); opacity: 0.2; } 100% { transform: scale(3.5); opacity: 0; } }
          @keyframes previewPulse3 { 0% { transform: scale(1); opacity: 0.15; } 100% { transform: scale(4); opacity: 0; } }
        </style>
      `;

      const marker = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(selectedSOSLocation.lat, selectedSOSLocation.lng),
        content: markerEl,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 1001
      });

      marker.setMap(map);

      locationPreviewMapRef.current = { map, marker };
    };

    initPreviewMap();

    return () => {
      if (locationPreviewMapRef.current) {
        locationPreviewMapRef.current.marker.setMap(null);
        locationPreviewMapRef.current.map = null;
        locationPreviewMapRef.current = null;
      }
    };
  }, [selectedSOSLocation, showSOSModal, isSelectingLocation]);

  /** 등록은 광고와 무관하게 즉시 저장 (스폰서 영상은 등록 직후 재생) */
  const commitSOSRequestToStorage = useCallback((req) => {
    const existingSOS = JSON.parse(localStorage.getItem('sosRequests_v1') || '[]');
    const updatedSOS = [req, ...existingSOS];
    localStorage.setItem('sosRequests_v1', JSON.stringify(updatedSOS));

    const questionText = req.question || '';
    const questionSnippet =
      questionText.length > 35 ? questionText.substring(0, 35) + '...' : questionText;

    const locationName = req.coordinates
      ? getLocationByCoordinates(req.coordinates.lat, req.coordinates.lng)
      : '근처 지역';

    const mission = {
      id: `mission-${Date.now()}`,
      coordinates: req.coordinates,
      locationName,
      question: req.question,
      requesterId: 'current-user',
      status: 'open',
      responses: [],
      createdAt: new Date().toISOString(),
    };
    appendSOSMission(mission);

    addNotification({
      type: 'system',
      title: `[${locationName} 실시간 속보] 📢 "${questionSnippet}"`,
      message: `지금 ${locationName}의 최신 정보를 원하는 고객이 있습니다. 지금 해결해주면 신뢰지수/뱃지 혜택을 받을 수 있어요!`,
      icon: 'location_on',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      iconColor: 'text-blue-500',
      link: '/map',
      data: {
        sosRequest: req,
        missionId: mission.id,
        type: 'sos_request',
      },
    });
  }, []);

  useEffect(() => {
    if (!showAdModal) {
      setAdPlaybackProgress(0);
      return;
    }
    setAdPlaybackProgress(0);
    const started = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - started;
      const p = Math.min(100, (elapsed / SOS_AD_PLAY_DURATION_MS) * 100);
      setAdPlaybackProgress(p);
      if (elapsed >= SOS_AD_PLAY_DURATION_MS) {
        clearInterval(id);
        setShowAdModal(false);
      }
    }, 80);
    return () => clearInterval(id);
  }, [showAdModal]);

  // 도움 요청 제출 — 즉시 등록 후 스폰서 영상 모달
  const handleSOSSubmit = () => {
    if (!selectedSOSLocation) {
      alert('위치를 선택해주세요.');
      return;
    }
    if (!sosQuestion.trim()) {
      alert('궁금한 내용을 입력해주세요.');
      return;
    }

    const newSOSRequest = {
      id: `sos-${Date.now()}`,
      coordinates: selectedSOSLocation,
      question: sosQuestion.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
      userId: 'current-user', // TODO: 실제 사용자 ID로 교체
    };

    try {
      commitSOSRequestToStorage(newSOSRequest);
    } catch (error) {
      logger.error('상황 알아보기 요청 저장 실패:', error);
      alert('등록에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    setShowSOSModal(false);
    setSosQuestion('');
    setSosLocationSearch('');
    setIsSelectingLocation(false);
    setSelectedSOSLocation(null);

    if (sosMarkerRef.current) {
      sosMarkerRef.current.setMap(null);
      sosMarkerRef.current = null;
    }

    setShowAdModal(true);
  };

  const handleSelectSOSLocationBySearch = useCallback(async (suggestion) => {
    if (!suggestion) return;
    setSosLocationSuggestions([]);
    const label = suggestion.display || suggestion.name || suggestion.title || suggestion.regionName || '';
    setSosLocationSearch(label);

    const applyPoint = (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      const point = { lat, lng };
      setSelectedSOSLocation(point);
      if (map && window.kakao?.maps) {
        map.setCenter(new window.kakao.maps.LatLng(lat, lng));
        map.setLevel(4);
        updateSOSMarker(map, point);
      }
      return true;
    };

    if (suggestion.kakaoPlace && suggestion.lat != null && suggestion.lng != null) {
      applyPoint(suggestion.lat, suggestion.lng);
      return;
    }
    if (suggestion.lat != null && suggestion.lng != null) {
      applyPoint(suggestion.lat, suggestion.lng);
      return;
    }
    if (suggestion.type === 'place' && suggestion.post) {
      const post = await enrichPostWithResolvedCoordinates(suggestion.post);
      const coords = coordsFromPostObject(post);
      if (coords?.lat && coords?.lng) {
        applyPoint(coords.lat, coords.lng);
        return;
      }
    }
    if (suggestion.type === 'recommended_region' && suggestion.regionName) {
      let coords = getCoordsByRegion(suggestion.regionName);
      if (!coords) {
        const geo = await searchPlaceWithKakaoFirst(suggestion.regionName);
        if (geo?.lat != null && geo?.lng != null) coords = { lat: geo.lat, lng: geo.lng };
      }
      if (coords?.lat && coords?.lng) {
        applyPoint(coords.lat, coords.lng);
        return;
      }
    }
    const name = suggestion.name || suggestion.regionName;
    if (name) {
      let coords = getCoordsByRegion(name);
      if (!coords) {
        const geo = await searchPlaceWithKakaoFirst(name);
        if (geo?.lat != null && geo?.lng != null) coords = { lat: geo.lat, lng: geo.lng };
      }
      if (coords?.lat && coords?.lng) {
        applyPoint(coords.lat, coords.lng);
        return;
      }
    }
    alert('해당 위치 좌표를 찾지 못했습니다. 지도에서 선택해 주세요.');
  }, [map]);

  const handleAdModalDismiss = () => {
    setShowAdModal(false);
  };

  // 상황 알아보기 흐름 닫기
  const handleSOSModalClose = () => {
    setShowSOSModal(false);
    setSosQuestion('');
    setSosLocationSearch('');
    setIsSelectingLocation(false);
    setSelectedSOSLocation(null);

    // 중심 마커 제거
    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove();
      centerMarkerRef.current = null;
    }

    // 표시선 제거
    if (crosshairRef.current) {
      crosshairRef.current.remove();
      crosshairRef.current = null;
    }

    // SOS 마커 제거
    if (sosMarkerRef.current) {
      sosMarkerRef.current.setMap(null);
      sosMarkerRef.current = null;
    }

    // 위치 미리보기 지도 제거
    if (locationPreviewMapRef.current) {
      locationPreviewMapRef.current.marker.setMap(null);
      locationPreviewMapRef.current.map = null;
      locationPreviewMapRef.current = null;
    }
  };

  // 지도에서 위치 선택하기 시작
  const handleStartLocationSelection = () => {
    setIsSelectingLocation(true);
    setShowSOSModal(false);

    // 기존 SOS 마커 제거 (중심 마커로 대체됨)
    if (sosMarkerRef.current) {
      sosMarkerRef.current.setMap(null);
      sosMarkerRef.current = null;
    }
  };

  const getLocationIcon = (locationName) => {
    if (!locationName) return 'location_on';
    if (locationName.includes('산') || locationName.includes('봉')) return 'landscape';
    if (locationName.includes('해') || locationName.includes('바다') || locationName.includes('해변')) return 'beach_access';
    if (locationName.includes('카페') || locationName.includes('커피')) return 'local_cafe';
    if (locationName.includes('맛집') || locationName.includes('식당')) return 'restaurant';
    return 'location_on';
  };

  // 핀을 경로에 추가하는 핸들러
  const handlePinSelectForRoute = (post, position, index) => {
    const pinData = {
      post,
      position,
      index,
      lat: position.getLat(),
      lng: position.getLng()
    };

    // 이미 선택된 핀인지 확인
    const isAlreadySelected = selectedRoutePins.some(p => p.post.id === post.id);

    if (isAlreadySelected) {
      // 이미 선택된 핀은 제거
      const newPins = selectedRoutePins.filter(p => p.post.id !== post.id);
      setSelectedRoutePins(newPins);
      drawRoute(newPins);
      // 마커 다시 생성하여 선택 상태 업데이트
      if (map) {
        createMarkers(posts, map, newPins, selectedPinId);
      }
    } else {
      // 새로운 핀 추가
      const newPins = [...selectedRoutePins, pinData];
      setSelectedRoutePins(newPins);
      drawRoute(newPins);
      // 마커 다시 생성하여 선택 상태 업데이트
      if (map) {
        createMarkers(posts, map, newPins, selectedPinId);
      }
    }
  };

  // 경로 그리기
  const drawRoute = (pins) => {
    if (!map || !window.kakao || !window.kakao.maps) return;

    // 기존 경로 선 제거
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    // 핀이 2개 이상일 때만 경로 그리기
    if (pins.length < 2) return;

    // 경로 좌표 배열 생성
    const path = pins.map(pin => new window.kakao.maps.LatLng(pin.lat, pin.lng));

    // Polyline 생성
    const polyline = new window.kakao.maps.Polyline({
      path: path,
      strokeWeight: 4,
      strokeColor: '#00BCD4',
      strokeOpacity: 0.8,
      strokeStyle: 'solid'
    });

    polyline.setMap(map);
    routePolylineRef.current = polyline;
  };

  // 경로 모드 토글
  const toggleRouteMode = () => {
    if (!LIVE_COURSE_UI_ENABLED) return;
    const newMode = !isRouteMode;
    setIsRouteMode(newMode);

    if (newMode) {
      // 경로 모드 진입 시 상세 모달·설명 카드·선택 강조 닫기
      setSelectedPost(null);
      setPinDetailView(null);
      setSelectedPinId(null);
      // 경로 모드 시작 시 바텀 시트 숨기기
      const hideOffset = sheetHeight + 20;
      setIsSheetHidden(true);
      setSheetOffset(hideOffset);
    } else {
      // 경로 모드 종료 시 경로 초기화 및 바텀 시트 다시 표시
      clearRoute();
      setIsSheetHidden(false);
      setSheetOffset(0);
    }
  };

  // 경로 초기화
  const clearRoute = () => {
    setSelectedRoutePins([]);
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    // 마커 다시 생성하여 선택 상태 제거
    if (map) {
      createMarkers(posts, map, [], selectedPinId);
    }
  };

  // 경로 모드만 종료 (시트 복구 + 핀 초기화) — 취소 버튼용
  const exitRouteMode = () => {
    if (!isRouteMode) return;
    setIsRouteMode(false);
    clearRoute();
    setIsSheetHidden(false);
    setSheetOffset(0);
  };

  // 경로 저장: 저장 후 경로 모드 해제, 방금 저장한 경로 표시(연결선·핀 스타일 동일)
  const saveRoute = () => {
    if (selectedRoutePins.length < 2) {
      alert('경로를 만들려면 최소 2개 이상의 핀을 선택해주세요.');
      return;
    }

    const routeData = {
      id: `route-${Date.now()}`,
      pins: selectedRoutePins.map(pin => ({
        id: pin.post.id,
        location: pin.post.location || pin.post.detailedLocation || '여행지',
        lat: pin.lat,
        lng: pin.lng,
        image: getPostPinImageUrl(pin.post)
      })),
      createdAt: new Date().toISOString()
    };

    try {
      const existingRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
      const updatedRoutes = [routeData, ...existingRoutes];
      localStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
      setSavedRoute(routeData);
      // 경로 모드 해제
      setIsRouteMode(false);
      setSelectedRoutePins([]);
      setIsSheetHidden(false);
      setSheetOffset(0);
      // 방금 저장한 경로를 경로 모드와 동일하게 표시: 연결선(메인컬러) + 핀(메인컬러 테두리)
      const routePins = routeData.pins.map(pin => ({
        post: { id: pin.id, location: pin.location, images: pin.image ? [pin.image] : [] },
        lat: pin.lat,
        lng: pin.lng
      }));
      drawRoute(routePins);
      createMarkers(posts, map, routePins, selectedPinId);
      const bounds = new window.kakao.maps.LatLngBounds();
      routePins.forEach(pin => bounds.extend(new window.kakao.maps.LatLng(pin.lat, pin.lng)));
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const latSpan = Math.max((ne.getLat() - sw.getLat()) * 0.25, 0.01);
      const lngSpan = Math.max((ne.getLng() - sw.getLng()) * 0.25, 0.01);
      bounds.extend(new window.kakao.maps.LatLng(sw.getLat() - latSpan, sw.getLng() - lngSpan));
      bounds.extend(new window.kakao.maps.LatLng(ne.getLat() + latSpan, ne.getLng() + lngSpan));
      if (map) map.setBounds(bounds);
      // 프로필의 "저장된 경로" 탭에서 볼 수 있도록 안내 토스트 표시
      setShowRouteSavedToast(true);
      // 다른 탭(프로필 등)에서도 savedRoutes 갱신되도록 storage 이벤트 발생
      window.dispatchEvent(new Event('storage'));
      // 일정 시간 후 토스트 자동 숨김
      setTimeout(() => {
        setShowRouteSavedToast(false);
      }, 5000);
    } catch (error) {
      logger.error('경로 저장 실패:', error);
      alert('경로 저장에 실패했습니다.');
    }
  };

  const MAX_RECENT_ROUTES_ON_MAP = 2;

  const recentSavedRoutes = useMemo(() => {
    try {
      const routes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
      return routes.slice(0, MAX_RECENT_ROUTES_ON_MAP);
    } catch { return []; }
  }, [savedRoute]);

  const totalSavedRoutesCount = useMemo(() => {
    try {
      const routes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
      return routes.length;
    } catch { return 0; }
  }, [savedRoute]);

  const showRouteOnMap = (route) => {
    if (!route || !map) return;
    setSavedRoute(route);
    setShowSavedRoutesPanel(false);
    if (route.pins && route.pins.length > 0) {
      const routePins = route.pins.map(pin => ({
        post: { id: pin.id, location: pin.location, images: pin.image ? [pin.image] : [] },
        lat: pin.lat,
        lng: pin.lng
      }));
      if (routePins.length >= 2) drawRoute(routePins);
      createMarkers(posts, map, routePins, selectedPinId);
      const bounds = new window.kakao.maps.LatLngBounds();
      routePins.forEach(pin => bounds.extend(new window.kakao.maps.LatLng(pin.lat, pin.lng)));
      // 패딩 추가해서 한 화면에 모든 핀이 다 보이게
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const latSpan = Math.max((ne.getLat() - sw.getLat()) * 0.25, 0.01);
      const lngSpan = Math.max((ne.getLng() - sw.getLng()) * 0.25, 0.01);
      bounds.extend(new window.kakao.maps.LatLng(sw.getLat() - latSpan, sw.getLng() - lngSpan));
      bounds.extend(new window.kakao.maps.LatLng(ne.getLat() + latSpan, ne.getLng() + lngSpan));
      map.setBounds(bounds);
    }
  };

  const showSavedRoute = () => {
    try {
      const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
      if (savedRoutes.length === 0) {
        alert('저장된 경로가 없습니다.');
        return;
      }
      showRouteOnMap(savedRoutes[0]);
    } catch (error) {
      logger.error('저장된 경로 불러오기 실패:', error);
      alert('저장된 경로를 불러오는데 실패했습니다.');
    }
  };

  // 프로필에서 "지도에서 보기"로 진입 시 해당 경로 표시
  const routeToShowRef = useRef(null);
  useEffect(() => {
    const routeToShow = location.state?.routeToShow;
    if (map && routeToShow && routeToShow.pins?.length > 0 && routeToShowRef.current !== routeToShow.id) {
      routeToShowRef.current = routeToShow.id;
      showRouteOnMap(routeToShow);
    }
  }, [map, location.state?.routeToShow]);

  // 저장된 경로 숨기기
  const hideSavedRoute = () => {
    setSavedRoute(null);
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    // 마커 다시 생성하여 선택 상태 제거
    if (map) {
      createMarkers(posts, map, [], selectedPinId);
    }
  };

  // 저장된 경로 삭제
  const deleteSavedRoute = () => {
    if (!savedRoute) return;
    
    if (confirm('저장된 경로를 삭제하시겠습니까?')) {
      try {
        const savedRoutes = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
        const updatedRoutes = savedRoutes.filter(route => route.id !== savedRoute.id);
        localStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
        
        // 경로 숨기기
        hideSavedRoute();
        alert('경로가 삭제되었습니다.');
      } catch (error) {
        logger.error('경로 삭제 실패:', error);
        alert('경로 삭제에 실패했습니다.');
      }
    }
  };

  // 경로 공유
  const shareRoute = async () => {
    if (selectedRoutePins.length < 2) {
      alert('경로를 만들려면 최소 2개 이상의 핀을 선택해주세요.');
      return;
    }

    const routeData = {
      pins: selectedRoutePins.map(pin => ({
        location: pin.post.location || pin.post.detailedLocation || '여행지',
        lat: pin.lat,
        lng: pin.lng
      }))
    };

    // 공유 링크 생성 (실제로는 서버에 저장하고 링크를 받아야 함)
    const shareUrl = `${window.location.origin}/map?route=${encodeURIComponent(JSON.stringify(routeData))}`;

    // Web Share API 사용 (지원하는 경우)
    if (navigator.share) {
      try {
        await navigator.share({
          title: '여행 경로 공유',
          text: `${selectedRoutePins.length}개의 장소를 포함한 여행 경로를 공유합니다.`,
          url: shareUrl
        });
      } catch (error) {
        // 사용자가 공유를 취소한 경우
        if (error.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      // Web Share API를 지원하지 않는 경우 클립보드에 복사
      copyToClipboard(shareUrl);
    }
  };

  // 클립보드에 복사
  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('경로 링크가 클립보드에 복사되었습니다!');
      }).catch(() => {
        fallbackCopyToClipboard(text);
      });
    } else {
      fallbackCopyToClipboard(text);
    }
  };

  // 클립보드 복사 폴백
  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('경로 링크가 클립보드에 복사되었습니다!');
    } catch (error) {
      alert('링크 복사에 실패했습니다. 링크를 직접 복사해주세요: ' + text);
    }
    document.body.removeChild(textArea);
  };

  // 경로 모드 변경 시 경로 다시 그리기 및 마커 업데이트
  useEffect(() => {
    // 지도/게시물 없으면 아무 것도 하지 않음
    if (!map || posts.length === 0) return;

    if (isRouteMode) {
      // 경로 모드: 2개 이상이면 경로 표시
      if (selectedRoutePins.length >= 2) {
        drawRoute(selectedRoutePins);
      } else {
        // 2개 미만이면 기존 선이 있으면 제거만
        if (routePolylineRef.current) {
          routePolylineRef.current.setMap(null);
          routePolylineRef.current = null;
        }
      }

      createMarkers(posts, map, selectedRoutePins, selectedPinId);
      return;
    }

    // 경로 모드 OFF: 선 제거 + (필요할 때만) 선택 핀 초기화
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
    if (selectedRoutePins.length > 0) {
      setSelectedRoutePins([]);
    }
    createMarkers(posts, map, [], selectedPinId);
  }, [isRouteMode, selectedRoutePins, map, posts]);

  return (
    <>
      <style>
        {`
          .sheet-scroll-container::-webkit-scrollbar {
            height: 6px;
          }
          .sheet-scroll-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .sheet-scroll-container::-webkit-scrollbar-thumb {
            background: #d4d4d8;
            border-radius: 3px;
          }
          .sheet-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #a1a1aa;
          }
          .filter-scroll::-webkit-scrollbar {
            display: none;
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
        `}
      </style>
      <div className="phone-screen" style={{
        background: 'transparent',
        borderRadius: '0px',
        overflow: 'hidden',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* 지도 컨테이너 - 전체 화면에 지도가 보이도록 */}
        <main
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0, // 네비게이션바 제거 → 지도를 화면 맨 아래까지 확장
            overflow: 'hidden',
            zIndex: 1,
            pointerEvents: 'auto',
            width: '100%',
            height: '100%'
          }}
        >
          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: '100%',
              pointerEvents: 'auto',
              position: 'relative'
            }}
          />
        </main>

        {/* 상태바 영역 (시스템 UI 제거, 공간만 유지) */}
        <div style={{
          height: '20px',
          position: 'relative',
          zIndex: 10
        }} />

        {/* 검색바 - 투명 배경으로 지도가 보이도록 */}
        <div style={{
          padding: '16px 16px 10px 16px', // 위·아래 패딩을 조금 더 늘려 여백 확보
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'relative',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          {/* 뒤로가기 버튼 - 검색창 왼쪽에 정렬 */}
          <button
            onClick={() => navigate('/main')}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '20px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#333' }}>
              arrow_back
            </span>
          </button>
          <div
            onClick={() => setShowSearchSheet(true)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '28px',
              padding: '12px 20px',
              gap: '12px',
              minHeight: '52px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#666' }}>
              search
            </span>
            <span style={{
              flex: 1,
              fontSize: '16px',
              color: '#999',
              fontWeight: '400'
            }}>
              {searchQuery || "지역 검색"}
            </span>
          </div>
          <button
            onClick={() => {
              if (map) {
                updateVisiblePins(map);
              }
            }}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '26px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              pointerEvents: 'auto'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#666' }}>
              refresh
            </span>
          </button>
        </div>

        {/* 상황 물어보기 버튼과 필터 버튼들 - 메인 추천여행지처럼 좌우 슬라이드(마우스 드래그·휠·터치 스와이프) */}
        <div
          ref={filterScrollRef}
          className="filter-scroll"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: '8px',
            alignItems: 'center',
            padding: '0 16px 8px 16px', // 검색창과 더 가깝게: 상단 패딩 제거
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
            width: '100%',
            minWidth: 0,
            flexShrink: 0,
            overflowX: 'scroll',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            cursor: 'grab',
            touchAction: 'pan-x'
          }}
          onMouseDown={(e) => {
            if (e.target.closest('button')) return;
            e.preventDefault();
            hasDraggedFilterRef.current = false;
            const slider = e.currentTarget;
            let isDown = true;
            const startX = e.pageX;
            const startScrollLeft = slider.scrollLeft;
            slider.style.cursor = 'grabbing';
            slider.style.userSelect = 'none';

            const handleMouseMove = (ev) => {
              if (!isDown) return;
              ev.preventDefault();
              const walk = (ev.pageX - startX) * 1.2;
              if (Math.abs(walk) > 5) hasDraggedFilterRef.current = true;
              slider.scrollLeft = startScrollLeft - walk;
            };

            const handleMouseUp = () => {
              isDown = false;
              slider.style.cursor = 'grab';
              slider.style.userSelect = 'auto';
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            if (e.target.closest('button')) return;
            hasDraggedFilterRef.current = false;
            const slider = e.currentTarget;
            if (slider.scrollWidth <= slider.clientWidth) return;
            const startX = e.touches[0].pageX;
            const startScrollLeft = slider.scrollLeft;
            slider._touchStartX = startX;
            slider._touchStartScroll = startScrollLeft;
          }}
          onTouchMove={(e) => {
            const slider = e.currentTarget;
            if (slider.scrollWidth <= slider.clientWidth) return;
            if (slider._touchStartX == null) return;
            e.preventDefault();
            hasDraggedFilterRef.current = true;
            const x = e.touches[0].pageX;
            const walk = (x - slider._touchStartX) * 1.2;
            slider.scrollLeft = slider._touchStartScroll - walk;
          }}
          onTouchEnd={(e) => {
            e.currentTarget._touchStartX = null;
            e.currentTarget._touchStartScroll = null;
          }}
          onTouchCancel={(e) => {
            e.currentTarget._touchStartX = null;
            e.currentTarget._touchStartScroll = null;
          }}
        >
          {/* 상황 물어보기 버튼 - 가장 앞에 배치 */}
          <button
            onClick={() => {
              if (hasDraggedFilterRef.current) { hasDraggedFilterRef.current = false; return; }
              handleSOSRequest();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 12px',
              minHeight: 34,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#00BCD4'
            }}>
              지금 상황 알아보기
            </span>
          </button>

          {/* 필터 버튼들 - 중복 선택 가능, 좌우 스크롤 */}
          <button
            onClick={() => {
              if (hasDraggedFilterRef.current) { hasDraggedFilterRef.current = false; return; }
              setSelectedFilters(prev =>
                prev.includes('bloom')
                  ? prev.filter(f => f !== 'bloom')
                  : [...prev, 'bloom']
              );
            }}
            style={{
              padding: '6px 12px',
              minHeight: 34,
              borderRadius: '16px',
              border: 'none',
              background: selectedFilters.includes('bloom') ? '#00BCD4' : 'rgba(255, 255, 255, 0.95)',
              color: selectedFilters.includes('bloom') ? 'white' : '#666',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            🌸 개화정보
          </button>
          <button
            onClick={() => {
              if (hasDraggedFilterRef.current) { hasDraggedFilterRef.current = false; return; }
              setSelectedFilters(prev =>
                prev.includes('scenic')
                  ? prev.filter(f => f !== 'scenic')
                  : [...prev, 'scenic']
              );
            }}
            style={{
              padding: '6px 12px',
              minHeight: 34,
              borderRadius: '16px',
              border: 'none',
              background: selectedFilters.includes('scenic') ? '#00BCD4' : 'rgba(255, 255, 255, 0.95)',
              color: selectedFilters.includes('scenic') ? 'white' : '#666',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            🏞️ 가볼만한 곳
          </button>
          {/* 스크롤 끝 여백 (메인 추천여행지 슬라이드와 동일) */}
          <div style={{ width: '16px', flexShrink: 0 }} aria-hidden="true" />
        </div>

        {/* 경로 모드 토글·초기화 — LIVE_COURSE_UI_ENABLED 가 꺼지면 숨김 */}
        {LIVE_COURSE_UI_ENABLED && (
        <div style={{
            position: 'absolute',
            left: '16px',
            bottom: `${isSheetHidden ? 100 : Math.max(sheetHeight + 20, 100)}px`,
            zIndex: 30,
            transition: 'all 0.3s ease-out',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <button
              type="button"
              onClick={toggleRouteMode}
              aria-pressed={isRouteMode}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: isRouteMode ? '1px solid #0097A7' : '1px solid rgba(0,0,0,0.1)',
                background: isRouteMode ? '#00BCD4' : '#ffffff',
                color: isRouteMode ? '#ffffff' : '#333333',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isRouteMode) {
                  e.currentTarget.style.background = '#f3f4f6';
                } else {
                  e.currentTarget.style.background = '#00ACC1';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRouteMode) {
                  e.currentTarget.style.background = '#ffffff';
                } else {
                  e.currentTarget.style.background = '#00BCD4';
                }
              }}
            >
              라이브 코스 만들기
              {isRouteMode && selectedRoutePins.length > 0 && (
                <span style={{
                  marginLeft: '2px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.25)',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  {selectedRoutePins.length}
                </span>
              )}
            </button>
            {isRouteMode && (
              <button
                type="button"
                onClick={exitRouteMode}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: 'rgba(255,255,255,0.95)',
                  color: '#555',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.color = '#c62828';
                  e.currentTarget.style.borderColor = 'rgba(198,40,40,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                  e.currentTarget.style.color = '#555';
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)';
                }}
              >
                취소
              </button>
            )}
            {/* 최근 저장한 경로 (시간 아이콘) - 켜면 경로, 끄면 바로 내 위치 */}
            {recentSavedRoutes.length > 0 && (
              <button
                onClick={() => {
                  if (showSavedRoutesPanel || savedRoute) {
                    hideSavedRoute();
                    setShowSavedRoutesPanel(false);
                    if (map && currentLocation?.lat != null && currentLocation?.lng != null) {
                      const moveLatLon = new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
                      map.panTo(moveLatLon);
                      map.setLevel(3);
                    } else {
                      handleCenterLocation();
                    }
                  } else {
                    showRouteOnMap(recentSavedRoutes[0]);
                    setShowSavedRoutesPanel(true);
                  }
                }}
                title="최근 저장한 경로"
                style={{
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  borderRadius: '22px',
                  border: 'none',
                  background: showSavedRoutesPanel || savedRoute ? '#00BCD4' : 'rgba(255, 255, 255, 0.95)',
                  color: showSavedRoutesPanel || savedRoute ? 'white' : '#666',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!showSavedRoutesPanel && !savedRoute) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showSavedRoutesPanel && !savedRoute) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  }
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700 }}>최근</span>
              </button>
            )}
            {/* 초기화 아이콘 버튼 (경로 모드이고 핀이 선택되었을 때만 표시) */}
            {isRouteMode && selectedRoutePins.length > 0 && (
              <button
                onClick={clearRoute}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  border: 'none',
                  background: 'white',
                  color: '#666',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700 }}>초기화</span>
              </button>
            )}
          </div>
        )}

        {/* 저장된 경로 패널 — 최근 2개만, 사이즈 축소 */}
        {LIVE_COURSE_UI_ENABLED && showSavedRoutesPanel && !isRouteMode && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: (isSheetHidden ? 100 : Math.max(sheetHeight + 20, 100)) + 56,
              zIndex: 35,
              background: 'white',
              borderRadius: 12,
              padding: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              minWidth: 160,
              maxWidth: 200
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 6 }}>최근 저장한 경로</div>
            {recentSavedRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => showRouteOnMap(route)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 8,
                  background: savedRoute?.id === route.id ? '#e0f7fa' : '#f5f5f5',
                  cursor: 'pointer',
                  marginBottom: 4,
                  textAlign: 'left'
                }}
              >
                {route.pins?.[0]?.image && (
                  <img src={route.pins[0].image} alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {route.pins?.length || 0}개 장소
                </span>
                {savedRoute?.id === route.id && <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#00BCD4', flexShrink: 0 }}>check</span>}
              </button>
            ))}
            {totalSavedRoutesCount > MAX_RECENT_ROUTES_ON_MAP && (
              <button
                type="button"
                onClick={() => { setShowSavedRoutesPanel(false); navigate('/profile', { state: { tab: 'savedRoutes' } }); }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#f0f9ff',
                  color: '#00BCD4',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                프로필에서 전체 보기
              </button>
            )}
          </div>
        )}

        {/* 저장·공유 — 경로 모드에서 항상 보이도록 z-index 상향, 시트 높이와 동기화 */}
        {LIVE_COURSE_UI_ENABLED && isRouteMode && selectedRoutePins.length >= 2 && (
          <div style={{
            position: 'absolute',
            left: '16px',
            bottom: (isSheetHidden ? 100 : Math.max(sheetHeight + 20, 100)) + 56,
            zIndex: 32,
            pointerEvents: 'auto',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <button
              onClick={saveRoute}
              style={{
                padding: '10px 18px',
                minHeight: 44,
                borderRadius: '20px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#666',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              저장
            </button>
            <button
              onClick={shareRoute}
              style={{
                padding: '10px 18px',
                minHeight: 44,
                borderRadius: '20px',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#666',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              공유
            </button>
          </div>
        )}

        {/* 경로 저장 완료 토스트 - 사진 시트 on 위치에 겹쳐서 표시 */}
        {LIVE_COURSE_UI_ENABLED && showRouteSavedToast && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: isSheetHidden ? 24 : 72,
              zIndex: 25,
              maxWidth: 280,
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#334155',
              borderRadius: 999,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.06)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'auto',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            <span>경로가 저장되었어요</span>
            <button
              type="button"
              onClick={() => {
                setShowRouteSavedToast(false);
                navigate('/profile', LIVE_COURSE_UI_ENABLED ? { state: { tab: 'savedRoutes' } } : undefined);
              }}
              style={{
                marginLeft: 4,
                padding: '2px 0',
                border: 'none',
                background: 'none',
                color: '#00BCD4',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              보기
            </button>
          </div>
        )}

        {/* 지도 컨트롤: 줌 + 내 위치 */}
        {!isRouteMode && (
          <div
            style={{
              position: 'absolute',
              right: '16px',
              bottom: isSheetHidden ? '120px' : `${sheetHeight + 16}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 30,
              transition: 'all 0.3s ease-out',
              pointerEvents: 'auto',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: 'none',
                background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="확대"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#52525b' }}>
                add
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: 'none',
                background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="축소"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#52525b' }}>
                remove
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCenterLocation();
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: 'none',
                background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="내 위치"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00BCD4' }}>
                my_location
              </span>
            </button>
          </div>
        )}

        {/* 사진 다시 보기 버튼 - 시트가 숨겨졌고 경로 모드가 아닐 때만 표시 */}
        {isSheetHidden && !isRouteMode && (
          <button
            onClick={handleShowSheet}
            style={{
              position: 'absolute',
              bottom: '120px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'white',
              borderRadius: '24px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
              zIndex: 25
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              사진 다시 보기
            </span>
          </button>
        )}

        {/* 주변 장소 바텀 시트 - 경로 모드가 아닐 때만 보임, 아래로 슬라이드 가능 */}
        {!isSelectingLocation && !isRouteMode && (
          <div
            ref={sheetRef}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0, // 네비게이션바 높이(68px)만큼 있던 여백 제거 → 화면 맨 아래까지 시트 내림
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              transform: `translateY(${sheetOffset}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
              maxHeight: '40vh',
              zIndex: 20
            }}
          >
            <div
              ref={dragHandleRef}
              onMouseDown={handleSheetDragStart}
              onTouchStart={handleSheetDragStart}
              style={{
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none'
              }}
            >
              <div style={{
                width: '40px',
                height: '4px',
                backgroundColor: '#d4d4d8',
                borderRadius: '2px'
              }} />
            </div>

            <div style={{
              padding: '8px 16px 12px',
              borderBottom: '1px solid #f4f4f5'
            }}>
              <h1 style={{
                fontSize: '18px',
                fontWeight: 'bold',
                margin: 0
              }}>주변 장소</h1>
            </div>

            <div
              className="sheet-scroll-container"
              style={{
                flex: 1,
                overflowX: visiblePins.length >= 4 ? 'auto' : 'hidden',
                overflowY: 'hidden',
                padding: '16px 16px 24px 16px',
                display: 'flex',
                gap: '12px',
                minHeight: '110px',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                scrollbarColor: '#d4d4d8 transparent',
                cursor: visiblePins.length >= 4 ? 'grab' : 'default',
                userSelect: 'none',
                touchAction: 'pan-x',
                scrollSnapType: 'x mandatory',
                scrollPadding: '0 16px'
              }}
              onMouseDown={handlePinScrollDrag}
            >
              {visiblePins.length > 0 ? (
                visiblePins.map((pin, index) => {
                  const isSelectedPin = selectedPinId === pin.id;
                  const ageVisual = getMapAgeVisual(pin.post);
                  return (
                  <div
                    key={`${pin.id}-${index}`}
                    className="pin-card"
                    onClick={() => {
                      if (pinHasMovedRef.current) return;
                      setSelectedPinId(pin.id);
                      setPinDetailView(null);
                      if (map && pin.lat != null && pin.lng != null) {
                        const pos = new window.kakao.maps.LatLng(Number(pin.lat), Number(pin.lng));
                        map.panTo(pos);
                        map.setLevel(3);
                      }
                    }}
                    style={{
                      minWidth: '90px',
                      width: '90px',
                      flexShrink: 0,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isSelectedPin
                        ? '0 0 0 2px rgba(0,188,212,0.7), 0 2px 8px rgba(0,0,0,0.12)'
                        : '0 2px 8px rgba(0,0,0,0.1)',
                      background: isSelectedPin ? '#F0FBFC' : '#f5f5f5',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      scrollSnapAlign: 'start',
                      scrollSnapStop: 'always',
                      display: 'flex',
                      flexDirection: 'column' // 사진이 위, 지역명이 아래
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                  >
                    {hasExifTag(pin.post) && (
                      <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 3 }}>
                        <StatusBadge status={getPhotoStatusFromPost(pin.post)} />
                      </div>
                    )}
                    {(pin.image || pin.videoUrl || getPostPinImageUrl(pin.post)) && (
                      pin.videoUrl && !pin.image ? (
                        <video
                          src={pin.videoUrl}
                          muted
                          playsInline
                          preload="metadata"
                          style={{
                            width: '100%',
                            height: '90px',
                            objectFit: 'cover',
                            opacity: ageVisual.imageOpacity,
                            filter: ageVisual.imageFilter
                          }}
                        />
                      ) : (
                        <img
                          src={pin.image || getPostPinImageUrl(pin.post)}
                          alt={pin.title}
                          style={{
                            width: '100%',
                            height: '90px',
                            objectFit: 'cover',
                            opacity: ageVisual.imageOpacity,
                            filter: ageVisual.imageFilter
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )
                    )}
                    <div style={{
                      padding: '6px',
                      background: 'white'
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {pin.title}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', fontWeight: 600, color: '#64748b' }}>
                        {ageVisual.label}
                      </p>
                    </div>
                  </div>
                  );
                })
              ) : (
                <div style={{
                  width: '100%',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '14px'
                }}>
                  표시할 장소가 없습니다
                </div>
              )}
            </div>
          </div>
        )}

        {/* 핀/시트 선택 시 설명 카드 — 사진처럼 화면 가운데, 경로 만들기 버튼 위 */}
        {pinDetailView && pinDetailView.post && !selectedPost && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: `calc(${isSheetHidden ? 88 : Math.max(sheetHeight + 16, 88)}px + 56px)`,
              width: 'calc(100% - 24px)',
              maxWidth: 300,
              zIndex: 200,
              background: 'rgba(255,255,255,0.97)',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.06)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px' }}>
              {(() => {
                const thumb = getPostPinImageUrl(pinDetailView.post);
                const rawVid = !thumb ? getFirstVideoUriFromPost(pinDetailView.post) : '';
                const vUrl = rawVid ? getDisplayImageUrl(rawVid) : '';
                if (vUrl && !thumb) {
                  return (
                    <video
                      src={vUrl}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  );
                }
                return (
                  <img
                    src={thumb || MAP_PIN_PLACEHOLDER_SVG}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    onError={(e) => { e.target.src = MAP_PIN_PLACEHOLDER_SVG; }}
                  />
                );
              })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#27272a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pinDetailView.post.placeName || pinDetailView.post.detailedLocation || pinDetailView.post.location || '여행지'}
                </p>
                {(pinDetailView.post.note && pinDetailView.post.note.trim()) ? (
                  <p style={{ margin: '3px 0 0 0', fontSize: 11, color: '#71717a', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {pinDetailView.post.note}
                  </p>
                ) : (
                  <p style={{ margin: '3px 0 0 0', fontSize: 11, color: '#a1a1aa' }}>설명 없음</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPinDetailView(null)}
                style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                aria-label="닫기"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#a1a1aa' }}>close</span>
              </button>
            </div>
            <div style={{ padding: '0 10px 8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  const idx = posts.findIndex(p => p.id === pinDetailView.post.id);
                  setPinDetailView(null);
                  navigate(`/post/${pinDetailView.post.id}`, {
                    state: {
                      post: pinDetailView.post,
                      allPosts: posts,
                      currentPostIndex: idx >= 0 ? idx : 0
                    }
                  });
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(0,188,212,0.45)',
                  background: 'rgba(0,188,212,0.08)',
                  color: '#0891b2',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                상세보기
              </button>
            </div>
          </div>
        )}

        {/* 게시물 상세화면 모달 - 핸드폰 화면 안에서만 표시 */}
        {selectedPost && (
          <div
            onClick={() => setSelectedPost(null)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: '68px',
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '20px',
                width: '100%',
                maxWidth: 'calc(100% - 40px)',
                maxHeight: 'calc(100vh - 200px)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
            >
              {/* 헤더 */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {selectedPost.post.location || selectedPost.post.detailedLocation || '여행지'}
                </h2>
                <button
                  onClick={() => setSelectedPost(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: 'none',
                    background: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>
                    close
                  </span>
                </button>
              </div>

              {/* 이미지 / 동영상 썸네일 */}
              <div style={{
                width: '100%',
                aspectRatio: '4/3',
                overflow: 'hidden',
                background: '#f5f5f5',
                position: 'relative'
              }}>
                {hasExifTag(selectedPost.post) && (
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
                    <StatusBadge status={getPhotoStatusFromPost(selectedPost.post)} />
                  </div>
                )}
                {(() => {
                  const t = getPostPinImageUrl(selectedPost.post);
                  const rv = !t ? getFirstVideoUriFromPost(selectedPost.post) : '';
                  const vu = rv ? getDisplayImageUrl(rv) : '';
                  if (vu && !t) {
                    return (
                      <video
                        src={vu}
                        muted
                        playsInline
                        controls
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    );
                  }
                  return (
                    <img
                      src={t || MAP_PIN_PLACEHOLDER_SVG}
                      alt={selectedPost.post.location || '여행지'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = MAP_PIN_PLACEHOLDER_SVG;
                      }}
                    />
                  );
                })()}
              </div>

              {/* 내용 — 사진 아래 시트 스타일 통일 */}
              <div style={{
                padding: '16px',
                overflowY: 'auto',
                flex: 1,
                borderTop: '3px solid #475569',
                background: '#f8fafc',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                {selectedPost.post.note && (
                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.6'
                  }}>
                    {selectedPost.post.note}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                  paddingTop: '12px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00BCD4' }}>
                    location_on
                  </span>
                  <span style={{
                    fontSize: '13px',
                    color: '#999'
                  }}>
                    {selectedPost.post.detailedLocation || selectedPost.post.location || '위치 정보 없음'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    navigate(`/post/${selectedPost.post.id}`, {
                      state: {
                        post: selectedPost.post,
                        allPosts: selectedPost.allPosts,
                        currentPostIndex: selectedPost.currentPostIndex
                      }
                    });
                  }}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    background: '#00BCD4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  전체 보기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 위치 선택 모드 하단 안내 */}
        {isSelectingLocation && (
          <div style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1003,
            width: 'calc(100% - 32px)',
            maxWidth: '400px'
          }}>
            <div style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <span style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#00BCD4',
                textAlign: 'center'
              }}>
                위치를 설정하세요
              </span>
              <button
                onClick={() => {
                  finishSOSLocationSelection();
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#00BCD4',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#00ACC1';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#00BCD4';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                완료
              </button>
            </div>
          </div>
        )}

        {/* 지금 상황 알아보기 — 위치 선택 모달 */}
        {showSOSModal && !isSelectingLocation && (
          <>
            {/* 모달 배경 - 지도가 보이도록 반투명 */}
            <div
              onClick={handleSOSModalClose}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: '68px',
                background: 'rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                pointerEvents: 'auto'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: '68px',
                zIndex: 1001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                pointerEvents: 'none'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'white',
                  borderRadius: '24px',
                  width: '100%',
                  maxWidth: '400px',
                  height: '85vh',
                  maxHeight: '85vh',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto',
                  flexShrink: 0,
                }}
              >
                {/* 헤더 */}
                <div style={{
                  padding: '16px 20px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f0f0f0',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    지금 상황 알아보기
                  </span>
                  <button
                    onClick={handleSOSModalClose}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '14px',
                      border: 'none',
                      background: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#666' }}>
                      close
                    </span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  {/* 스크롤: 지도 검색과 같은 자동완성 목록 */}
                  <div style={{
                    padding: '12px 16px 8px',
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 0,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>위치 검색</span>
                      {selectedSOSLocation && (
                        <span style={{ fontSize: '12px', color: '#00BCD4', fontWeight: '600' }}>선택됨</span>
                      )}
                    </div>

                    <div
                      style={{
                        marginBottom: '10px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        height: '100px',
                        flexShrink: 0,
                        background: selectedSOSLocation ? '#f0f9fa' : '#f1f5f9',
                        border: selectedSOSLocation ? '1px solid #00BCD4' : '1px dashed #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selectedSOSLocation ? (
                        <div
                          id="location-preview-map"
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '12px'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8', padding: '0 12px', textAlign: 'center', lineHeight: 1.4 }}>
                          장소를 고르면 여기에 미리보기가 표시돼요
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        value={sosLocationSearch}
                        onChange={(e) => handleSOSLocationInput(e.target.value)}
                        placeholder="지역 또는 장소명 검색 (예: 창녕 연지못, 카페)"
                        style={{
                          flex: 1,
                          border: '1px solid #d1d5db',
                          borderRadius: '12px',
                          padding: '11px 12px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleStartLocationSelection}
                        title="지도에서 선택"
                        style={{
                          width: '44px',
                          height: '44px',
                          border: '1px solid #d1d5db',
                          borderRadius: '10px',
                          background: '#fff',
                          color: '#4b5563',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>map</span>
                      </button>
                    </div>

                    {sosLocationSuggestions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {sosLocationSuggestions.map((suggestion) => {
                          const t = suggestion.type;
                          const icon =
                            t === 'recommended_region' ? 'recommendation'
                              : t === 'region' ? 'location_on'
                                : t === 'place' ? 'photo_camera'
                                  : t === 'tourist' ? 'tour'
                                    : t === 'restaurant' ? 'restaurant'
                                      : t === 'cafe' ? 'local_cafe'
                                        : t === 'park' ? 'park'
                                          : 'place';
                          const iconColor =
                            t === 'recommended_region' ? '#9C27B0'
                              : t === 'region' ? '#00BCD4'
                                : t === 'place' ? '#FF9800'
                                  : t === 'tourist' ? '#2196F3'
                                    : t === 'restaurant' ? '#FF5722'
                                      : t === 'cafe' ? '#795548'
                                        : t === 'park' ? '#4CAF50'
                                          : '#64748b';
                          return (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => handleSelectSOSLocationBySearch(suggestion)}
                              style={{
                                width: '100%',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                textAlign: 'left',
                                background: '#fafafa',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: iconColor, flexShrink: 0 }}>
                                {icon}
                              </span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600, color: '#111827', lineHeight: 1.35 }}>
                                  {suggestion.display || suggestion.name}
                                </span>
                                {suggestion.address ? (
                                  <span style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                                    {suggestion.address}
                                  </span>
                                ) : null}
                                {suggestion.category && suggestion.kakaoPlace ? (
                                  <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                                    {suggestion.category}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {sosLocationSearch.trim() && sosLocationSuggestions.length === 0 && (
                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                        검색어를 조금 더 입력하거나, 아래에서 지도로 직접 고를 수 있어요.
                      </p>
                    )}
                  </div>

                  {/* 하단 고정: 궁금한 내용 + 바로 등록 */}
                  <div style={{
                    flexShrink: 0,
                    padding: '12px 16px 16px',
                    borderTop: '1px solid #f0f0f0',
                    background: '#fafafa',
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                      궁금한 내용
                    </span>
                    <textarea
                      value={sosQuestion}
                      onChange={(e) => setSosQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleSOSSubmit();
                        }
                      }}
                      placeholder="무엇이 궁금하신가요? (예: 주차 가능한가요, 사람 많나요)"
                      style={{
                        width: '100%',
                        height: '88px',
                        minHeight: '88px',
                        maxHeight: '88px',
                        padding: '10px 12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: 1.5,
                        background: '#fff',
                        marginBottom: '10px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#94a3b8' }}>
                      Ctrl+Enter로 바로 등록할 수 있어요.
                    </p>
                    <button
                      type="button"
                      onClick={handleSOSSubmit}
                      disabled={!selectedSOSLocation || !sosQuestion.trim()}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: selectedSOSLocation && sosQuestion.trim() ? '#00BCD4' : '#ddd',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        cursor: selectedSOSLocation && sosQuestion.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                      바로 등록하기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 검색 시트 모달 */}
        {showSearchSheet && (
          <div
            onClick={() => setShowSearchSheet(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'flex-start',
              pointerEvents: 'auto'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                width: '100%',
                height: '100vh',
                borderBottomLeftRadius: '0',
                borderBottomRightRadius: '0',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* 헤더 */}
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f5f5f5',
                  borderRadius: '24px',
                  padding: '12px 20px',
                  gap: '12px'
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#666' }}>
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="지역 또는 장소명 검색 (예: 서울 올림픽 공원, 카페, 맛집)"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch(e);
                        setShowSearchSheet(false);
                      }
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '16px',
                      color: '#333',
                      fontWeight: '400'
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setFilteredRegions([]);
                        setSearchSuggestions([]);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>
                        close
                      </span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowSearchSheet(false)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '20px',
                    border: 'none',
                    background: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#666' }}>
                    close
                  </span>
                </button>
              </div>

              {/* 검색 결과 또는 최근 검색 지역 */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
              }}>
                {searchQuery.trim() ? (
                  // 검색어가 있을 때 자동완성 결과
                  (searchSuggestions.length > 0 ? (
                    <div>
                      {searchSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px',
                            transition: 'background 0.2s',
                            background: '#fafafa'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0f0f0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fafafa';
                          }}
                        >
                          <span className="material-symbols-outlined" style={{
                            fontSize: '24px',
                            color: suggestion.type === 'recommended_region' ? '#9C27B0'
                              : suggestion.type === 'region' ? '#00BCD4'
                                : suggestion.type === 'hashtag' ? '#9C27B0'
                                  : suggestion.type === 'tourist' ? '#2196F3'
                                    : suggestion.type === 'restaurant' ? '#FF5722'
                                      : suggestion.type === 'cafe' ? '#795548'
                                        : suggestion.type === 'park' ? '#4CAF50'
                                          : '#FF9800'
                          }}>
                            {suggestion.type === 'recommended_region' ? 'recommendation'
                              : suggestion.type === 'region' ? 'location_on'
                                : suggestion.type === 'hashtag' ? 'tag'
                                  : suggestion.type === 'tourist' ? 'tour'
                                    : suggestion.type === 'restaurant' ? 'restaurant'
                                      : suggestion.type === 'cafe' ? 'local_cafe'
                                        : suggestion.type === 'park' ? 'park'
                                          : 'place'}
                          </span>
                          <span style={{
                            fontSize: '16px',
                            fontWeight: '500',
                            color: '#333',
                            flex: 1
                          }}>
                            {suggestion.display}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#999',
                      fontSize: '14px'
                    }}>
                      검색 결과가 없습니다
                    </div>
                  ))
                ) : (
                  // 검색어가 없을 때 최근 검색 지역
                  <div>
                    {recentSearches.length > 0 ? (
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '16px'
                        }}>
                          <h2 style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#333'
                          }}>
                            최근 검색한 지역
                          </h2>
                          <button
                            onClick={() => {
                              setRecentSearches([]);
                              localStorage.removeItem('recentSearches');
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#666',
                              padding: '4px 8px'
                            }}
                          >
                            지우기
                          </button>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          {recentSearches.map((search, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setSearchQuery(search);
                                setTimeout(() => {
                                  handleSearch({ preventDefault: () => { } });
                                  setShowSearchSheet(false);
                                }, 100);
                              }}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '20px',
                                border: 'none',
                                background: index === 0 ? '#00BCD4' : '#f5f5f5',
                                color: index === 0 ? 'white' : '#333',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                history
                              </span>
                              {search}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '14px'
                      }}>
                        최근 검색한 지역이 없습니다
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 등록 완료 직후 스폰서 영상(모의 자동 재생) */}
        {showAdModal && (
          <div
            onClick={handleAdModalDismiss}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: '68px',
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '400px',
                maxHeight: '80vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #f0f0f0',
                textAlign: 'center'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  요청이 등록되었습니다
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  스폰서 영상이 재생됩니다. 등록은 이미 완료되었어요.
                </p>
              </div>

              <div style={{
                padding: '12px 20px 0',
              }}>
                <div style={{
                  height: '6px',
                  borderRadius: '999px',
                  background: '#e2e8f0',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${adPlaybackProgress}%`,
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #00BCD4, #0097A7)',
                    transition: 'width 0.08s linear',
                  }} />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                  {adPlaybackProgress >= 100
                    ? '재생 종료'
                    : `재생 중… ${Math.round(adPlaybackProgress)}%`}
                </p>
              </div>

              <div style={{
                padding: '20px',
                background: '#f5f5f5',
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1
              }}>
                <div style={{
                  width: '100%',
                  height: '200px',
                  background: 'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '600'
                }}>
                  스폰서 영상
                  <span style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px', display: 'block', fontWeight: 400 }}>
                    (실제 광고 SDK 연동 시 이 영역에 재생)
                  </span>
                </div>
              </div>

              <div style={{
                padding: '16px 20px 20px',
                borderTop: '1px solid #f0f0f0',
                background: '#fafafa'
              }}>
                <button
                  type="button"
                  onClick={handleAdModalDismiss}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
                <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                  요청 등록에는 광고 시청이 필요하지 않습니다. 재생이 끝나면 자동으로 닫혀요.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default MapScreen;

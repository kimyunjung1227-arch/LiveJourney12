import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getRegionDefaultImage } from '../utils/regionDefaultImages';
import { getMapThumbnailUri } from '../utils/postMedia';
import { getTimeAgo, filterActivePosts48 } from '../utils/timeUtils';
import { logger } from '../utils/logger';
import { getCombinedPosts } from '../utils/mockData';
import { getDisplayImageUrl } from '../api/upload';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { getWeatherByRegion } from '../api/weather';
import PostThumbnail from '../components/PostThumbnail';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import BackButton from '../components/BackButton';
import { normalizeRegionName } from '../utils/regionNames';
import { combinePostsSupabaseAndLocal } from '../utils/mergePostsById';
import { getPostUserId, resolveUserDisplayFromPosts } from '../utils/userProfileHints';
import { getCurrentUserId, getFollowingIds } from '../utils/followSystem';

// 해시태그 파싱: #동백꽃 #바다 #힐링 → ['동백꽃','바다','힐링']
const parseHashtags = (q) => {
  if (!q || typeof q !== 'string') return [];
  const matches = q.match(/#[^\s#]+/g) || [];
  return matches.map((m) => m.replace(/^#+/, '').trim()).filter(Boolean);
};

// 기본 인기 해시태그 (게시물 태그가 없을 때 해시태그 영역에 표시)
const DEFAULT_HASHTAGS = ['바다', '힐링', '맛집', '자연', '꽃', '일출', '카페', '여행', '휴양', '등산', '야경', '축제', '해변', '산', '전통', '한옥', '감귤', '벚꽃', '단풍', '도시'];

// 지역별 재미있는 한 줄 설명 (성심당의 도시 스타일)
const REGION_TAGLINES = {
  '서울': '한강과 궁궐의 도시', '부산': '해운대와 광안리의 도시', '대구': '김광석과 치맥의 도시',
  '인천': '짜장면과 차이나타운의 도시', '광주': '무등산과 빛고을', '대전': '성심당의 도시',
  '울산': '간절곶 일출의 도시', '세종': '호수공원과 행정의 도시', '수원': '화성과 갈비의 도시',
  '용인': '에버랜드의 도시', '성남': '판교와 IT의 도시', '고양': '일산 호수와 킨텍스의 도시',
  '부천': '만화와 영화의 도시', '안양': '안양천과 예술의 도시', '파주': '헤이리와 DMZ의 도시',
  '평택': '평택항과 송탄의 도시', '화성': '융건릉과 제부도의 도시', '김포': '한강과 김포공항의 도시',
  '광명': '광명동굴의 도시', '이천': '도자기와 쌀의 고장', '양평': '두물머리와 세미원의 고장',
  '가평': '남이섬과 아침고요의 고장', '포천': '산정호수와 허브아일랜드의 고장',
  '춘천': '닭갈비와 소양강의 도시', '강릉': '커피와 정동진 일출의 도시', '속초': '오징어와 설악산의 도시',
  '원주': '치악산과 단풍의 고장', '동해': '촛대바위와 추암의 도시', '태백': '눈꽃과 스키의 고장',
  '삼척': '환선굴과 동굴의 도시', '평창': '용평과 올림픽의 고장', '양양': '서핑과 낙산사의 도시',
  '청주': '직지와 상당산성의 도시', '충주': '충주호와 사과의 고장', '제천': '의림지와 한방의 고장',
  '천안': '호두과자와 독립기념관의 도시', '아산': '온양온천과 이순신의 고장', '공주': '백제와 무령왕릉의 도시',
  '보령': '머드와 대천해수욕장의 도시', '서산': '간월암과 마애삼존불의 고장', '당진': '왜목마을과 일출의 고장',
  '부여': '백제 궁남지의 도시', '전주': '한옥과 비빔밥의 도시', '군산': '이성당 빵과 경암동의 도시',
  '익산': '미륵사지와 보석의 고장', '정읍': '내장산 단풍의 고장', '남원': '춘향과 광한루의 도시',
  '목포': '갓바위와 회의 도시', '여수': '밤바다와 오동도의 도시', '순천': '순천만 갈대의 도시',
  '광양': '매화와 불고기의 도시', '담양': '죽녹원과 대나무의 고장', '보성': '녹차밭과 드라이브의 고장',
  '포항': '과메기와 호미곶 일출의 도시', '경주': '불국사와 신라 천년의 도시', '구미': '반도체와 골드키위의 도시',
  '안동': '하회마을과 간고등어의 고장', '김천': '직지사와 포도의 고장', '영주': '부석사와 소수서원의 고장',
  '창원': '진해 벚꽃의 도시', '진주': '진주성과 비빔밥의 도시', '통영': '한려수도와 회의 도시',
  '사천': '바다와 항공의 도시', '김해': '수로왕릉과 가야의 도시', '거제': '해금강과 외도의 도시',
  '양산': '통도사와 신불산의 고장', '제주': '한라산과 흑돼지의 섬', '서귀포': '정방폭포와 감귤의 도시'
};

const getRegionTagline = (name) => REGION_TAGLINES[name] || `${name}의 숨은 보석`;

const SearchScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  /** 'place': 지역·해시태그, 'person': 여행자 닉네임 */
  const [searchMode, setSearchMode] = useState('place');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredRegions, setFilteredRegions] = useState([]);
  const [filteredHashtags, setFilteredHashtags] = useState([]);
  const [filteredTravelers, setFilteredTravelers] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [selectedHashtag, setSelectedHashtag] = useState(null);
  const [searchCount, setSearchCount] = useState(0);
  const [searchEvents, setSearchEvents] = useState([]);
  const [photoFocusMode, setPhotoFocusMode] = useState(false);
  const [weatherData, setWeatherData] = useState({});
  const [cycleIndex, setCycleIndex] = useState(0);

  const recommendedScrollRef = useRef(null);
  const screenBodyRef = useRef(null);
  const recentScrollRef = useRef(null);
  const hotScrollRef = useRef(null);
  const searchContainerRef = useRef(null);
  const { handleDragStart, hasMovedRef } = useHorizontalDragScroll();

  // 추천 지역 데이터 (메모이제이션) - 기본 이미지는 getRegionDefaultImage 사용
  const recommendedRegions = useMemo(() => [
    { id: 1, name: '서울', image: getRegionDefaultImage('서울'), keywords: ['도시', '쇼핑', '명동', '강남', '홍대', '경복궁', '궁궐', '한강', '야경', '카페', '맛집'] },
    { id: 2, name: '부산', image: getRegionDefaultImage('부산'), keywords: ['바다', '해변', '해운대', '광안리', '야경', '횟집', '수산시장', '자갈치', '항구', '서핑'] },
    { id: 3, name: '대구', image: getRegionDefaultImage('대구'), keywords: ['도시', '근대', '골목', '김광석길', '동성로', '쇼핑', '약령시', '팔공산', '치맥', '맥주'] },
    { id: 4, name: '인천', image: getRegionDefaultImage('인천'), keywords: ['차이나타운', '짜장면', '월미도', '야경', '인천공항', '바다', '항구', '송도', '근대'] },
    { id: 5, name: '광주', image: getRegionDefaultImage('광주'), keywords: ['도시', '무등산', '양동시장', '충장로', '예술', '문화', '민주화', '역사'] },
    { id: 6, name: '대전', image: getRegionDefaultImage('대전'), keywords: ['도시', '과학', '엑스포', '성심당', '빵', '한밭수목원', '대청호', '계족산'] },
    { id: 7, name: '울산', image: getRegionDefaultImage('울산'), keywords: ['공업', '항구', '대왕암공원', '간절곶', '일출', '고래', '울산대교', '태화강'] },
    { id: 8, name: '세종', image: getRegionDefaultImage('세종'), keywords: ['행정', '정부', '신도시', '계획도시', '공원', '호수공원', '도담동'] },
    { id: 9, name: '수원', image: getRegionDefaultImage('수원'), keywords: ['화성', '성곽', '수원갈비', '행궁', '화성행궁', '전통', '맛집'] },
    { id: 10, name: '용인', image: getRegionDefaultImage('용인'), keywords: ['에버랜드', '놀이공원', '민속촌', '한국민속촌', '가족'] },
    { id: 11, name: '성남', image: getRegionDefaultImage('성남'), keywords: ['도시', '판교', 'IT', '테크노', '카페'] },
    { id: 12, name: '고양', image: getRegionDefaultImage('고양'), keywords: ['일산', '호수공원', '킨텍스', '전시', '꽃축제'] },
    { id: 13, name: '부천', image: getRegionDefaultImage('부천'), keywords: ['도시', '만화박물관', '애니메이션', '영화'] },
    { id: 14, name: '안양', image: getRegionDefaultImage('안양'), keywords: ['도시', '안양천', '예술공원'] },
    { id: 15, name: '파주', image: getRegionDefaultImage('파주'), keywords: ['헤이리', '출판단지', '임진각', 'DMZ', '예술', '북카페'] },
    { id: 16, name: '평택', image: getRegionDefaultImage('평택'), keywords: ['항구', '미군기지', '송탄'] },
    { id: 17, name: '화성', image: getRegionDefaultImage('화성'), keywords: ['융건릉', '용주사', '제부도', '바다'] },
    { id: 18, name: '김포', image: getRegionDefaultImage('김포'), keywords: ['공항', '김포공항', '한강', '애기봉'] },
    { id: 19, name: '광명', image: getRegionDefaultImage('광명'), keywords: ['동굴', '광명동굴', 'KTX'] },
    { id: 20, name: '이천', image: getRegionDefaultImage('이천'), keywords: ['도자기', '쌀', '온천', '세라피아'] },
    { id: 21, name: '양평', image: getRegionDefaultImage('양평'), keywords: ['자연', '두물머리', '세미원', '힐링', '강', '수목원'] },
    { id: 22, name: '가평', image: getRegionDefaultImage('가평'), keywords: ['남이섬', '쁘띠프랑스', '아침고요수목원', '자연', '힐링', '계곡'] },
    { id: 23, name: '포천', image: getRegionDefaultImage('포천'), keywords: ['아트밸리', '허브아일랜드', '산정호수', '자연'] },
    { id: 24, name: '춘천', image: getRegionDefaultImage('춘천'), keywords: ['닭갈비', '호수', '남이섬', '소양강', '스카이워크', '맛집'] },
    { id: 25, name: '강릉', image: getRegionDefaultImage('강릉'), keywords: ['바다', '커피', '카페', '경포대', '정동진', '일출', '해변', '순두부'] },
    { id: 26, name: '속초', image: getRegionDefaultImage('속초'), keywords: ['바다', '설악산', '산', '등산', '오징어', '수산시장', '아바이마을', '회'] },
    { id: 27, name: '원주', image: getRegionDefaultImage('원주'), keywords: ['치악산', '등산', '산', '자연'] },
    { id: 28, name: '동해', image: getRegionDefaultImage('동해'), keywords: ['바다', '해변', '추암', '촛대바위', '일출'] },
    { id: 29, name: '태백', image: getRegionDefaultImage('태백'), keywords: ['산', '탄광', '눈꽃축제', '겨울', '스키'] },
    { id: 30, name: '삼척', image: getRegionDefaultImage('삼척'), keywords: ['바다', '동굴', '환선굴', '대금굴', '해변'] },
    { id: 31, name: '평창', image: getRegionDefaultImage('평창'), keywords: ['스키', '겨울', '올림픽', '산', '용평'] },
    { id: 32, name: '양양', image: getRegionDefaultImage('양양'), keywords: ['바다', '서핑', '해변', '낙산사', '하조대'] },
    { id: 33, name: '청주', image: getRegionDefaultImage('청주'), keywords: ['도시', '직지', '인쇄', '상당산성', '문화'] },
    { id: 34, name: '충주', image: getRegionDefaultImage('충주'), keywords: ['호수', '충주호', '탄금대', '사과', '자연'] },
    { id: 35, name: '제천', image: getRegionDefaultImage('제천'), keywords: ['약초', '한방', '청풍호', '의림지', '자연'] },
    { id: 36, name: '천안', image: getRegionDefaultImage('천안'), keywords: ['호두과자', '독립기념관', '역사', '맛집'] },
    { id: 37, name: '아산', image: getRegionDefaultImage('아산'), keywords: ['온양온천', '온천', '현충사', '이순신', '역사'] },
    { id: 38, name: '공주', image: getRegionDefaultImage('공주'), keywords: ['역사', '백제', '공산성', '무령왕릉', '전통', '문화재'] },
    { id: 39, name: '보령', image: getRegionDefaultImage('보령'), keywords: ['바다', '머드', '축제', '해수욕장', '대천'] },
    { id: 40, name: '서산', image: getRegionDefaultImage('서산'), keywords: ['바다', '간월암', '마애삼존불', '석불', '역사'] },
    { id: 41, name: '당진', image: getRegionDefaultImage('당진'), keywords: ['바다', '왜목마을', '일출', '일몰'] },
    { id: 42, name: '부여', image: getRegionDefaultImage('부여'), keywords: ['역사', '백제', '궁남지', '정림사지', '문화재', '전통'] },
    { id: 43, name: '전주', image: getRegionDefaultImage('전주'), keywords: ['한옥', '전통', '한옥마을', '비빔밥', '콩나물국밥', '맛집', '한복'] },
    { id: 44, name: '군산', image: getRegionDefaultImage('군산'), keywords: ['근대', '역사', '이성당', '빵', '항구', '경암동'] },
    { id: 45, name: '익산', image: getRegionDefaultImage('익산'), keywords: ['역사', '백제', '미륵사지', '보석', '문화재'] },
    { id: 46, name: '정읍', image: getRegionDefaultImage('정읍'), keywords: ['내장산', '단풍', '산', '등산', '자연'] },
    { id: 47, name: '남원', image: getRegionDefaultImage('남원'), keywords: ['춘향', '전통', '광한루', '지리산', '산'] },
    { id: 48, name: '목포', image: getRegionDefaultImage('목포'), keywords: ['바다', '항구', '유달산', '갓바위', '회', '해산물'] },
    { id: 49, name: '여수', image: getRegionDefaultImage('여수'), keywords: ['바다', '밤바다', '야경', '낭만', '케이블카', '오동도', '향일암'] },
    { id: 50, name: '순천', image: getRegionDefaultImage('순천'), keywords: ['순천만', '정원', '갈대', '습지', '자연', '생태'] },
    { id: 51, name: '광양', image: getRegionDefaultImage('광양'), keywords: ['매화', '꽃', '섬진강', '불고기', '맛집'] },
    { id: 52, name: '담양', image: getRegionDefaultImage('담양'), keywords: ['대나무', '죽녹원', '메타세쿼이아', '자연', '힐링'] },
    { id: 53, name: '보성', image: getRegionDefaultImage('보성'), keywords: ['녹차', '차밭', '자연', '힐링', '드라이브'] },
    { id: 54, name: '포항', image: getRegionDefaultImage('포항'), keywords: ['바다', '호미곶', '일출', '과메기', '회', '항구'] },
    { id: 55, name: '경주', image: getRegionDefaultImage('경주'), keywords: ['역사', '문화재', '불국사', '석굴암', '첨성대', '신라', '전통'] },
    { id: 56, name: '구미', image: getRegionDefaultImage('구미'), keywords: ['공업', 'IT', '도시'] },
    { id: 57, name: '안동', image: getRegionDefaultImage('안동'), keywords: ['하회마을', '전통', '한옥', '탈춤', '간고등어', '역사'] },
    { id: 58, name: '김천', image: getRegionDefaultImage('김천'), keywords: ['직지사', '산', '사찰', '포도'] },
    { id: 59, name: '영주', image: getRegionDefaultImage('영주'), keywords: ['부석사', '소수서원', '사찰', '역사', '전통'] },
    { id: 60, name: '창원', image: getRegionDefaultImage('창원'), keywords: ['도시', '공업', '진해', '벚꽃', '축제'] },
    { id: 61, name: '진주', image: getRegionDefaultImage('진주'), keywords: ['진주성', '역사', '비빔밥', '맛집', '남강'] },
    { id: 62, name: '통영', image: getRegionDefaultImage('통영'), keywords: ['바다', '케이블카', '한려수도', '회', '해산물', '섬'] },
    { id: 63, name: '사천', image: getRegionDefaultImage('사천'), keywords: ['바다', '해변', '항공', '공항'] },
    { id: 64, name: '김해', image: getRegionDefaultImage('김해'), keywords: ['가야', '역사', '공항', '김해공항', '수로왕릉'] },
    { id: 65, name: '거제', image: getRegionDefaultImage('거제'), keywords: ['바다', '섬', '해금강', '외도', '조선소'] },
    { id: 66, name: '양산', image: getRegionDefaultImage('양산'), keywords: ['통도사', '사찰', '신불산', '산', '자연'] },
    { id: 67, name: '제주', image: getRegionDefaultImage('제주'), keywords: ['섬', '바다', '한라산', '오름', '돌하르방', '흑돼지', '감귤', '휴양', '힐링'] },
    { id: 68, name: '서귀포', image: getRegionDefaultImage('서귀포'), keywords: ['바다', '섬', '폭포', '정방폭포', '천지연', '감귤', '자연'] }
  ], []);

  // 게시물 위치에서 지역 키 추출 (대전 대덕구 → 대전, 경상북도 포항 → 포항)
  const getRegionKeyFromLocation = useCallback((loc) => {
    const s = String(loc || '').trim();
    if (!s) return '';
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts[0].endsWith('도')) return parts.length >= 2 ? parts[1] : parts[0];
    return parts[0];
  }, []);

  // 추천 지역 카드: 피드 게시물 위치별로 묶어서 하나의 지역으로 (대전→대전, 부산→부산), 사진은 사용자 업로드로 순환
  const diverseRegionCards = useMemo(() => {
    const groups = new Map();
    for (const post of allPosts) {
      const loc = post.location || post.placeName || post.region || '';
      const regionKey = getRegionKeyFromLocation(loc);
      if (!regionKey || regionKey.length < 2) continue;
      if (!groups.has(regionKey)) groups.set(regionKey, []);
      groups.get(regionKey).push(post);
    }
    const cards = [];
    for (const [name, posts] of groups) {
      const sorted = [...posts].sort((a, b) => (new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)));
      const latest = sorted[0];
      const imgUrl = latest?.images?.[0] || latest?.thumbnail || latest?.image;
      cards.push({
        name,
        category: '명소',
        categoryLabel: '명소',
        image: imgUrl,
        shortDesc: `${name} 지역 게시물`,
        detailedLocation: latest?.location || name,
        time: getTimeAgo(latest?.timestamp || latest?.createdAt),
        count: posts.length,
        hasUploadedPhoto: true,
        posts: sorted
      });
    }
    cards.sort((a, b) => b.count - a.count || (b.time || '').localeCompare(a.time || ''));
    return cards.slice(0, 12);
  }, [allPosts, getRegionKeyFromLocation]);

  // 추천 지역 카드 사진 순환 (사용자 올린 사진이 주기적으로 바뀌도록)
  useEffect(() => {
    const t = setInterval(() => setCycleIndex((i) => i + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // 지역별 날씨 정보 가져오기
  useEffect(() => {
    if (!diverseRegionCards || diverseRegionCards.length === 0) return;

    const fetchWeatherForCards = async () => {
      const weatherPromises = diverseRegionCards.map(async (card) => {
        try {
          const weatherResult = await getWeatherByRegion(card.name);
          if (weatherResult?.success && weatherResult?.weather) {
            return { regionName: card.name, weather: weatherResult.weather };
          }
        } catch (error) {
          logger.error(`날씨 정보 가져오기 실패 (${card.name}):`, error);
        }
        return null;
      });

      const weatherResults = await Promise.all(weatherPromises);
      const weatherMap = {};
      weatherResults.forEach((result) => {
        if (result) {
          weatherMap[result.regionName] = result.weather;
        }
      });
      setWeatherData(weatherMap);
    };

    fetchWeatherForCards();
  }, [diverseRegionCards]);


  // 최근 검색한 지역만 (#해시태그 제외)
  const recentRegionSearches = useMemo(
    () => recentSearches.filter((s) => !String(s).startsWith('#')),
    [recentSearches]
  );

  // 가장 많이 검색된 지역 (searchEvents 기반, 상위 5개)
  const mostSearchedRegions = useMemo(() => {
    if (!searchEvents || searchEvents.length === 0) return [];

    const counts = new Map();
    searchEvents.forEach((ev) => {
      const t = String(ev?.term || '').trim().toLowerCase();
      if (!t || t.startsWith('#')) return;

      // 추천 지역 목록에서 매칭되는 지역 찾기
      const matched = recommendedRegions.find((r) => {
        const nameLower = r.name.toLowerCase();
        return nameLower === t || nameLower.includes(t) || t.includes(nameLower);
      });
      if (!matched) return;

      const key = matched.name;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const items = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    items.sort((a, b) => b.count - a.count);
    return items.slice(0, 5);
  }, [searchEvents, recommendedRegions]);

  // 해시태그 칩: 전체 게시물에서 태그 수집, 빈도순 상위 24개. 없으면 기본 인기 해시태그 사용
  const hashtagChips = useMemo(() => {
    const norm = (s) => String(s || '').replace(/^#+/, '').trim().toLowerCase();
    const getDisplay = (t) => (typeof t === 'string' ? t : (t?.name || t?.label || '')).replace(/^#+/, '').trim();
    const map = new Map(); // norm -> { display, count }
    allPosts.forEach((p) => {
      const tags = [
        ...(p.tags || []).map((t) => (typeof t === 'string' ? t : (t?.name || t?.label || ''))),
        ...(p.aiLabels || []).map((l) => (typeof l === 'string' ? l : (l?.name || l?.label || '')))
      ].filter(Boolean);
      tags.forEach((raw) => {
        const n = norm(raw);
        if (!n || n.length < 2) return;
        if (!map.has(n)) map.set(n, { display: getDisplay(raw) || n, count: 0 });
        map.get(n).count += 1;
      });
    });
    const fromPosts = Array.from(map.entries())
      .map(([n, { display, count }]) => ({ key: n, display, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);
    if (fromPosts.length > 0) return fromPosts;
    return DEFAULT_HASHTAGS.map((d) => ({ key: d.toLowerCase(), display: d, count: 0 }));
  }, [allPosts]);

  // 선택된 해시태그에 해당하는 게시물
  const hashtagPostResults = useMemo(() => {
    if (!selectedHashtag) return [];
    const norm = (s) => String(s || '').replace(/^#+/, '').trim().toLowerCase();
    const getPostTags = (p) => [
      ...(p.tags || []).map((t) => (typeof t === 'string' ? t : (t?.name || t?.label || ''))),
      ...(p.aiLabels || []).map((l) => (typeof l === 'string' ? l : (l?.name || l?.label || '')))
    ];
    const target = norm(selectedHashtag);
    return allPosts.filter((p) => {
      const pt = getPostTags(p).map(norm).filter(Boolean);
      return pt.some((pTag) => pTag === target || (pTag.includes(target) && target.length >= 2));
    });
  }, [allPosts, selectedHashtag]);

  // 한글 초성 추출 함수 (useCallback)
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

  // 초성 매칭 함수 (useCallback)
  const matchChosung = useCallback((text, search) => {
    const textChosung = getChosung(text);
    const searchChosung = getChosung(search);

    // 초성 매칭: 검색어의 초성이 지역명 초성에 포함되는지
    const matches = textChosung.includes(searchChosung) || textChosung.includes(search);

    return matches;
  }, [getChosung]);

  // 검색어 기준 지역 매칭·정렬: 완전일치 > 앞글자일치 > 포함 > 초성순. 같은 rank면 이름 짧은 순(더 정확한 매칭 우선)
  const getMatchingRegions = useCallback((searchTerm, raw) => {
    if (!searchTerm || !raw) return [];
    return recommendedRegions
      .map((region) => {
        const name = region.name.toLowerCase();
        let rank = 99;
        if (name === searchTerm) rank = 0;
        else if (name.startsWith(searchTerm)) rank = 1;
        else if (name.includes(searchTerm)) rank = 2;
        else if (matchChosung(region.name, raw)) rank = 3;
        else return null;
        return { region, rank };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.region.name.length - b.region.name.length)
      .map((x) => x.region);
  }, [recommendedRegions, matchChosung]);

  // 인물 검색: 게시물에 등장한 userId 기준 여행자 목록
  const travelerDirectory = useMemo(() => {
    const byId = new Map();
    for (const p of allPosts) {
      const uid = getPostUserId(p);
      if (!uid || uid === 'undefined' || uid === 'null') continue;
      if (!byId.has(uid)) byId.set(uid, { userId: uid, postCount: 0 });
      byId.get(uid).postCount += 1;
    }
    return Array.from(byId.values())
      .map((row) => {
        const resolved = resolveUserDisplayFromPosts(row.userId, allPosts);
        let username = resolved.username && resolved.username !== '사용자' ? resolved.username : '';
        if (!username) {
          const sample = allPosts.find((p) => getPostUserId(p) === String(row.userId));
          const u = sample?.user;
          if (u && typeof u === 'object' && (u.username || u.name)) {
            username = String(u.username || u.name).trim();
          } else if (typeof u === 'string' && u.trim()) {
            username = u.trim();
          }
        }
        if (!username) return null;
        return {
          userId: row.userId,
          username,
          profileImage: resolved.profileImage || null,
          postCount: row.postCount,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.postCount - a.postCount || a.username.localeCompare(b.username, 'ko'));
  }, [allPosts]);

  const myUserId = useMemo(() => {
    const id = getCurrentUserId();
    return id ? String(id) : '';
  }, []);

  const followingIds = useMemo(() => {
    if (!myUserId) return [];
    return getFollowingIds(myUserId).filter(Boolean).map(String);
  }, [myUserId]);

  const followedTravelersTop5 = useMemo(() => {
    if (!followingIds.length) return [];
    const map = new Map(travelerDirectory.map((t) => [String(t.userId), t]));
    const out = [];
    for (const id of followingIds) {
      const t = map.get(String(id));
      if (t) out.push(t);
      if (out.length >= 5) break;
    }
    return out.slice(0, 5);
  }, [followingIds, travelerDirectory]);

  const recommendedTravelersTop5 = useMemo(() => {
    const exclude = new Set([...(followingIds || []).map(String), myUserId ? String(myUserId) : '']);
    return travelerDirectory
      .filter((t) => t && t.userId && !exclude.has(String(t.userId)))
      .slice(0, 5);
  }, [travelerDirectory, followingIds, myUserId]);

  const goTravelerProfile = useCallback(
    (t) => {
      if (!t?.userId) return;
      navigate(`/user/${encodeURIComponent(t.userId)}`, {
        state: { profileHint: { username: t.username, profileImage: t.profileImage || null } },
      });
    },
    [navigate]
  );

  const getMatchingTravelers = useCallback(
    (searchTerm, raw) => {
      if (!searchTerm || !travelerDirectory.length) return [];
      return travelerDirectory
        .map((t) => {
          const name = String(t.username || '').toLowerCase();
          let rank = 99;
          if (name === searchTerm) rank = 0;
          else if (name.startsWith(searchTerm)) rank = 1;
          else if (name.includes(searchTerm)) rank = 2;
          else if (matchChosung(t.username, raw)) rank = 3;
          else return null;
          return { ...t, rank };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            b.postCount - a.postCount ||
            a.username.localeCompare(b.username, 'ko')
        )
        .slice(0, 20);
    },
    [travelerDirectory, matchChosung]
  );

  const switchSearchMode = useCallback((mode) => {
    if (mode !== 'place' && mode !== 'person') return;
    setSearchMode(mode);
    setSearchQuery('');
    setShowSuggestions(false);
    setFilteredRegions([]);
    setFilteredHashtags([]);
    setFilteredTravelers([]);
  }, []);

  const incrementSearchCount = useCallback((term = '') => {
    const n = parseInt(localStorage.getItem('searchCount') || '0', 10) + 1;
    localStorage.setItem('searchCount', String(n));
    setSearchCount(n);

    // 검색 이벤트 저장 (핫플 의도 신호용)
    if (term) {
      const entry = { term: String(term).trim().toLowerCase(), ts: Date.now() };
      try {
        const raw = JSON.parse(localStorage.getItem('searchEvents') || '[]');
        const base = Array.isArray(raw) ? raw : [];
        const next = [entry, ...base].slice(0, 500);
        localStorage.setItem('searchEvents', JSON.stringify(next));
        setSearchEvents(next);
      } catch {
        const next = [entry];
        localStorage.setItem('searchEvents', JSON.stringify(next));
        setSearchEvents(next);
      }
    }
  }, []);

  // 검색어 입력 핸들러: 장소 모드(지역+해시태그) / 인물 모드(여행자)
  const handleSearchInput = useCallback(
    (e) => {
      const value = e.target.value;
      setSearchQuery(value);

      if (value.trim()) {
        const raw = value.replace(/^#+/, '').trim();
        const searchTerm = raw.toLowerCase();

        if (searchMode === 'person') {
          setFilteredRegions([]);
          setFilteredHashtags([]);
          setFilteredTravelers(getMatchingTravelers(searchTerm, raw));
          setShowSuggestions(true);
        } else {
          setFilteredRegions(getMatchingRegions(searchTerm, raw));
          const hashtagMatches = (hashtagChips || []).filter(
            (h) =>
              (h.key && h.key.includes(searchTerm)) ||
              (h.display && String(h.display).toLowerCase().includes(searchTerm))
          );
          setFilteredHashtags(hashtagMatches);
          setFilteredTravelers([]);
          setShowSuggestions(true);
        }
      } else {
        setFilteredRegions([]);
        setFilteredHashtags([]);
        setFilteredTravelers([]);
        setShowSuggestions(false);
      }
    },
    [getMatchingRegions, hashtagChips, getMatchingTravelers, searchMode]
  );

  // 검색 핸들러: 장소(지역·해시태그) 또는 인물(프로필)
  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    incrementSearchCount(searchQuery);

    const raw = searchQuery.replace(/^#+/, '').trim();
    const searchTerm = raw.toLowerCase();

    if (searchMode === 'person') {
      const matches = getMatchingTravelers(searchTerm, raw);
      if (matches.length > 0) {
        const t = matches[0];
        navigate(`/user/${encodeURIComponent(t.userId)}`, {
          state: { profileHint: { username: t.username, profileImage: t.profileImage || null } },
        });
        setSearchQuery('');
        setShowSuggestions(false);
        return;
      }
      alert('일치하는 여행자를 찾지 못했어요. 닉네임을 확인해 주세요.');
      return;
    }

    // 1) 지역 먼저 — getMatchingRegions로 완전일치·앞글자·포함·초성 순 정렬 후 첫 항목 사용
    const matchedRegions = getMatchingRegions(searchTerm, raw);

    if (matchedRegions.length > 0) {
      const targetRegion = matchedRegions[0];
      const updated = recentSearches.includes(targetRegion.name) ? recentSearches : [targetRegion.name, ...recentSearches.slice(0, 3)];
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
      {
        const rn = normalizeRegionName(targetRegion.name);
        navigate(`/region/${encodeURIComponent(rn)}`, { state: { region: { name: rn } } });
      }
      setSearchQuery('');
      setShowSuggestions(false);
      return;
    }

    // 2) 해시태그
    const found = (hashtagChips || []).find(
      h => (h.key && h.key === searchTerm) || (h.display && String(h.display).toLowerCase().includes(searchTerm)) || (h.key && h.key.includes(searchTerm))
    );
    if (found) {
      setSelectedHashtag(found.display);
      setSearchQuery('');
      setShowSuggestions(false);
      return;
    }

    alert('검색 결과가 없습니다. 지역명이나 #해시태그를 입력해보세요.');
  }, [
    searchQuery,
    searchMode,
    getMatchingRegions,
    getMatchingTravelers,
    recentSearches,
    navigate,
    hashtagChips,
    incrementSearchCount,
  ]);

  // 자동완성 항목 클릭 (useCallback)
  const handleSuggestionClick = useCallback((regionName) => {
    incrementSearchCount(regionName);
    setSearchQuery(regionName);
    setShowSuggestions(false);

    const updatedRecentSearches = recentSearches.includes(regionName)
      ? recentSearches
      : [regionName, ...recentSearches.slice(0, 3)];
    setRecentSearches(updatedRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedRecentSearches));

    {
      const rn = normalizeRegionName(regionName);
      navigate(`/region/${encodeURIComponent(rn)}`, { state: { region: { name: rn } } });
    }
  }, [recentSearches, navigate, incrementSearchCount]);

  // 해시태그 자동완성 클릭 (최근 검색에는 넣지 않음)
  const handleHashtagSuggestionClick = useCallback((display) => {
    incrementSearchCount(display);
    setSelectedHashtag(display);
    setSearchQuery('');
    setShowSuggestions(false);
  }, [incrementSearchCount]);

  const handleTravelerSuggestionClick = useCallback(
    (t) => {
      if (!t?.userId) return;
      incrementSearchCount(t.username);
      setSearchQuery('');
      setShowSuggestions(false);
      navigate(`/user/${encodeURIComponent(t.userId)}`, {
        state: { profileHint: { username: t.username, profileImage: t.profileImage || null } },
      });
    },
    [incrementSearchCount, navigate]
  );

  const handleRecentSearchClick = useCallback((search) => {
    incrementSearchCount();
    if (search && String(search).startsWith('#')) {
      setSelectedHashtag(String(search).replace(/^#+/, '').trim());
      setSearchQuery('');
      return;
    }
    {
      const rn = normalizeRegionName(search);
      navigate(`/region/${encodeURIComponent(rn)}`, { state: { region: { name: rn } } });
    }
  }, [navigate, incrementSearchCount]);

  const handleClearRecentSearches = useCallback(() => {
    if (window.confirm('최근 검색어를 모두 삭제하시겠습니까?')) {
      setRecentSearches([]);
      localStorage.removeItem('recentSearches');
    }
  }, []);

  // 개별 최근 검색어 삭제
  const handleDeleteRecentSearch = useCallback((searchToDelete, event) => {
    // 이벤트 전파 중지 (버튼 클릭 시 지역 이동 방지)
    if (event) {
      event.stopPropagation();
    }

    const updatedSearches = recentSearches.filter(search => search !== searchToDelete);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  }, [recentSearches]);

  const handleRegionClick = useCallback((regionName) => {
    const rn = normalizeRegionName(regionName);
    navigate(`/region/${encodeURIComponent(rn)}`, { state: { region: { name: rn } } });
  }, [navigate]);

  const handleRegionClickWithDragCheck = useCallback((regionName) => {
    if (!hasMovedRef.current) {
      handleRegionClick(regionName);
    }
  }, [handleRegionClick]);

  const handleRecentSearchClickWithDragCheck = useCallback((search) => {
    if (!hasMovedRef.current) {
      handleRecentSearchClick(search);
    }
  }, [handleRecentSearchClick]);


  // URL 파라미터: ?q=#해시태그 시 해시태그 칩 선택 (다른 화면에서 해시태그 클릭 후 진입)
  useEffect(() => {
    const query = searchParams.get('q');
    if (!query) return;
    const tags = parseHashtags(query);
    if (tags.length > 0) {
      setSelectedHashtag(tags[0]);
    } else {
      setSearchQuery(query);
    }
  }, [searchParams]);

  // 전체 게시물 (Supabase + 로컬), 최근 검색어, 검색 횟수 로드
  useEffect(() => {
    const loadAllPosts = async () => {
      const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
      const supabasePosts = await fetchPostsSupabase();
      const combined = getCombinedPosts(combinePostsSupabaseAndLocal(supabasePosts, localPosts));
      setAllPosts(filterActivePosts48(combined));
    };

    loadAllPosts();

    const savedRecentSearches = localStorage.getItem('recentSearches');
    if (savedRecentSearches) {
      try {
        setRecentSearches(JSON.parse(savedRecentSearches));
      } catch (e) {
        logger.error('최근 검색어 로드 실패:', e);
      }
    }
    setSearchCount(parseInt(localStorage.getItem('searchCount') || '0', 10));

    // 검색 이벤트(검색어 기록) 로드
    try {
      const rawEvents = JSON.parse(localStorage.getItem('searchEvents') || '[]');
      if (Array.isArray(rawEvents)) {
        setSearchEvents(rawEvents);
      }
    } catch (e) {
      logger.error('검색 이벤트 로드 실패:', e);
    }

    const handlePostsUpdate = () => {
      setTimeout(loadAllPosts, 200);
    };
    window.addEventListener('postsUpdated', handlePostsUpdate);
    window.addEventListener('newPostsAdded', handlePostsUpdate);
    return () => {
      window.removeEventListener('postsUpdated', handlePostsUpdate);
      window.removeEventListener('newPostsAdded', handlePostsUpdate);
    };
  }, []);

  // 외부 클릭 시 자동완성 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  // 스크롤: 최상단이면 원래 구조(3열), 사진 영역 들어가면 2열·크게(최고 잘 보이게)
  const handleScroll = useCallback(() => {
    const el = screenBodyRef.current;
    if (!el) return;
    const st = el.scrollTop;
    if (st <= 60) setPhotoFocusMode(false);
    else if (selectedHashtag && st > 360) setPhotoFocusMode(true);
  }, [selectedHashtag]);

  useEffect(() => {
    if (!selectedHashtag) setPhotoFocusMode(false);
  }, [selectedHashtag]);

  return (
    <div className="screen-layout text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
      <div className="screen-content flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* 헤더 - 최소화 (고정) */}
        <div className="flex-shrink-0 flex items-center px-4 pt-2 pb-1 bg-white dark:bg-gray-900">
          <BackButton />
        </div>

        {/* 검색창 - 스크롤해도 계속 보이게 (고정) */}
        <div className="flex-shrink-0 px-4 pb-2 bg-white dark:bg-gray-900 relative" ref={searchContainerRef}>
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800/90 p-0.5 mb-2" role="tablist" aria-label="검색 유형">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'place'}
              onClick={() => switchSearchMode('place')}
              className={`flex-1 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
                searchMode === 'place'
                  ? 'bg-white dark:bg-gray-700 text-primary shadow-sm dark:text-[#FFC599]'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              장소
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'person'}
              onClick={() => switchSearchMode('person')}
              className={`flex-1 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
                searchMode === 'person'
                  ? 'bg-white dark:bg-gray-700 text-primary shadow-sm dark:text-[#FFC599]'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              인물
            </button>
          </div>
          <form onSubmit={handleSearch}>
            <div className="flex items-center w-full h-10 rounded-xl border border-gray-200 dark:border-gray-600 bg-primary-5 dark:bg-gray-800 px-3 gap-2">
              <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-[20px]">
                {searchMode === 'person' ? 'person_search' : 'search'}
              </span>
              <input
                className="flex-1 min-w-0 bg-transparent text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base focus:outline-none"
                placeholder={searchMode === 'person' ? '여행자 닉네임 검색' : '어디로 떠나볼까요?'}
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={() => {
                  if (searchQuery.trim()) setShowSuggestions(true);
                }}
              />
            </div>
          </form>

          {/* 자동완성: 장소(지역·해시태그) / 인물(여행자) */}
          {showSuggestions && searchQuery.trim() && (
            <div
              className="mt-3 absolute left-4 right-4 z-[200]"
              style={{ top: 'calc(100% + 12px)' }}
            >
              {searchMode === 'person' ? (
                filteredTravelers.length > 0 ? (
                  <div
                    className="bg-white dark:bg-[#2F2418] rounded-2xl shadow-2xl ring-2 ring-primary/30 dark:ring-primary/50 overflow-y-auto"
                    style={{ maxHeight: 'calc(60px * 6)' }}
                  >
                    {filteredTravelers.map((t) => (
                      <div
                        key={t.userId}
                        onClick={() => handleTravelerSuggestionClick(t)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#3a2d1f] cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 min-h-[56px]"
                      >
                        {t.profileImage ? (
                          <img
                            src={getDisplayImageUrl(t.profileImage)}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-200 dark:bg-gray-600"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-100 to-slate-200 dark:from-cyan-900/40 dark:to-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-sm shrink-0">
                            {String(t.username || '?').slice(0, 1)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[#1c140d] dark:text-background-light font-semibold text-base truncate">
                            {t.username}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">게시 {t.postCount}건</div>
                        </div>
                        <span className="material-symbols-outlined text-gray-400 text-[20px] shrink-0">chevron_right</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#2F2418] rounded-2xl ring-2 ring-red-300 dark:ring-red-800 px-4 py-6 text-center">
                    <span className="material-symbols-outlined text-gray-400 text-4xl mb-2">person_off</span>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">일치하는 여행자가 없어요</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">게시물에 올라온 닉네임으로 검색해 보세요</p>
                  </div>
                )
              ) : filteredRegions.length > 0 || filteredHashtags.length > 0 ? (
                <div
                  className="bg-white dark:bg-[#2F2418] rounded-2xl shadow-2xl ring-2 ring-primary/30 dark:ring-primary/50 overflow-y-auto"
                  style={{ maxHeight: 'calc(60px * 6)' }}
                >
                  {filteredRegions.map((region) => (
                    <div
                      key={region.id}
                      onClick={() => handleSuggestionClick(region.name)}
                      className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-[#3a2d1f] cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 h-[60px]"
                    >
                      <span className="material-symbols-outlined text-primary">location_on</span>
                      <span className="text-[#1c140d] dark:text-background-light font-semibold text-base">
                        {region.name}
                      </span>
                    </div>
                  ))}
                  {filteredHashtags.length > 0 && (
                    <>
                      {filteredRegions.length > 0 && <div className="border-b border-gray-100 dark:border-gray-700" />}
                      <div className="px-4 py-2 bg-gray-50/50 dark:bg-[#2a1f15] text-xs font-medium text-gray-500 dark:text-gray-400">해시태그</div>
                      {filteredHashtags.map((h) => (
                        <div
                          key={h.key}
                          onClick={() => handleHashtagSuggestionClick(h.display)}
                          className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-[#3a2d1f] cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 h-[60px]"
                        >
                          <span className="material-symbols-outlined text-primary">label</span>
                          <span className="text-[#1c140d] dark:text-background-light font-semibold text-base">#{h.display}</span>
                          <span className="text-gray-500 dark:text-gray-400 text-sm ml-auto">({h.count}장)</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-[#2F2418] rounded-2xl ring-2 ring-red-300 dark:ring-red-800 px-4 py-6 text-center">
                  <span className="material-symbols-outlined text-gray-400 text-4xl mb-2">search_off</span>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">검색 결과가 없습니다</p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">지역명이나 #해시태그를 입력해보세요</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 메인 컨텐츠 - 스크롤하면 위로 올라감 */}
        <div
          ref={screenBodyRef}
          onScroll={handleScroll}
          className="screen-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ minHeight: 0, WebkitOverflowScrolling: 'touch' }}
        >
          {/* 인물 모드: 팔로우/추천 여행자 프로필 섹션 */}
          {searchMode === 'person' && !searchQuery.trim() && (
            <div className={`px-4 pt-2 pb-2 ${showSuggestions ? 'opacity-30 pointer-events-none' : ''}`}>
              <h2 className="text-black dark:text-white text-sm font-bold leading-tight tracking-[-0.015em] mb-2">
                여행자
              </h2>

              {/* 팔로우한 여행자 5 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">팔로우한 여행자</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400">{followedTravelersTop5.length}/5</div>
                </div>
                {followedTravelersTop5.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#2F2418] p-4 text-center text-[12px] text-slate-500 dark:text-slate-300">
                    아직 팔로우한 여행자가 없어요.
                  </div>
                ) : (
                  <div
                    onMouseDown={handleDragStart}
                    className="flex overflow-x-auto overflow-y-hidden gap-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {followedTravelersTop5.map((t) => (
                      <button
                        key={`followed-${t.userId}`}
                        type="button"
                        onClick={() => { if (!hasMovedRef.current) goTravelerProfile(t); }}
                        className="flex-shrink-0 w-[132px] rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#2F2418] p-3 text-left shadow-sm hover:shadow transition"
                      >
                        <div className="flex items-center gap-2">
                          {t.profileImage ? (
                            <img
                              src={getDisplayImageUrl(t.profileImage)}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover bg-slate-200 dark:bg-slate-700"
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1520975682031-ae3f39f19b64?w=200&q=60'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-100 to-slate-200 dark:from-cyan-900/40 dark:to-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-sm shrink-0">
                              {String(t.username || '?').slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{t.username}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-300">게시 {t.postCount}건</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 추천 여행자 5 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">추천 여행자</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400">{recommendedTravelersTop5.length}/5</div>
                </div>
                {recommendedTravelersTop5.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-[#2F2418] p-4 text-center text-[12px] text-slate-500 dark:text-slate-300">
                    추천할 여행자가 아직 없어요.
                  </div>
                ) : (
                  <div
                    onMouseDown={handleDragStart}
                    className="flex overflow-x-auto overflow-y-hidden gap-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {recommendedTravelersTop5.map((t) => (
                      <button
                        key={`rec-${t.userId}`}
                        type="button"
                        onClick={() => { if (!hasMovedRef.current) goTravelerProfile(t); }}
                        className="flex-shrink-0 w-[132px] rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#2F2418] p-3 text-left shadow-sm hover:shadow transition"
                      >
                        <div className="flex items-center gap-2">
                          {t.profileImage ? (
                            <img
                              src={getDisplayImageUrl(t.profileImage)}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover bg-slate-200 dark:bg-slate-700"
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1520975682031-ae3f39f19b64?w=200&q=60'; }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-100 to-slate-200 dark:from-cyan-900/40 dark:to-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-sm shrink-0">
                              {String(t.username || '?').slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{t.username}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-300">게시 {t.postCount}건</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 최근 검색한 지역 - 해시태그 위 (공간 최소화) */}
          {recentRegionSearches.length > 0 && (
            <div className={`px-4 pt-1 pb-1 ${showSuggestions ? 'opacity-30' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[#1c140d] dark:text-background-light text-sm font-bold leading-tight tracking-[-0.015em]">
                  최근 검색한 지역
                </h2>
                <button
                  onClick={handleClearRecentSearches}
                  className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                >
                  지우기
                </button>
              </div>
              <div
                className={`flex overflow-x-scroll overflow-y-hidden [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-smooth ${showSuggestions ? 'opacity-30 pointer-events-none' : ''}`}
                onMouseDown={handleDragStart}
                style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch', maxHeight: 52 }}
              >
                <div className="flex items-center px-2 gap-2 pb-1">
                  {recentRegionSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearchClickWithDragCheck(search)}
                      className={`flex-shrink-0 cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors snap-start select-none flex gap-1.5 ${index === 0
                        ? 'bg-primary/20 dark:bg-primary/30 text-primary dark:text-[#FFC599]'
                        : 'bg-background-light dark:bg-[#2F2418] text-[#1c140d] dark:text-background-light ring-1 ring-inset ring-black/10 dark:ring-white/10 shadow-sm hover:bg-primary/10'
                        }`}
                    >
                      <span>{search}</span>
                      <span
                        className="material-symbols-outlined text-[16px] opacity-60 hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleDeleteRecentSearch(search, e); }}
                        style={{ cursor: 'pointer' }}
                      >
                        close
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 추천 · 인기 지역 (통합) */}
          <div className={`px-4 pt-2 pb-2 ${showSuggestions ? 'opacity-30 pointer-events-none' : ''}`}>
            <h2 className="text-black dark:text-white text-sm font-bold leading-tight tracking-[-0.015em] mb-2">
              추천 · 인기 지역
            </h2>
            {/* 인기 검색 지역 칩 */}
            {mostSearchedRegions.length > 0 && (
              <div
                onMouseDown={handleDragStart}
                className="flex overflow-x-auto overflow-y-hidden gap-1.5 mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {mostSearchedRegions.map(({ name }, index) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (!hasMovedRef.current) {
                        incrementSearchCount(name);
                        {
                          const rn = normalizeRegionName(name);
                          navigate(`/region/${encodeURIComponent(rn)}`, { state: { region: { name: rn } } });
                        }
                      }
                    }}
                    className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium bg-primary-5 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-primary-10 dark:hover:bg-primary/30 transition-colors flex items-center gap-1.5"
                    style={{ scrollSnapStop: 'always' }}
                  >
                    <span className="material-symbols-outlined text-primary text-[16px]">trending_up</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-300">{index + 1}.</span>
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            )}
            {/* 추천 여행지 카드 */}
            <div
              onMouseDown={handleDragStart}
              className="flex overflow-x-auto overflow-y-hidden pb-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
              style={{ WebkitOverflowScrolling: 'touch', gap: '8px' }}
            >
              {diverseRegionCards.length === 0 && mostSearchedRegions.length === 0 ? (
                <div className="w-full py-6 px-4 text-center">
                  <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-3xl mb-1">photo_camera</span>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">사용자가 올린 여행 정보가 아직 없어요</p>
                </div>
              ) : diverseRegionCards.length === 0 ? null : (
                diverseRegionCards.map((card, index) => {
                  const posts = card.posts || [];
                  const cyclePost = posts.length > 0 ? posts[(cycleIndex + index) % posts.length] : null;
                  const thumbUri = cyclePost ? getMapThumbnailUri(cyclePost) : null;
                  const displayImage = thumbUri
                    ? getDisplayImageUrl(thumbUri)
                    : getRegionDefaultImage(card.name);
                  const weather = weatherData[card.name];
                  return (
                    <div
                      key={`${card.name}-${card.category}-${index}`}
                      onClick={() => handleRegionClickWithDragCheck(card.name)}
                      className="flex-shrink-0 overflow-visible cursor-pointer transition-all snap-start"
                      style={{ width: '160px', minWidth: '160px', maxWidth: '160px', scrollSnapStop: 'always' }}
                    >
                      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '9/10', height: 'auto', borderRadius: '12px', marginBottom: '2px' }}>
                        <img src={displayImage} alt={card.name} className="w-full h-full object-cover" style={{ display: 'block', borderRadius: '12px' }} />
                        {weather && (
                          <span className="absolute top-3 right-3 text-white text-xs font-semibold bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <span>{weather.icon}</span>
                            <span>{weather.temperature}</span>
                          </span>
                        )}
                      </div>
                      <div className="px-2 py-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-black dark:text-white font-bold text-xs truncate">{card.name}</p>
                          {card.time && (
                            <span className="text-gray-400 dark:text-gray-500 text-[10px] whitespace-nowrap">🕐 {card.time}</span>
                          )}
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-[10px] font-medium truncate">{getRegionTagline(card.name)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div className="flex-shrink-0" style={{ width: '160px' }}></div>
            </div>
          </div>

          {/* 해시태그 - 클릭 시 하단에 사진 표시 */}
          {hashtagChips.length > 0 && (
            <div className={`px-4 pt-1 pb-2 ${showSuggestions ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-black dark:text-white text-sm font-bold">해시태그</h2>
                <button
                  type="button"
                  onClick={() => navigate('/hashtags')}
                  className="text-xs font-medium text-primary dark:text-primary hover:underline"
                >
                  태그 전체보기
                </button>
              </div>
              <div
                onMouseDown={handleDragStart}
                className="flex overflow-x-auto overflow-y-hidden gap-1.5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {hashtagChips.map(({ key, display }) => {
                  const isSelected = selectedHashtag && (selectedHashtag || '').replace(/^#+/, '').trim().toLowerCase() === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (!hasMovedRef.current) {
                          if (isSelected) {
                            setSelectedHashtag(null);
                          } else {
                            incrementSearchCount();
                            setSelectedHashtag(display);
                          }
                        }
                      }}
                      className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors snap-start ${isSelected ? 'bg-primary text-white' : 'bg-primary-5 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-primary-10 dark:hover:bg-primary/30'
                        }`}
                      style={{ scrollSnapStop: 'always' }}
                    >
                      #{display}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 선택된 해시태그 사진 그리드 */}
          {selectedHashtag && (
            <div className={`px-4 pt-0 pb-2 ${showSuggestions ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-black dark:text-white text-xs font-bold">#{selectedHashtag} ({hashtagPostResults.length}장)</h3>
                <button
                  type="button"
                  onClick={() => setSelectedHashtag(null)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary"
                >
                  해제
                </button>
              </div>
              {hashtagPostResults.length > 0 ? (
              <div className="grid grid-cols-3" style={{ gap: '7px' }}>
                  {hashtagPostResults.map((post) => {
                    const id = post.id || post._id;
                    const upTime = getTimeAgo(post.timestamp || post.createdAt);
                    return (
                      <button
                        key={id || (post.timestamp || 0)}
                        type="button"
                        onClick={() => navigate(`/post/${id}`, { state: { post, allPosts: hashtagPostResults } })}
                        className="relative aspect-square rounded overflow-hidden bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <PostThumbnail post={post} className="w-full h-full object-cover" alt="" />
                        <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white bg-black/50 px-1 py-0.5 rounded truncate text-center">
                          🕐 {upTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">이 해시태그가 달린 사진이 없습니다</p>
              )}
            </div>
          )}


        </div>
      </div>

      <BottomNavigation />
    </div >
  );
};

export default SearchScreen;











































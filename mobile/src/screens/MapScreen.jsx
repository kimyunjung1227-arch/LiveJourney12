import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Image,
  TextInput,
  Animated,
  PanResponder,
  Modal,
  Alert,
  Share,
  StatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/styles';
import { getCoordinatesByLocation } from '../utils/regionLocationMapping';
import { getMapThumbnailUri, postHasVideoWithoutThumbnail } from '../utils/postMedia';

const inferPostCoordinates = (post) => {
  if (post?.coordinates?.lat != null && post?.coordinates?.lng != null) {
    return { lat: Number(post.coordinates.lat), lng: Number(post.coordinates.lng) };
  }
  const fields = [post.detailedLocation, post.placeName, post.address, post.location];
  for (const f of fields) {
    const c = getCoordinatesByLocation(f);
    if (c?.lat != null && c?.lng != null) return { lat: c.lat, lng: c.lng };
  }
  return null;
};
// import { BlurView } from 'expo-blur'; // 필요시 설치 후 사용

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_TAB_HEIGHT = 68;

// 현재 위치 마커 컴포넌트 (파동 효과)
const CurrentLocationMarker = () => {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const pulse4 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.4)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.2)).current;
  const opacity4 = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    // 파동 1 애니메이션
    const anim1 = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse1, {
          toValue: 4,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity1, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // 파동 2 애니메이션 (약간 지연)
    const anim2 = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse2, {
          toValue: 4.5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity2, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // 파동 3 애니메이션 (더 지연)
    const anim3 = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse3, {
          toValue: 5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity3, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // 파동 4 애니메이션 (가장 지연)
    const anim4 = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse4, {
          toValue: 5.5,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity4, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    anim1.start();
    anim2.start();
    anim3.start();
    anim4.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      anim4.stop();
    };
  }, []);

  return (
    <View style={styles.currentLocationMarkerContainer}>
      {/* 중심 원점만 표시 (파동 효과 제거) */}
      <View style={styles.currentLocationDot} />
    </View>
  );
};

const MapScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [posts, setPosts] = useState([]);
  const [visiblePins, setVisiblePins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]); // 필터: ['bloom', 'food', 'scenic'] 중복 선택 가능
  const [searchResults, setSearchResults] = useState([]); // 검색 결과 게시물
  const [isSearching, setIsSearching] = useState(false); // 검색 중인지 여부
  const [showSearchSheet, setShowSearchSheet] = useState(false); // 검색 시트 표시 여부
  const [filteredRegions, setFilteredRegions] = useState([]); // 자동완성 필터링된 지역
  const [searchSuggestions, setSearchSuggestions] = useState([]); // 검색 제안 (지역 + 게시물)
  const [recentSearches, setRecentSearches] = useState([]); // 최근 검색 지역
  const [isDragging, setIsDragging] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isSheetHidden, setIsSheetHidden] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(200);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [selectedSOSLocation, setSelectedSOSLocation] = useState(null);
  const [sosQuestion, setSosQuestion] = useState('');
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [isRouteMode, setIsRouteMode] = useState(false); // 경로 모드 활성화 여부
  const [selectedRoutePins, setSelectedRoutePins] = useState([]); // 선택된 경로 핀들
  
  const sheetRef = useRef(null);
  const dragHandleRef = useRef(null);
  const sheetOffsetAnim = useRef(new Animated.Value(0)).current;
  const startY = useRef(0);
  const mapRef = useRef(null);

  // 네비게이션 바 숨기기
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // GPS 위치 가져오기 (완전히 새로 작성)
  useEffect(() => {
    setLoading(false);
    loadPosts();
    
    // 최근 검색 지역 로드
    const loadRecentSearches = async () => {
      try {
        const savedRecentSearches = await AsyncStorage.getItem('recentSearches');
        if (savedRecentSearches) {
          setRecentSearches(JSON.parse(savedRecentSearches));
        }
      } catch (e) {
        console.error('최근 검색 지역 로드 실패:', e);
      }
    };
    loadRecentSearches();

    let locationSubscription = null;

    // GPS 위치 가져오기
    const getGPSLocation = async () => {
      try {
        // 먼저 현재 권한 상태 확인
        const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
        
        // 권한이 없으면 사용자에게 알림 표시
        if (currentStatus !== 'granted') {
          Alert.alert(
            '위치 권한 필요',
            '지도에서 현재 위치를 표시하려면 위치 권한이 필요합니다.\n\n설정에서 위치 권한을 허용해주세요.',
            [
              {
                text: '취소',
                style: 'cancel',
                onPress: () => {
                  setCurrentLocation({ latitude: 37.5665, longitude: 126.9780 });
                }
              },
              {
                text: '설정 열기',
                onPress: async () => {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status === 'granted') {
                    // 권한 허용 후 위치 가져오기
                    try {
                      const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Best,
                      });
                      setCurrentLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                      });
                      console.log('📍 GPS 위치:', {
                        위도: location.coords.latitude,
                        경도: location.coords.longitude,
                      });
                      
                      // 위치 추적 시작
                      locationSubscription = await Location.watchPositionAsync(
                        {
                          accuracy: Location.Accuracy.Best,
                          timeInterval: 5000,
                          distanceInterval: 10,
                        },
                        (newLocation) => {
                          const newLat = newLocation.coords.latitude;
                          const newLng = newLocation.coords.longitude;
                          setCurrentLocation({ latitude: newLat, longitude: newLng });
                          console.log('📍 위치 업데이트:', { 위도: newLat, 경도: newLng });
                        }
                      );
                    } catch (error) {
                      console.error('📍 위치 가져오기 실패:', error);
                      setCurrentLocation({ latitude: 37.5665, longitude: 126.9780 });
                    }
                  } else {
                    Alert.alert(
                      '위치 권한 거부됨',
                      '위치 권한이 거부되었습니다. 지도 기능을 사용하려면 설정에서 위치 권한을 허용해주세요.',
                      [{ text: '확인' }]
                    );
                    setCurrentLocation({ latitude: 37.5665, longitude: 126.9780 });
                  }
                }
              }
            ]
          );
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            '위치 권한 거부됨',
            '위치 권한이 거부되었습니다. 지도에서 현재 위치를 표시하려면 설정에서 위치 권한을 허용해주세요.',
            [{ text: '확인' }]
          );
          setCurrentLocation({ latitude: 37.5665, longitude: 126.9780 });
          return;
        }

        // 현재 위치 가져오기
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Best,
        });

        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

        setCurrentLocation({ latitude: lat, longitude: lng });

        console.log('📍 GPS 위치:', { 위도: lat, 경도: lng });

        // 위치 추적 시작
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Best,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (newLocation) => {
            const newLat = newLocation.coords.latitude;
            const newLng = newLocation.coords.longitude;
            setCurrentLocation({ latitude: newLat, longitude: newLng });
            console.log('📍 위치 업데이트:', { 위도: newLat, 경도: newLng });
          }
        );
      } catch (error) {
        console.error('📍 위치 가져오기 실패:', error);
        setCurrentLocation({ latitude: 37.5665, longitude: 126.9780 });
      }
    };

    getGPSLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // 지도가 준비되었는지 추적
  const [mapReady, setMapReady] = useState(false);

  // 화면이 포커스될 때마다 내 위치로 이동
  useFocusEffect(
    React.useCallback(() => {
      // 지도가 준비되고 현재 위치가 있으면 내 위치로 이동
      if (mapReady && mapRef.current && currentLocation && currentLocation.latitude && currentLocation.longitude) {
        // 지도가 완전히 로드된 후 이동
        const timer = setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 500);
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }, [mapReady, currentLocation])
  );

  // currentLocation이 변경되고 지도가 준비되면 내 위치로 이동
  useEffect(() => {
    if (mapReady && mapRef.current && currentLocation && currentLocation.latitude && currentLocation.longitude) {
      const timer = setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [mapReady, currentLocation]);

  // 필터 변경 시 게시물 다시 로드
  useEffect(() => {
    loadPosts();
  }, [selectedFilters, isSearching, searchResults]);

  useEffect(() => {
    // visiblePins 업데이트 (현재는 posts를 그대로 사용)
    setVisiblePins(posts.map((post, index) => ({
      id: post.id || index,
      title: post.placeName || post.detailedLocation || post.location || '여행지',
      image: getMapThumbnailUri(post) || post.image || '',
      needsVideoPlaceholder: postHasVideoWithoutThumbnail(post),
      lat: post.coordinates?.lat,
      lng: post.coordinates?.lng,
      post: post
    })));
  }, [posts]);


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

  // 게시물에서 장소명 검색
  const searchInPosts = async (query) => {
    const queryLower = query.toLowerCase().trim();
    
    try {
      // 모든 게시물 가져오기
      const postsJson = await AsyncStorage.getItem('uploadedPosts');
      const allPosts = postsJson ? JSON.parse(postsJson) : [];
      
      const validPosts = allPosts.filter(post => 
        post.coordinates || post.location || post.detailedLocation
      );

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

      // 해시태그 검색 (#로 시작하거나 해시태그 형식인 경우)
      const queryWithoutHash = queryLower.replace(/^#+/, ''); // # 제거
      const isHashtagSearch = query.includes('#') || queryWithoutHash.length > 0;
      
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

      return matchingPosts;
    } catch (error) {
      console.error('검색 중 오류:', error);
      return [];
    }
  };

  const loadPosts = async () => {
    try {
      // 검색 중이면 검색 결과만 사용
      if (isSearching && searchResults.length > 0) {
        let filteredResults = searchResults
          .map((post) => {
            const coords = inferPostCoordinates(post);
            return coords ? { ...post, coordinates: coords } : null;
          })
          .filter(Boolean);

        // 필터 적용 (중복 선택 가능)
        if (selectedFilters.length > 0) {
          filteredResults = filteredResults.filter(post => {
            const category = post.category || 'general';
            // 활성화된 필터 중 하나라도 매칭되면 표시
            return selectedFilters.some(filter => {
              if (filter === 'bloom') return category === 'bloom';
              if (filter === 'food') return category === 'food';
              if (filter === 'scenic') return category === 'scenic' || category === 'landmark';
              return false;
            });
          });
        }

        setPosts(filteredResults);
        return;
      }

      const postsJson = await AsyncStorage.getItem('uploadedPosts');
      const allPosts = postsJson ? JSON.parse(postsJson) : [];

      let postsWithLocation = allPosts
        .map((post) => {
          const coords = inferPostCoordinates(post);
          return coords ? { ...post, coordinates: coords } : null;
        })
        .filter(Boolean);

      // 필터 적용 (중복 선택 가능)
      if (selectedFilters.length > 0) {
        postsWithLocation = postsWithLocation.filter(post => {
          const category = post.category || 'general';
          // 활성화된 필터 중 하나라도 매칭되면 표시
          return selectedFilters.some(filter => {
            if (filter === 'bloom') return category === 'bloom';
            if (filter === 'food') return category === 'food';
            if (filter === 'scenic') return category === 'scenic' || category === 'landmark';
            return false;
          });
        });
      }
      
      setPosts(postsWithLocation);
    } catch (error) {
      console.error('게시물 로드 실패:', error);
    }
  };

  // Kakao Local API를 사용한 장소 검색 (HTTP 요청)
  const searchPlaceWithKakaoAPI = async (query) => {
    try {
      // Kakao Local API 호출 (REST API)
      // 주의: 실제 프로덕션에서는 서버를 통해 API 키를 숨겨야 합니다
      const apiKey = 'cc3234f026f2f64c40c0edcff5b96306'; // 임시 API 키 (환경변수로 관리 권장)
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `KakaoAK ${apiKey}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.documents && data.documents.length > 0) {
        const firstResult = data.documents[0];
        return {
          name: firstResult.place_name,
          address: firstResult.address_name,
          roadAddress: firstResult.road_address_name,
          lat: parseFloat(firstResult.y),
          lng: parseFloat(firstResult.x),
          placeUrl: firstResult.place_url
        };
      }
      
      return null;
    } catch (error) {
      console.error('Kakao API 검색 오류:', error);
      return null;
    }
  };

  // 검색 핸들러
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // 검색어가 비어있으면 검색 결과 초기화
      setSearchResults([]);
      setIsSearching(false);
      await loadPosts();
      return;
    }

    const query = searchQuery.trim();
    
    // 게시물에서 먼저 검색
    const matchingPosts = await searchInPosts(query);
    
    if (matchingPosts.length > 0) {
      // 검색 결과가 있으면 해당 게시물만 표시
      setSearchResults(matchingPosts);
      setIsSearching(true);
      await loadPosts();
      
      // 첫 번째 게시물의 위치 정보 표시
      const firstPost = matchingPosts[0];
      const coords = firstPost.coordinates || getCoordinatesByLocation(firstPost.detailedLocation || firstPost.location);
      if (coords) {
        Alert.alert('검색 완료', `${firstPost.placeName || firstPost.location} 위치로 이동했습니다.`);
      }
    } else {
      // 게시물에서 찾지 못하면 Kakao Local API로 검색
      const place = await searchPlaceWithKakaoAPI(query);
      
      if (place) {
        // 검색 결과 저장 (나중에 지도 구현 시 사용)
        setSearchResults([]);
        setIsSearching(false);
        await loadPosts();
        Alert.alert('검색 완료', `${place.name}\n${place.address}\n\n위치 정보를 찾았습니다. (지도 이동 기능은 준비 중입니다.)`);
      } else {
        // Kakao 검색도 실패하면 기본 지역명 검색 시도
        const coords = getCoordinatesByLocation(query);
        if (coords) {
          setSearchResults([]);
          setIsSearching(false);
          await loadPosts();
          Alert.alert('검색 완료', `"${query}" 지역으로 이동했습니다.`);
        } else {
          Alert.alert('검색 실패', '검색 결과를 찾을 수 없습니다. 다른 검색어를 입력해주세요.');
          setSearchResults([]);
          setIsSearching(false);
        }
      }
    }
  };

  const updateVisiblePins = () => {
    // 현재는 모든 posts를 visiblePins로 설정 (실제 지도 구현 시 bounds 기반 필터링)
    setVisiblePins(posts.map((post, index) => ({
      id: post.id || index,
      title: post.placeName || post.detailedLocation || post.location || '여행지',
      image: getMapThumbnailUri(post) || post.image || '',
      needsVideoPlaceholder: postHasVideoWithoutThumbnail(post),
      lat: post.coordinates?.lat,
      lng: post.coordinates?.lng,
      post: post
    })));
  };

  const handleZoomIn = () => {
    // 실제 지도 구현 시 사용
    console.log('줌 인');
  };

  const handleZoomOut = () => {
    // 실제 지도 구현 시 사용
    console.log('줌 아웃');
  };

  const handleCenterLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // 핀을 경로에 추가하는 핸들러
  const handlePinSelectForRoute = (pin, index) => {
    if (!isRouteMode) {
      // 경로 모드가 아니면 경로 모드를 활성화하도록 안내
      Alert.alert(
        '경로 모드',
        '경로에 추가하려면 먼저 "경로 만들기" 버튼을 눌러주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '경로 모드 켜기', onPress: () => setIsRouteMode(true) }
        ]
      );
      return;
    }

    const pinData = {
      post: pin.post,
      lat: pin.lat,
      lng: pin.lng,
      title: pin.title,
      image: pin.image,
      index
    };
    
    // 이미 선택된 핀인지 확인
    const isAlreadySelected = selectedRoutePins.some(p => p.post.id === pin.post.id);
    
    if (isAlreadySelected) {
      // 이미 선택된 핀은 제거
      const newPins = selectedRoutePins.filter(p => p.post.id !== pin.post.id);
      setSelectedRoutePins(newPins);
    } else {
      // 새로운 핀 추가
      const newPins = [...selectedRoutePins, pinData];
      setSelectedRoutePins(newPins);
    }
  };

  // 경로 모드 토글
  const toggleRouteMode = () => {
    const newMode = !isRouteMode;
    
    if (!newMode && selectedRoutePins.length > 0) {
      // 경로 모드 종료 시 경로 초기화 확인
      Alert.alert(
        '경로 모드 종료',
        '경로 모드를 종료하면 선택한 핀들이 초기화됩니다. 계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '종료', 
            onPress: () => {
              setIsRouteMode(false);
              setSelectedRoutePins([]);
              // 바텀 시트 다시 표시
              setIsSheetHidden(false);
              setSheetOffset(0);
              Animated.spring(sheetOffsetAnim, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }
          }
        ]
      );
    } else {
      // 경로 모드 시작 또는 종료
      setIsRouteMode(newMode);
      if (newMode) {
        // 경로 모드 시작 시 바텀 시트 숨기기
        const hideOffset = sheetHeight + 20;
        setIsSheetHidden(true);
        setSheetOffset(hideOffset);
        Animated.spring(sheetOffsetAnim, {
          toValue: hideOffset,
          useNativeDriver: true,
        }).start();
      } else {
        // 경로 모드 종료 시 선택된 핀 초기화 및 바텀 시트 다시 표시
        setSelectedRoutePins([]);
        setIsSheetHidden(false);
        setSheetOffset(0);
        Animated.spring(sheetOffsetAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // 경로 초기화
  const clearRoute = () => {
    if (selectedRoutePins.length > 0) {
      Alert.alert(
        '경로 초기화',
        '선택한 모든 핀을 제거하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { 
            text: '초기화', 
            onPress: () => {
              setSelectedRoutePins([]);
            }
          }
        ]
      );
    } else {
      setSelectedRoutePins([]);
    }
  };

  // 경로 저장
  const saveRoute = async () => {
    if (selectedRoutePins.length < 2) {
      Alert.alert('알림', '경로를 만들려면 최소 2개 이상의 핀을 선택해주세요.');
      return;
    }

    const routeData = {
      id: `route-${Date.now()}`,
      pins: selectedRoutePins.map(pin => ({
        id: pin.post.id,
        location: pin.title,
        lat: pin.lat,
        lng: pin.lng,
        image: pin.image
      })),
      createdAt: new Date().toISOString()
    };

    try {
      const existingRoutesJson = await AsyncStorage.getItem('savedRoutes');
      const existingRoutes = existingRoutesJson ? JSON.parse(existingRoutesJson) : [];
      const updatedRoutes = [routeData, ...existingRoutes];
      await AsyncStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
      Alert.alert('성공', '경로가 저장되었습니다!');
    } catch (error) {
      console.error('경로 저장 실패:', error);
      Alert.alert('오류', '경로 저장에 실패했습니다.');
    }
  };

  // 경로 공유
  const shareRoute = async () => {
    if (selectedRoutePins.length < 2) {
      Alert.alert('알림', '경로를 만들려면 최소 2개 이상의 핀을 선택해주세요.');
      return;
    }

    const routeData = {
      pins: selectedRoutePins.map(pin => ({
        location: pin.title,
        lat: pin.lat,
        lng: pin.lng
      }))
    };

    const shareUrl = `여행 경로: ${selectedRoutePins.map(p => p.title).join(' → ')}`;
    
    try {
      await Share.share({
        message: `${selectedRoutePins.length}개의 장소를 포함한 여행 경로를 공유합니다.\n${shareUrl}`,
        title: '여행 경로 공유'
      });
    } catch (error) {
      console.error('공유 실패:', error);
      Alert.alert('오류', '경로 공유에 실패했습니다.');
    }
  };

  const handleSOSRequest = () => {
    setIsSelectingLocation(true);
    setShowSOSModal(true);
  };

  const handleShowSheet = () => {
    setSheetOffset(0);
    setIsSheetHidden(false);
    Animated.spring(sheetOffsetAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  // 드래그 핸들러
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        startY.current = evt.nativeEvent.pageY;
      },
      onPanResponderMove: (evt, gestureState) => {
        const deltaY = gestureState.dy;
        // 아래로 드래그만 허용
        if (deltaY > 0) {
          setSheetOffset(deltaY);
          sheetOffsetAnim.setValue(deltaY);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        const threshold = sheetHeight * 0.5;
        
        if (gestureState.dy > threshold) {
          // 시트 숨김
          const hideOffset = sheetHeight + 20;
          setSheetOffset(hideOffset);
          setIsSheetHidden(true);
          Animated.spring(sheetOffsetAnim, {
            toValue: hideOffset,
            useNativeDriver: true,
          }).start();
        } else {
          // 원래 위치로
          setSheetOffset(0);
          setIsSheetHidden(false);
          Animated.spring(sheetOffsetAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* 지도 컨테이너 - 전체 화면에 지도가 보이도록 */}
      <View style={styles.mapContainer}>
        {!currentLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>지도를 불러오는 중...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            followsUserLocation={false}
            onMapReady={() => {
              setMapReady(true);
              // 지도가 준비되고 현재 위치가 있으면 내 위치로 이동
              if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
                setTimeout(() => {
                  mapRef.current?.animateToRegion({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }, 500);
                }, 100);
              }
            }}
          >
            {/* 현재 위치 마커 - GPS 좌표에 정확히 표시 */}
            {currentLocation && currentLocation.latitude && currentLocation.longitude && (
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="현재 위치"
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={true}
                zIndex={1000}
                identifier="currentLocation"
              >
                <CurrentLocationMarker />
              </Marker>
            )}

            {/* 게시물 마커들 */}
            {visiblePins
              .filter(pin => pin.lat && pin.lng)
              .map((pin, index) => (
                <Marker
                  key={pin.id || index}
                  coordinate={{
                    latitude: pin.lat,
                    longitude: pin.lng,
                  }}
                  title={pin.title}
                  onPress={() => {
                    // 핀 클릭 시 게시물 상세 보기
                    const postData = {
                      post: pin.post,
                      allPosts: posts,
                      currentPostIndex: posts.findIndex(p => p.id === pin.post.id),
                    };
                    setSelectedPost(postData);
                  }}
                >
                  {pin.image ? (
                    <View style={styles.customMarker}>
                      <Image
                        source={{ uri: pin.image }}
                        style={styles.markerImage}
                        resizeMode="cover"
                      />
                    </View>
                  ) : pin.needsVideoPlaceholder ? (
                    <View style={[styles.customMarker, styles.markerVideoPlaceholder]}>
                      <Ionicons name="videocam" size={22} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.defaultMarker}>
                      <Ionicons name="location" size={24} color={COLORS.primary} />
                    </View>
                  )}
                </Marker>
              ))}
          </MapView>
        )}
      </View>

      {/* 검색바 - 투명 배경으로 지도가 보이도록 */}
      <View style={styles.searchBarContainer}>
        <TouchableOpacity 
          onPress={() => setShowSearchSheet(true)}
          style={styles.searchBar}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="search" 
            size={24} 
            color="#666" 
          />
          <Text style={{
            flex: 1,
            fontSize: 16,
            color: '#999',
            fontWeight: '400',
            marginLeft: 12
          }}>
            {searchQuery || "지역 검색"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={updateVisiblePins}
        >
          <View style={styles.refreshButtonBlur}>
            <Ionicons name="refresh" size={24} color="#666" />
          </View>
        </TouchableOpacity>
      </View>

      {/* 상황 물어보기 버튼과 필터 버튼들 - 같은 위치에 배치, 좌우 스크롤 가능 */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* 상황 물어보기 버튼 - 가장 앞에 배치 */}
          <TouchableOpacity
            style={styles.sosButtonInFilter}
            onPress={handleSOSRequest}
            activeOpacity={0.8}
          >
            <View style={styles.sosButtonBlur}>
              <Text style={styles.sosButtonText}>지금 상황 알아보기</Text>
            </View>
          </TouchableOpacity>
          
          {/* 필터 버튼들 - 중복 선택 가능 */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilters.includes('bloom') && styles.filterButtonActive
            ]}
            onPress={() => {
              setSelectedFilters(prev => 
                prev.includes('bloom') 
                  ? prev.filter(f => f !== 'bloom')
                  : [...prev, 'bloom']
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilters.includes('bloom') && styles.filterButtonTextActive
            ]}>
              🌸 개화정보
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilters.includes('food') && styles.filterButtonActive
            ]}
            onPress={() => {
              setSelectedFilters(prev => 
                prev.includes('food') 
                  ? prev.filter(f => f !== 'food')
                  : [...prev, 'food']
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilters.includes('food') && styles.filterButtonTextActive
            ]}>
              🍜 맛집정보
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilters.includes('scenic') && styles.filterButtonActive
            ]}
            onPress={() => {
              setSelectedFilters(prev => 
                prev.includes('scenic') 
                  ? prev.filter(f => f !== 'scenic')
                  : [...prev, 'scenic']
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilters.includes('scenic') && styles.filterButtonTextActive
            ]}>
              🏞️ 가볼만한 곳
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 경로 모드: 취소 + 안내 / 일반: 경로 만들기 */}
      <View style={[
        styles.routeModeButtonContainer,
        { bottom: isRouteMode ? (selectedRoutePins.length >= 2 ? 168 : 132) : (isSheetHidden ? 120 : sheetHeight + 16 + BOTTOM_TAB_HEIGHT) }
      ]}>
        {isRouteMode ? (
          <View style={styles.routeModeTopRow}>
            <TouchableOpacity
              style={styles.routeCancelButton}
              onPress={() => toggleRouteMode()}
              activeOpacity={0.85}
            >
              <Text style={styles.routeCancelButtonText}>취소</Text>
            </TouchableOpacity>
            <View style={styles.routeModeStatusPill}>
              <Ionicons name="map" size={18} color={COLORS.primary} />
              <Text style={styles.routeModeStatusText}>경로 모드</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.routeModeButton}
            onPress={toggleRouteMode}
            activeOpacity={0.8}
          >
            <Ionicons name="map" size={20} color={COLORS.text} />
            <Text style={styles.routeModeButtonText}>경로 만들기</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 선택된 핀 개수 배지 (경로 모드일 때만 표시) */}
      {isRouteMode && selectedRoutePins.length > 0 && (
        <View style={[
          styles.pinCountBadge,
          { 
            top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 70 : 110,
            bottom: 'auto'
          }
        ]}>
          <Ionicons name="location" size={16} color={COLORS.textWhite} />
          <Text style={styles.pinCountBadgeText}>
            {selectedRoutePins.length}개 선택됨
          </Text>
        </View>
      )}

      {/* 경로 모드 하단: 저장·공유 가운데 정렬 */}
      {isRouteMode && (
        <View style={[styles.routeBottomActionBar, { bottom: BOTTOM_TAB_HEIGHT + 8 }]}>
          {selectedRoutePins.length >= 2 ? (
            <View style={styles.routeCenterActions}>
              <TouchableOpacity
                style={[styles.routeBottomBtn, styles.routeBottomBtnPrimary]}
                onPress={saveRoute}
                activeOpacity={0.85}
              >
                <Text style={styles.routeBottomBtnTextPrimary}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.routeBottomBtn, styles.routeBottomBtnSuccess]}
                onPress={shareRoute}
                activeOpacity={0.85}
              >
                <Ionicons name="share" size={18} color="#fff" />
                <Text style={styles.routeBottomBtnTextLight}>공유</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.routeBottomHintBlock}>
              <Text style={styles.routeBottomHint}>지도에서 핀을 눌러 2곳 이상 선택하세요</Text>
              {selectedRoutePins.length === 1 ? (
                <TouchableOpacity onPress={clearRoute} style={styles.routeClearOneTap}>
                  <Text style={styles.routeClearOneTapText}>선택 해제</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      )}

      {/* 지도 컨트롤 버튼들 - 경로 모드일 때는 숨김 */}
      {!isRouteMode && (
        <View style={[
          styles.mapControls,
          { bottom: isSheetHidden ? 120 : sheetHeight + 16 + BOTTOM_TAB_HEIGHT }
        ]}>
          <TouchableOpacity style={styles.controlButton} onPress={handleZoomIn}>
            <Ionicons name="add" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleZoomOut}>
            <Ionicons name="remove" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={handleCenterLocation}>
            <Ionicons name="locate" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* 사진 다시 보기 버튼 - 시트가 숨겨졌고 경로 모드가 아닐 때만 표시 */}
      {isSheetHidden && !isRouteMode && (
        <TouchableOpacity
          style={styles.showSheetButton}
          onPress={handleShowSheet}
          activeOpacity={0.8}
        >
          <Ionicons name="images" size={20} color={COLORS.primary} />
          <Text style={styles.showSheetButtonText}>사진 다시 보기</Text>
        </TouchableOpacity>
      )}

      {/* 주변 장소 바텀 시트 - 경로 모드가 아닐 때만 보임, 아래로 슬라이드 가능 (웹과 동일) */}
      {!isSelectingLocation && !isRouteMode && (
        <Animated.View
          ref={sheetRef}
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: sheetOffsetAnim }],
            }
          ]}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setSheetHeight(height);
          }}
        >
          {/* 드래그 핸들 */}
          <View
            ref={dragHandleRef}
            {...panResponder.panHandlers}
            style={styles.dragHandle}
          >
            <View style={styles.dragHandleBar} />
          </View>

          {/* 시트 헤더 */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetHeaderTitle}>주변 장소</Text>
          </View>

          {/* 주변 장소 스크롤 - 4개 이상일 때만 좌우 슬라이드 가능 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
            pagingEnabled={false}
            snapToInterval={visiblePins.length >= 4 ? 102 : undefined} // 4개 이상일 때만 스냅
            snapToAlignment="start"
            decelerationRate="fast"
            scrollEventThrottle={16}
            scrollEnabled={visiblePins.length >= 4} // 4개 이상일 때만 스크롤 가능
          >
            {visiblePins.length > 0 ? (
              visiblePins.map((pin, index) => {
                const isSelected = selectedRoutePins.some(p => p.post.id === pin.post.id);
                const selectedIndex = selectedRoutePins.findIndex(p => p.post.id === pin.post.id);
                
                return (
                <TouchableOpacity
                  key={pin.id || index}
                  style={[
                    styles.pinCard,
                    isSelected && styles.pinCardSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    // 경로 모드일 때는 경로에 추가, 아니면 게시물 상세 보기
                    if (isRouteMode) {
                      handlePinSelectForRoute(pin, index);
                    } else {
                      // 즉시 상세화면 표시
                      const postData = { 
                        post: pin.post, 
                        allPosts: posts, 
                        currentPostIndex: index 
                      };
                      setSelectedPost(postData);
                    }
                  }}
                  onLongPress={() => {
                    // 길게 누르면 경로 모드가 아니어도 경로에 추가할 수 있도록 (선택사항)
                    if (!isRouteMode) {
                      Alert.alert(
                        '경로 모드',
                        '경로에 추가하려면 먼저 "경로 만들기" 버튼을 눌러주세요.',
                        [
                          { text: '취소', style: 'cancel' },
                          { text: '경로 모드 켜기', onPress: () => setIsRouteMode(true) }
                        ]
                      );
                    }
                  }}
                >
                  {pin.image ? (
                    <Image
                      source={{ uri: pin.image }}
                      style={styles.pinCardImage}
                      resizeMode="cover"
                    />
                  ) : pin.needsVideoPlaceholder ? (
                    <View style={[styles.pinCardImage, styles.pinCardVideoPlaceholder]}>
                      <Ionicons name="videocam" size={28} color="#fff" />
                    </View>
                  ) : (
                    <View style={[styles.pinCardImage, styles.pinCardImagePlaceholder]}>
                      <Ionicons name="image-outline" size={24} color={COLORS.textSubtle} />
                    </View>
                  )}
                  <View style={styles.pinCardInfo}>
                    <Text style={styles.pinCardTitle} numberOfLines={1}>
                      {pin.title}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.pinCardBadge}>
                      <Text style={styles.pinCardBadgeText}>
                        {selectedIndex + 1}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
              })
            ) : (
              <View style={styles.emptyPinsContainer}>
                <Text style={styles.emptyPinsText}>표시할 장소가 없습니다</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* 게시물 상세화면 모달 (웹과 동일) */}
      {selectedPost && (
        <Modal
          visible={!!selectedPost}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPost(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedPost(null)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              {/* 헤더 */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>
                  {selectedPost.post.location || selectedPost.post.detailedLocation || '여행지'}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedPost(null)}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {/* 이미지 */}
              {selectedPost.post.images?.[0] && (
                <Image
                  source={{ uri: selectedPost.post.images[0] }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              )}

              {/* 내용 */}
              <ScrollView style={styles.modalBody}>
                {selectedPost.post.note && (
                  <Text style={styles.modalNote}>{selectedPost.post.note}</Text>
                )}
                <TouchableOpacity
                  style={styles.modalViewPostButton}
                  onPress={() => {
                    setSelectedPost(null);
                    navigation.navigate('PostDetail', {
                      postId: selectedPost.post.id,
                      post: selectedPost.post,
                      allPosts: selectedPost.allPosts,
                      currentPostIndex: selectedPost.currentPostIndex
                    });
                  }}
                >
                  <Text style={styles.modalViewPostButtonText}>게시물 보기</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 검색 시트 모달 */}
      <Modal
        visible={showSearchSheet}
        transparent
        animationType="none"
        onRequestClose={() => setShowSearchSheet(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'flex-start'
        }}>
          <View style={{
            backgroundColor: 'white',
            width: '100%',
            height: '100%',
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 50
          }}>
            {/* 헤더 */}
            <View style={{
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: '#f0f0f0',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12
            }}>
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                borderRadius: 24,
                paddingHorizontal: 20,
                paddingVertical: 12,
                gap: 12
              }}>
                <Ionicons name="search" size={24} color="#666" />
                <TextInput
                  placeholder="지역 또는 장소명 검색 (예: 서울 올림픽 공원, 카페, 맛집)"
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={async (text) => {
                    setSearchQuery(text);
                    
                    if (!text.trim()) {
                      setFilteredRegions([]);
                      setSearchSuggestions([]);
                      return;
                    }

                    const query = text.trim().toLowerCase();
                    const queryWithoutHash = query.replace(/^#+/, '');
                    const suggestions = [];

                    // 1. 해시태그 검색 (#로 시작하거나 해시태그 형식인 경우)
                    const isHashtagQuery = text.startsWith('#') || queryWithoutHash.length > 0;
                    if (isHashtagQuery) {
                      try {
                        // 모든 게시물에서 해시태그 수집
                        const postsJson = await AsyncStorage.getItem('uploadedPosts');
                        const allPosts = postsJson ? JSON.parse(postsJson) : [];
                        const allTagsSet = new Set();
                        
                        allPosts.forEach(post => {
                          const tags = post.tags || [];
                          const aiLabels = post.aiLabels || [];
                          
                          tags.forEach(tag => {
                            const tagText = typeof tag === 'string' ? tag.replace(/^#+/, '').toLowerCase() : String(tag).replace(/^#+/, '').toLowerCase();
                            if (tagText && tagText.includes(queryWithoutHash)) {
                              allTagsSet.add(tagText);
                            }
                          });
                          
                          aiLabels.forEach(label => {
                            const labelText = label.name?.toLowerCase() || String(label).toLowerCase();
                            if (labelText && labelText.includes(queryWithoutHash)) {
                              allTagsSet.add(labelText);
                            }
                          });
                        });
                        
                        // 해시태그 제안 추가
                        Array.from(allTagsSet).slice(0, 8).forEach(tag => {
                          suggestions.push({
                            type: 'hashtag',
                            name: `#${tag}`,
                            display: `#${tag}`,
                            tag: tag
                          });
                        });
                      } catch (e) {
                        console.error('해시태그 자동완성 오류:', e);
                      }
                    }

                    // 2. 지역명 검색 (초성 검색 포함은 나중에 구현)
                    // 3. 게시물에서 장소명 검색
                    const matchingPosts = await searchInPosts(text);
                    const uniquePlaces = new Set();
                    
                    // 검색어와 정확히 매칭되는 것을 우선순위로 정렬
                    const sortedPosts = matchingPosts.sort((a, b) => {
                      const aPlaceName = (a.placeName || a.detailedLocation || a.location || '').toLowerCase();
                      const bPlaceName = (b.placeName || b.detailedLocation || b.location || '').toLowerCase();
                      const queryLower = text.toLowerCase().trim();
                      
                      // 정확히 시작하는 것을 우선
                      const aStartsWith = aPlaceName.startsWith(queryLower);
                      const bStartsWith = bPlaceName.startsWith(queryLower);
                      if (aStartsWith && !bStartsWith) return -1;
                      if (!aStartsWith && bStartsWith) return 1;
                      
                      // 더 짧은 이름을 우선 (더 정확한 매칭일 가능성)
                      return aPlaceName.length - bPlaceName.length;
                    });
                    
                    sortedPosts.slice(0, 8).forEach(post => {
                      const placeName = post.placeName || post.detailedLocation || post.location;
                      if (placeName && !uniquePlaces.has(placeName)) {
                        uniquePlaces.add(placeName);
                        suggestions.push({
                          type: 'place',
                          name: placeName,
                          display: `${placeName}${post.location && placeName !== post.location ? ` (${post.location})` : ''}`,
                          post: post
                        });
                      }
                    });

                    // 최대 10개로 제한
                    const limitedSuggestions = suggestions.slice(0, 10);
                    setFilteredRegions([]);
                    setSearchSuggestions(limitedSuggestions);
                  }}
                  onSubmitEditing={handleSearch}
                  autoFocus
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: '#333',
                    fontWeight: '400',
                    padding: 0
                  }}
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setFilteredRegions([]);
                      setSearchSuggestions([]);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setShowSearchSheet(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#f5f5f5',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 검색 결과 또는 최근 검색 지역 */}
            <ScrollView style={{ flex: 1, padding: 20 }}>
              {searchQuery.trim() ? (
                // 검색어가 있을 때 자동완성 결과
                (searchSuggestions.length > 0 ? (
                  <View>
                    {searchSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={async () => {
                          setSearchQuery(suggestion.name);
                          setShowSearchSheet(false);
                          
                          // 검색 실행
                          setTimeout(() => {
                            handleSearch();
                          }, 100);
                        }}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 8,
                          backgroundColor: '#fafafa'
                        }}
                      >
                        <Ionicons 
                          name={suggestion.type === 'region' ? 'location' : suggestion.type === 'hashtag' ? 'pricetag' : 'place'} 
                          size={24} 
                          color={suggestion.type === 'region' ? COLORS.primary : suggestion.type === 'hashtag' ? '#9C27B0' : '#FF9800'} 
                        />
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '500',
                          color: '#333',
                          flex: 1
                        }}>
                          {suggestion.display}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={{
                    padding: 40,
                    alignItems: 'center'
                  }}>
                    <Text style={{
                      color: '#999',
                      fontSize: 14
                    }}>
                      검색 결과가 없습니다
                    </Text>
                  </View>
                ))
              ) : (
                // 검색어가 없을 때 최근 검색 지역
                <View>
                  {recentSearches.length > 0 ? (
                    <View>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 16
                      }}>
                        <Text style={{
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: '#333'
                        }}>
                          최근 검색한 지역
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setRecentSearches([]);
                            AsyncStorage.removeItem('recentSearches');
                          }}
                          style={{
                            padding: 4
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            color: '#666'
                          }}>
                            지우기
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 8
                      }}>
                        {recentSearches.map((search, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => {
                              setSearchQuery(search);
                              setTimeout(() => {
                                handleSearch();
                                setShowSearchSheet(false);
                              }, 100);
                            }}
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 10,
                              borderRadius: 20,
                              backgroundColor: index === 0 ? COLORS.primary : '#f5f5f5',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                            <Ionicons name="time-outline" size={18} color={index === 0 ? 'white' : '#333'} />
                            <Text style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: index === 0 ? 'white' : '#333'
                            }}>
                              {search}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={{
                      padding: 40,
                      alignItems: 'center'
                    }}>
                      <Text style={{
                        color: '#999',
                        fontSize: 14
                      }}>
                        최근 검색한 지역이 없습니다
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SOS 요청 모달 (웹과 동일) */}
      {showSOSModal && (
        <Modal
          visible={showSOSModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowSOSModal(false);
            setIsSelectingLocation(false);
          }}
        >
          <View style={styles.sosModalOverlay}>
            <View style={styles.sosModalContent}>
              <View style={styles.sosModalHeader}>
                <Text style={styles.sosModalTitle}>도움 요청</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowSOSModal(false);
                    setIsSelectingLocation(false);
                  }}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.sosModalDescription}>
                지도에서 위치를 선택하거나 궁금한 내용을 입력해주세요.
              </Text>
              <TextInput
                style={styles.sosModalInput}
                placeholder="예: 이 근처에 주차장이 있나요?"
                placeholderTextColor={COLORS.textSubtle}
                value={sosQuestion}
                onChangeText={setSosQuestion}
                multiline
              />
              <TouchableOpacity
                style={styles.sosModalSubmitButton}
                onPress={() => {
                  // SOS 요청 저장 로직 (웹과 동일)
                  Alert.alert('알림', '도움 요청이 등록되었습니다.');
                  setShowSOSModal(false);
                  setIsSelectingLocation(false);
                  setSosQuestion('');
                }}
              >
                <Text style={styles.sosModalSubmitButtonText}>요청하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: BOTTOM_TAB_HEIGHT,
    zIndex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  customMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerVideoPlaceholder: {
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  currentLocationMarkerContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(135, 206, 250, 0.4)',
  },
  currentLocationDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#87CEEB',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  // 검색바 (투명 배경, blur)
  searchBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 50,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    minHeight: 52,
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
  },
  refreshButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  refreshButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 26,
  },
  // 필터 버튼들
  filterContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 114 : 154,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: COLORS.textWhite,
  },
  // SOS 버튼 (필터와 같은 줄에 배치)
  sosButtonInFilter: {
    borderRadius: 20,
    marginLeft: 8,
  },
  sosButtonBlur: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  sosButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // 지도 컨트롤 버튼들 (웹과 동일)
  mapControls: {
    position: 'absolute',
    right: 16,
    zIndex: 30,
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  // 사진 다시 보기 버튼 (웹과 동일)
  showSheetButton: {
    position: 'absolute',
    bottom: 120,
    left: '50%',
    transform: [{ translateX: -SCREEN_WIDTH / 4 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 25,
  },
  showSheetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // 바텀 시트 (웹과 동일)
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_TAB_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.4,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#d4d4d8',
    borderRadius: 2,
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  sheetHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
    minHeight: 110,
  },
  pinCard: {
    width: 90,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'column', // 사진이 위, 지역명이 아래
  },
  pinCardImage: {
    width: '100%',
    height: 90,
  },
  pinCardImagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCardVideoPlaceholder: {
    backgroundColor: '#4b5563',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCardInfo: {
    padding: 6,
    backgroundColor: 'white',
  },
  pinCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  pinCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  pinCardBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  pinCardBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  emptyPinsContainer: {
    width: SCREEN_WIDTH - 32,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyPinsText: {
    fontSize: 14,
    color: '#999',
  },
  // 모달 (웹과 동일)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: SCREEN_WIDTH - 40,
    maxHeight: SCREEN_HEIGHT - 200,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f5f5f5',
  },
  modalBody: {
    padding: 16,
  },
  modalNote: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalViewPostButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalViewPostButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // SOS 모달 (웹과 동일)
  sosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sosModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  sosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sosModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sosModalDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  sosModalInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 16,
  },
  sosModalSubmitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosModalSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // 경로 모드 UI
  routeModeButtonContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 30,
  },
  routeModeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  routeCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  routeModeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  routeModeStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  routeModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  routeModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  routeBottomActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  routeCenterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  routeBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  routeBottomBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  routeBottomBtnSuccess: {
    backgroundColor: '#4CAF50',
  },
  routeBottomBtnTextPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  routeBottomBtnTextLight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  routeBottomHintBlock: {
    alignItems: 'center',
    gap: 8,
  },
  routeBottomHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  routeClearOneTap: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  routeClearOneTapText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // 선택된 핀 개수 배지
  pinCountBadge: {
    position: 'absolute',
    left: 16,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  pinCountBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textWhite,
  },
});

export default MapScreen;

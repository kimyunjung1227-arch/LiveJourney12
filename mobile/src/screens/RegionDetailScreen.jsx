import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '../constants/styles';
import { filterRecentPosts, getTimeAgo } from '../utils/timeUtils';
import { isPostLiked } from '../utils/socialInteractions';
import { toggleInterestPlace, isInterestPlace } from '../utils/interestPlaces';
import { ScreenLayout, ScreenContent, ScreenHeader, ScreenBody } from '../components/ScreenLayout';
import { getLandmarksByRegion, isPostMatchingLandmarks } from '../utils/regionLandmarks';
import { getRegionDefaultImage } from '../utils/regionDefaultImages';
import { getCombinedPosts } from '../utils/mockData';
import { buildMediaItemsFromPost, getMapThumbnailUri } from '../utils/postMedia';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FEED_CARD_WIDTH = (SCREEN_WIDTH - SPACING.md * 3) / 2;

/** 지금 여기는 더보기와 동일: 장소명 → 설명 → 시간·날씨 */
const RegionFeedPostItem = ({ item, index, onPress, regionName, cardWeather }) => {
  const [isLiked, setIsLiked] = useState(false);
  const thumb = getMapThumbnailUri(item);
  const hasVideoOnly = !thumb && buildMediaItemsFromPost(item).some((m) => m.type === 'video');
  const likeCount = item.likes || item.likeCount || 0;
  const loc = item.detailedLocation || item.placeName || item.location || '여행지';
  const desc = (item.note || item.content || '').trim() || `${regionName || loc}의 모습`;
  const timeLabel = item.timeLabel || item.time || getTimeAgo(item.timestamp || item.createdAt || item.time);
  const w = cardWeather && !cardWeather.loading ? { icon: cardWeather.icon, temperature: cardWeather.temperature } : null;

  useEffect(() => {
    const checkLike = async () => {
      const liked = await isPostLiked(item.id);
      setIsLiked(liked);
    };
    checkLike();
  }, [item.id]);

  return (
    <TouchableOpacity
      style={regionStyles.postItem}
      onPress={() => onPress(item, index)}
      activeOpacity={0.9}
    >
      <View style={regionStyles.postImageContainer}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={regionStyles.postImage} resizeMode="cover" />
        ) : hasVideoOnly ? (
          <View style={[regionStyles.postImage, regionStyles.videoThumbPlaceholder]}>
            <Ionicons name="videocam" size={36} color={COLORS.textSubtle} />
          </View>
        ) : (
          <View style={[regionStyles.postImage, regionStyles.postImagePlaceholder]}>
            <Ionicons name="image-outline" size={32} color={COLORS.textSubtle} />
          </View>
        )}
        <View style={regionStyles.likeBadge}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={16}
            color={isLiked ? COLORS.error : COLORS.text}
          />
          <Text style={regionStyles.likeCount}>{likeCount}</Text>
        </View>
      </View>
      <View style={regionStyles.postTextContainer}>
        <Text style={regionStyles.locationTitle} numberOfLines={1}>
          {loc}
        </Text>
        <Text style={regionStyles.noteText} numberOfLines={2}>
          {desc}
        </Text>
        <View style={regionStyles.metaRow}>
          <Text style={regionStyles.timeText}>{timeLabel}</Text>
          {w ? (
            <View style={regionStyles.weatherInline}>
              <Text style={regionStyles.weatherIcon}>{w.icon}</Text>
              <Text style={regionStyles.weatherTemp}>{w.temperature}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const RegionDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { regionName, focusLocation } = route.params || {};
  const region = route.params?.region || { name: regionName || '서울' };

  // 검색 에러 방어: regionName이 없으면 뒤로가기
  useEffect(() => {
    if (!regionName && !route.params?.region) {
      Alert.alert('알림', '지역 정보가 없습니다.', [{ text: '확인', onPress: () => navigation.goBack() }]);
    }
  }, [regionName]);

  const [realtimePhotos, setRealtimePhotos] = useState([]);
  const [bloomPhotos, setBloomPhotos] = useState([]);
  const [touristSpots, setTouristSpots] = useState([]);
  const [foodPhotos, setFoodPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInterest, setIsInterest] = useState(false);
  const [regionHashtags, setRegionHashtags] = useState([]);
  const [activeCategory, setActiveCategory] = useState('전체');

  const [weatherInfo, setWeatherInfo] = useState({
    icon: '☀️',
    condition: '맑음',
    temperature: '23℃',
    loading: false
  });

  const [trafficInfo, setTrafficInfo] = useState({
    icon: '🚗',
    status: '교통 원활',
    loading: false
  });

  const categories = ['전체', '명소', '맛집', '카페', '개화'];

  // 데이터 로드 및 필터링
  const loadRegionData = useCallback(async () => {
    try {
      setLoading(true);
      const uploadedPostsJson = await AsyncStorage.getItem('uploadedPosts');
      const allMockPosts = getCombinedPosts(JSON.parse(uploadedPostsJson || '[]'));

      // 해당 지역 게시물 필터링
      const regionPosts = allMockPosts.filter(post =>
        (post.location || '').includes(region.name) ||
        (post.placeName || '').includes(region.name)
      ).sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));

      setRealtimePhotos(regionPosts);

      // 카테고리별 분리
      const bloom = regionPosts.filter(p => p.category === 'bloom' || (p.tags || []).includes('꽃') || (p.tags || []).includes('개화'));
      const spots = regionPosts.filter(p => p.category === 'landmark' || p.category === 'scenic');
      const food = regionPosts.filter(p => p.category === 'food');

      setBloomPhotos(bloom);
      setTouristSpots(spots);
      setFoodPhotos(food);

      // 지역 해시태그 수집
      const tagsMap = new Map();
      regionPosts.forEach(p => {
        const tags = [...(p.tags || []), ...(p.aiLabels || [])];
        tags.forEach(t => {
          const display = typeof t === 'string' ? t : (t.display || t.name);
          if (!display) return;
          const key = display.replace(/^#+/, '').trim();
          if (!key) return;
          tagsMap.set(key, (tagsMap.get(key) || 0) + 1);
        });
      });
      const topTags = Array.from(tagsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setRegionHashtags(topTags);

      // 관심 지역 여부 확인
      const interested = await isInterestPlace(region.name);
      setIsInterest(interested);

    } catch (error) {
      console.error('Region data load error:', error);
    } finally {
      setLoading(false);
    }
  }, [region.name]);

  // 날씨 정보 가져오기
  const fetchWeatherData = useCallback(async () => {
    setWeatherInfo(prev => ({ ...prev, loading: true }));
    try {
      const mockWeatherData = {
        '서울': { icon: '☀️', condition: '맑음', temperature: '23℃' },
        '부산': { icon: '🌤️', condition: '구름조금', temperature: '25℃' },
        '제주': { icon: '☀️', condition: '맑음', temperature: '24℃' },
      };
      const mockWeather = mockWeatherData[region.name] || { icon: '☀️', condition: '맑음', temperature: '23℃' };
      setWeatherInfo({ ...mockWeather, loading: false });
    } catch (error) {
      setWeatherInfo(prev => ({ ...prev, loading: false }));
    }
  }, [region.name]);

  // 교통 정보 가져오기
  const fetchTrafficData = useCallback(async () => {
    setTrafficInfo(prev => ({ ...prev, loading: true }));
    try {
      setTrafficInfo({ icon: '🚗', status: '교통 원활', loading: false });
    } catch (error) {
      setTrafficInfo(prev => ({ ...prev, loading: false }));
    }
  }, [region.name]);

  useEffect(() => {
    loadRegionData();
    fetchWeatherData();
    fetchTrafficData();
  }, [loadRegionData, fetchWeatherData, fetchTrafficData]);

  const toggleInterest = async () => {
    const newState = await toggleInterestPlace(region.name);
    setIsInterest(newState);
  };

  const facetedPhotos = useMemo(() => {
    if (activeCategory === '전체') return realtimePhotos;
    const catMap = { '명소': 'scenic', '맛집': 'food', '카페': 'cafe', '개화': 'bloom' };
    const targetCat = catMap[activeCategory];
    return realtimePhotos.filter(p => p.category === targetCat || (p.categoryLabel || '').includes(activeCategory));
  }, [realtimePhotos, activeCategory]);

  const handlePostPress = (post, index, allPosts) => {
    navigation.navigate('PostDetail', {
      postId: post.id,
      post: post,
      allPosts: allPosts,
      currentPostIndex: index,
    });
  };

  const renderCategoryFilter = () => (
    <View style={styles.categoryFilterContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.categoryText, activeCategory === cat && styles.categoryTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSection = (title, data, sectionType) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('RegionCategory', { regionName: region.name, type: sectionType })}>
            <Text style={styles.moreButton}>더보기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendScroll}>
          {data.map((item, index) => (
            <TouchableOpacity
              key={item.id || index}
              style={styles.diverseCard}
              onPress={() => handlePostPress(item, index, data)}
            >
              <Image source={{ uri: item.image || item.imageUrl || (item.images && item.images[0]) }} style={styles.diverseImage} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.diverseOverlay} />
              <View style={styles.diverseInfo}>
                <Text style={styles.diverseName}>{item.placeName || item.detailedLocation || '명소'}</Text>
                <Text style={styles.diverseCount}>{item.timeLabel || getTimeAgo(item.timestamp || item.createdAt) || '방금 전'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenLayout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenLayout>
    );
  }

  const bannerImage = realtimePhotos[0]?.image || realtimePhotos[0]?.imageUrl || (realtimePhotos[0]?.images && realtimePhotos[0]?.images[0]) || getRegionDefaultImage(region.name);

  return (
    <ScreenLayout>
      <ScreenContent>
        {/* 배너 섹션 */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: bannerImage }} style={styles.bannerImage} />
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']} style={styles.bannerOverlay} />
          <View style={styles.bannerHeader}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleInterest}>
              <Ionicons name={isInterest ? "heart" : "heart-outline"} size={24} color={isInterest ? COLORS.error : "#fff"} />
            </TouchableOpacity>
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerRegionName}>{region.name}</Text>
            <View style={styles.bannerMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="sunny" size={16} color="#FFE14D" />
                <Text style={styles.metaText}>{weatherInfo.temperature} {weatherInfo.condition}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="car" size={16} color="#fff" />
                <Text style={styles.metaText}>{trafficInfo.status}</Text>
              </View>
            </View>
          </View>
        </View>

        <ScreenBody>
          {/* 카테고리 필터 */}
          {renderCategoryFilter()}

          {/* 지역 해시태그 */}
          {regionHashtags.length > 0 && (
            <View style={styles.tagSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll}>
                {regionHashtags.map((tag) => (
                  <TouchableOpacity key={tag.name} style={styles.tagChip} onPress={() => navigation.navigate('Search', { initialQuery: '#' + tag.name })}>
                    <Text style={styles.tagText}>#{tag.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 인기 게시물 */}
          {renderSection(`🏞️ ${region.name} 인기 명소`, touristSpots, 'spots')}
          {renderSection('🍜 지역 대표 맛집', foodPhotos, 'food')}
          {renderSection('🌸 실시간 개화 정보', bloomPhotos, 'bloom')}

          {/* 실시간 피드 */}
          <View style={styles.feedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>실시간 지역 피드</Text>
            </View>
            <View style={styles.postGrid}>
              {facetedPhotos.length > 0 ? (
                facetedPhotos.slice(0, 12).map((post, idx) => (
                  <RegionFeedPostItem
                    key={post.id || idx}
                    item={post}
                    index={idx}
                    onPress={(p, i) => handlePostPress(p, i, facetedPhotos)}
                    regionName={region.name}
                    cardWeather={{
                      loading: weatherInfo.loading,
                      icon: weatherInfo.icon,
                      temperature: weatherInfo.temperature,
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyFeed}>
                  <Text style={styles.emptyFeedText}>해당 카테고리의 게시물이 없습니다.</Text>
                </View>
              )}
            </View>
          </View>

        </ScreenBody>
      </ScreenContent>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Banner
  bannerContainer: { width: '100%', height: 360, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bannerHeader: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  bannerInfo: { position: 'absolute', bottom: 32, left: 24 },
  bannerRegionName: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  bannerMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItemWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(241,245,249,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    maxWidth: '100%',
  },
  metaTextWeather: { color: '#0f172a', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  metaText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  // Category Filter
  categoryFilterContainer: { marginTop: 20, marginBottom: 12 },
  categoryScroll: { paddingHorizontal: 16, gap: 8 },
  categoryChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f5f5f5' },
  categoryChipActive: { backgroundColor: COLORS.primary },
  categoryText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  categoryTextActive: { color: '#fff' },

  // Tags
  tagSection: { marginBottom: 24 },
  tagScroll: { paddingHorizontal: 16, gap: 8 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.primary + '0D', borderWidth: 1, borderColor: COLORS.primary + '1A' },
  tagText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Sections
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  moreButton: { fontSize: 14, color: COLORS.textSubtle, fontWeight: '500' },

  recommendScroll: { paddingHorizontal: 16, gap: 16 },
  diverseCard: { width: 200, height: 260, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: '#eee' },
  diverseImage: { width: '100%', height: '100%' },
  diverseOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  diverseInfo: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  diverseName: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
  diverseCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  // Feed
  feedSection: { marginBottom: 40 },
  postGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    rowGap: SPACING.md,
  },
  emptyFeed: { width: '100%', padding: 40, alignItems: 'center' },
  emptyFeedText: { color: COLORS.textSubtle, fontSize: 14 },
});

const regionStyles = StyleSheet.create({
  postItem: { width: FEED_CARD_WIDTH, marginBottom: 0 },
  postImageContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: COLORS.borderLight,
  },
  postImage: { width: '100%', height: '100%' },
  postImagePlaceholder: { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' },
  videoThumbPlaceholder: { backgroundColor: '#e8eaed', justifyContent: 'center', alignItems: 'center' },
  likeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  likeCount: { fontSize: 14, fontWeight: '600', color: '#374151' },
  postTextContainer: { gap: 2 },
  locationTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  noteText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 19, marginTop: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  weatherInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherIcon: { fontSize: 13 },
  weatherTemp: { fontSize: 12, fontWeight: '700', color: COLORS.text },
});

export default RegionDetailScreen;

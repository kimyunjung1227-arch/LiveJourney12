import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { useTabBar } from '../contexts/TabBarContext';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/styles';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import StartScreen from '../screens/StartScreen';
import MainScreen from '../screens/MainScreen';
import SearchScreen from '../screens/SearchScreen';
import UploadScreen from '../screens/UploadScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import RegionDetailScreen from '../screens/RegionDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import DetailScreen from '../screens/DetailScreen';
import MagazineDetailScreen from '../screens/MagazineDetailScreen';
import RegionCategoryScreen from '../screens/RegionCategoryScreen';
import BadgeListScreen from '../screens/BadgeListScreen';
import RealtimeFeedScreen from '../screens/RealtimeFeedScreen';
import CrowdedPlaceScreen from '../screens/CrowdedPlaceScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { FeedVideoProvider } from '../contexts/FeedVideoContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 메인 탭 네비게이터 (웹과 동일한 디자인)
function MainTabs() {
  const { isTabBarVisible } = useTabBar();
  const tabBarHeight = 80;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isTabBarVisible ? 0 : tabBarHeight,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: isTabBarVisible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isTabBarVisible, tabBarHeight, translateY, opacity]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00BCD4', // 웹과 동일
        tabBarInactiveTintColor: '#9CA3AF', // 웹: text-subtle-light = #9CA3AF
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB', // 웹: border-light = #E5E7EB
          backgroundColor: '#FFFFFF', // 웹: background-light = #ffffff
          paddingBottom: 8,
          paddingTop: 8,
          height: tabBarHeight, // 웹: h-20 (80px)
          position: 'absolute',
          bottom: 0,
          opacity: opacity,
          transform: [{ translateY: translateY }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          marginTop: 4, // 웹: gap-1
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tab.Screen
        name="MainTab"
        component={MainScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name="home"
              size={24}
              color={focused ? COLORS.primary : '#8a7560'}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarLabel: '검색',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name="search"
              size={24}
              color={focused ? COLORS.primary : '#8a7560'}
            />
          ),
        }}
      />
      <Tab.Screen
        name="UploadTab"
        component={UploadScreen}
        options={{
          tabBarLabel: '업로드',
          tabBarIcon: ({ color, focused, size }) => (
            <View style={{
              backgroundColor: COLORS.primary,
              width: 56,
              height: 56,
              borderRadius: 28,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -8,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}>
              <Ionicons
                name="add"
                size={28}
                color="white"
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          tabBarLabel: '지도',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name="map"
              size={24}
              color={focused ? COLORS.primary : '#8a7560'}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: '프로필',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name="person"
              size={24}
              color={focused ? COLORS.primary : '#8a7560'}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// 메인 스택 네비게이터
export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // 로딩 화면 (나중에 추가)
    return null;
  }

  return (
    <NavigationContainer>
      <FeedVideoProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isAuthenticated ? (
          // 인증되지 않은 사용자
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Start" component={StartScreen} />
          </>
        ) : (
          // 인증된 사용자
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="RegionDetail"
              component={RegionDetailScreen}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
            />
            <Stack.Screen
              name="Detail"
              component={DetailScreen}
            />
            <Stack.Screen
              name="MagazineDetail"
              component={MagazineDetailScreen}
            />
            <Stack.Screen
              name="RegionCategory"
              component={RegionCategoryScreen}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
            />
            <Stack.Screen
              name="Upload"
              component={UploadScreen}
            />
            <Stack.Screen
              name="BadgeList"
              component={BadgeListScreen}
            />
            <Stack.Screen
              name="RealtimeFeed"
              component={RealtimeFeedScreen}
            />
            <Stack.Screen
              name="CrowdedPlace"
              component={CrowdedPlaceScreen}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
            />
          </>
        )}
      </Stack.Navigator>
      </FeedVideoProvider>
    </NavigationContainer>
  );
}



import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { initStatusBar } from './utils/statusBar'
import SosAlertBanner from './components/SosAlertBanner'
import { cleanLegacyUploadedPosts } from './utils/localStorageManager'

// Pages (코드 스플리팅을 위해 lazy 로드)
const WelcomeScreen = lazy(() => import('./pages/WelcomeScreen'))
const StartScreen = lazy(() => import('./pages/StartScreen'))
const OnboardingScreen = lazy(() => import('./pages/OnboardingScreen'))
const AuthCallbackScreen = lazy(() => import('./pages/AuthCallbackScreen'))
const MainScreen = lazy(() => import('./pages/MainScreen'))
const MagazineListScreen = lazy(() => import('./pages/MagazineListScreen'))
const MagazineDetailScreen = lazy(() => import('./pages/MagazineDetailScreen'))
const MagazineWriteScreen = lazy(() => import('./pages/MagazineWriteScreen'))
const MagazineAdminScreen = lazy(() => import('./pages/MagazineAdminScreen'))
const SearchScreen = lazy(() => import('./pages/SearchScreen'))
const HashtagScreen = lazy(() => import('./pages/HashtagScreen'))
const DetailScreen = lazy(() => import('./pages/DetailScreen'))
const PostDetailScreen = lazy(() => import('./pages/PostDetailScreen'))
const RegionDetailScreen = lazy(() => import('./pages/RegionDetailScreen'))
const UploadScreen = lazy(() => import('./pages/UploadScreen'))
const MapScreen = lazy(() => import('./pages/MapScreen'))
const MapPhotoGridScreen = lazy(() => import('./pages/MapPhotoGridScreen'))
const ProfileScreen = lazy(() => import('./pages/ProfileScreen'))
const UserProfileScreen = lazy(() => import('./pages/UserProfileScreen'))
const EditProfileScreen = lazy(() => import('./pages/EditProfileScreen'))
const PersonalInfoEditScreen = lazy(() => import('./pages/PersonalInfoEditScreen'))
const PasswordChangeScreen = lazy(() => import('./pages/PasswordChangeScreen'))
const AccountConnectionScreen = lazy(() => import('./pages/AccountConnectionScreen'))
const AccountDeleteScreen = lazy(() => import('./pages/AccountDeleteScreen'))
const AccountDeleteConfirmScreen = lazy(() => import('./pages/AccountDeleteConfirmScreen'))
const BadgeListScreen = lazy(() => import('./pages/BadgeListScreen'))
const BadgeAchievementScreen = lazy(() => import('./pages/BadgeAchievementScreen'))
const MyCouponsScreen = lazy(() => import('./pages/MyCouponsScreen'))
const SettingsScreen = lazy(() => import('./pages/SettingsScreen'))
const FeedUpdateFrequencyScreen = lazy(() => import('./pages/FeedUpdateFrequencyScreen'))
const NoticesScreen = lazy(() => import('./pages/NoticesScreen'))
const FAQScreen = lazy(() => import('./pages/FAQScreen'))
const InquiryScreen = lazy(() => import('./pages/InquiryScreen'))
const PrivacyPolicyScreen = lazy(() => import('./pages/PrivacyPolicyScreen'))
const TermsAndPoliciesScreen = lazy(() => import('./pages/TermsAndPoliciesScreen'))
const LocationTermsScreen = lazy(() => import('./pages/LocationTermsScreen'))
const YouthPolicyScreen = lazy(() => import('./pages/YouthPolicyScreen'))
const MarketingConsentScreen = lazy(() => import('./pages/MarketingConsentScreen'))
const OpenSourceLicensesScreen = lazy(() => import('./pages/OpenSourceLicensesScreen'))
const BusinessInfoScreen = lazy(() => import('./pages/BusinessInfoScreen'))
const TermsOfServiceScreen = lazy(() => import('./pages/TermsOfServiceScreen'))
const NotificationsScreen = lazy(() => import('./pages/NotificationsScreen'))
const InterestPlacesScreen = lazy(() => import('./pages/InterestPlacesScreen'))
const RealtimeFeedScreen = lazy(() => import('./pages/RealtimeFeedScreen'))
const CrowdedPlaceScreen = lazy(() => import('./pages/CrowdedPlaceScreen'))
const ChatScreen = lazy(() => import('./pages/ChatScreen'))
const ChatWriteScreen = lazy(() => import('./pages/ChatWriteScreen'))
const AdminScreen = lazy(() => import('./pages/AdminScreen'))

function App() {
  // StatusBar 초기화 (앱 시작 시 한 번만)
  useEffect(() => {
    initStatusBar()
    // Supabase 연동 이전에 남아 있던 테스트/목업 게시물 정리
    cleanLegacyUploadedPosts()
  }, [])

  // 개발 환경에서는 basename 없이, 프로덕션에서는 BASE_URL 사용
  const basename = import.meta.env.PROD ? import.meta.env.BASE_URL : undefined;

  return (
    <AuthProvider>
      <Router basename={basename}>
        <div className="app-container">
          <div className="page-wrapper">
            <SosAlertBanner />
            <Suspense
              fallback={
                <div className="screen-layout bg-background-light dark:bg-background-dark flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
                    <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      화면을 불러오는 중입니다...
                    </span>
                  </div>
                </div>
              }
            >
              <Routes>
                {/* 1. 스플래시 → 2. 온보딩 → 3. 로그인(StartScreen) */}
                <Route path="/" element={<WelcomeScreen />} />
                <Route path="/onboarding" element={<OnboardingScreen />} />
                <Route path="/start" element={<StartScreen />} />
                <Route path="/auth/callback" element={<AuthCallbackScreen />} />
                {/* 로그인 없이도 접근 가능한 페이지 */}
                <Route path="/main" element={<MainScreen />} />
                <Route path="/magazine" element={<MagazineListScreen />} />
                <Route
                  path="/magazine/write"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <MagazineWriteScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="/magazine/:id" element={<MagazineDetailScreen />} />
                <Route path="/realtime-feed" element={<RealtimeFeedScreen />} />
                <Route path="/crowded-place" element={<CrowdedPlaceScreen />} />
                <Route path="/chat" element={<ChatScreen />} />
                <Route path="/chat/write" element={<ChatWriteScreen />} />
                <Route path="/search" element={<SearchScreen />} />
                <Route path="/hashtags" element={<HashtagScreen />} />
                <Route path="/detail" element={<DetailScreen />} />
                <Route path="/post/:id/edit" element={<UploadScreen />} />
                <Route path="/post/:id" element={<PostDetailScreen />} />
                <Route path="/region/:regionName" element={<RegionDetailScreen />} />
                <Route path="/upload" element={<UploadScreen />} />
                <Route path="/map" element={<MapScreen />} />
                <Route path="/map/photos" element={<MapPhotoGridScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="/user/:userId" element={<UserProfileScreen />} />
                <Route path="/badges" element={<BadgeListScreen />} />
                <Route path="/badge-achievement/:badgeId" element={<BadgeAchievementScreen />} />
                <Route path="/badge/achievement" element={<BadgeAchievementScreen />} />
                <Route path="/coupons" element={<MyCouponsScreen />} />
                <Route path="/notifications" element={<NotificationsScreen />} />
                <Route path="/interest-places" element={<InterestPlacesScreen />} />
                <Route path="/notices" element={<NoticesScreen />} />
                <Route path="/faq" element={<FAQScreen />} />
                <Route path="/inquiry" element={<InquiryScreen />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyScreen />} />
                <Route path="/location-terms" element={<LocationTermsScreen />} />
                <Route path="/youth-policy" element={<YouthPolicyScreen />} />
                <Route path="/marketing-consent" element={<MarketingConsentScreen />} />
                <Route path="/opensource-licenses" element={<OpenSourceLicensesScreen />} />
                <Route path="/business-info" element={<BusinessInfoScreen />} />
                <Route path="/terms-and-policies" element={<TermsAndPoliciesScreen />} />
                <Route path="/terms-of-service" element={<TermsOfServiceScreen />} />
                {/* 로그인 필수 페이지 */}
                <Route path="/profile/edit" element={<ProtectedRoute><EditProfileScreen /></ProtectedRoute>} />
                <Route path="/personal-info-edit" element={<ProtectedRoute><PersonalInfoEditScreen /></ProtectedRoute>} />
                <Route path="/password-change" element={<ProtectedRoute><PasswordChangeScreen /></ProtectedRoute>} />
                <Route path="/account-connection" element={<ProtectedRoute><AccountConnectionScreen /></ProtectedRoute>} />
                <Route path="/account-delete" element={<ProtectedRoute><AccountDeleteScreen /></ProtectedRoute>} />
                <Route path="/account-delete/confirm" element={<ProtectedRoute><AccountDeleteConfirmScreen /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
                <Route path="/feed-update-frequency" element={<ProtectedRoute><FeedUpdateFrequencyScreen /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminScreen /></AdminRoute></ProtectedRoute>} />
                <Route
                  path="/admin/magazines"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <MagazineAdminScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App





























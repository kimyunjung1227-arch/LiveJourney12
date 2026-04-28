import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ExifConsentProvider } from './contexts/ExifConsentContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { initStatusBar } from './utils/statusBar'
import SosAlertBanner from './components/SosAlertBanner'
import { cleanLegacyUploadedPosts } from './utils/localStorageManager'
import BadgeEarnedNavigator from './components/BadgeEarnedNavigator'
import RootSeo from './components/RootSeo'

// GitHub Pages/정적 호스팅에서 간헐적으로 index.html과 assets 해시가 불일치(캐시)하면
// lazy chunk 로딩이 "text/html" MIME(404/SPA fallback)로 떨어지며 동적 import가 실패한다.
// 이 경우 1회 강제 새로고침으로 최신 index를 다시 받아 복구한다.
let __didRecoverFromChunkLoadError = false
const lazyWithRecover = (factory) =>
  lazy(() =>
    factory().catch((err) => {
      const msg = String(err?.message || err || '')
      const isChunkLoad =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Expected a JavaScript-or-Wasm module script/i.test(msg) ||
        /Loading chunk \\d+ failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg)

      if (isChunkLoad && typeof window !== 'undefined' && !__didRecoverFromChunkLoadError) {
        __didRecoverFromChunkLoadError = true
        // replace로 히스토리 누적 방지
        window.location.replace(window.location.href)
        // lazy는 Promise를 기대하므로, 여기서는 실패를 유지한다(리로드가 곧 진행됨).
      }
      throw err
    })
  )

// Pages (코드 스플리팅을 위해 lazy 로드)
const WelcomeScreen = lazyWithRecover(() => import('./pages/WelcomeScreen'))
const StartScreen = lazyWithRecover(() => import('./pages/StartScreen'))
const OnboardingScreen = lazyWithRecover(() => import('./pages/OnboardingScreen'))
const AuthCallbackScreen = lazyWithRecover(() => import('./pages/AuthCallbackScreen'))
const MainScreen = lazyWithRecover(() => import('./pages/MainScreen'))
const MagazineListScreen = lazyWithRecover(() => import('./pages/MagazineListScreen'))
const MagazineCollectionScreen = lazyWithRecover(() => import('./pages/MagazineCollectionScreen'))
const MagazineDetailScreen = lazyWithRecover(() => import('./pages/MagazineDetailScreen'))
const MagazineWriteScreen = lazyWithRecover(() => import('./pages/MagazineWriteScreen'))
const MagazineAdminScreen = lazyWithRecover(() => import('./pages/MagazineAdminScreen'))
const SearchScreen = lazyWithRecover(() => import('./pages/SearchScreen'))
const HashtagScreen = lazyWithRecover(() => import('./pages/HashtagScreen'))
const DetailScreen = lazyWithRecover(() => import('./pages/DetailScreen'))
const PostDetailScreen = lazyWithRecover(() => import('./pages/PostDetailScreen'))
const RegionDetailScreen = lazyWithRecover(() => import('./pages/RegionDetailScreen'))
const UploadScreen = lazyWithRecover(() => import('./pages/UploadScreen'))
const MapScreen = lazyWithRecover(() => import('./pages/MapScreen'))
const MapAskSituationScreen = lazyWithRecover(() => import('./pages/MapAskSituationScreen'))
const MapPhotoGridScreen = lazyWithRecover(() => import('./pages/MapPhotoGridScreen'))
const ProfileScreen = lazyWithRecover(() => import('./pages/ProfileScreen'))
const EarnedBadgesScreen = lazyWithRecover(() => import('./pages/EarnedBadgesScreen'))
const UserProfileScreen = lazyWithRecover(() => import('./pages/UserProfileScreen'))
const EditProfileScreen = lazyWithRecover(() => import('./pages/EditProfileScreen'))
const PersonalInfoEditScreen = lazyWithRecover(() => import('./pages/PersonalInfoEditScreen'))
const PasswordChangeScreen = lazyWithRecover(() => import('./pages/PasswordChangeScreen'))
const AccountConnectionScreen = lazyWithRecover(() => import('./pages/AccountConnectionScreen'))
const AccountDeleteScreen = lazyWithRecover(() => import('./pages/AccountDeleteScreen'))
const AccountDeleteConfirmScreen = lazyWithRecover(() => import('./pages/AccountDeleteConfirmScreen'))
const BadgeAchievementScreen = lazyWithRecover(() => import('./pages/BadgeAchievementScreen'))
const LiveBadgeDetailScreen = lazyWithRecover(() => import('./pages/LiveBadgeDetailScreen'))
const MyCouponsScreen = lazyWithRecover(() => import('./pages/MyCouponsScreen'))
const RaffleScreen = lazyWithRecover(() => import('./pages/RaffleScreen'))
const RaffleGuideScreen = lazyWithRecover(() => import('./pages/RaffleGuideScreen'))
const SettingsScreen = lazyWithRecover(() => import('./pages/SettingsScreen'))
const FeedUpdateFrequencyScreen = lazyWithRecover(() => import('./pages/FeedUpdateFrequencyScreen'))
const NoticesScreen = lazyWithRecover(() => import('./pages/NoticesScreen'))
const FAQScreen = lazyWithRecover(() => import('./pages/FAQScreen'))
const InquiryScreen = lazyWithRecover(() => import('./pages/InquiryScreen'))
const PrivacyPolicyScreen = lazyWithRecover(() => import('./pages/PrivacyPolicyScreen'))
const TermsAndPoliciesScreen = lazyWithRecover(() => import('./pages/TermsAndPoliciesScreen'))
const LocationTermsScreen = lazyWithRecover(() => import('./pages/LocationTermsScreen'))
const YouthPolicyScreen = lazyWithRecover(() => import('./pages/YouthPolicyScreen'))
const MarketingConsentScreen = lazyWithRecover(() => import('./pages/MarketingConsentScreen'))
const OpenSourceLicensesScreen = lazyWithRecover(() => import('./pages/OpenSourceLicensesScreen'))
const BusinessInfoScreen = lazyWithRecover(() => import('./pages/BusinessInfoScreen'))
const TermsOfServiceScreen = lazyWithRecover(() => import('./pages/TermsOfServiceScreen'))
const UploadGuideScreen = lazyWithRecover(() => import('./pages/UploadGuideScreen'))
const NotificationsScreen = lazyWithRecover(() => import('./pages/NotificationsScreen'))
const RealtimeFeedScreen = lazyWithRecover(() => import('./pages/RealtimeFeedScreen'))
const CrowdedPlaceScreen = lazyWithRecover(() => import('./pages/CrowdedPlaceScreen'))
const HotplaceLiveFeedScreen = lazyWithRecover(() => import('./pages/HotplaceLiveFeedScreen'))
const RecommendedPlaceFeedScreen = lazyWithRecover(() => import('./pages/RecommendedPlaceFeedScreen'))
const ChatScreen = lazyWithRecover(() => import('./pages/ChatScreen'))
const ChatWriteScreen = lazyWithRecover(() => import('./pages/ChatWriteScreen'))
const AdminScreen = lazyWithRecover(() => import('./pages/AdminScreen'))
const AdminHubScreen = lazyWithRecover(() => import('./pages/AdminHubScreen'))
const AdminPostsScreen = lazyWithRecover(() => import('./pages/AdminPostsScreen'))
const AdminNoticesScreen = lazyWithRecover(() => import('./pages/AdminNoticesScreen'))
const AdminPublishedMagazinesScreen = lazyWithRecover(() => import('./pages/AdminPublishedMagazinesScreen'))
const AdminRafflesScreen = lazyWithRecover(() => import('./pages/AdminRafflesScreen'))
const AdminRaffleDetailScreen = lazyWithRecover(() => import('./pages/AdminRaffleDetailScreen'))

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
    <ExifConsentProvider>
      <Router basename={basename}>
        <RootSeo />
        <div className="app-container">
          <div className="page-wrapper">
            <SosAlertBanner />
            <BadgeEarnedNavigator />
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
                <Route path="/magazines" element={<MagazineCollectionScreen />} />
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
                <Route path="/hotplace/:placeKey" element={<HotplaceLiveFeedScreen />} />
                <Route path="/recommended-place-feed" element={<RecommendedPlaceFeedScreen />} />
                <Route path="/chat" element={<ChatScreen />} />
                <Route path="/chat/write" element={<ChatWriteScreen />} />
                <Route path="/search" element={<SearchScreen />} />
                <Route path="/hashtags" element={<HashtagScreen />} />
                <Route path="/detail" element={<DetailScreen />} />
                <Route path="/post/:id/edit" element={<UploadScreen />} />
                <Route path="/post/:id" element={<PostDetailScreen />} />
                <Route path="/region/:regionName" element={<RegionDetailScreen />} />
                <Route path="/upload" element={<UploadScreen />} />
                <Route path="/upload/guide" element={<UploadGuideScreen />} />
                <Route path="/map" element={<MapScreen />} />
                <Route path="/map/ask-situation" element={<MapAskSituationScreen />} />
                <Route path="/map/photos" element={<MapPhotoGridScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route
                  path="/profile/badges"
                  element={
                    <ProtectedRoute>
                      <EarnedBadgesScreen />
                    </ProtectedRoute>
                  }
                />
                <Route path="/user/:userId/badges" element={<EarnedBadgesScreen />} />
                <Route path="/badge/live/:badgeName" element={<LiveBadgeDetailScreen />} />
                <Route path="/user/:userId" element={<UserProfileScreen />} />
                <Route path="/badge-achievement/:badgeId" element={<BadgeAchievementScreen />} />
                <Route path="/badge/achievement" element={<BadgeAchievementScreen />} />
                <Route path="/coupons" element={<MyCouponsScreen />} />
                <Route path="/raffle" element={<RaffleScreen />} />
                <Route path="/raffle/guide" element={<RaffleGuideScreen />} />
                <Route path="/notifications" element={<NotificationsScreen />} />
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
                <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminHubScreen /></AdminRoute></ProtectedRoute>} />
                <Route
                  path="/admin/posts"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <AdminPostsScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/notices"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <AdminNoticesScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/magazine/publish"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <MagazineWriteScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/magazine/manage"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <AdminPublishedMagazinesScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/raffles"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <AdminRafflesScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/raffles/:id"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <AdminRaffleDetailScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/legacy"
                  element={
                    <ProtectedRoute>
                      <AdminRoute>
                        <AdminScreen />
                      </AdminRoute>
                    </ProtectedRoute>
                  }
                />
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
    </ExifConsentProvider>
    </AuthProvider>
  )
}

export default App





























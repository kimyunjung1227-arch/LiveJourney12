import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LiveJourneyLogo from '../components/LiveJourneyLogo';
import { logger } from '../utils/logger';

const StartScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithProvider, authLoading } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 서버 운영 전환: sessionStorage 플래그 제거
    if (isAuthenticated) {
      navigate('/main', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    setError('');

    try {
      await loginWithProvider(provider.toLowerCase());
      // Supabase가 redirect 처리하므로 여기서는 별도 처리 없음
    } catch (error) {
      logger.error('소셜 로그인 실패:', error);
      setError(`${provider} 로그인에 실패했습니다.`);
      setLoading(false);
    }
  };


  // 메인 시작 화면 (소셜 로그인 전용, 전체 화면 중앙 정렬)
  return (
    <div className="min-h-[100dvh] bg-white dark:bg-zinc-900 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white dark:bg-gray-900 flex items-center p-4 justify-between shadow-sm">
        <button
          onClick={() => navigate('/main')}
          className="flex h-10 w-10 items-center justify-center text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">로그인</h2>
        <div className="w-10" />
      </header>

      {/* 컨텐츠 영역 */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md text-center">
          {/* 상단 카피 */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-primary mb-1 tracking-[0.15em] uppercase">
              LIVEJOURNEY
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
              실시간 여행 현황 검증의 기준,<br />라이브저니
            </p>
          </div>

          {/* 소셜 로그인 버튼들 */}
          <div className="flex flex-col w-full gap-3 mb-3">
            {/* 카카오 로그인 - 카카오톡 느낌의 말풍선 + TALK 로고 */}
            <button
              onClick={() => handleSocialLogin('kakao')}
              disabled={loading || authLoading}
              className="flex cursor-pointer items-center justify-center gap-3 rounded-full h-12 px-6 bg-[#FEE500] text-[#000000] text-sm font-bold tracking-tight hover:bg-[#fdd835] active:bg-[#fbc02d] transition-all shadow-md disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              <svg
                className="w-6 h-6 shrink-0 flex-shrink-0"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                role="img"
              >
                {/* 검정 말풍선 배경 */}
                <path
                  d="M12 3C7.029 3 3 6.582 3 10.95c0 3.133 2.01 5.867 5 7.516v3.234c0 .276.224.5.5.5.132 0 .26-.053.354-.146L10.5 18.4c.94.134 1.924.2 2.923.2 4.971 0 9-3.582 9-7.95S16.971 3 12 3z"
                  fill="#000000"
                />
                {/* TALK 텍스트 */}
                <text
                  x="12"
                  y="14"
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill="#FEE500"
                  fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                >
                  TALK
                </text>
              </svg>
              <span className="truncate">카카오로 시작하기</span>
            </button>

            {/* 구글 로그인 */}
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading || authLoading}
              className="flex cursor-pointer items-center justify-center gap-3 rounded-full h-12 px-6 bg-white dark:bg-gray-900 text-[#1F1F1F] dark:text-white text-sm font-semibold tracking-tight border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-gray-800 active:bg-zinc-100 transition-all shadow-sm disabled:opacity-50"
              style={{ touchAction: 'manipulation' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="truncate">구글로 시작하기</span>
            </button>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-xs font-medium text-center">
              {error}
            </div>
          )}

          {/* 로딩 상태 */}
          {loading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-primary dark:text-primary-soft">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              <span className="text-xs font-medium">로그인 중...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StartScreen;

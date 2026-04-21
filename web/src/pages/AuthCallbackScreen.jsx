import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { logger } from '../utils/logger';

const AuthCallbackScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase OAuth 에러 파라미터 처리
        const errorCode = searchParams.get('error_code') || searchParams.get('error');
        const errorDescription = searchParams.get('error_description') || searchParams.get('error_message');
        if (errorCode || errorDescription) {
          const msg = String(errorDescription || errorCode || '로그인에 실패했습니다.');
          logger.error('Supabase OAuth 오류:', { errorCode, errorDescription });
          setError(msg);
          setTimeout(() => {
            navigate('/start', { replace: true });
          }, 3000);
          return;
        }

        // PKCE(code) → session 교환
        // supabase-js는 detectSessionInUrl=true일 때 자동 처리도 하지만,
        // 라우트 전환/초기 렌더 타이밍 이슈를 피하려고 콜백 라우트에서 명시적으로 교환한다.
        const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (exErr) throw exErr;

        const uid = data?.session?.user?.id || null;
        if (!uid) {
          setError('세션을 생성할 수 없습니다.');
          setTimeout(() => {
            navigate('/start', { replace: true });
          }, 2500);
          return;
        }

        // 기존 코드 호환을 위해 userUpdated 이벤트만 유지 (AuthContext는 onAuthStateChange로 갱신됨)
        try {
          window.dispatchEvent(new Event('userUpdated'));
        } catch {
          // ignore
        }

        logger.log('✅ OAuth 세션 교환 완료:', { uid });
        navigate('/main', { replace: true });
      } catch (err) {
        logger.error('OAuth 콜백 처리 오류:', err);
        const msg =
          String(err?.message || '')
            .trim()
            .replace(/\+/g, ' ') || '로그인 처리 중 오류가 발생했습니다.';
        setError(msg);
        setTimeout(() => {
          navigate('/start', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark p-6">
      {error ? (
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-6xl text-red-500">
            error
          </span>
          <h2 className="text-xl font-bold text-content-light dark:text-content-dark">
            로그인 실패
          </h2>
          <p className="text-center text-subtle-light dark:text-subtle-dark">
            {error}
          </p>
          <p className="text-sm text-subtle-light dark:text-subtle-dark">
            잠시 후 로그인 화면으로 이동합니다...
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin">
            <span className="material-symbols-outlined text-6xl text-primary">
              sync
            </span>
          </div>
          <h2 className="text-xl font-bold text-content-light dark:text-content-dark">
            로그인 처리 중...
          </h2>
          <p className="text-center text-subtle-light dark:text-subtle-dark">
            잠시만 기다려주세요
          </p>
        </div>
      )}
    </div>
  );
};

export default AuthCallbackScreen;







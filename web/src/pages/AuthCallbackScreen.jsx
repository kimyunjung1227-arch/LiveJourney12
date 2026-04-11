import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

const AuthCallbackScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URL에서 토큰과 사용자 정보 가져오기
        const token = searchParams.get('token');
        const userJson = searchParams.get('user');
        const errorMsg = searchParams.get('error');

        if (errorMsg) {
          logger.error('소셜 로그인 오류:', errorMsg);
          setError(errorMsg);
          setTimeout(() => {
            navigate('/main', { replace: true });
          }, 3000);
          return;
        }

        if (token && userJson) {
          try {
            const user = JSON.parse(decodeURIComponent(userJson));
            
            // 로컬 스토리지에 저장
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            // Auth Context 업데이트
            if (setUser) {
              setUser(user);
            }
            
            // 사용자 정보 업데이트 이벤트 발생
            window.dispatchEvent(new Event('userUpdated'));
            
            logger.log('✅ 소셜 로그인 성공:', user);
            
            // 로그인 후 바로 메인으로
            navigate('/main', { replace: true });
          } catch (parseError) {
            logger.error('사용자 정보 파싱 오류:', parseError);
            setError('사용자 정보를 처리할 수 없습니다.');
            setTimeout(() => {
              navigate('/main', { replace: true });
            }, 3000);
          }
        } else {
          console.error('토큰 또는 사용자 정보가 없습니다');
          setError('로그인 정보를 가져올 수 없습니다.');
          setTimeout(() => {
            navigate('/main', { replace: true });
          }, 3000);
        }
      } catch (err) {
        logger.error('콜백 처리 오류:', err);
        setError('로그인 처리 중 오류가 발생했습니다.');
        setTimeout(() => {
          navigate('/main', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setUser]);

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







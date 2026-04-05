import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './utils/clearStorage'
import { requestNotificationPermission } from './utils/browserNotifications'
import { logger } from './utils/logger'

// Kakao Map API 로드: HTML 스크립트 대기 → 없으면 동적 주입 시도 → 초기화
const loadKakaoMapAPI = () => {
  return new Promise((resolve, reject) => {
    const key = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_KAKAO_MAP_API_KEY
      ? String(import.meta.env.VITE_KAKAO_MAP_API_KEY).trim()
      : '';

    const tryResolve = () => {
      if (window.kakao && window.kakao.maps) {
        logger.log('✅ Kakao Map API 로드됨');
        window.kakao.maps.load(() => {
          logger.log('✅ Kakao Map API 초기화 완료');
          resolve(window.kakao);
        });
        return true;
      }
      return false;
    };

    if (tryResolve()) return;

    const waitForKakao = (deadlineMs) => {
      const deadline = Date.now() + deadlineMs;
      const t = setInterval(() => {
        if (tryResolve()) {
          clearInterval(t);
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(t);
          reject(new Error('Kakao Map 로드 시간 초과'));
        }
      }, 150);
    };

    // 1) 먼저 HTML에 삽입된 스크립트 대기 (최대 4초)
    logger.log('📡 Kakao Map API 대기 중...');
    waitForKakao(4000);
  }).catch((err) => {
    // 2) 실패 시 키가 있으면 동적 스크립트로 한 번 더 시도
    const key = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_KAKAO_MAP_API_KEY
      ? String(import.meta.env.VITE_KAKAO_MAP_API_KEY).trim()
      : '';
    if (!key) {
      logger.warn('⚠️ Kakao Map: VITE_KAKAO_MAP_API_KEY가 없습니다. Vercel 환경변수와 카카오 콘솔 웹 도메인을 확인하세요.');
      throw err;
    }
    return new Promise((resolve, reject) => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve(window.kakao));
        return;
      }
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services,clusterer&autoload=false`;
      script.async = false;
      script.onload = () => {
        if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(() => resolve(window.kakao));
        } else {
          reject(new Error('Kakao Map 스크립트 로드 후 초기화 실패'));
        }
      };
      script.onerror = () => reject(new Error('Kakao Map 스크립트 404/실패. 카카오 콘솔에서 이 사이트 도메인을 등록했는지 확인하세요.'));
      document.head.appendChild(script);
    });
  });
};

// GitHub Pages 리다이렉트 처리 (404.html에서 리다이렉트된 경우)
const handleGitHubPagesRedirect = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectPath = urlParams.get('redirect');
  
  if (redirectPath) {
    // 리다이렉트 경로로 이동
    const newPath = redirectPath + window.location.search.replace(/[?&]redirect=[^&]*/, '').replace(/^\?/, '?') + window.location.hash;
    window.history.replaceState({}, '', newPath);
  }
};

// 앱 초기화 (Kakao는 백그라운드 로드, 앱은 즉시 표시)
const initApp = () => {
  handleGitHubPagesRedirect();

  // Kakao Map은 백그라운드에서 로드 (기다리지 않음 → 로드 시간 초과로 앱이 막히지 않음)
  loadKakaoMapAPI()
    .then(() => logger.log('🗺️ Kakao Map API 준비 완료'))
    .catch((err) => logger.warn('⚠️ Kakao Map:', err?.message || '로드 실패 (지도 화면만 제한됨)'));

  // 앱 즉시 렌더링
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  logger.log('✅ 앱 렌더링 완료');

  setTimeout(() => {
    const user = localStorage.getItem('user');
    if (user) {
      requestNotificationPermission().then((ok) => {
        if (ok) logger.log('✅ 브라우저 알림 권한 허용됨');
      });
    }
  }, 2000);
};

// 앱 시작
initApp();






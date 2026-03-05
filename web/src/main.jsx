import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './utils/clearStorage'
import { requestNotificationPermission } from './utils/browserNotifications'
import { logger } from './utils/logger'

// Kakao Map API 동적 로드
const loadKakaoMapAPI = () => {
  return new Promise((resolve, reject) => {
    // 이미 로드된 경우
    if (window.kakao && window.kakao.maps) {
      logger.log('✅ Kakao Map API 이미 로드됨');
      resolve(window.kakao);
      return;
    }

    // API 키 설정 (환경변수 필수)
    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY;

    if (!apiKey) {
      logger.error('❌ VITE_KAKAO_MAP_API_KEY 가 설정되어 있지 않습니다.');
      reject(new Error('Kakao Map API 키가 없습니다. .env 및 Vercel 환경변수를 확인해주세요.'));
      return;
    }

    logger.log('📡 Kakao Map API 로드 시작...');
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,clusterer&autoload=false`;
    script.async = false; // 동기로 로드
    
    script.onload = () => {
      logger.log('✅ Kakao Map 스크립트 로드 완료');
      
      // kakao.maps.load 대기
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          logger.log('✅ Kakao Map API 초기화 완료');
          resolve(window.kakao);
        });
      } else {
        logger.error('❌ window.kakao.maps 없음');
        reject(new Error('Kakao maps 객체를 찾을 수 없습니다'));
      }
    };
    
    script.onerror = (error) => {
      logger.error('❌ Kakao Map 스크립트 로드 실패:', error);
      logger.error('URL:', script.src);
      reject(new Error('Kakao Map API 스크립트 로드 실패'));
    };
    
    document.head.appendChild(script);
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

// 앱 초기화
const initApp = async () => {
  try {
    // GitHub Pages 리다이렉트 처리
    handleGitHubPagesRedirect();
    // Kakao Map API 로드 및 대기
    await loadKakaoMapAPI();
    logger.log('🗺️ Kakao Map API 준비 완료!');
    
    // 브라우저 알림 권한 요청 (사용자가 로그인한 경우에만)
    setTimeout(async () => {
      const user = localStorage.getItem('user');
      if (user) {
        const hasPermission = await requestNotificationPermission();
        if (hasPermission) {
          logger.log('✅ 브라우저 알림 권한 허용됨');
        } else {
          logger.log('ℹ️ 브라우저 알림 권한이 거부되었거나 요청되지 않았습니다.');
        }
      }
    }, 2000); // 앱 로드 후 2초 뒤에 권한 요청
    
    // React 앱 렌더링
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    
    logger.log('✅ 앱 렌더링 완료');
  } catch (err) {
    logger.error('❌ 앱 초기화 실패:', err);
    
    // Kakao Map 없이도 앱 실행 (지도 기능만 제외)
    logger.warn('⚠️ Kakao Map 없이 앱을 시작합니다 (지도 기능 제한됨)');
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
};

// 앱 시작
initApp();






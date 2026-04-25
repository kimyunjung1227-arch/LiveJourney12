import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './utils/clearStorage'
import { requestNotificationPermission } from './utils/browserNotifications'
import { logger } from './utils/logger'

/**
 * 브라우저 확대/축소를 "완전 고정"하는 것은 불가능하지만,
 * 앱처럼 보이도록 사용자가 의도적으로 줌을 바꾸는 대표 동작(Ctrl+휠 / Ctrl+±/0)을 최대한 막는다.
 * - 일부 브라우저/환경에서는 정책상 무시될 수 있음.
 */
function preventDesktopZoom() {
  if (typeof window === 'undefined') return

  const onWheel = (e) => {
    if (e.ctrlKey) e.preventDefault()
  }
  const onKeyDown = (e) => {
    const key = String(e.key || '').toLowerCase()
    if (!e.ctrlKey && !e.metaKey) return
    // Ctrl(+)/(-)/(0) or Cmd(+)/(-)/(0)
    if (key === '+' || key === '=' || key === '-' || key === '_' || key === '0') {
      e.preventDefault()
    }
  }

  // passive: false 필요 (preventDefault 적용)
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown, { passive: false })

  // iOS Safari 제스처 줌(핀치) 방지 best-effort
  window.addEventListener(
    'gesturestart',
    (e) => e.preventDefault(),
    { passive: false },
  )
  window.addEventListener(
    'gesturechange',
    (e) => e.preventDefault(),
    { passive: false },
  )
  window.addEventListener(
    'gestureend',
    (e) => e.preventDefault(),
    { passive: false },
  )
}

/** Supabase Storage 이미지 요청 전 TLS/DNS 연결을 미리 열어 첫 페인트 지연 완화 */
function preconnectSupabaseOrigin() {
  try {
    const raw =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
        ? String(import.meta.env.VITE_SUPABASE_URL).trim()
        : ''
    if (!raw || typeof document === 'undefined') return
    const origin = new URL(raw.startsWith('http') ? raw : `https://${raw}`).origin
    if (!origin.includes('supabase.co')) return
    const id = 'lj-preconnect-supabase'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preconnect'
    link.href = origin
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {
    /* ignore */
  }
}
preconnectSupabaseOrigin()

// Kakao Map API 로드: HTML 스크립트 대기 → 없으면 동적 주입 시도 → 초기화
/** 동시 호출·setInterval 중복 시 maps.load()가 여러 번 호출되면 SDK 내부 insertBefore 오류가 날 수 있어 단일 Promise + 단일 load로 고정 */
let kakaoMapApiPromise = null;
const loadKakaoMapAPI = () => {
  if (kakaoMapApiPromise) return kakaoMapApiPromise;

  kakaoMapApiPromise = new Promise((resolve, reject) => {
    const key =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_KAKAO_MAP_API_KEY
        ? String(import.meta.env.VITE_KAKAO_MAP_API_KEY).trim()
        : '';

    let mapsLoadScheduled = false;
    const scheduleMapsLoadOnce = () => {
      if (mapsLoadScheduled || !window.kakao?.maps) return;
      mapsLoadScheduled = true;
      window.kakao.maps.load(() => {
        logger.log('✅ Kakao Map API 초기화 완료');
        resolve(window.kakao);
      });
    };

    const tryResolve = () => {
      if (window.kakao && window.kakao.maps) {
        logger.log('✅ Kakao Map API 로드됨');
        scheduleMapsLoadOnce();
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

    logger.log('📡 Kakao Map API 대기 중...');
    waitForKakao(4000);
  }).catch((err) => {
    const key =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_KAKAO_MAP_API_KEY
        ? String(import.meta.env.VITE_KAKAO_MAP_API_KEY).trim()
        : '';
    if (!key) {
      logger.warn(
        '⚠️ Kakao Map: VITE_KAKAO_MAP_API_KEY가 없습니다. Vercel 환경변수와 카카오 콘솔 웹 도메인을 확인하세요.',
      );
      kakaoMapApiPromise = null;
      throw err;
    }
    return new Promise((resolve, reject) => {
      let mapsLoadScheduled = false;
      const runLoad = () => {
        if (mapsLoadScheduled || !window.kakao?.maps) return;
        mapsLoadScheduled = true;
        window.kakao.maps.load(() => resolve(window.kakao));
      };

      if (window.kakao && window.kakao.maps) {
        runLoad();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services,clusterer&autoload=false`;
      script.async = false;
      script.onload = () => {
        if (window.kakao && window.kakao.maps) {
          runLoad();
        } else {
          kakaoMapApiPromise = null;
          reject(new Error('Kakao Map 스크립트 로드 후 초기화 실패'));
        }
      };
      script.onerror = () => {
        kakaoMapApiPromise = null;
        reject(new Error('Kakao Map 스크립트 404/실패. 카카오 콘솔에서 이 사이트 도메인을 등록했는지 확인하세요.'));
      };
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) {
        kakaoMapApiPromise = null;
        reject(new Error('document.head 없음'));
        return;
      }
      head.appendChild(script);
    });
  });

  return kakaoMapApiPromise;
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
  preventDesktopZoom();

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
    // 서버 운영 전환: localStorage 확인 없이 권한 요청은 best-effort로 수행
    requestNotificationPermission().then((ok) => {
      if (ok) logger.log('✅ 브라우저 알림 권한 허용됨');
    });
  }, 2000);
};

// 앱 시작
initApp();






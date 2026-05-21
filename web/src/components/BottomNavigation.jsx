import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IconCamera, IconPencilPlus } from '@tabler/icons-react';

const BottomNavigation = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollTop = useRef(0);
  const scrollTimeout = useRef(null);

  // 스크롤 방향 감지 및 네비게이션 바 표시/숨김
  useEffect(() => {
    const handleScroll = () => {
      // 스크롤 컨테이너 찾기 (screen-content 또는 page-wrapper)
      const scrollContainer = document.querySelector('.screen-content') ||
        document.querySelector('.page-wrapper') ||
        document.documentElement ||
        document.body;

      const currentScrollTop = scrollContainer.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
      const scrollDifference = Math.abs(currentScrollTop - lastScrollTop.current);

      // 최소 스크롤 거리 (너무 작은 움직임은 무시)
      if (scrollDifference < 5) {
        return;
      }

      // 아래로 스크롤 (scrollTop 증가) = 숨기기
      if (currentScrollTop > lastScrollTop.current && currentScrollTop > 50) {
        setIsVisible(false);
      }
      // 위로 스크롤 (scrollTop 감소) = 보이기
      else if (currentScrollTop < lastScrollTop.current) {
        setIsVisible(true);
      }

      // 맨 위에 있을 때는 항상 보이기
      if (currentScrollTop <= 10) {
        setIsVisible(true);
      }

      lastScrollTop.current = currentScrollTop;
    };

    // 스크롤 이벤트 리스너 등록 (throttle 적용)
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    // 페이지 변경 시 스크롤 위치 초기화
    lastScrollTop.current = 0;
    setIsVisible(true);

    // 여러 스크롤 컨테이너에 이벤트 리스너 추가
    const addScrollListeners = () => {
      const scrollContainers = document.querySelectorAll('.screen-content, .page-wrapper');
      scrollContainers.forEach(container => {
        container.addEventListener('scroll', throttledHandleScroll, { passive: true });
      });
      window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    };

    addScrollListeners();

    // MutationObserver로 동적으로 추가되는 스크롤 컨테이너도 감지
    const observer = new MutationObserver(() => {
      addScrollListeners();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      const scrollContainers = document.querySelectorAll('.screen-content, .page-wrapper');
      scrollContainers.forEach(container => {
        container.removeEventListener('scroll', throttledHandleScroll);
      });
      window.removeEventListener('scroll', throttledHandleScroll);
      observer.disconnect();
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [location.pathname]);

  // 현재 활성화된 탭 확인 (useCallback)
  const isActive = useCallback((path) => {
    if (path === '/main') {
      return location.pathname === '/main' ||
        location.pathname === '/' ||
        location.pathname.startsWith('/magazine') ||
        location.pathname.startsWith('/magazines');
    }
    // 실시간 핫플 탭: 목록·장소별 피드
    if (path === '/crowded-place') {
      return (
        location.pathname.startsWith('/crowded-place') ||
        location.pathname.startsWith('/hotplace/')
      );
    }
    if (path === '/upload') {
      return location.pathname === '/upload';
    }
    if (path === '/map') {
      return location.pathname === '/map';
    }
    if (path === '/profile') {
      return location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/settings') ||
        location.pathname.startsWith('/personal-info') ||
        location.pathname.startsWith('/password-change') ||
        location.pathname.startsWith('/account-') ||
        location.pathname.startsWith('/feed-update') ||
        location.pathname.startsWith('/notices') ||
        location.pathname.startsWith('/faq') ||
        location.pathname.startsWith('/inquiry') ||
        location.pathname.startsWith('/terms') ||
        location.pathname.startsWith('/coupons') ||
        location.pathname.startsWith('/points') ||
        location.pathname.startsWith('/exchange-success');
    }
    return false;
  }, [location.pathname]);

  // 질문하기 FAB 노출 여부: 질문 작성/장소 검색 경로에서는 숨김
  const showAskFab = !(
    location.pathname.startsWith('/question/new') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/camera')
  );

  return (
    <>
      {/* 네비가 숨겨져도 하단 영역에 스크롤 콘텐츠가 비치지 않도록 흰 배경을 고정 */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '414px',
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          background: '#ffffff',
          borderTop: '1px solid rgba(242, 244, 247, 0.8)',
          zIndex: 45,
          pointerEvents: 'none',
        }}
      />

      {/* 질문하기 가벼운 FAB — 프로필 탭 위에 떠있음 */}
      {showAskFab && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: `translateX(-50%) ${isVisible ? 'translateY(0)' : 'translateY(80px)'}`,
            transition: 'transform 0.3s ease-in-out',
            width: '100%',
            maxWidth: '414px',
            pointerEvents: 'none',
            zIndex: 48,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/question/new')}
            aria-label="질문하기"
            className="flex items-center gap-1.5"
            style={{
              position: 'absolute',
              right: 12,
              bottom: 0,
              pointerEvents: 'auto',
              padding: '7px 12px',
              borderRadius: 999,
              background: '#ffffff',
              border: '1px solid #4DB8E8',
              color: '#1A6EA8',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(77, 184, 232, 0.18), 0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <IconPencilPlus size={14} stroke={2.2} />
            질문하기
          </button>
        </div>
      )}
      <nav
        className="flex-shrink-0 flex h-16 items-center justify-around"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) ${isVisible ? 'translateY(0)' : 'translateY(100%)'}`,
          width: '100%',
          maxWidth: '414px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: 'none',
          zIndex: 50,
          transition: 'transform 0.3s ease-in-out',
          background: '#ffffff',
        }}
      >
      <button
      onClick={() => navigate('/main')}
      className={`flex flex-col items-center justify-center gap-1 py-1.5 ${isActive('/main') ? 'text-primary' : 'text-text-subtle-light dark:text-text-subtle-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors'
          }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>home</span>
        <span className="text-sm font-bold">홈</span>
      </button>
      <button
      type="button"
      onClick={() => navigate('/crowded-place')}
      className={`flex flex-col items-center justify-center gap-1 py-1.5 ${isActive('/crowded-place') ? 'text-primary' : 'text-text-subtle-light dark:text-text-subtle-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors'
          }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>local_fire_department</span>
        <span className="text-sm font-bold leading-tight text-center">실시간 핫플</span>
      </button>
      <button
        onClick={() => navigate('/camera')}
        className="flex flex-col items-center gap-1 relative"
        style={{
          background: '#26C6DA',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 188, 212, 0.3)',
          marginTop: '-4px'
        }}
      >
        <IconCamera size={26} stroke={2} color="#fff" />
      </button>
      <button
        onClick={() => navigate('/map')}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 ${isActive('/map') ? 'text-primary' : 'text-text-subtle-light dark:text-text-subtle-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors'
          }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>map</span>
        <span className="text-sm font-bold">지도</span>
      </button>
      <button
        onClick={() => navigate('/profile')}
        className={`flex flex-col items-center justify-center gap-1 py-1.5 ${isActive('/profile') ? 'text-primary' : 'text-text-subtle-light dark:text-text-subtle-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors'
          }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>person</span>
        <span className="text-sm font-bold">프로필</span>
      </button>
      </nav>
    </>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

export default BottomNavigation;






























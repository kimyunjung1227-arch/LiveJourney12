import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';

const TermsAndPoliciesScreen = () => {
  const navigate = useNavigate();

  const handleTermClick = (termType) => {
    switch (termType) {
      case '개인정보 처리방침':
        navigate('/privacy-policy');
        break;
      case '위치기반 서비스 이용약관':
        navigate('/location-terms');
        break;
      case '청소년 보호정책':
        navigate('/youth-policy');
        break;
      case '광고/마케팅 수신 동의':
        navigate('/marketing-consent');
        break;
      case '오픈소스/서드파티 라이선스':
        navigate('/opensource-licenses');
        break;
      case '사업자 정보':
        navigate('/business-info');
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background-light dark:bg-background-dark group/design-root">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-light bg-surface-light/80 dark:border-border-dark dark:bg-surface-dark/80 backdrop-blur-sm px-4">
          <button
            onClick={() => navigate('/settings')}
            className="flex size-12 shrink-0 items-center justify-start cursor-pointer text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-black dark:text-white">서비스 약관 및 정책</h1>
          <div className="flex size-12 shrink-0 items-center justify-end"></div>
        </header>

        <main className="flex-grow pb-24">
          <div className="flex flex-col">
            {/* 핵심 약관 섹션 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-8 pb-3">
                <h2 className="text-lg font-bold leading-normal text-black dark:text-white">핵심 약관</h2>
              </div>
              <div className="flex flex-col divide-y divide-border-light dark:divide-border-dark">
                <button
                  onClick={() => handleTermClick('개인정보 처리방침')}
                  className="flex items-center justify-between gap-4 py-4 px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <div className="flex flex-col text-left">
                    <p className="text-base font-semibold leading-normal text-black dark:text-white">개인정보 처리방침</p>
                    <p className="text-sm font-normal leading-normal text-black/70 dark:text-white/70">개인정보 수집 및 이용에 대한 안내</p>
                  </div>
                  <span className="material-symbols-outlined text-black/70 dark:text-white/70" style={{ fontSize: '20px' }}>
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            <div className="h-2 bg-background-light dark:bg-background-dark"></div>

            {/* 부가 약관 및 정보 섹션 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-8 pb-3">
                <h2 className="text-lg font-bold leading-normal text-black dark:text-white">부가 약관 및 정보</h2>
              </div>
              <div className="flex flex-col divide-y divide-border-light dark:divide-border-dark">
                <button
                  onClick={() => handleTermClick('위치기반 서비스 이용약관')}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">위치기반 서비스 이용약관</p>
                  <span className="material-symbols-outlined text-black/70 dark:text-white/70" style={{ fontSize: '20px' }}>
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={() => handleTermClick('청소년 보호정책')}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">청소년 보호정책</p>
                  <span className="material-symbols-outlined text-black/70 dark:text-white/70" style={{ fontSize: '20px' }}>
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={() => handleTermClick('광고/마케팅 수신 동의')}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">광고/마케팅 수신 동의</p>
                  <span className="material-symbols-outlined text-black/70 dark:text-white/70" style={{ fontSize: '20px' }}>
                    chevron_right
                  </span>
                </button>
              </div>
            </div>

            <div className="h-2 bg-background-light dark:bg-background-dark"></div>

            {/* 기타 정보 섹션 */}
            <div className="bg-surface-light dark:bg-surface-dark">
              <div className="px-4 pt-8 pb-3">
                <h2 className="text-lg font-bold leading-normal text-black dark:text-white">기타 정보</h2>
              </div>
              <div className="flex flex-col divide-y divide-border-light dark:divide-border-dark">
                <button
                  onClick={() => handleTermClick('오픈소스/서드파티 라이선스')}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">오픈소스/서드파티 라이선스</p>
                  <span className="material-symbols-outlined text-black/70 dark:text-white/70" style={{ fontSize: '20px' }}>
                    chevron_right
                  </span>
                </button>
                <button
                  onClick={() => handleTermClick('사업자 정보')}
                  className="flex h-14 items-center justify-between px-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors"
                >
                  <p className="text-base font-semibold leading-normal text-black dark:text-white">사업자 정보</p>
                  <span className="material-symbols-outlined text-black/70 dark:text-white/70" style={{ fontSize: '20px' }}>
                    chevron_right
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>

      </div>

      <BottomNavigation />
    </div>
  );
};

export default TermsAndPoliciesScreen;


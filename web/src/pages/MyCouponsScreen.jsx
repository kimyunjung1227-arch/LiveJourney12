import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';

const MyCouponsScreen = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('available'); // 'available' or 'used'

  // 쿠폰 데이터 (빈 상태 - 추후 백엔드 연동)
  const coupons = [];

  // 필터링된 쿠폰 (useMemo로 최적화)
  const filteredCoupons = useMemo(() =>
    filter === 'available'
      ? coupons.filter(c => c.status === 'available')
      : coupons.filter(c => c.status !== 'available'),
    [filter, coupons]
  );

  const handleUseCoupon = (coupon) => {
    if (confirm(`${coupon.name} 쿠폰을 사용하시겠습니까?`)) {
      alert('쿠폰 사용 기능은 추후 구현 예정입니다.\n\n매장에서 바코드를 제시해주세요.');
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-sm p-4 pb-2 border-b border-border-light dark:border-border-dark">
          <button
            onClick={() => navigate('/profile')}
            className="flex size-12 shrink-0 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl text-content-light dark:text-content-dark">arrow_back</span>
          </button>
          <h1 className="flex-1 text-center text-lg font-bold text-content-light dark:text-content-dark">
            내 쿠폰함
          </h1>
          <div className="size-12"></div>
        </header>

        {/* 필터 토글 */}
        <div className="flex px-4 py-3 bg-surface-light dark:bg-surface-dark">
          <div className="flex h-12 flex-1 items-center justify-center rounded-full bg-surface-subtle-light dark:bg-surface-subtle-dark p-1.5">
            <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 text-sm font-medium leading-normal transition-colors duration-200 ${filter === 'available'
                ? 'bg-primary text-white'
                : 'text-content-light dark:text-content-dark'
              }`}>
              <span className="truncate">사용 가능</span>
              <input
                className="invisible w-0"
                name="coupon-filter"
                type="radio"
                value="available"
                checked={filter === 'available'}
                onChange={() => setFilter('available')}
              />
            </label>
            <label className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 text-sm font-medium leading-normal transition-colors duration-200 ${filter === 'used'
                ? 'bg-primary text-white'
                : 'text-content-light dark:text-content-dark'
              }`}>
              <span className="truncate">사용 완료</span>
              <input
                className="invisible w-0"
                name="coupon-filter"
                type="radio"
                value="used"
                checked={filter === 'used'}
                onChange={() => setFilter('used')}
              />
            </label>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <main className="flex-grow px-4 pb-4">
          {filteredCoupons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-text-light dark:text-text-dark text-[15px] font-bold">
                {filter === 'available' ? '사용 가능한 쿠폰이 없습니다' : '사용한 쿠폰이 없습니다'}
              </p>
              <p className="text-sm text-subtle-light dark:text-subtle-dark mt-2">
                포인트 상점에서 쿠폰을 교환해보세요!
              </p>
              <button
                onClick={() => navigate('/points/shop')}
                className="mt-5 px-4 py-2 bg-primary/10 text-primary rounded-full font-semibold text-sm hover:bg-primary/15 transition-colors"
              >
                포인트 상점 가기
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {filteredCoupons.map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex flex-col rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden shadow-sm"
                >
                  <div className="flex gap-4 p-4">
                    {/* 쿠폰 이미지 */}
                    <div
                      className="w-24 h-24 shrink-0 bg-center bg-cover bg-no-repeat rounded-lg"
                      style={{ backgroundImage: `url("${coupon.image}")` }}
                    ></div>

                    {/* 쿠폰 정보 */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-content-light dark:text-content-dark mb-1">
                          {coupon.name}
                        </h3>
                        <p className="text-sm text-subtle-light dark:text-subtle-dark">
                          교환: {coupon.exchangeDate}
                        </p>
                        <p className="text-sm text-subtle-light dark:text-subtle-dark">
                          {coupon.status === 'available'
                            ? `만료: ${coupon.expiryDate}`
                            : `사용: ${coupon.usedDate}`
                          }
                        </p>
                      </div>
                      <p className="text-sm font-bold text-primary">
                        {coupon.points.toLocaleString()} P
                      </p>
                    </div>
                  </div>

                  {/* 쿠폰 사용 버튼 */}
                  {coupon.status === 'available' && (
                    <div className="border-t border-border-light dark:border-border-dark p-3 bg-surface-subtle-light dark:bg-surface-subtle-dark">
                      <button
                        onClick={() => handleUseCoupon(coupon)}
                        className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
                      >
                        쿠폰 사용하기
                      </button>
                      <p className="text-xs text-center text-subtle-light dark:text-subtle-dark mt-2">
                        바코드: {coupon.barcode}
                      </p>
                    </div>
                  )}
                  {coupon.status === 'used' && (
                    <div className="border-t border-border-light dark:border-border-dark p-3 bg-surface-subtle-light dark:bg-surface-subtle-dark">
                      <div className="text-center text-sm text-subtle-light dark:text-subtle-dark">
                        사용 완료
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MyCouponsScreen;

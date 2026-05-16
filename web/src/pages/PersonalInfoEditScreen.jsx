import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import { logger } from '../utils/logger';

const PersonalInfoEditScreen = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    birthdate: user?.birthdate || ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenderSelect = (gender) => {
    setFormData(prev => ({
      ...prev,
      gender: gender
    }));
  };

  const handleVerifyPhone = () => {
    alert('휴대폰 인증 기능은 추후 구현 예정입니다.\n\nSMS 인증 코드를 발송합니다.');
  };

  const handleSave = async () => {
    try {
      // 업데이트된 사용자 정보 생성
      const updatedUserData = {
        ...user,
        name: formData.name,
        username: formData.name, // username도 함께 업데이트
        email: formData.email,
        phone: formData.phone,
        gender: formData.gender,
        birthdate: formData.birthdate
      };
      
      // AuthContext 및 localStorage 업데이트
      updateUser(updatedUserData);
      
      // 사용자 정보 업데이트 이벤트 발생 (다른 컴포넌트에서 감지)
      window.dispatchEvent(new Event('userUpdated'));
      
      logger.debug('✅ 개인 정보 저장 완료');
      alert('개인 정보가 저장되었습니다!');
      navigate('/settings');
    } catch (error) {
      logger.error('❌ 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background-light dark:bg-background-dark">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-light bg-surface-light/80 dark:border-border-dark dark:bg-surface-dark/80 backdrop-blur-sm px-4">
        <button 
          onClick={() => navigate('/settings')}
          className="flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-2xl text-black dark:text-white">
            arrow_back
          </span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-black dark:text-white">
          개인 정보 수정
        </h1>
        <button 
          onClick={handleSave}
          className="flex size-12 shrink-0 items-center justify-end text-base font-bold text-black dark:text-white hover:text-black/80 dark:hover:text-white/80 transition-colors"
        >
          저장
        </button>
      </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-grow pb-4">
        {/* 기본 정보 섹션 */}
        <div className="flex flex-col gap-4 p-4">
          {/* 이름 */}
          <div className="flex flex-col gap-2">
            <label 
              className="text-sm font-medium text-black dark:text-white" 
              htmlFor="name"
            >
              이름
            </label>
            <input 
              className="w-full rounded-lg border border-border-light bg-surface-light p-3 text-black placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white dark:placeholder:text-gray-500 transition-all" 
              id="name"
              name="name"
              placeholder="이름을 입력하세요" 
              type="text" 
              value={formData.name}
              onChange={handleInputChange}
            />
          </div>

          {/* 이메일 */}
          <div className="flex flex-col gap-2">
            <label 
              className="text-sm font-medium text-black dark:text-white" 
              htmlFor="email"
            >
              이메일
            </label>
            <input 
              className="w-full rounded-lg border border-border-light bg-surface-light p-3 text-black placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white dark:placeholder:text-gray-500 transition-all" 
              id="email"
              name="email"
              placeholder="이메일을 입력하세요" 
              type="email" 
              value={formData.email}
              onChange={handleInputChange}
            />
            <p className="text-xs text-black/70 dark:text-white/70">
              이메일 변경 시, 재인증이 필요합니다.
            </p>
          </div>

          {/* 휴대폰 번호 */}
          <div className="flex flex-col gap-2">
            <label 
              className="text-sm font-medium text-black dark:text-white" 
              htmlFor="phone"
            >
              휴대폰 번호
            </label>
            <div className="flex items-center gap-2">
              <input 
                className="w-full flex-grow rounded-lg border border-border-light bg-surface-light p-3 text-black placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white dark:placeholder:text-gray-500 transition-all" 
                id="phone"
                name="phone"
                placeholder="휴대폰 번호를 입력하세요" 
                type="tel" 
                value={formData.phone}
                onChange={handleInputChange}
              />
              <button 
                onClick={handleVerifyPhone}
                className="flex-shrink-0 rounded-lg bg-surface-subtle-light px-4 py-3 text-sm font-medium text-black dark:bg-surface-subtle-dark dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                인증
              </button>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-2 bg-background-light dark:bg-background-dark"></div>

        {/* 추가 정보 섹션 */}
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-lg font-bold text-black dark:text-white">
            기본 정보
          </h2>

          {/* 성별 */}
          <div className="flex flex-col gap-2">
            <label 
              className="text-sm font-medium text-black dark:text-white"
            >
              성별
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleGenderSelect('male')}
                className={`rounded-lg border py-3 text-center font-medium transition-all ${
                  formData.gender === 'male'
                    ? 'border-primary bg-primary/10 text-primary font-bold dark:bg-primary/20'
                    : 'border-border-light bg-surface-light text-black dark:border-border-dark dark:bg-surface-dark dark:text-white'
                }`}
              >
                남성
              </button>
              <button 
                onClick={() => handleGenderSelect('female')}
                className={`rounded-lg border py-3 text-center font-medium transition-all ${
                  formData.gender === 'female'
                    ? 'border-primary bg-primary/10 text-primary font-bold dark:bg-primary/20'
                    : 'border-border-light bg-surface-light text-black dark:border-border-dark dark:bg-surface-dark dark:text-white'
                }`}
              >
                여성
              </button>
            </div>
          </div>

          {/* 생년월일 */}
          <div className="flex flex-col gap-2">
            <label 
              className="text-sm font-medium text-black dark:text-white" 
              htmlFor="birthdate"
            >
              생년월일
            </label>
            <div className="relative">
              <input 
                className="w-full rounded-lg border border-border-light bg-surface-light p-3 pr-10 text-black placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-white dark:placeholder:text-gray-500 transition-all" 
                id="birthdate"
                name="birthdate"
                type="text" 
                value={formData.birthdate}
                onChange={handleInputChange}
              />
              <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/70 dark:text-white/70">
                calendar_today
              </span>
            </div>
          </div>
        </div>
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default PersonalInfoEditScreen;




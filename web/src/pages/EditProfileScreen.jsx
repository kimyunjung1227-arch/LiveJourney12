import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import { logger } from '../utils/logger';
import { setCachedFollowProfile } from '../utils/userProfileHints';

const EditProfileScreen = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const savedUser = user || {};

  const [formData, setFormData] = useState({
    username: savedUser?.username || user?.username || '',
    email: savedUser?.email || user?.email || 'mosamo@example.com',
    bio: savedUser?.bio || user?.bio || '',
    level: 'Lv. 5 Traveler'
  });

  // 기본 프로필 이미지
  const DEFAULT_PROFILE_IMAGE = 'default';

  const [profileImage, setProfileImage] = useState(
    savedUser?.profileImage ||
    user?.profileImage ||
    DEFAULT_PROFILE_IMAGE
  );
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = () => {
    setShowImageOptions(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 파일 크기 체크 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.');
        return;
      }

      // 이미지 파일 타입 체크
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.');
        return;
      }

      // 파일 미리보기
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
        setShowImageOptions(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGallerySelect = () => {
    fileInputRef.current?.click();
    setShowImageOptions(false);
  };

  const handleCameraCapture = () => {
    // 카메라 기능은 모바일 환경에서 작동
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
    setShowImageOptions(false);
  };

  const handleDefaultImage = () => {
    setProfileImage(DEFAULT_PROFILE_IMAGE);
    setShowImageOptions(false);
  };

  const handleSave = async () => {
    // 닉네임 유효성 검사
    const trimmedUsername = formData.username.trim();

    if (!trimmedUsername) {
      alert('닉네임을 입력해주세요.');
      return;
    }

    if (trimmedUsername.length < 2) {
      alert('닉네임은 2글자 이상이어야 합니다.');
      return;
    }

    if (trimmedUsername.length > 20) {
      alert('닉네임은 20글자 이하여야 합니다.');
      return;
    }

    // 닉네임 특수문자 검사 (한글, 영문, 숫자, 공백만 허용)
    const usernameRegex = /^[가-힣a-zA-Z0-9\s]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      alert('닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.');
      return;
    }

    // 연속된 공백 체크
    if (trimmedUsername.includes('  ')) {
      alert('닉네임에 연속된 공백을 사용할 수 없습니다.');
      return;
    }

    if (!formData.email.trim()) {
      alert('이메일을 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('올바른 이메일 형식이 아닙니다.');
      return;
    }

    if (formData.bio.length > 150) {
      alert('자기소개는 150자 이하로 입력해주세요.');
      return;
    }

    try {
      const currentUser = user || {};

      // 업데이트된 사용자 정보 (닉네임은 trim된 값 사용)
      const updatedUser = {
        ...currentUser,
        username: trimmedUsername,
        email: formData.email.trim(),
        bio: formData.bio.trim(),
        profileImage: profileImage, // 프로필 이미지 저장! ✨
      };

      // AuthContext 업데이트
      if (updateUser) {
        updateUser(updatedUser);
      }

      // 댓글/피드 등에서 작성자 표시 최신화 힌트 저장
      if (updatedUser?.id) {
        setCachedFollowProfile(updatedUser.id, {
          username: updatedUser.username,
          profileImage: updatedUser.profileImage && updatedUser.profileImage !== 'default' ? updatedUser.profileImage : null,
        });
      }

      // userUpdated 이벤트 발생 (다른 컴포넌트에서 감지)
      window.dispatchEvent(new Event('userUpdated'));

      logger.log('✅ 프로필 저장 완료:', updatedUser);

      setShowSuccessModal(true);

      // 2초 후 프로필 화면으로 이동
      setTimeout(() => {
        setShowSuccessModal(false);
        navigate('/profile');
      }, 2000);
    } catch (error) {
      logger.error('프로필 저장 실패:', error);
      alert('프로필 저장에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    navigate('/profile');
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-4 pb-2 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={handleCancel}
            className="flex size-12 shrink-0 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-gray-900 dark:text-gray-100">close</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">프로필 편집</h1>
          <button
            onClick={handleSave}
            className="flex h-12 items-center justify-center px-4 text-primary font-bold hover:text-primary/80 transition-colors"
          >
            저장
          </button>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-grow pb-4">
          {/* 프로필 사진 섹션 */}
          <div className="flex flex-col items-center justify-center py-8 bg-white dark:bg-gray-900">
            <div className="relative">
              {profileImage === DEFAULT_PROFILE_IMAGE ? (
                <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-7xl">person</span>
                </div>
              ) : (
                <div
                  className="w-32 h-32 rounded-full bg-cover bg-center bg-no-repeat border-4 border-white dark:border-gray-800 shadow-lg"
                  style={{ backgroundImage: `url("${profileImage}")` }}
                ></div>
              )}
              <button
                onClick={handleImageChange}
                className="absolute bottom-0 right-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">photo_camera</span>
              </button>
            </div>
            <button
              onClick={handleImageChange}
              className="mt-4 text-primary text-sm font-semibold hover:text-primary/80 transition-colors"
            >
              프로필 사진 변경
            </button>
          </div>

          {/* 구분선 */}
          <div className="h-2 bg-background-light dark:bg-background-dark"></div>

          {/* 입력 폼 섹션 */}
          <div className="bg-white dark:bg-gray-900">
            <div className="px-4 py-4 space-y-6">
              {/* 닉네임 */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  닉네임 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  placeholder="닉네임을 입력하세요 (2-20자)"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    한글, 영문, 숫자만 사용 가능 (공백 포함 가능)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.username.length} / 20
                  </p>
                </div>
              </div>





              {/* 자기소개 */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                  자기소개
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                  placeholder="자기소개를 입력하세요"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {formData.bio.length} / 150
                </p>
              </div>
            </div>
          </div>

          {/* 하단 여백 */}
          <div className="h-8"></div>
        </main>
      </div>

      <BottomNavigation />

      {/* 저장 성공 모달 */}
      {showSuccessModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-scale-up">
            {/* 성공 아이콘 */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-5xl">
                    check_circle
                  </span>
                </div>
                {/* 펄스 애니메이션 */}
                <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping"></div>
              </div>
            </div>

            {/* 메시지 */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                저장 완료!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                프로필이 성공적으로 업데이트되었습니다
              </p>
            </div>

            {/* 프로그레스 바 */}
            <div className="mt-6">
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-progress"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 사진 변경 옵션 모달 */}
      {showImageOptions && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
          <div className="w-full max-w-sm transform flex-col rounded-xl bg-white dark:bg-[#221910] p-5 shadow-2xl transition-all">
            {/* 제목 */}
            <h1 className="text-[#181411] dark:text-gray-100 text-[22px] font-bold leading-tight tracking-[-0.015em] text-center pb-3 pt-1">
              프로필 사진 변경
            </h1>

            {/* 설명 */}
            <p className="text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal pb-4 text-center">
              원하는 방법을 선택하세요
            </p>

            {/* 옵션 버튼들 */}
            <div className="flex flex-col gap-2 pb-4">
              <button
                onClick={handleGallerySelect}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>photo_library</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">갤러리에서 선택</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">기존 사진을 선택합니다</p>
                </div>
                <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
              </button>

              <button
                onClick={handleCameraCapture}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>photo_camera</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">카메라로 찍기</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">새로운 사진을 촬영합니다</p>
                </div>
                <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
              </button>

              <button
                onClick={handleDefaultImage}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700">
                  <span className="material-symbols-outlined text-gray-600 dark:text-gray-300" style={{ fontSize: '20px' }}>person</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">기본 이미지로 변경</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">기본 프로필 사진으로 설정</p>
                </div>
                <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
              </button>
            </div>

            {/* 취소 버튼 */}
            <button
              onClick={() => setShowImageOptions(false)}
              className="w-full min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-gray-200 dark:bg-gray-700 text-[#181411] dark:text-gray-200 text-base font-bold leading-normal tracking-[0.015em] hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex"
            >
              <span className="truncate">취소</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfileScreen;












































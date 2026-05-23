import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconX,
  IconCamera,
  IconUser,
  IconPhoto,
  IconCameraPlus,
  IconUserCircle,
  IconChevronRight,
  IconCheck,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import { logger } from '../utils/logger';
import { setCachedFollowProfile } from '../utils/userProfileHints';

const KEY = '#4DB8E8';
const KEY_DARK = '#1A6EA8';
const KEY_LIGHT = '#E8F4FB';
const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const TEXT_TERTIARY = '#B8B8B8';
const BORDER_LIGHT = '#E8E8E8';
const SURFACE_SOFT = '#F7F9FB';
const DANGER = '#E0556C';
const SUCCESS = '#3FB872';
const GRADIENT = 'linear-gradient(135deg, #4DB8E8, #1A6EA8)';

const DEFAULT_PROFILE_IMAGE = 'default';
const USERNAME_REGEX = /^[가-힣a-zA-Z0-9\s]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EditProfileScreen = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const savedUser = user || {};

  const [formData, setFormData] = useState({
    username: savedUser?.username || '',
    email: savedUser?.email || 'mosamo@example.com',
    bio: savedUser?.bio || '',
  });

  const [profileImage, setProfileImage] = useState(
    savedUser?.profileImage || DEFAULT_PROFILE_IMAGE
  );
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState({ username: '', email: '', bio: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result);
      setShowImageOptions(false);
    };
    reader.readAsDataURL(file);
  };

  const handleGallerySelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
    setShowImageOptions(false);
  };

  const handleCameraCapture = () => {
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

  const validate = () => {
    const next = { username: '', email: '', bio: '' };
    const trimmedUsername = formData.username.trim();

    if (!trimmedUsername) next.username = '닉네임을 입력해주세요.';
    else if (trimmedUsername.length < 2) next.username = '닉네임은 2글자 이상이어야 합니다.';
    else if (trimmedUsername.length > 20) next.username = '닉네임은 20글자 이하여야 합니다.';
    else if (!USERNAME_REGEX.test(trimmedUsername))
      next.username = '한글, 영문, 숫자만 사용할 수 있어요.';
    else if (trimmedUsername.includes('  '))
      next.username = '연속된 공백은 사용할 수 없어요.';

    if (!formData.email.trim()) next.email = '이메일을 입력해주세요.';
    else if (!EMAIL_REGEX.test(formData.email)) next.email = '올바른 이메일 형식이 아니에요.';

    if (formData.bio.length > 150) next.bio = '자기소개는 150자 이하로 입력해주세요.';

    setErrors(next);
    return !next.username && !next.email && !next.bio;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      const trimmedUsername = formData.username.trim();
      const updatedUser = {
        ...(user || {}),
        username: trimmedUsername,
        email: formData.email.trim(),
        bio: formData.bio.trim(),
        profileImage,
      };

      if (updateUser) updateUser(updatedUser);

      if (updatedUser?.id) {
        setCachedFollowProfile(updatedUser.id, {
          username: updatedUser.username,
          profileImage:
            updatedUser.profileImage && updatedUser.profileImage !== DEFAULT_PROFILE_IMAGE
              ? updatedUser.profileImage
              : null,
        });
      }

      window.dispatchEvent(new Event('userUpdated'));
      logger.log('✅ 프로필 저장 완료:', updatedUser);

      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        navigate('/profile');
      }, 1600);
    } catch (error) {
      logger.error('프로필 저장 실패:', error);
      alert('프로필 저장에 실패했습니다.');
    }
  };

  const handleCancel = () => navigate('/profile');

  const usernameTrimmed = formData.username.trim();
  const canSave =
    usernameTrimmed.length >= 2 &&
    usernameTrimmed.length <= 20 &&
    formData.email.trim().length > 0 &&
    formData.bio.length <= 150;

  return (
    <div
      className="flex w-full flex-col overflow-hidden relative"
      style={{ height: '100dvh', background: SURFACE_SOFT }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* 헤더 */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'saturate(180%) blur(10px)',
            WebkitBackdropFilter: 'saturate(180%) blur(10px)',
            padding: '10px 12px',
            borderBottom: `1px solid ${BORDER_LIGHT}`,
          }}
        >
          <button
            onClick={handleCancel}
            aria-label="닫기"
            className="flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <IconX size={22} color={TEXT_PRIMARY} stroke={2} />
          </button>
          <h1
            className="m-0"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              letterSpacing: -0.2,
            }}
          >
            프로필 편집
          </h1>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center justify-center"
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              background: canSave ? GRADIENT : '#D9DEE3',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'opacity .15s ease',
              opacity: canSave ? 1 : 0.85,
            }}
          >
            저장
          </button>
        </header>

        <main className="flex-grow" style={{ paddingBottom: 24 }}>
          {/* 프로필 사진 섹션 */}
          <section
            style={{
              background: 'white',
              padding: '28px 16px 22px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div className="relative" style={{ width: 108, height: 108 }}>
              <div
                className="flex items-center justify-center overflow-hidden"
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 999,
                  background: profileImage === DEFAULT_PROFILE_IMAGE ? KEY_LIGHT : KEY,
                  boxShadow: '0 6px 18px rgba(26,110,168,0.18)',
                }}
              >
                {profileImage === DEFAULT_PROFILE_IMAGE ? (
                  <IconUser size={56} color={KEY_DARK} stroke={1.6} />
                ) : (
                  <img
                    src={profileImage}
                    alt=""
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              <button
                onClick={() => setShowImageOptions(true)}
                aria-label="프로필 사진 변경"
                className="absolute flex items-center justify-center"
                style={{
                  right: -2,
                  bottom: -2,
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: GRADIENT,
                  border: '3px solid white',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                  cursor: 'pointer',
                }}
              >
                <IconCamera size={16} color="white" stroke={2.2} />
              </button>
            </div>

            <button
              onClick={() => setShowImageOptions(true)}
              style={{
                marginTop: 14,
                background: 'transparent',
                border: 'none',
                color: KEY_DARK,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              프로필 사진 변경
            </button>
          </section>

          {/* 입력 폼 */}
          <section
            style={{
              background: 'white',
              marginTop: 10,
              padding: '20px 16px 4px',
            }}
          >
            {/* 닉네임 */}
            <FieldGroup
              label="닉네임"
              required
              hint="한글, 영문, 숫자 사용 가능"
              counter={`${formData.username.length} / 20`}
              error={errors.username}
            >
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                maxLength={20}
                placeholder="닉네임 (2-20자)"
                style={inputStyle(errors.username)}
              />
            </FieldGroup>

            {/* 이메일 */}
            <FieldGroup label="이메일" required error={errors.email}>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="example@email.com"
                style={inputStyle(errors.email)}
              />
            </FieldGroup>

            {/* 자기소개 */}
            <FieldGroup
              label="자기소개"
              counter={`${formData.bio.length} / 150`}
              error={errors.bio}
            >
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                placeholder="지금, 당신의 여행을 한 줄로 소개해보세요"
                style={{
                  ...inputStyle(errors.bio),
                  resize: 'none',
                  lineHeight: 1.55,
                  padding: '12px 14px',
                }}
              />
            </FieldGroup>
          </section>

          <div style={{ height: 24 }} />
        </main>
      </div>

      <BottomNavigation />

      {/* 저장 성공 모달 */}
      {showSuccessModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', padding: 16 }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              padding: '28px 24px',
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
              textAlign: 'center',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: KEY_LIGHT,
                margin: '0 auto 16px',
              }}
            >
              <IconCheck size={32} color={SUCCESS} stroke={3} />
            </div>
            <h3
              className="m-0"
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                marginBottom: 6,
              }}
            >
              저장 완료!
            </h3>
            <p
              className="m-0"
              style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}
            >
              프로필이 업데이트되었어요
            </p>
            <div
              style={{
                marginTop: 18,
                height: 3,
                borderRadius: 999,
                background: '#EEF2F5',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: GRADIENT,
                  animation: 'editProfileProgress 1.6s linear forwards',
                  transformOrigin: 'left',
                }}
              />
            </div>
            <style>{`
              @keyframes editProfileProgress {
                from { transform: scaleX(0); }
                to { transform: scaleX(1); }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* 사진 변경 옵션 시트 */}
      {showImageOptions && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowImageOptions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '18px 16px 22px',
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 -8px 28px rgba(0,0,0,0.14)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: '#DDE2E7',
                margin: '0 auto 14px',
              }}
            />
            <h2
              className="m-0"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              프로필 사진 변경
            </h2>
            <p
              className="m-0"
              style={{
                fontSize: 12,
                color: TEXT_SECONDARY,
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              원하는 방법을 선택하세요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SheetOption
                icon={<IconPhoto size={18} color={KEY_DARK} stroke={2} />}
                title="갤러리에서 선택"
                subtitle="기기에 있는 사진을 가져옵니다"
                onClick={handleGallerySelect}
              />
              <SheetOption
                icon={<IconCameraPlus size={18} color={KEY_DARK} stroke={2} />}
                title="카메라로 찍기"
                subtitle="새로운 사진을 촬영합니다"
                onClick={handleCameraCapture}
              />
              <SheetOption
                icon={<IconUserCircle size={18} color={TEXT_SECONDARY} stroke={2} />}
                title="기본 이미지로 변경"
                subtitle="기본 프로필 사진으로 설정"
                onClick={handleDefaultImage}
                muted
              />
            </div>

            <button
              onClick={() => setShowImageOptions(false)}
              style={{
                marginTop: 14,
                width: '100%',
                height: 48,
                borderRadius: 12,
                background: SURFACE_SOFT,
                color: TEXT_PRIMARY,
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function FieldGroup({ label, required, hint, counter, error, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 8 }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            letterSpacing: -0.1,
          }}
        >
          {label}
          {required && (
            <span style={{ color: DANGER, marginLeft: 4 }}>*</span>
          )}
        </label>
        {counter && (
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>{counter}</span>
        )}
      </div>
      {children}
      <div style={{ marginTop: 6, minHeight: 16 }}>
        {error ? (
          <p
            className="m-0"
            style={{ fontSize: 11, color: DANGER, fontWeight: 600 }}
          >
            {error}
          </p>
        ) : hint ? (
          <p className="m-0" style={{ fontSize: 11, color: TEXT_TERTIARY }}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function inputStyle(hasError) {
  return {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: `1.5px solid ${hasError ? DANGER : BORDER_LIGHT}`,
    background: 'white',
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color .15s ease, box-shadow .15s ease',
    boxSizing: 'border-box',
  };
}

function SheetOption({ icon, title, subtitle, onClick, muted }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        background: SURFACE_SOFT,
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          background: muted ? '#EDEFF2' : KEY_LIGHT,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="m-0"
          style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}
        >
          {title}
        </p>
        <p
          className="m-0"
          style={{ fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 }}
        >
          {subtitle}
        </p>
      </div>
      <IconChevronRight size={18} color={TEXT_TERTIARY} stroke={2} />
    </button>
  );
}

export default EditProfileScreen;

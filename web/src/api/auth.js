import api from './axios';
import { logger } from '../utils/logger';

// 로그인 / 회원가입
export const login = async (username) => {
  try {
    const response = await api.post('/auth/login', { username });
    return response.data;
  } catch (error) {
    logger.error('로그인 실패:', error);
    throw error;
  }
};

// 사용자 정보 조회
export const getMe = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    logger.error('사용자 정보 조회 실패:', error);
    throw error;
  }
};

// 로그아웃
export const logout = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error) {
    logger.warn('로그아웃 실패(무시):', error?.message || error);
    return { success: false };
  }
};

// 사용자 프로필 업데이트
export const updateProfile = async (userId, profileData) => {
  try {
    const response = await api.put(`/users/${userId}`, profileData);
    return response.data;
  } catch (error) {
    logger.error('프로필 업데이트 실패:', error);
    throw error;
  }
};

// 사용자 정보 조회 (ID로)
export const getUser = async (userId) => {
  try {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    logger.error('사용자 조회 실패:', error);
    throw error;
  }
};



























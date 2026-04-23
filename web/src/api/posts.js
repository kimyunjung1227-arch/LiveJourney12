import api from './axios';
import { logger } from '../utils/logger';

// 게시물 목록 조회
export const getPosts = async (params = {}) => {
  try {
    const response = await api.get('/posts', { params });
    return response.data;
  } catch (error) {
    // 백엔드 없이도 작동하도록 조용히 처리
    const status = error?.response?.status;
    if (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ERR_CONNECTION_REFUSED' ||
      status === 404
    ) {
      // 개발 모드에서만 로그 출력
      if (import.meta.env.MODE === 'development') {
        logger.log('💡 게시물 REST API 사용 불가(404/미연결) — Supabase/로컬로 대체');
      }
      return { success: false, posts: [] };
    }
    console.error('게시물 조회 실패:', error);
    throw error;
  }
};

// 태그 목록 조회
export const getTags = async () => {
  try {
    const response = await api.get('/posts/tags');
    return response.data;
  } catch (error) {
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false, tags: [] };
    }
    console.error('태그 조회 실패:', error);
    throw error;
  }
};

// 게시물 상세 조회
export const getPost = async (postId) => {
  try {
    const response = await api.get(`/posts/${postId}`);
    return response.data;
  } catch (error) {
    // 네트워크 오류는 조용히 처리
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false, post: null };
    }
    logger.error('게시물 상세 조회 실패:', error);
    throw error;
  }
};

// 게시물 작성
export const createPost = async (postData) => {
  try {
    const response = await api.post('/posts', postData);
    return response.data;
  } catch (error) {
    // 네트워크 오류는 조용히 처리
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false };
    }
    console.error('게시물 작성 실패:', error);
    throw error;
  }
};

// 좋아요
export const likePost = async (postId) => {
  try {
    const response = await api.post(`/posts/${postId}/like`);
    return response.data;
  } catch (error) {
    // 네트워크 오류는 조용히 처리
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false };
    }
    console.error('좋아요 실패:', error);
    throw error;
  }
};

// 댓글 작성
export const addComment = async (postId, content) => {
  try {
    const response = await api.post(`/posts/${postId}/comment`, { content });
    return response.data;
  } catch (error) {
    // 네트워크 오류는 조용히 처리
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false };
    }
    logger.error('댓글 작성 실패:', error);
    throw error;
  }
};

// 질문 작성
export const addQuestion = async (postId, question) => {
  try {
    const response = await api.post(`/posts/${postId}/question`, { question });
    return response.data;
  } catch (error) {
    // 네트워크 오류는 조용히 처리
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false };
    }
    logger.error('질문 작성 실패:', error);
    throw error;
  }
};

// 질문 답변
export const answerQuestion = async (questionId, answer) => {
  try {
    const response = await api.post(`/posts/questions/${questionId}/answer`, { answer });
    return response.data;
  } catch (error) {
    // 네트워크 오류는 조용히 처리
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
      return { success: false };
    }
    logger.error('답변 작성 실패:', error);
    throw error;
  }
};
















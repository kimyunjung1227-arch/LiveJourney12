/**
 * (서버 운영 전환) localStorage 제거
 * - 과거 로컬 캐시/목업 데이터 호환용 API는 유지하되, 브라우저 저장소에는 접근하지 않습니다.
 * - 필요한 경우에만 런타임 메모리(Map)로 최소 동작을 제공합니다(새로고침 시 초기화).
 */

import { logger } from './logger';

const memoryStore = new Map();

// uploadedPosts 안전 로드 (새로고침 후에는 비어있음)
export const getUploadedPostsSafe = () => {
  const v = memoryStore.get('uploadedPosts');
  return Array.isArray(v) ? v : [];
};

// 저장소 사용 용량 확인 (bytes) — memoryStore 기준
export const getLocalStorageSize = () => {
  let total = 0;
  try {
    for (const [k, v] of memoryStore.entries()) {
      total += String(k).length + JSON.stringify(v || '').length;
    }
  } catch (error) {
    logger.error('memoryStore 크기 계산 오류:', error);
  }
  return Math.max(0, total);
};

// 저장소 사용 용량 확인 (MB)
export const getLocalStorageSizeMB = () => {
  return (getLocalStorageSize() / (1024 * 1024)).toFixed(2);
};

// 오래된 사용자 게시물 정리 (메모리 기반)
export const cleanOldUserPosts = (daysToKeep = 30) => {
  try {
    const posts = getUploadedPostsSafe();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const recentPosts = posts.filter(post => {
      if (!post.createdAt) return true; // 날짜 정보가 없으면 유지
      const postDate = new Date(post.createdAt);
      return postDate >= cutoffDate;
    });
    
    if (recentPosts.length < posts.length) {
      memoryStore.set('uploadedPosts', recentPosts);
      console.log(`✅ 오래된 게시물 정리 완료: ${posts.length}개 → ${recentPosts.length}개 (${posts.length - recentPosts.length}개 삭제)`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('오래된 게시물 정리 실패:', error);
    return false;
  }
};

// 게시물 수 제한 (메모리 기반)
export const limitPostsCount = (maxCount = 100) => {
  try {
    const posts = getUploadedPostsSafe();
    
    if (posts.length > maxCount) {
      // 최신 게시물만 유지 (날짜 기준 정렬)
      const sortedPosts = posts.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // 최신순
      });
      
      const limitedPosts = sortedPosts.slice(0, maxCount);
      memoryStore.set('uploadedPosts', limitedPosts);
      logger.log(`✅ 게시물 수 제한 적용: ${posts.length}개 → ${limitedPosts.length}개`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('게시물 수 제한 실패:', error);
    return false;
  }
};

// 과거 테스트/목업 게시물 정리
// - Supabase 연동 이전에 사용하던 userId(예: 'test_user_001') 등을 가진 게시물을 정리
// - 현재는 Supabase OAuth 사용자(UUID 형식)만 남기고 나머지는 삭제
const isValidUuid = (value) => {
  if (typeof value !== 'string') return false;
  // 간단한 UUID v4 패턴 검사
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
};

export const cleanLegacyUploadedPosts = () => {
  try {
    const posts = getUploadedPostsSafe();
    if (!Array.isArray(posts) || posts.length === 0) return false;

    const cleaned = posts.filter((post) => {
      const uid =
        post.userId ||
        (typeof post.user === 'string' ? post.user : post.user?.id) ||
        null;

      // 사용자 정보가 없거나 UUID 형식이 아니면 과거 목업/테스트 데이터로 간주하고 제거
      if (!uid) return false;
      if (!isValidUuid(String(uid))) return false;
      return true;
    });

    if (cleaned.length !== posts.length) {
      memoryStore.set('uploadedPosts', cleaned);
      logger.log(`🧹 legacy uploadedPosts 정리: ${posts.length}개 → ${cleaned.length}개`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('legacy uploadedPosts 정리 실패:', error);
    return false;
  }
};

// 과거에 사용하던 목업 데이터 정리용 함수들
// 현재는 실제 사용자 데이터만 사용하지만,
// safeSetItem 내부에서 호출하므로 안전하게 no-op 수준으로 구현
export const cleanOldMockData = () => {
  try {
    memoryStore.delete('MOCK_POSTS');
    memoryStore.delete('mockPosts');
    return true;
  } catch (error) {
    logger.error('Mock 데이터 정리 실패:', error);
    return false;
  }
};

export const clearAllMockData = () => {
  try {
    memoryStore.delete('MOCK_POSTS');
    memoryStore.delete('mockPosts');
    logger.log('🗑️ 모든 Mock 데이터 삭제 완료');
    return { success: true };
  } catch (error) {
    logger.error('Mock 데이터 삭제 실패:', error);
    return { success: false, error: error.message };
  }
};

// 안전 저장 (메모리 기반)
export const safeSetItem = (key, value) => {
  try {
    // JSON 문자열로 들어오는 경우도 있어 최대한 호환
    const normalized =
      typeof value === 'string'
        ? (() => {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          })()
        : value;
    memoryStore.set(String(key), normalized);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.name,
      message: error.message 
    };
  }
};

// 모든 게시물 데이터 완전 삭제 (목업 데이터 포함)
export const clearAllPostsData = () => {
  try {
    memoryStore.delete('uploadedPosts');
    logger.log('🗑️ 모든 게시물 데이터 삭제 완료 (목업 데이터 포함)');
    return { success: true };
  } catch (error) {
    logger.error('게시물 데이터 삭제 실패:', error);
    return { success: false, error: error.message };
  }
};

// 모든 사진 데이터 완전 삭제 (이미지 URL, base64 등 모든 이미지 데이터 제거)
export const removeAllImageData = () => {
  try {
    const posts = getUploadedPostsSafe();
    let removedCount = 0;
    let totalImagesRemoved = 0;
    
    const cleanedPosts = posts.map(post => {
      const hasImages = (post.images && post.images.length > 0) || 
                       (post.videos && post.videos.length > 0) ||
                       (post.image && post.image) ||
                       (post.thumbnail && post.thumbnail);
      
      if (hasImages) {
        removedCount++;
        const imageCount = (post.images?.length || 0) + (post.videos?.length || 0);
        totalImagesRemoved += imageCount;
      }
      
      // 모든 이미지 관련 데이터 제거
      const cleaned = {
        ...post,
        images: [],
        videos: [],
        image: null,
        thumbnail: null,
        imageCount: 0,
        videoCount: 0
      };
      
      // imageFiles, videoFiles 같은 파일 참조도 제거
      delete cleaned.imageFiles;
      delete cleaned.videoFiles;
      
      return cleaned;
    });
    
    memoryStore.set('uploadedPosts', cleanedPosts);
    logger.log(`🗑️ 모든 사진 데이터 삭제 완료: ${removedCount}개 게시물에서 ${totalImagesRemoved}개의 이미지/동영상 제거`);
    return { 
      success: true, 
      postsCleaned: removedCount, 
      imagesRemoved: totalImagesRemoved 
    };
  } catch (error) {
    logger.error('사진 데이터 삭제 실패:', error);
    return { success: false, error: error.message };
  }
};

// 상태 로깅 (memoryStore)
export const logLocalStorageStatus = () => {
  try {
    const sizeMB = getLocalStorageSizeMB();
    const posts = getUploadedPostsSafe();
    const postsSizeMB = (JSON.stringify(posts).length / (1024 * 1024)).toFixed(2);

    console.log('📊 memoryStore 상태:');
    console.log(`   - 전체 사용 용량: ${sizeMB} MB`);
    console.log(`   - uploadedPosts 용량: ${postsSizeMB} MB`);
    console.log(`   - 전체 게시물: ${posts.length}개`);
    
    // 가장 큰 항목 찾기
    let largestKey = '';
    let largestSize = 0;
    for (const [key, val] of memoryStore.entries()) {
      const size = JSON.stringify(val || '').length;
      if (size > largestSize) {
        largestSize = size;
        largestKey = String(key);
      }
    }
    console.log(`   - 가장 큰 항목: ${largestKey} (${(largestSize / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (error) {
    console.error('memoryStore 상태 로깅 오류:', error);
  }
};






















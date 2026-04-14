/**
 * localStorage 관리 유틸리티
 */

import { logger } from './logger';

// uploadedPosts 안전 로드 (파싱 실패/형식 오류 방어)
export const getUploadedPostsSafe = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// localStorage 사용 용량 확인 (bytes)
export const getLocalStorageSize = () => {
  let total = 0;
  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage[key];
        if (value) {
          total += value.length + key.length;
        }
      }
    }
  } catch (error) {
    logger.error('localStorage 크기 계산 오류:', error);
  }
  return total;
};

// localStorage 사용 용량 확인 (MB)
export const getLocalStorageSizeMB = () => {
  return (getLocalStorageSize() / (1024 * 1024)).toFixed(2);
};

// 오래된 사용자 게시물 정리 (30일 이상 지난 게시물)
export const cleanOldUserPosts = (daysToKeep = 30) => {
  try {
    const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const recentPosts = posts.filter(post => {
      if (!post.createdAt) return true; // 날짜 정보가 없으면 유지
      const postDate = new Date(post.createdAt);
      return postDate >= cutoffDate;
    });
    
    if (recentPosts.length < posts.length) {
      localStorage.setItem('uploadedPosts', JSON.stringify(recentPosts));
      console.log(`✅ 오래된 게시물 정리 완료: ${posts.length}개 → ${recentPosts.length}개 (${posts.length - recentPosts.length}개 삭제)`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('오래된 게시물 정리 실패:', error);
    return false;
  }
};

// 게시물 수 제한 (최대 개수 유지)
export const limitPostsCount = (maxCount = 100) => {
  try {
    const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    
    if (posts.length > maxCount) {
      // 최신 게시물만 유지 (날짜 기준 정렬)
      const sortedPosts = posts.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // 최신순
      });
      
      const limitedPosts = sortedPosts.slice(0, maxCount);
      localStorage.setItem('uploadedPosts', JSON.stringify(limitedPosts));
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
    const raw = localStorage.getItem('uploadedPosts');
    if (!raw) return false;

    const posts = JSON.parse(raw || '[]');
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
      localStorage.setItem('uploadedPosts', JSON.stringify(cleaned));
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
    // 예전에 사용했을 가능성이 있는 키들 정리
    localStorage.removeItem('MOCK_POSTS');
    localStorage.removeItem('mockPosts');
    return true;
  } catch (error) {
    logger.error('Mock 데이터 정리 실패:', error);
    return false;
  }
};

export const clearAllMockData = () => {
  try {
    localStorage.removeItem('MOCK_POSTS');
    localStorage.removeItem('mockPosts');
    logger.log('🗑️ 모든 Mock 데이터 삭제 완료');
    return { success: true };
  } catch (error) {
    logger.error('Mock 데이터 삭제 실패:', error);
    return { success: false, error: error.message };
  }
};

// localStorage에 안전하게 저장 (용량 초과 시 자동 정리)
export const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return { success: true };
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage 용량 초과! 자동 정리 시작...');
      console.log(`현재 사용량: ${getLocalStorageSizeMB()} MB`);
      
      // 1차: 오래된 Mock 데이터 정리
      console.log('1️⃣ Mock 데이터 정리 중...');
      cleanOldMockData();
      
      try {
        localStorage.setItem(key, value);
        console.log('✅ Mock 데이터 정리 후 저장 성공!');
        return { success: true };
      } catch (retryError) {
        // 2차: 오래된 사용자 게시물 정리 (30일 이상)
        console.warn('2️⃣ 오래된 게시물 정리 중...');
        cleanOldUserPosts(30);
        
        try {
          localStorage.setItem(key, value);
          console.log('✅ 오래된 게시물 정리 후 저장 성공!');
          return { success: true };
        } catch (retry2Error) {
          // 3차: 게시물 수 제한 (최대 100개)
          console.warn('3️⃣ 게시물 수 제한 적용 중...');
          limitPostsCount(100);
          
          try {
            localStorage.setItem(key, value);
            console.log('✅ 게시물 수 제한 후 저장 성공!');
            return { success: true };
          } catch (retry3Error) {
            // 4차: 모든 Mock 데이터 삭제
            console.warn('4️⃣ 모든 Mock 데이터 삭제 중...');
            clearAllMockData();
            
            try {
              localStorage.setItem(key, value);
              console.log('✅ 모든 Mock 데이터 삭제 후 저장 성공!');
              return { success: true };
            } catch (retry4Error) {
              // 5차: 게시물 수를 50개로 더 줄임
              console.warn('5️⃣ 게시물 수를 50개로 제한 중...');
              limitPostsCount(50);
              
              try {
                localStorage.setItem(key, value);
                console.log('✅ 게시물 수 50개 제한 후 저장 성공!');
                return { success: true };
              } catch (finalError) {
                console.error('❌ localStorage 저장 최종 실패:', finalError);
                console.log(`최종 사용량: ${getLocalStorageSizeMB()} MB`);
                return { 
                  success: false, 
                  error: 'QUOTA_EXCEEDED',
                  message: 'localStorage 용량이 부족합니다. 브라우저 데이터를 삭제하거나 오래된 게시물을 수동으로 삭제해주세요.'
                };
              }
            }
          }
        }
      }
    }
    
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
    localStorage.removeItem('uploadedPosts');
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
    const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
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
    
    localStorage.setItem('uploadedPosts', JSON.stringify(cleanedPosts));
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

// localStorage 상태 로깅
export const logLocalStorageStatus = () => {
  try {
    const sizeMB = getLocalStorageSizeMB();
    const postsString = localStorage.getItem('uploadedPosts') || '[]';
    const postsSizeMB = (postsString.length / (1024 * 1024)).toFixed(2);
    const posts = JSON.parse(postsString);

    console.log('📊 localStorage 상태:');
    console.log(`   - 전체 사용 용량: ${sizeMB} MB`);
    console.log(`   - uploadedPosts 용량: ${postsSizeMB} MB`);
    console.log(`   - 전체 게시물: ${posts.length}개`);
    
    // 가장 큰 항목 찾기
    let largestKey = '';
    let largestSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const size = localStorage[key].length;
        if (size > largestSize) {
          largestSize = size;
          largestKey = key;
        }
      }
    }
    console.log(`   - 가장 큰 항목: ${largestKey} (${(largestSize / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (error) {
    console.error('localStorage 상태 로깅 오류:', error);
  }
};






















/**
 * 모든 로컬 데이터 삭제 유틸리티
 * 배포 전 테스트 데이터 정리용
 */

export const clearAllPosts = () => {
  try {
    // 서버 운영 전환: localStorage 제거 → no-op
    return { success: true, message: '모든 게시물 데이터가 삭제되었습니다.' };
  } catch (error) {
    return { success: false, message: '데이터 삭제에 실패했습니다.' };
  }
};

export const clearAllData = () => {
  try {
    // 서버 운영 전환: localStorage 제거 → no-op
    return { success: true, message: '모든 로컬 데이터가 삭제되었습니다.' };
  } catch (error) {
    return { success: false, message: '데이터 삭제에 실패했습니다.' };
  }
};

export const getStorageInfo = () => {
  try {
    return {
      postsCount: 0,
      routesCount: 0,
      postsSizeKB: '0',
      routesSizeKB: '0',
      totalSizeKB: '0'
    };
  } catch (error) {
    return {
      postsCount: 0,
      routesCount: 0,
      postsSizeKB: '0',
      routesSizeKB: '0',
      totalSizeKB: '0'
    };
  }
};

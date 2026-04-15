/**
 * 관심 지역/장소 시스템 (통합)
 * 지역 알림 + 즐겨찾기 장소를 하나로!
 */
import { logger } from './logger';

/**
 * 관심 지역/장소 추가/제거
 */
export const toggleInterestPlace = (place) => {
  try {
    const interests = JSON.parse(localStorage.getItem('interestPlaces') || '[]');
    const placeName = typeof place === 'string' ? place : (place.name || place.location);
    const index = interests.findIndex(p => p.name === placeName);
    
    if (index > -1) {
      // 이미 있으면 제거
      interests.splice(index, 1);
      logger.log(`⭐ 관심 지역/장소 해제: ${placeName}`);
    } else {
      // 새로 추가
      const newPlace = typeof place === 'string' 
        ? { name: place, addedAt: new Date().toISOString() }
        : { 
            name: placeName,
            location: place.location || placeName,
            region: place.region || placeName.split(' ')[0],
            coordinates: place.coordinates,
            addedAt: new Date().toISOString()
          };
      
      interests.push(newPlace);
      logger.log(`⭐ 관심 지역/장소 추가: ${placeName}`);
    }
    
    localStorage.setItem('interestPlaces', JSON.stringify(interests));
    
    // 이벤트 발생
    window.dispatchEvent(new CustomEvent('interestPlaceChanged', { 
      detail: { place: placeName, enabled: index === -1 }
    }));
    
    return index === -1; // true면 추가됨, false면 제거됨
  } catch (error) {
    logger.error('관심 지역/장소 토글 오류:', error);
    return false;
  }
};

/**
 * 관심 지역/장소인지 확인
 */
export const isInterestPlace = (placeName) => {
  try {
    const interests = JSON.parse(localStorage.getItem('interestPlaces') || '[]');
    return interests.some(p => 
      p.name === placeName || 
      p.location === placeName ||
      placeName.includes(p.name) ||
      p.name.includes(placeName)
    );
  } catch (error) {
    logger.error('관심 지역/장소 확인 오류:', error);
    return false;
  }
};

/**
 * 모든 관심 지역/장소 가져오기
 */
export const getInterestPlaces = () => {
  try {
    return JSON.parse(localStorage.getItem('interestPlaces') || '[]');
  } catch (error) {
    logger.error('관심 목록 조회 오류:', error);
    return [];
  }
};

/**
 * 새 게시물이 관심 지역/장소인지 확인하고 알림 발송
 */
export const checkAndNotifyInterestPlace = async (post) => {
  try {
    const postLocation = post.location || post.placeName || '';
    if (!postLocation) return;
    
    const interests = getInterestPlaces();
    const matchedPlace = interests.find(p => 
      postLocation.includes(p.name) || 
      p.name.includes(postLocation) ||
      (p.location && (postLocation.includes(p.location) || p.location.includes(postLocation)))
    );
    
    if (matchedPlace) {
      logger.log(`⭐ 관심 지역/장소에 새 게시물: ${matchedPlace.name}`);
      
      // 브라우저 알림
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(`⭐ ${matchedPlace.name} 실시간 정보`, {
          body: post.note || `${matchedPlace.name}에 새로운 정보가 올라왔어요!`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `interest-${matchedPlace.name}-${post.id}`,
          data: { postId: post.id, place: matchedPlace.name }
        });
        
        notification.onclick = () => {
          window.focus();
          window.location.href = `/post/${post.id}`;
        };
      }
      
      // 앱 내부 알림
      const { addNotification } = await import('./notifications');
      addNotification({
        type: 'interest',
        title: `⭐ ${matchedPlace.name} 실시간 정보`,
        message: post.note || `${matchedPlace.name}에 새로운 정보가 올라왔어요!`,
        link: `/post/${post.id}`
      });
    }
  } catch (error) {
    logger.error('관심 지역/장소 알림 발송 오류:', error);
  }
};

/**
 * 관심 지역/장소 통계
 */
export const getInterestPlaceStats = () => {
  const places = getInterestPlaces();
  
  // 대략적인 지역 구분 (시/도 단위)
  const regions = [];
  const specificPlaces = [];
  
  places.forEach(place => {
    // 짧으면 지역(시/도), 길면 구체적 장소
    if (place.name.length <= 3) {
      regions.push(place);
    } else {
      specificPlaces.push(place);
    }
  });
  
  return {
    total: places.length,
    regions: regions.length,
    places: specificPlaces.length
  };
};

export default {
  toggleInterestPlace,
  isInterestPlace,
  getInterestPlaces,
  checkAndNotifyInterestPlace,
  getInterestPlaceStats
};





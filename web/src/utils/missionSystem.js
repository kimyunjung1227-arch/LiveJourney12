const MISSIONS_KEY = 'sosMissions_v1';
const MISSION_REWARD_KEY = 'missionRewards_v1';

const TRUST_SCORE_BY_GRADE = {
  노마드: 0,
  트래커: 1200,
  가이드: 4500,
  마스터: 16000,
  앰버서더: 52000
};

const haversineDistanceKm = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
};

export const getMissionTrustScoreByGrade = (grade = '노마드') =>
  TRUST_SCORE_BY_GRADE[grade] ?? 0;

export const getSOSMissions = () => {
  try {
    const missions = JSON.parse(localStorage.getItem(MISSIONS_KEY) || '[]');
    return Array.isArray(missions) ? missions : [];
  } catch {
    return [];
  }
};

export const saveSOSMissions = (missions = []) => {
  localStorage.setItem(MISSIONS_KEY, JSON.stringify(missions));
  window.dispatchEvent(new Event('sosMissionUpdated'));
  return missions;
};

export const createSOSMission = (payload = {}) => {
  const mission = {
    id: `mission-${Date.now()}`,
    title: payload.title || '지금 상황 알려주세요',
    question: payload.question || '',
    coordinates: payload.coordinates || null,
    locationName: payload.locationName || '근처 지역',
    requesterId: payload.requesterId || 'current-user',
    requesterName: payload.requesterName || '요청자',
    minimumTrustGrade: payload.minimumTrustGrade || '노마드',
    minimumTrustScore:
      payload.minimumTrustScore ?? getMissionTrustScoreByGrade(payload.minimumTrustGrade),
    notifyRadiusKm: payload.notifyRadiusKm || 8,
    status: 'open',
    responses: [],
    bestResponseId: null,
    createdAt: new Date().toISOString()
  };
  const next = [mission, ...getSOSMissions()];
  saveSOSMissions(next);
  return mission;
};

export const addMissionResponse = (missionId, responsePayload = {}) => {
  const missions = getSOSMissions();
  const next = missions.map((m) => {
    if (m.id !== missionId) return m;
    const response = {
      id: `resp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      responderId: responsePayload.responderId || 'current-user',
      responderName: responsePayload.responderName || '여행자',
      responderTrustScore: Number(responsePayload.responderTrustScore || 0),
      responderTrustGrade: responsePayload.responderTrustGrade || '노마드',
      note: responsePayload.note || '',
      photoUrl: responsePayload.photoUrl || '',
      createdAt: new Date().toISOString()
    };
    return { ...m, responses: [response, ...(m.responses || [])] };
  });
  saveSOSMissions(next);
};

export const createMissionResponsePost = (mission, response, opts = {}) => {
  if (!mission || !response?.photoUrl) return null;
  const userId = opts.userId || 'current-user';
  const username = opts.username || '미션 해결자';
  const createdAt = new Date().toISOString();
  const region = (mission.locationName || '기타').split(' ')[0] || '기타';
  const newPost = {
    id: `mission-post-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    user: { id: userId, username, profileImage: null },
    images: [response.photoUrl],
    videos: [],
    location: mission.locationName || '근처 지역',
    detailedLocation: mission.locationName || '근처 지역',
    placeName: mission.locationName || '근처 지역',
    region,
    coordinates: mission.coordinates || null,
    tags: ['미션', '실시간', '현장제보'],
    category: 'scenic',
    categories: ['scenic'],
    note: response.note || `${mission.question || '미션'}에 대한 현장 답변`,
    timestamp: Date.now(),
    createdAt,
    timeLabel: '방금',
    likes: 0,
    isLocal: true,
    mission: {
      missionId: mission.id,
      responseId: response.id,
      source: 'sos-mission'
    }
  };
  try {
    const posts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const next = [newPost, ...(Array.isArray(posts) ? posts : [])];
    localStorage.setItem('uploadedPosts', JSON.stringify(next));
    window.dispatchEvent(new Event('postsUpdated'));
    return newPost;
  } catch {
    return null;
  }
};

export const selectMissionBestResponse = (missionId, responseId, requesterId = 'current-user') => {
  const missions = getSOSMissions();
  const next = missions.map((m) => {
    if (m.id !== missionId) return m;
    if (m.requesterId !== requesterId) return m;
    return { ...m, bestResponseId: responseId, status: 'resolved', resolvedAt: new Date().toISOString() };
  });
  saveSOSMissions(next);
};

export const getNearbyMissions = (missions, myLocation, radiusKm = 8) => {
  return (missions || []).filter((m) => {
    if (!m?.coordinates || !myLocation) return false;
    return haversineDistanceKm(myLocation, m.coordinates) <= radiusKm;
  });
};

export const getMissionRewards = (userId = 'current-user') => {
  try {
    const raw = JSON.parse(localStorage.getItem(MISSION_REWARD_KEY) || '{}');
    return raw[userId] || { trustPoint: 0, completed: 0, selectedBest: 0 };
  } catch {
    return { trustPoint: 0, completed: 0, selectedBest: 0 };
  }
};

export const updateMissionRewards = (userId = 'current-user', partial = {}) => {
  const all = JSON.parse(localStorage.getItem(MISSION_REWARD_KEY) || '{}');
  const prev = all[userId] || { trustPoint: 0, completed: 0, selectedBest: 0 };
  const next = {
    trustPoint: Math.max(0, (prev.trustPoint || 0) + (partial.trustPoint || 0)),
    completed: Math.max(0, (prev.completed || 0) + (partial.completed || 0)),
    selectedBest: Math.max(0, (prev.selectedBest || 0) + (partial.selectedBest || 0))
  };
  all[userId] = next;
  localStorage.setItem(MISSION_REWARD_KEY, JSON.stringify(all));
  return next;
};

export const getMissionBadges = (reward = {}) => {
  const badges = [];
  if ((reward.completed || 0) >= 1) badges.push({ id: 'starter', name: '미션 스타터', icon: '🚀' });
  if ((reward.selectedBest || 0) >= 1) badges.push({ id: 'helper', name: '현장 해결사', icon: '📸' });
  if ((reward.selectedBest || 0) >= 3) badges.push({ id: 'pro', name: '베스트 정보원', icon: '🏅' });
  return badges;
};
/**
 * 🎮 일일 미션 & 챌린지 시스템
 * 사용자들이 즐겁게 사진을 올리도록 게임화
 */

// 미션 타입 정의
const MISSION_TYPES = [
  {
    id: 'upload_photo',
    title: '오늘의 순간 남기기',
    description: '사진 1장 업로드하기',
    icon: '📸',
    reward: 50,
    difficulty: '쉬움',
    requiredCount: 1,
    type: 'upload'
  },
  {
    id: 'upload_3_photos',
    title: '여행 마니아',
    description: '사진 3장 업로드하기',
    icon: '🌟',
    reward: 150,
    difficulty: '보통',
    requiredCount: 3,
    type: 'upload'
  },
  {
    id: 'visit_new_location',
    title: '새로운 곳 탐험',
    description: '처음 방문하는 지역 사진 올리기',
    icon: '🗺️',
    reward: 100,
    difficulty: '보통',
    requiredCount: 1,
    type: 'new_location'
  },
  {
    id: 'morning_upload',
    title: '아침형 인간',
    description: '오전(6시-12시)에 사진 올리기',
    icon: '🌅',
    reward: 80,
    difficulty: '쉬움',
    requiredCount: 1,
    type: 'time_specific'
  },
  {
    id: 'comment_on_post',
    title: '소통왕',
    description: '다른 사용자 게시물에 댓글 3개 달기',
    icon: '💬',
    reward: 60,
    difficulty: '쉬움',
    requiredCount: 3,
    type: 'social'
  },
  {
    id: 'like_5_posts',
    title: '좋아요 요정',
    description: '게시물 5개에 좋아요 누르기',
    icon: '❤️',
    reward: 40,
    difficulty: '쉬움',
    requiredCount: 5,
    type: 'social'
  },
  {
    id: 'category_food',
    title: '맛집 탐방가',
    description: '맛집 카테고리 사진 올리기',
    icon: '🍜',
    reward: 70,
    difficulty: '쉬움',
    requiredCount: 1,
    type: 'category',
    targetCategory: 'food'
  },
  {
    id: 'category_nature',
    title: '자연 애호가',
    description: '자연 관련 사진 올리기',
    icon: '🌿',
    reward: 70,
    difficulty: '쉬움',
    requiredCount: 1,
    type: 'category',
    targetCategory: 'scenic'
  },
  {
    id: 'streak_3_days',
    title: '3일 연속 업로드',
    description: '3일 연속으로 사진 올리기',
    icon: '🔥',
    reward: 200,
    difficulty: '어려움',
    requiredCount: 3,
    type: 'streak'
  }
];

// 주간 특별 챌린지
const WEEKLY_CHALLENGES = [
  {
    id: 'weekend_explorer',
    title: '주말 탐험가',
    description: '주말에 5곳 이상 방문하기',
    icon: '🏖️',
    reward: 500,
    duration: 'weekend',
    requiredCount: 5
  },
  {
    id: 'cafe_tour',
    title: '카페 투어',
    description: '이번 주 카페 3곳 방문',
    icon: '☕',
    reward: 300,
    duration: 'week',
    requiredCount: 3,
    category: 'food'
  },
  {
    id: 'hidden_gems',
    title: '숨은 명소 찾기',
    description: '방문자 10명 미만 장소 3곳 발견',
    icon: '💎',
    reward: 400,
    duration: 'week',
    requiredCount: 3
  }
];

// 오늘의 일일 미션 가져오기 (날짜별로 고정)
export const getDailyMissions = () => {
  const today = new Date().toDateString();
  const savedMissions = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  
  // 오늘 날짜와 저장된 날짜가 다르면 새로 생성
  if (savedMissions.date !== today) {
    // 매일 3개의 미션을 랜덤으로 선택
    const shuffled = [...MISSION_TYPES].sort(() => Math.random() - 0.5);
    const todayMissions = shuffled.slice(0, 3).map(mission => ({
      ...mission,
      progress: 0,
      completed: false,
      claimed: false
    }));
    
    const newMissions = {
      date: today,
      missions: todayMissions
    };
    
    localStorage.setItem('dailyMissions', JSON.stringify(newMissions));
    
    logger.log('🎯 오늘의 새로운 미션:', todayMissions.map(m => m.title));
    
    return todayMissions;
  }
  
  return savedMissions.missions || [];
};

// 미션 진행도 업데이트
export const updateMissionProgress = (missionType, data = {}) => {
  const savedMissions = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  
  if (!savedMissions.missions) return;
  
  let updated = false;
  
  savedMissions.missions = savedMissions.missions.map(mission => {
    // 이미 완료된 미션은 스킵
    if (mission.completed) return mission;
    
    let shouldUpdate = false;
    
    // 미션 타입별 체크
    switch (mission.type) {
      case 'upload':
        if (missionType === 'upload') {
          shouldUpdate = true;
        }
        break;
        
      case 'new_location':
        if (missionType === 'new_location' && data.isNewLocation) {
          shouldUpdate = true;
        }
        break;
        
      case 'time_specific':
        if (missionType === 'upload' && mission.id === 'morning_upload') {
          const hour = new Date().getHours();
          if (hour >= 6 && hour < 12) {
            shouldUpdate = true;
          }
        }
        break;
        
      case 'category':
        if (missionType === 'upload' && data.category === mission.targetCategory) {
          shouldUpdate = true;
        }
        break;
        
      case 'social':
        if (missionType === mission.id.includes('comment') ? 'comment' : 'like') {
          shouldUpdate = true;
        }
        break;
        
      case 'streak':
        if (missionType === 'streak_check') {
          const streakDays = data.streakDays || 0;
          if (streakDays >= mission.requiredCount) {
            return { ...mission, progress: mission.requiredCount, completed: true };
          }
        }
        break;
    }
    
    if (shouldUpdate) {
      updated = true;
      const newProgress = mission.progress + 1;
      const completed = newProgress >= mission.requiredCount;
      
      if (completed && !mission.completed) {
        showMissionCompleteNotification(mission);
      }
      
      return {
        ...mission,
        progress: newProgress,
        completed
      };
    }
    
    return mission;
  });
  
  if (updated) {
    localStorage.setItem('dailyMissions', JSON.stringify(savedMissions));
    window.dispatchEvent(new Event('missionUpdated'));
  }
  
  return savedMissions.missions;
};

// 미션 보상 받기
export const claimMissionReward = (missionId) => {
  const savedMissions = JSON.parse(localStorage.getItem('dailyMissions') || '{}');
  
  if (!savedMissions.missions) return null;
  
  const mission = savedMissions.missions.find(m => m.id === missionId);
  
  if (!mission || !mission.completed || mission.claimed) {
    return null;
  }
  
  // 포인트 지급
  const currentPoints = parseInt(localStorage.getItem('userPoints') || '0');
  const newPoints = currentPoints + mission.reward;
  localStorage.setItem('userPoints', newPoints.toString());
  
  // 미션 완료 표시
  savedMissions.missions = savedMissions.missions.map(m =>
    m.id === missionId ? { ...m, claimed: true } : m
  );
  
  localStorage.setItem('dailyMissions', JSON.stringify(savedMissions));
  
  console.log(`🎁 미션 보상 획득: ${mission.reward}P (총: ${newPoints}P)`);
  
  // 포인트 변경 이벤트 발생
  window.dispatchEvent(new Event('pointsChanged'));
  
  return {
    mission,
    reward: mission.reward,
    totalPoints: newPoints
  };
};

// 미션 완료 알림
const showMissionCompleteNotification = (mission) => {
  logger.log(`✅ 미션 완료! ${mission.icon} ${mission.title}`);
  
  // 알림 생성
  const notification = {
    id: `mission_${mission.id}_${Date.now()}`,
    type: 'mission_complete',
    title: '미션 완료! 🎉',
    message: `${mission.icon} ${mission.title}을(를) 완료했어요! 보상: ${mission.reward}P`,
    timestamp: Date.now(),
    read: false,
    data: { mission }
  };
  
  const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
  notifications.unshift(notification);
  localStorage.setItem('notifications', JSON.stringify(notifications));
  
  window.dispatchEvent(new Event('notificationAdded'));
};

// 완료된 미션 개수
export const getCompletedMissionsCount = () => {
  const missions = getDailyMissions();
  return missions.filter(m => m.completed).length;
};

// 스트릭 (연속 업로드) 관리
export const getUploadStreak = () => {
  const streak = JSON.parse(localStorage.getItem('uploadStreak') || '{"days": 0, "lastUpload": null}');
  
  const today = new Date().toDateString();
  const lastUpload = streak.lastUpload ? new Date(streak.lastUpload).toDateString() : null;
  
  return {
    days: streak.days || 0,
    lastUpload: lastUpload,
    isToday: lastUpload === today
  };
};

export const updateUploadStreak = () => {
  const streak = getUploadStreak();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  let newStreak = { ...streak };
  
  // 오늘 이미 업로드했으면 스킵
  if (streak.isToday) {
    return newStreak;
  }
  
  // 어제 업로드했으면 스트릭 증가
  if (streak.lastUpload === yesterday) {
    newStreak.days = streak.days + 1;
  } else if (streak.lastUpload !== today) {
    // 스트릭이 끊겼으면 1부터 시작
    newStreak.days = 1;
  }
  
  newStreak.lastUpload = new Date().toISOString();
  
  localStorage.setItem('uploadStreak', JSON.stringify(newStreak));
  
  console.log(`🔥 업로드 스트릭: ${newStreak.days}일 연속!`);
  
  // 스트릭 달성 체크
  if (newStreak.days === 3 || newStreak.days === 7 || newStreak.days === 30) {
    showStreakAchievement(newStreak.days);
  }
  
  // 스트릭 미션 체크
  updateMissionProgress('streak_check', { streakDays: newStreak.days });
  
  return newStreak;
};

// 스트릭 달성 알림
const showStreakAchievement = (days) => {
  const icons = {
    3: '🔥',
    7: '⭐',
    30: '👑'
  };
  
  const titles = {
    3: '3일 연속!',
    7: '일주일 연속!',
    30: '한 달 연속!'
  };
  
  const notification = {
    id: `streak_${days}_${Date.now()}`,
    type: 'streak_achievement',
    title: `${icons[days]} ${titles[days]}`,
    message: `${days}일 연속 업로드 달성! 대단해요! 🎉`,
    timestamp: Date.now(),
    read: false
  };
  
  const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
  notifications.unshift(notification);
  localStorage.setItem('notifications', JSON.stringify(notifications));
  
  window.dispatchEvent(new Event('notificationAdded'));
};

// 오늘의 챌린지 제안
export const getSuggestedChallenge = () => {
  const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
  const dayOfWeek = new Date().getDay();
  
  // 주말이면 특별 챌린지
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      id: 'weekend_special',
      title: '주말 특별 미션',
      description: '오늘 방문한 곳 3곳 이상 기록하기',
      icon: '🎈',
      reward: 300
    };
  }
  
  // 사용자 취향 기반 추천
  const topCategory = Object.entries(preferences.categories || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  
  if (topCategory === 'food' || topCategory === '맛집 정보' || topCategory === '맛집정보') {
    return {
      id: 'food_challenge',
      title: '맛집 탐방',
      description: '새로운 맛집 발견하기',
      icon: '🍽️',
      reward: 150
    };
  }
  
  return {
    id: 'explorer',
    title: '탐험가 챌린지',
    description: '새로운 장소 발견하기',
    icon: '🗺️',
    reward: 120
  };
};

// 미션 시스템 초기화 (디버깅용)
export const resetMissions = () => {
  localStorage.removeItem('dailyMissions');
  localStorage.removeItem('uploadStreak');
  logger.log('🔄 미션 시스템 초기화');
};



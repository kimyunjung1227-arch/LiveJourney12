const mongoose = require('mongoose');

/**
 * 라이브저니 뱃지 시스템 v5.0
 * 7 카테고리 20개: 온보딩, 지역 가이드, 실시간 정보, 도움 지수, 정확한 정보, 친절한 여행자, 기여도
 * - clientOnly: 서버 미집계, 클라이언트에서만 지급
 * - 첫 걸음: postCount 1 / 지역 가이드: regionMaxPosts 10 (서버 지급)
 */

const BADGES = {
  '첫 걸음': { name: '첫 걸음', description: '첫 번째 실시간 여행 정보를 공유했어요. 여행의 첫걸음을 내딛었어요!', icon: '👣', category: '온보딩', difficulty: 1, gradient: 'from-green-400 to-emerald-500', condition: { type: 'postCount', value: 1 } },
  '지역 가이드': { name: '지역 가이드', description: '해당 지역 실시간 제보 10회 이상. 가장 직관적인 로컬 전문가 인증', icon: '🗺️', category: '지역 가이드', difficulty: 2, gradient: 'from-indigo-600 to-blue-800', condition: { type: 'regionMaxPosts', value: 10 } },
  '지역 톡파원': { name: '지역 톡파원', description: '해당 지역에서 3일 연속 실시간 중계. 지역 소식을 실시간으로 전하는 톡파원', icon: '📡', category: '지역 가이드', difficulty: 3, gradient: 'from-cyan-500 to-blue-600', condition: { type: 'clientOnly', value: 0 } },
  '지역 마스터': { name: '지역 마스터', description: '해당 지역 활동량 상위 1% 기록. 그 지역에 대해선 모르는 게 없는 권위자', icon: '👑', category: '지역 가이드', difficulty: 4, gradient: 'from-purple-600 to-fuchsia-700', condition: { type: 'clientOnly', value: 0 } },
  '날씨요정': { name: '날씨요정', description: '비/눈 등 기상 변화 시 10분 이내 현장 제보 5회. 친근하고 확실한 날씨 알림이', icon: '🌦️', category: '실시간 정보', difficulty: 2, gradient: 'from-cyan-400 to-blue-600', condition: { type: 'clientOnly', value: 0 } },
  '웨이팅 요정': { name: '웨이팅 요정', description: '실시간 대기 줄 상황과 예상 시간 10회 공유. 헛걸음과 시간 낭비를 막아주는 구세주', icon: '⏱️', category: '실시간 정보', difficulty: 2, gradient: 'from-lime-400 to-green-600', condition: { type: 'clientOnly', value: 0 } },
  '0.1초 셔터': { name: '0.1초 셔터', description: '현장 도착 즉시 실시간 라이브 사진 업로드. 누구보다 빠르게 현장을 중계하는 유저', icon: '⚡', category: '실시간 정보', difficulty: 3, gradient: 'from-yellow-300 to-amber-500', condition: { type: 'clientOnly', value: 0 } },
  '베스트 나침반': { name: '베스트 나침반', description: '실시간 게시글 총 조회수 10,000회 돌파. 많은 이들의 길잡이가 된 영향력 인증', icon: '🧭', category: '도움 지수', difficulty: 4, gradient: 'from-amber-400 to-yellow-600', condition: { type: 'clientOnly', value: 0 } },
  '실패 구조대': { name: '실패 구조대', description: '내 정보로 헛걸음을 피한 감사 피드백 50회. 라이브저니의 사명을 가장 잘 실천한 유저', icon: '🫀', category: '도움 지수', difficulty: 3, gradient: 'from-red-400 to-rose-600', condition: { type: 'likesReceived', value: 50 } },
  '라이트하우스': { name: '라이트하우스', description: '정보가 귀한 시점(밤, 악천후)에 유용한 정보 제공. 어려운 상황에서 타인의 여행을 밝혀준 존재', icon: '🗼', category: '도움 지수', difficulty: 3, gradient: 'from-cyan-400 to-blue-600', condition: { type: 'clientOnly', value: 0 } },
  '팩트 체크 마스터': { name: '팩트 체크 마스터', description: '잘못된 과거 정보를 최신으로 수정/갱신 10회. 정보의 최신성을 유지하는 커뮤니티의 기둥', icon: '✅', category: '정확한 정보', difficulty: 3, gradient: 'from-emerald-600 to-teal-700', condition: { type: 'clientOnly', value: 0 } },
  '인간 GPS': { name: '인간 GPS', description: '제보 위치와 실제 GPS 일치율 100% 유지. 데이터 신뢰도를 보장하는 물리적 인증', icon: '🛡️', category: '정확한 정보', difficulty: 2, gradient: 'from-slate-500 to-slate-700', condition: { type: 'clientOnly', value: 0 } },
  '트래블 셜록': { name: '트래블 셜록', description: '주차 꿀팁, 숨은 입구 등 디테일한 정보 공유. 남들이 놓치는 세밀한 부분까지 챙기는 유저', icon: '🔍', category: '정확한 정보', difficulty: 2, gradient: 'from-amber-600 to-amber-800', condition: { type: 'clientOnly', value: 0 } },
  '실시간 답변러': { name: '실시간 답변러', description: '질문 게시글에 10분 이내로 답변 5회 이상. 여행자의 궁금증을 즉시 해결해 주는 해결사', icon: '💬', category: '친절한 여행자', difficulty: 2, gradient: 'from-sky-400 to-blue-500', condition: { type: 'clientOnly', value: 0 } },
  '길 위의 천사': { name: '길 위의 천사', description: '타인의 게시글에 응원 및 격려 댓글 50회 이상. 커뮤니티의 긍정적인 활력을 불어넣는 유저', icon: '👼', category: '친절한 여행자', difficulty: 1, gradient: 'from-yellow-400 to-orange-500', condition: { type: 'clientOnly', value: 0 } },
  '동행 가이드': { name: '동행 가이드', description: '사진을 포함한 정성스러운 답변으로 도움 제공. 가장 헌신적으로 정보를 나누는 친절한 유저', icon: '🤝', category: '친절한 여행자', difficulty: 3, gradient: 'from-violet-500 to-purple-600', condition: { type: 'clientOnly', value: 0 } },
  '라이브 기록가': { name: '라이브 기록가', description: '총 실시간 제보 게시글 100개 달성. 서비스의 성장을 이끄는 핵심 기여자', icon: '📝', category: '기여도', difficulty: 3, gradient: 'from-blue-600 to-indigo-700', condition: { type: 'postCount', value: 100 } },
  '연속 중계 마스터': { name: '연속 중계 마스터', description: '30일 연속으로 실시간 상황 1회 이상 공유. 변함없는 성실함으로 신뢰를 쌓는 유저', icon: '📅', category: '기여도', difficulty: 4, gradient: 'from-emerald-500 to-green-700', condition: { type: 'clientOnly', value: 0 } },
  '지도 개척자': { name: '지도 개척자', description: '정보가 없던 새로운 장소의 첫 실시간 정보 등록. 라이브저니의 지도를 확장하는 선구자', icon: '🗺️', category: '기여도', difficulty: 2, gradient: 'from-amber-600 to-orange-700', condition: { type: 'clientOnly', value: 0 } }
};

// 뱃지 획득 기록 스키마
const rewardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  badgeName: {
    type: String,
    required: true,
    enum: Object.keys(BADGES)
  },
  badgeData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

rewardSchema.index({ user: 1, badgeName: 1 }, { unique: true });
rewardSchema.index({ createdAt: -1 });

// 뱃지 확인 및 지급
rewardSchema.statics.checkAndAwardBadges = async function(userId) {
  const User = mongoose.model('User');
  const Post = mongoose.model('Post');
  
  const user = await User.findById(userId);
  if (!user) return [];
  
  const newBadges = [];
  const posts = await Post.find({ user: userId, isPublic: true });
  const postCount = posts.length;
  
  // 통계 계산
  const regions = new Set(posts.map(p => (p.location || p.region || '').split(' ')[0]).filter(Boolean));
  const regionCount = regions.size;
  const likesReceived = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
  const maxLikes = Math.max(...posts.map(p => p.likes || 0), 0);
  
  // 지역별 게시물 수
  const regionPostCounts = {};
  posts.forEach(post => {
    const region = (post.location || post.region || '').split(' ')[0];
    if (region) {
      regionPostCounts[region] = (regionPostCounts[region] || 0) + 1;
    }
  });
  const maxRegionPosts = Math.max(...Object.values(regionPostCounts), 0);
  
  // 날짜별 게시물 수
  const postsByDate = {};
  posts.forEach(post => {
    const date = new Date(post.createdAt).toDateString();
    postsByDate[date] = (postsByDate[date] || 0) + 1;
  });
  const maxDailyPosts = Math.max(...Object.values(postsByDate), 0);
  
  // 각 뱃지 조건 확인
  for (const [badgeName, badgeInfo] of Object.entries(BADGES)) {
    const alreadyHas = await this.findOne({ user: userId, badgeName });
    if (alreadyHas) continue;
    
    let shouldAward = false;
    
    switch (badgeInfo.condition.type) {
      case 'postCount':
        shouldAward = postCount >= badgeInfo.condition.value;
        break;
      case 'likesReceived':
        shouldAward = likesReceived >= badgeInfo.condition.value;
        break;
      case 'regionCount':
        shouldAward = regionCount >= badgeInfo.condition.value;
        break;
      case 'singlePostLikes':
        shouldAward = maxLikes >= badgeInfo.condition.value;
        break;
      case 'regionMaxPosts':
        shouldAward = maxRegionPosts >= badgeInfo.condition.value;
        break;
      case 'dailyPosts':
        shouldAward = maxDailyPosts >= badgeInfo.condition.value;
        break;
      case 'clientOnly':
        shouldAward = false; // 클라이언트에서만 집계·지급
        break;
      default:
        shouldAward = false;
        break;
    }
    
    if (shouldAward) {
      try {
        await this.create({
          user: userId,
          badgeName: badgeName,
          badgeData: badgeInfo
        });
        
        if (user.addBadge) {
          await user.addBadge(badgeName);
        }
        
        newBadges.push({
          badgeName,
          badgeData: badgeInfo
        });
        
        console.log(`✅ 뱃지 지급: ${badgeName}`);
      } catch (error) {
        console.error(`뱃지 지급 오류 (${badgeName}):`, error);
      }
    }
  }
  
  return newBadges;
};

// 사용자의 모든 뱃지 조회
rewardSchema.statics.getUserBadges = async function(userId) {
  const badges = await this.find({ user: userId })
    .sort({ createdAt: -1 });
  
  return badges.map(b => ({
    ...b.toObject(),
    ...(BADGES[b.badgeName] || {})
  }));
};

const Reward = mongoose.model('Reward', rewardSchema);

module.exports = {
  Reward,
  BADGES
};

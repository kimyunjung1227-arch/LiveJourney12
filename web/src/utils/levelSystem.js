/**
 * 레벨 시스템 (웹)
 * 사용자 활동에 따라 레벨 상승 - localStorage 기반
 */

const LEVEL_EXP = {
  1: 0, 2: 100, 3: 250, 4: 500, 5: 1000, 6: 2000, 7: 3500, 8: 5500, 9: 8000, 10: 11000,
  11: 15000, 12: 20000, 13: 26000, 14: 33000, 15: 41000, 16: 50000, 17: 60000, 18: 71000, 19: 83000, 20: 96000,
  21: 110000, 22: 125000, 23: 141000, 24: 158000, 25: 176000, 26: 195000, 27: 215000, 28: 236000, 29: 258000, 30: 281000
};

const LEVEL_TITLES = {
  1: '여행 입문자',
  5: '여행 애호가',
  10: '여행 마니아',
  15: '여행 전문가',
  20: '여행 달인',
  25: '여행 고수',
  30: '여행 명인'
};

const EXP_REWARDS = {
  '사진 업로드': 50,
  '좋아요 받기': 5,
  '댓글 받기': 10,
  '지역 방문': 20
};

export const calculateLevel = (totalExp) => {
  let level = 1;
  for (let lv = 1; lv <= 30; lv++) {
    if (totalExp >= (LEVEL_EXP[lv] ?? 0)) level = lv;
    else break;
  }
  return level;
};

export const getLevelTitle = (level) => {
  let title = LEVEL_TITLES[1];
  for (let lv = 30; lv >= 1; lv--) {
    if (LEVEL_TITLES[lv] && level >= lv) {
      title = LEVEL_TITLES[lv];
      break;
    }
  }
  return title;
};

function calculateTotalExp() {
  try {
    // 서버 운영 전환: localStorage 기반 경험치 계산 제거
    return 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 사용자 레벨 정보 조회 (동기)
 * @returns {{ level: number, title: string }}
 */
export function getUserLevel() {
  const totalExp = calculateTotalExp();
  const level = calculateLevel(totalExp);
  const title = getLevelTitle(level);
  return { level, title };
}

/**
 * 경험치 획득 (호환용)
 * - 기존 화면(UploadScreen 등)에서 `gainExp()`를 호출하고 있어 export를 제공합니다.
 * - 서버 운영 전환으로 totalExp 계산은 현재 0으로 고정되어 있어,
 *   레벨 업은 발생하지 않지만 호출부가 깨지지 않도록 결과 형태를 유지합니다.
 */
export const gainExp = (action) => {
  const expGained = EXP_REWARDS[action] || 0;
  if (expGained === 0) return { levelUp: false };
  return { levelUp: false };
};

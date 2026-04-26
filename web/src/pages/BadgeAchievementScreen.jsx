import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { getBadgeDisplayName, getBadgeDisplayNameFromName } from '../utils/badgeSystem';

const BadgeAchievementScreen = () => {
  const navigate = useNavigate();
  const { badgeId } = useParams();
  const location = useLocation();
  const passedBadge = location.state?.badge;

  // 뱃지 정보 매핑
  const getBadgeInfo = (badgeName) => {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 뱃지별 설명 및 이미지
    const badgeInfoMap = {
      '첫 여행 기록': {
        description: '첫 번째 여행 기록을 남긴 당신! 여행의 시작을 축하합니다. 앞으로 더 많은 추억을 만들어가세요!',
        relatedRegion: '전국'
      },
      '여행 탐험가': {
        description: '10개의 여행 기록을 남긴 진정한 탐험가! 당신의 발자취가 다른 여행자들에게 큰 도움이 되고 있습니다.',
        relatedRegion: '전국'
      },
      default: {
        description: '지역의 숨겨진 명소를 탐험하고 현지 문화를 깊이 있게 체험한 당신에게 이 배지를 수여합니다. 당신의 다음 여정이 더욱 기대됩니다!',
        relatedRegion: '전국'
      }
    };

    // 지역명 추출 (예: "서울 정복자" → "서울")
    const regionMatch = badgeName.match(/^(.+)\s정복자$/);
    if (regionMatch) {
      const region = regionMatch[1];
      return {
        name: badgeName,
        date: today,
        description: `${region}의 모든 주요 명소를 탐험하고 현지 문화를 깊이 있게 체험한 당신에게 이 배지를 수여합니다. ${region}의 진정한 전문가가 되었습니다!`,
        backgroundImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6Im47zvMU5QjpJZskwpg6uq-zkEVj2gAPP9m3Akha8RShNyTtRdZ8lPUAYh7fJe47TjtjWSYbv0KkFdPkJsjAxa0Xi5axJnuLP3JR4VxeN3CIx1F2YZkCLV9aVf6pKyC5LYByuoTWsAoaZzC_4YkPVm-ww7bnWtLxdxEe0jI_RqPoMhlGHpedwy4ergDmhbmrVx78krAC4um5fpgaDEP0GCom-dMc-BmjTFbb5Odv0CgoOXo5NFx9_X213_8CvGx7NDuDbwAmbBc',
        badgeIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuMOjMs9bxspwRGJK6Qc3aNChGf3fOf4JDuManeJ1EjCIB3QOB0rcPrldCJ-cLQqSUKoOPqApmiQwvJF8Z9U6OpmELM5-EKqYHDD1tnnv3bPhm403C_dE90SGumLaoarH8JlhwAqVdF82NS7BBL5G-ByTFvpy7-87_X0vS5G4-M5wYWOBuTBGGaBZp5dehRlhheINiyOCZN4xYOvUKgjRPXoCOTdehx352WTsex-4tjUuV0O5r96zvGIzXqMQP0DjUNblYgokqHsA',
        relatedRegion: region
      };
    }

    // 기타 뱃지
    const info = badgeInfoMap[badgeName] || badgeInfoMap.default;
    return {
      name: badgeName,
      date: today,
      description: info.description,
      backgroundImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6Im47zvMU5QjpJZskwpg6uq-zkEVj2gAPP9m3Akha8RShNyTtRdZ8lPUAYh7fJe47TjtjWSYbv0KkFdPkJsjAxa0Xi5axJnuLP3JR4VxeN3CIx1F2YZkCLV9aVf6pKyC5LYByuoTWsAoaZzC_4YkPVm-ww7bnWtLxdxEe0jI_RqPoMhlGHpedwy4ergDmhbmrVx78krAC4um5fpgaDEP0GCom-dMc-BmjTFbb5Odv0CgoOXo5NFx9_X213_8CvGx7NDuDbwAmbBc',
      badgeIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuMOjMs9bxspwRGJK6Qc3aNChGf3fOf4JDuManeJ1EjCIB3QOB0rcPrldCJ-cLQqSUKoOPqApmiQwvJF8Z9U6OpmELM5-EKqYHDD1tnnv3bPhm403C_dE90SGumLaoarH8JlhwAqVdF82NS7BBL5G-ByTFvpy7-87_X0vS5G4-M5wYWOBuTBGGaBZp5dehRlhheINiyOCZN4xYOvUKgjRPXoCOTdehx352WTsex-4tjUuV0O5r96zvGIzXqMQP0DjUNblYgokqHsA',
      relatedRegion: info.relatedRegion
    };
  };

  const rawKey = passedBadge?.name || badgeId || '로컬 전문가';
  const displayTitle =
    (passedBadge && (getBadgeDisplayName(passedBadge) || getBadgeDisplayNameFromName(rawKey))) ||
    getBadgeDisplayNameFromName(rawKey) ||
    rawKey;
  const badge = passedBadge ? getBadgeInfo(passedBadge.name) : getBadgeInfo(badgeId || '로컬 전문가');

  const handleExploreRelated = () => {
    if (badge.relatedRegion && badge.relatedRegion !== '전국') {
      navigate(`/region/${badge.relatedRegion}`);
    } else {
      navigate('/search');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${displayTitle} 뱃지 획득!`,
        text: `LiveJourney에서 ${displayTitle} 뱃지를 획득했습니다!`,
        url: window.location.href
      }).catch((error) => logger.log('공유 실패:', error));
    } else {
      alert('이 브라우저는 공유 기능을 지원하지 않습니다.');
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
      {/* 상단 앱 바 - 깔끔하게 */}
      <div className="sticky top-0 z-10 flex items-center bg-background-light dark:bg-background-dark p-4 justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex size-10 shrink-0 items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
        <button
          onClick={handleShare}
          className="flex size-10 items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-xl">share</span>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center px-4 py-8">
        {/* 뱃지 아이콘 - 단순한 애니메이션 */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center bg-primary/10 rounded-full p-6 shadow-xl animate-pulse">
            <img
              alt={`${displayTitle} 뱃지 아이콘`}
              className="h-32 w-32 object-contain"
              src={badge.badgeIcon}
            />
          </div>
        </div>

        {/* 축하 메시지 */}
        <div className="text-center mb-4">
          <span className="text-5xl mb-4 inline-block">🎉</span>
          <h1 className="text-zinc-800 dark:text-zinc-100 text-3xl font-extrabold leading-tight mb-2">
            뱃지 획득!
          </h1>
          <h2 className="text-primary text-2xl font-bold">
            {displayTitle}
          </h2>
        </div>

        {/* 획득 날짜 */}
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-6">
          {badge.date}
        </p>

        {/* 설명 카드 */}
        <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 mb-8">
          <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed text-center">
            {badge.description}
          </p>
        </div>
      </main>

      {/* 하단 액션 버튼 */}
      <div className="sticky bottom-0 w-full bg-background-light dark:bg-background-dark px-4 pb-6 pt-4">
        <button
          onClick={handleExploreRelated}
          className="w-full h-14 bg-primary text-white font-bold rounded-xl text-base flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95"
        >
          관련 여행지 둘러보기
        </button>
      </div>
    </div>
  );
};

export default BadgeAchievementScreen;













































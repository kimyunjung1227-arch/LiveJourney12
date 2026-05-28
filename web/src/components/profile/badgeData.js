import honorGold from '../../assets/badges/honor_gold.png';
import honorBronze from '../../assets/badges/honor_bronze.png';
import crown1 from '../../assets/badges/crown_1.png';
import crown5 from '../../assets/badges/crown_5.png';
import crown10 from '../../assets/badges/crown_10.png';
import flame100 from '../../assets/badges/flame_100.png';
import flame300 from '../../assets/badges/flame_300.png';
import flame500 from '../../assets/badges/flame_500.png';
import cherry from '../../assets/badges/cherry.png';
import sunset from '../../assets/badges/sunset.png';
import weather from '../../assets/badges/weather.png';
import festival from '../../assets/badges/festival.png';
import crowd from '../../assets/badges/crowd.png';
import store from '../../assets/badges/store.png';
import seoul from '../../assets/badges/seoul.png';
import jeju from '../../assets/badges/jeju.png';
import busan from '../../assets/badges/busan.png';
import gangneung from '../../assets/badges/gangneung.png';
import gyeongju from '../../assets/badges/gyeongju.png';

/**
 * 사용자 데이터로부터 뱃지 섹션 목록을 만든다.
 * 각 섹션은 { label, description, items: [{ name, img, desc, earned, requirement }] } 형태.
 */
export function buildBadgeGroups(user) {
  const helped = user?.helped_count || 0;
  const bestCut = user?.best_cut_count || 0;
  const primaryCity = user?.primary_city || '';
  const isArtist = !!user?.is_best_cut_artist;

  const cherryCount = user?.cherry_count || 0;
  const sunsetCount = user?.sunset_count || 0;
  const weatherCount = user?.weather_count || 0;
  const festivalCount = user?.festival_count || 0;
  const crowdCount = user?.crowd_count || 0;
  const storeCount = user?.store_count || 0;

  return [
    {
      label: '영예',
      description: '가장 강한 영예 — 원형 메달 형태',
      items: [
        {
          name: '영예 (금)',
          img: honorGold,
          desc: '커뮤니티 최상위 기여자',
          requirement: '도움 500명 + 베스트 컷 10회 달성',
          earned: helped >= 500 && bestCut >= 10,
        },
        {
          name: '영예 (동)',
          img: honorBronze,
          desc: '꾸준한 기여자',
          requirement: '도움 100명 또는 베스트 컷 1회 달성',
          earned: helped >= 100 || bestCut >= 1,
        },
      ],
    },
    {
      label: '베스트 컷 작가',
      description: '왕관 / 베스트 컷 선정 횟수',
      items: [
        {
          name: '베스트 컷 1회',
          img: crown1,
          desc: '첫 번째 베스트 컷',
          requirement: '베스트 컷 1회 선정',
          earned: bestCut >= 1 || isArtist,
        },
        {
          name: '베스트 컷 5회',
          img: crown5,
          desc: '5회 베스트 컷 선정',
          requirement: '베스트 컷 5회 선정',
          earned: bestCut >= 5,
        },
        {
          name: '베스트 컷 10회',
          img: crown10,
          desc: '10회 베스트 컷 선정',
          requirement: '베스트 컷 10회 선정',
          earned: bestCut >= 10,
        },
      ],
    },
    {
      label: '도움 마일스톤',
      description: '불꽃 / 도움 준 사람 수',
      items: [
        {
          name: '도움 100명',
          img: flame100,
          desc: '100명에게 도움',
          requirement: '도움 100명 달성',
          earned: helped >= 100,
        },
        {
          name: '도움 300명',
          img: flame300,
          desc: '300명에게 도움',
          requirement: '도움 300명 달성',
          earned: helped >= 300,
        },
        {
          name: '도움 500명+',
          img: flame500,
          desc: '500명 이상 도움',
          requirement: '도움 500명 달성',
          earned: helped >= 500,
        },
      ],
    },
    {
      label: '카테고리 전문성',
      description: '카테고리 별 고유 형태의 뱃지',
      items: [
        {
          name: '벚꽃 마스터',
          img: cherry,
          desc: '개화·자연 전문',
          requirement: '벚꽃 카테고리 10회 활동',
          earned: cherryCount >= 10,
        },
        {
          name: '노을 헌터',
          img: sunset,
          desc: '노을·야경 전문',
          requirement: '노을 카테고리 10회 활동',
          earned: sunsetCount >= 10,
        },
        {
          name: '날씨 리포터',
          img: weather,
          desc: '날씨·체감 전문',
          requirement: '날씨 카테고리 10회 활동',
          earned: weatherCount >= 10,
        },
        {
          name: '축제 마니아',
          img: festival,
          desc: '이벤트·축제 전문',
          requirement: '축제 카테고리 10회 활동',
          earned: festivalCount >= 10,
        },
        {
          name: '인파 리더',
          img: crowd,
          desc: '혼잡도·대기 전문',
          requirement: '인파 카테고리 10회 활동',
          earned: crowdCount >= 10,
        },
        {
          name: '단골 탐험가',
          img: store,
          desc: '영업·운영 전문',
          requirement: '단골 카테고리 10회 활동',
          earned: storeCount >= 10,
        },
      ],
    },
    {
      label: '지역 전문성',
      description: '방패 + 지역 상징',
      items: [
        {
          name: '서울 토박이',
          img: seoul,
          desc: '서울 지역 전문',
          requirement: '주 지역이 서울',
          earned: primaryCity === '서울',
        },
        {
          name: '제주 단골',
          img: jeju,
          desc: '제주 지역 전문',
          requirement: '주 지역이 제주',
          earned: primaryCity === '제주',
        },
        {
          name: '부산 탐험가',
          img: busan,
          desc: '부산 지역 전문',
          requirement: '주 지역이 부산',
          earned: primaryCity === '부산',
        },
        {
          name: '강릉 바닷가',
          img: gangneung,
          desc: '강릉 지역 전문',
          requirement: '주 지역이 강릉 (출시 예정)',
          earned: false,
          upcoming: true,
        },
        {
          name: '경주 고도',
          img: gyeongju,
          desc: '경주 지역 전문',
          requirement: '주 지역이 경주 (출시 예정)',
          earned: false,
          upcoming: true,
        },
      ],
    },
  ];
}

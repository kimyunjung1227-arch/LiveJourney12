import {
  // 지역
  IconBuildingSkyscraper,
  IconBuildingBridge,
  IconBuildingBroadcastTower,
  IconPlane,
  IconBuildingMonument,
  IconAtom2,
  IconBuildingFactory2,
  IconBuildingBank,
  IconBuildingCastle,
  IconMountain,
  IconRipple,
  IconSun,
  IconBuildingCottage,
  IconShip,
  IconBuildingArch,
  IconSailboat,
  IconBeach,
  // 카테고리 / 공통
  IconRosette,
  IconCrown,
  IconHeartHandshake,
  IconFlower,
  IconMoon,
  IconCloud,
  IconCalendarEvent,
  IconUsers,
  IconBuildingStore,
} from '@tabler/icons-react';

/**
 * 뱃지 모티프 → Tabler 아이콘 매핑.
 * - 손으로 그린 SVG 대신 일관·깔끔한 전문 아이콘 세트 사용.
 * - 지역 랜드마크는 의미가 가장 가까운 범용 아이콘으로 대체.
 *   (서울=고층, 부산=대교, 대구=관측탑, 인천=공항, 광주=기념물, 대전=과학,
 *    울산=산업, 세종=행정, 경기=수원화성, 강원=산, 충북=호수, 충남=일출,
 *    전북=한옥, 전남=다도해, 경북=석조유적, 경남=돛단배, 제주=바다)
 */
export const ICONS = {
  // 지역 (17개 시·도)
  seoul: IconBuildingSkyscraper,
  busan: IconBuildingBridge,
  daegu: IconBuildingBroadcastTower,
  incheon: IconPlane,
  gwangju: IconBuildingMonument,
  daejeon: IconAtom2,
  ulsan: IconBuildingFactory2,
  sejong: IconBuildingBank,
  gyeonggi: IconBuildingCastle,
  gangwon: IconMountain,
  chungbuk: IconRipple,
  chungnam: IconSun,
  jeonbuk: IconBuildingCottage,
  jeonnam: IconShip,
  gyeongbuk: IconBuildingArch,
  gyeongnam: IconSailboat,
  jeju: IconBeach,

  // 카테고리 / 공통 — 앱 카테고리 아이콘(LJ_CATEGORIES)과 일치
  honor: IconRosette, // 영예
  crown: IconCrown, // 베스트 컷
  flame: IconHeartHandshake, // 도움
  cherry: IconFlower, // 개화·자연
  sunset: IconMoon, // 노을·야경
  weather: IconCloud, // 날씨·체감
  festival: IconCalendarEvent, // 이벤트·축제
  crowd: IconUsers, // 혼잡도·대기
  store: IconBuildingStore, // 영업·운영
};

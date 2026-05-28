-- profiles.earned_badges: 보유한 뱃지 키 목록 (text[])
-- - 클라이언트 BadgesBox / BadgesScreen / BadgeDetailScreen 이 이 컬럼만 보고 표시
-- - 키 값은 badgeData.js 의 BADGE_CATALOG 키와 1:1 (honor_gold, crown_1, flame_100, cherry, seoul ...)
-- - 목업: 검증용 유저 e641740e-0176-437f-88ae-81b3c1a4e2c0 에 샘플 뱃지 부여

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles 없음; earned_badges 컬럼 추가 스킵';
    return;
  end if;
  alter table public.profiles
    add column if not exists earned_badges text[] not null default '{}';
end $$;

-- 목업 데이터: 김윤중 유저에게 뱃지 5종 부여
-- (영예 동, 베스트 컷 1회, 도움 100명, 벚꽃 마스터, 서울 토박이)
do $$
declare
  mock_user constant uuid := 'e641740e-0176-437f-88ae-81b3c1a4e2c0';
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;

  -- 행이 없으면 생성, 있으면 earned_badges 만 갱신
  insert into public.profiles (id, earned_badges)
  values (
    mock_user,
    array['honor_bronze', 'crown_1', 'flame_100', 'cherry', 'seoul']
  )
  on conflict (id) do update
    set earned_badges = excluded.earned_badges;
end $$;

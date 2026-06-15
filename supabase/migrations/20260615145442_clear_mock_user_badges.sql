-- 모든 유저의 뱃지 제거
-- - 20260528120000_profiles_earned_badges.sql 가 검증용 유저(e641740e…)에 목업 뱃지 5종을 부여했음
-- - 현 시점 뱃지 보유 유저는 그 목업 유저뿐이지만, 안전하게 전체 프로필 대상으로 비움
-- - DB 리셋 시에도 위 목업 부여 마이그레이션보다 늦게 실행되어 최종 상태 = 비워짐

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles 없음; 뱃지 초기화 스킵';
    return;
  end if;

  update public.profiles
    set earned_badges = '{}',
        representative_badge = null
    where (earned_badges is not null and array_length(earned_badges, 1) > 0)
       or representative_badge is not null;
end $$;

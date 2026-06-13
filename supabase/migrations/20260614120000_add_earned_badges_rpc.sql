-- add_earned_badges(p_keys): 호출자 본인의 profiles.earned_badges 에 키를 합집합(union)으로 추가.
-- - 한번 획득한 뱃지는 활동이 줄어도 영구 보존 (영구 획득)
-- - SECURITY DEFINER + row_security off + auth.uid() 로 "본인 행"만 갱신
-- - REST PATCH가 RLS로 400 날 때 대비해 RPC로 동일 작업 제공 (set_my_representative_badge 와 동일 방식)
-- - 반환: 갱신 후 전체 보유 키 배열

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles 없음; add_earned_badges 스킵';
    return;
  end if;
  alter table public.profiles
    add column if not exists earned_badges text[] not null default '{}';
end $$;

create or replace function public.add_earned_badges(p_keys text[])
returns text[]
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid      uuid   := auth.uid();
  v_keys   text[] := coalesce(p_keys, '{}');
  v_result text[];
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.profiles (id, earned_badges)
  values (
    uid,
    (select array(select distinct e from unnest(v_keys) as e where e is not null and e <> ''))
  )
  on conflict (id) do update
    set earned_badges = (
      select array(
        select distinct e
        from unnest(coalesce(profiles.earned_badges, '{}') || excluded.earned_badges) as e
        where e is not null and e <> ''
      )
    );

  select earned_badges into v_result from public.profiles where id = uid;
  return coalesce(v_result, '{}');
end;
$$;

grant execute on function public.add_earned_badges(text[]) to authenticated;

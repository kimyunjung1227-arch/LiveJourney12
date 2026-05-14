-- 대표 뱃지: REST PATCH가 400일 때 대비해 RPC로 동일 작업 제공 (auth.uid() 행만)
-- SECURITY DEFINER + row_security off — 본인 행만 auth.uid()로 한정

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'public.profiles 없음; set_my_representative_badge 스킵';
    return;
  end if;
  alter table public.profiles add column if not exists representative_badge jsonb;
end $$;

create or replace function public.set_my_representative_badge(p_badge jsonb)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.profiles (id, representative_badge)
  values (uid, p_badge)
  on conflict (id) do update
    set representative_badge = excluded.representative_badge;
end;
$$;

grant execute on function public.set_my_representative_badge(jsonb) to authenticated;

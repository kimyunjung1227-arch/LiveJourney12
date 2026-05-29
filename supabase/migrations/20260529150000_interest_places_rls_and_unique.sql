-- interest_places: 사용자가 저장한 관심 장소.
-- 문제: RLS는 켜져 있으나 정책이 하나도 없어 anon/authenticated 모두 read/write 불가.
-- 또한 (user_id, name) 중복 저장 방지 제약이 없었음.

-- 1) 동일 유저가 같은 장소(대소문자 무시)를 중복 저장한 기존 데이터 정리
delete from public.interest_places a
  using public.interest_places b
  where a.user_id = b.user_id
    and lower(a.name) = lower(b.name)
    and a.ctid < b.ctid;

-- 2) 중복 저장 방지 (대소문자 무시)
create unique index if not exists interest_places_user_name_uidx
  on public.interest_places (user_id, lower(name));

-- 3) RLS 정책: 본인 행만 조회/추가/삭제
alter table public.interest_places enable row level security;

drop policy if exists interest_places_select_own on public.interest_places;
create policy interest_places_select_own on public.interest_places
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists interest_places_insert_own on public.interest_places;
create policy interest_places_insert_own on public.interest_places
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists interest_places_delete_own on public.interest_places;
create policy interest_places_delete_own on public.interest_places
  for delete to authenticated
  using (user_id = auth.uid());

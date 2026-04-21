-- OAuth 신규 유저 생성 시 "Database error saving new user"가 발생하는 대표 원인:
-- auth.users INSERT 트리거가 public 쪽 테이블에 insert 하려다 실패(테이블 없음/제약조건/RLS/권한).
-- 이 마이그레이션은 트리거 대상 테이블을 만들고, 실패해도 auth 생성 자체는 막지 않도록 안전하게 처리한다.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at 자동 갱신(있으면 재사용)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'profiles_updated_at'
  ) then
    create trigger profiles_updated_at
      before update on public.profiles
      for each row
      execute function public.set_updated_at();
  end if;
exception when undefined_function then
  -- 프로젝트에 set_updated_at()가 없으면 트리거는 생략(핵심은 auth 신규 유저 생성 실패 방지)
  null;
end $$;

-- 신규 auth.users 생성 시 profiles row를 best-effort로 만든다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'preferred_username', ''),
      nullif(new.email, ''),
      '여행자'
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'picture', ''),
      nullif(new.raw_user_meta_data->>'avatar_url', '')
    )
  )
  on conflict (id) do update set
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
exception when others then
  -- 프로필 생성 실패가 auth 사용자 생성 자체를 막지 않도록 한다.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 최소 RLS(필요 시 앱 정책에서 확장)
alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
    create policy profiles_select_own on public.profiles
      for select
      using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles
      for update
      using (auth.uid() = id);
  end if;
end $$;


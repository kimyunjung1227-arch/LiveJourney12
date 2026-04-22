-- Create profiles table to persist user display info independent of posts.

create schema if not exists internal;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  bio text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public read (for traveler search + follow lists)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_select_all'
  ) then
    create policy profiles_select_all on public.profiles
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Authenticated can insert/update their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own'
  ) then
    create policy profiles_insert_own on public.profiles
      for insert
      to authenticated
      with check (id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

-- Backfill existing users
insert into public.profiles (id, username, avatar_url)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'username', ''),
    nullif(u.raw_user_meta_data->>'name', ''),
    nullif(split_part(u.email, '@', 1), ''),
    '여행자'
  ),
  nullif(u.raw_user_meta_data->>'avatar_url', '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Keep updated_at current
create or replace function public.tg_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.tg_profiles_set_updated_at();

-- Create profile row automatically when a new auth user is created.
create or replace function internal.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      '여행자'
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
  set username = excluded.username,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end $$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function internal.handle_new_user_profile();


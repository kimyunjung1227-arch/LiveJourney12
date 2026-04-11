-- LiveJourney: Supabase 스키마(게시물/매거진/프로필) + RLS (멀티기기 동기화용)
-- Supabase Dashboard → SQL Editor에서 "전체를 그대로" 실행하세요.
-- 실행 순서:
-- 1) 이 파일(supabase-setup.sql)
-- 2) web/supabase-social-setup.sql (좋아요/댓글/팔로우/알림 등)

create extension if not exists pgcrypto;

-- ============================================================
-- 0) public.users (프로필) — 없으면 생성
--    ⚠️ 현재 당신이 붙여넣은 RLS/트리거 SQL은 public.users 테이블이 없으면 여기서 에러로 멈춥니다.
--    "에러로 중간에 멈추면" 뒤쪽(posts/magazines/policy)이 적용되지 않아 다른 기기에서 안 보이는 증상이 남습니다.
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  username text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_all" on public.users;
create policy "users_select_all" on public.users
for select to anon, authenticated using (true);

-- 회원가입 시 public.users 프로필 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(excluded.username, public.users.username),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 1) posts — 프론트(postsSupabase.js)가 기대하는 컬럼을 확정
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  author_username text null,
  author_avatar_url text null,
  content text not null default '',
  images text[] not null default '{}'::text[],
  videos text[] not null default '{}'::text[],
  location text null,
  detailed_location text null,
  place_name text null,
  region text null,
  weather jsonb null,
  tags text[] not null default '{}'::text[],
  category text null,
  category_name text null,
  likes_count integer not null default 0,
  comments jsonb not null default '[]'::jsonb,
  captured_at timestamptz null,
  created_at timestamptz not null default now()
);

-- 기존 테이블 보강(누락 컬럼 추가)
alter table public.posts add column if not exists weather jsonb null;
alter table public.posts add column if not exists images text[] not null default '{}'::text[];
alter table public.posts add column if not exists videos text[] not null default '{}'::text[];
alter table public.posts add column if not exists tags text[] not null default '{}'::text[];
alter table public.posts add column if not exists comments jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists author_username text null;
alter table public.posts add column if not exists author_avatar_url text null;
alter table public.posts add column if not exists captured_at timestamptz null;
alter table public.posts add column if not exists region text null;
alter table public.posts add column if not exists detailed_location text null;
alter table public.posts add column if not exists place_name text null;
alter table public.posts add column if not exists category text null;
alter table public.posts add column if not exists category_name text null;
alter table public.posts alter column user_id drop not null;
alter table public.posts add column if not exists is_in_app_camera boolean not null default false;
alter table public.posts add column if not exists exif_data jsonb null;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_region_created_at_idx on public.posts (region, created_at desc);

alter table public.posts enable row level security;

-- ✅ 멀티기기 표시의 핵심: 다른 기기(anon/authenticated)에서도 "읽기"가 반드시 열려 있어야 함
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts
for select to anon, authenticated using (true);

drop policy if exists "posts_insert_all" on public.posts;
create policy "posts_insert_all" on public.posts
for insert to anon, authenticated with check (true);

drop policy if exists "posts_update_all" on public.posts;
create policy "posts_update_all" on public.posts
for update to anon, authenticated using (true) with check (true);

drop policy if exists "posts_delete_all" on public.posts;
create policy "posts_delete_all" on public.posts
for delete to anon, authenticated using (true);


-- ============================================================
-- 2) magazines — 404 방지
-- ============================================================
create table if not exists public.magazines (
  id text primary key,
  title text not null default '',
  subtitle text not null default '',
  sections jsonb not null default '[]'::jsonb,
  author text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists magazines_created_at_idx on public.magazines (created_at desc);

alter table public.magazines enable row level security;

drop policy if exists "magazines_select_all" on public.magazines;
create policy "magazines_select_all" on public.magazines
for select to anon, authenticated using (true);

drop policy if exists "magazines_insert_all" on public.magazines;
create policy "magazines_insert_all" on public.magazines
for insert to anon, authenticated with check (true);

drop policy if exists "magazines_update_all" on public.magazines;
create policy "magazines_update_all" on public.magazines
for update to anon, authenticated using (true) with check (true);

drop policy if exists "magazines_delete_all" on public.magazines;
create policy "magazines_delete_all" on public.magazines
for delete to anon, authenticated using (true);


-- ============================================================
-- 3) Storage 정책(선택) — 버킷: post-images
--    버킷 자체 생성은 대시보드에서 1회 필요할 수 있음.
-- ============================================================
drop policy if exists "allow_public_upload_post_images" on storage.objects;
create policy "allow_public_upload_post_images" on storage.objects
for insert to anon, authenticated with check (bucket_id = 'post-images');

drop policy if exists "allow_public_read_post_images" on storage.objects;
create policy "allow_public_read_post_images" on storage.objects
for select to anon, authenticated using (bucket_id = 'post-images');

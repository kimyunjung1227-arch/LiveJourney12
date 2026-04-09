-- LiveJourney: Supabase 올인원 스키마/권한 설정 (한 번에 실행)
-- 목적: "업로드한 기기에서만 보임" 문제를 끝내기 위해
-- - posts/magazines/users(프로필) 테이블 및 필수 컬럼을 확정
-- - anon/authenticated에서도 posts/magazines/users SELECT 가능하도록 RLS 정책 설정
-- - 소셜(좋아요/댓글/팔로우/알림), 관리자/공지, 뱃지, Storage 정책을 한 번에 구성
--
-- 사용 방법:
-- Supabase Dashboard → SQL Editor → New query → 이 파일 전체를 그대로 실행(Run)
--
-- 주의:
-- - Storage 버킷 `post-images`는 콘솔에서 1회 생성이 필요할 수 있습니다.
-- - 운영 전환 시 posts/magazines/posts_delete 등 정책은 반드시 제한하세요.

create extension if not exists pgcrypto;

-- ============================================================
-- 0) public.users (프로필)
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

-- 회원가입 시 public.users 프로필 자동 생성
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
-- 1) public.posts (게시물)
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

-- 기존 프로젝트 보강 (누락 컬럼/제약 보정)
alter table public.posts alter column user_id drop not null;
alter table public.posts add column if not exists author_username text null;
alter table public.posts add column if not exists author_avatar_url text null;
alter table public.posts add column if not exists images text[] not null default '{}'::text[];
alter table public.posts add column if not exists videos text[] not null default '{}'::text[];
alter table public.posts add column if not exists detailed_location text null;
alter table public.posts add column if not exists place_name text null;
alter table public.posts add column if not exists region text null;
alter table public.posts add column if not exists weather jsonb null;
alter table public.posts add column if not exists tags text[] not null default '{}'::text[];
alter table public.posts add column if not exists category text null;
alter table public.posts add column if not exists category_name text null;
alter table public.posts add column if not exists likes_count integer not null default 0;
alter table public.posts add column if not exists comments jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists captured_at timestamptz null;
alter table public.posts add column if not exists created_at timestamptz not null default now();

-- 과거 스키마에서 FK가 auth.users가 아닌 곳을 가리키는 경우 방어적으로 제거
alter table public.posts drop constraint if exists posts_user_id_fkey;

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_region_created_at_idx on public.posts (region, created_at desc);

alter table public.posts enable row level security;

-- ✅ 멀티기기 표시 핵심: anon/authenticated 모두 읽기 가능
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
-- 2) public.magazines (여행 매거진)
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
-- 3) 관리자/공지 (admin_users, notices)
-- ============================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text default '공지',
  content text not null,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.admin_users enable row level security;
alter table public.notices enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "notices_select_all" on public.notices;
create policy "notices_select_all" on public.notices
for select to anon, authenticated using (true);

drop policy if exists "notices_insert_admin" on public.notices;
create policy "notices_insert_admin" on public.notices
for insert to authenticated with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "notices_update_admin" on public.notices;
create policy "notices_update_admin" on public.notices
for update to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid()))
with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "notices_delete_admin" on public.notices;
create policy "notices_delete_admin" on public.notices
for delete to authenticated using (exists (select 1 from public.admin_users where user_id = auth.uid()));

create or replace function public.set_notices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notices_updated_at on public.notices;
create trigger notices_updated_at
before update on public.notices
for each row execute procedure public.set_notices_updated_at();


-- ============================================================
-- 4) user_badges (뱃지 기록)
-- ============================================================
create table if not exists public.user_badges (
  user_id uuid not null,
  badge_name text not null,
  earned_at timestamptz default now(),
  region text,
  primary key (user_id, badge_name)
);

alter table public.user_badges enable row level security;

drop policy if exists "user_badges_select_all" on public.user_badges;
create policy "user_badges_select_all" on public.user_badges
for select to anon, authenticated using (true);

drop policy if exists "user_badges_insert_all" on public.user_badges;
create policy "user_badges_insert_all" on public.user_badges
for insert to anon, authenticated with check (true);


-- ============================================================
-- 5) Storage 정책 (버킷: post-images)
-- ============================================================
drop policy if exists "allow_public_upload_post_images" on storage.objects;
create policy "allow_public_upload_post_images" on storage.objects
for insert to anon, authenticated with check (bucket_id = 'post-images');

drop policy if exists "allow_public_read_post_images" on storage.objects;
create policy "allow_public_read_post_images" on storage.objects
for select to anon, authenticated using (bucket_id = 'post-images');

-- 프로필에서 게시물 삭제 시 Storage 파일도 함께 삭제할 수 있도록 허용
-- ⚠️ MVP 용도: 운영 전환 시에는 본인 소유 경로로 제한하는 것을 권장합니다.
drop policy if exists "allow_authenticated_delete_post_images" on storage.objects;
create policy "allow_authenticated_delete_post_images" on storage.objects
for delete to authenticated using (bucket_id = 'post-images');


-- ============================================================
-- 6) 소셜: post_likes / notifications / follows / post_comments
-- ============================================================
-- 클라이언트는 insert 대신 upsert(onConflict post_id,user_id, ignoreDuplicates)로 중복 삽입 409를 피합니다.
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes_select" on public.post_likes;
create policy "post_likes_select" on public.post_likes
for select to authenticated using (auth.uid() is not null);

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own" on public.post_likes
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own" on public.post_likes
for delete to authenticated using (auth.uid() = user_id);


create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  type text not null check (type in ('like','comment','follow','system')),
  post_id uuid null references public.posts(id) on delete cascade,
  actor_username text null,
  actor_avatar_url text null,
  thumbnail_url text null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select to authenticated using (auth.uid() = recipient_user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (auth.uid() = recipient_user_id)
with check (auth.uid() = recipient_user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
for delete to authenticated using (auth.uid() = recipient_user_id);

drop policy if exists "notifications_insert_auth" on public.notifications;
create policy "notifications_insert_auth" on public.notifications
for insert to authenticated with check (auth.uid() is not null);


create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows_select" on public.follows;
create policy "follows_select" on public.follows
for select to authenticated using (auth.uid() is not null);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
for delete to authenticated using (auth.uid() = follower_id);


create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  username text null,
  avatar_url text null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at asc);

alter table public.post_comments enable row level security;

drop policy if exists "post_comments_select" on public.post_comments;
create policy "post_comments_select" on public.post_comments
for select to authenticated using (auth.uid() is not null);

drop policy if exists "post_comments_insert_auth" on public.post_comments;
create policy "post_comments_insert_auth" on public.post_comments
for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own" on public.post_comments
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments
for delete to authenticated using (auth.uid() = user_id);


-- ============================================================
-- 7) likes_count 자동 유지 (post_likes 트리거)
-- ============================================================
create or replace function public.recalc_post_likes_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = (select count(*) from public.post_likes where post_id = p_post_id)
  where id = p_post_id;
end;
$$;

create or replace function public.on_post_likes_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_post_likes_count(coalesce(new.post_id, old.post_id));
  return null;
end;
$$;

drop trigger if exists post_likes_after_change on public.post_likes;
create trigger post_likes_after_change
after insert or delete on public.post_likes
for each row execute procedure public.on_post_likes_changed();

-- ============================================================
-- 8) 좋아요 RPC (409 완전 제거용)
-- ============================================================
create or replace function public.like_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.post_likes (post_id, user_id)
  values (p_post_id, auth.uid())
  on conflict (post_id, user_id) do nothing;

  get diagnostics inserted = row_count > 0;

  perform public.recalc_post_likes_count(p_post_id);
  return inserted;
end;
$$;

create or replace function public.unlike_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from public.post_likes
  where post_id = p_post_id and user_id = auth.uid();

  get diagnostics deleted = row_count > 0;

  perform public.recalc_post_likes_count(p_post_id);
  return deleted;
end;
$$;

grant execute on function public.like_post(uuid) to authenticated;
grant execute on function public.unlike_post(uuid) to authenticated;


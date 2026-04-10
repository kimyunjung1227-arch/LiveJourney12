-- LiveJourney: 멀티계정 동기화용 소셜 테이블
-- Supabase SQL Editor에서 "전체를 그대로" 실행하세요.
-- (Postgres는 `create policy if not exists`를 지원하지 않아서 drop→create로 구성합니다.)

-- gen_random_uuid() 사용을 위해 필요
create extension if not exists pgcrypto;

-- 1) 게시물 좋아요(사용자별)
-- 앱: insert 후 409/23505(중복)은 "이미 좋아요"로 멱등 처리(호스트마다 upsert ignoreDuplicates 동작이 다름).
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

-- 로그인한 사용자는 좋아요를 생성/삭제/조회 가능 (RLS)
drop policy if exists "post_likes_select" on public.post_likes;
create policy "post_likes_select" on public.post_likes
for select using (auth.uid() is not null);

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own" on public.post_likes
for insert with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own" on public.post_likes
for delete using (auth.uid() = user_id);

-- 2) 사용자 알림(수신자 기준)
-- 기존 notifications 테이블이 이미 있고 컬럼명이 다르면(예: 과거 스키마)
-- 필요한 컬럼을 추가해 호환되게 만듭니다.
do $$
begin
  if to_regclass('public.notifications') is not null then
    -- recipient_user_id
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'recipient_user_id'
    ) then
      alter table public.notifications add column recipient_user_id uuid;
      -- best-effort 백필(컬럼명이 다를 수 있어 예외는 무시)
      begin
        if exists (
          select 1 from information_schema.columns
          where table_schema='public' and table_name='notifications' and column_name='recipientuserid'
        ) then
          execute 'update public.notifications set recipient_user_id = recipientuserid::uuid where recipient_user_id is null';
        end if;
      exception when others then
        null;
      end;
      begin
        if exists (
          select 1 from information_schema.columns
          where table_schema='public' and table_name='notifications' and column_name='user_id'
        ) then
          execute 'update public.notifications set recipient_user_id = user_id::uuid where recipient_user_id is null';
        end if;
      exception when others then
        null;
      end;
    end if;

    -- actor_user_id
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'actor_user_id'
    ) then
      alter table public.notifications add column actor_user_id uuid;
    end if;

    -- type
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'type'
    ) then
      alter table public.notifications add column type text;
    end if;

    -- post_id
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'post_id'
    ) then
      alter table public.notifications add column post_id uuid;
    end if;

    -- message
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'message'
    ) then
      alter table public.notifications add column message text;
    end if;

    -- read
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'read'
    ) then
      alter table public.notifications add column read boolean not null default false;
    end if;

    -- created_at
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'created_at'
    ) then
      alter table public.notifications add column created_at timestamptz not null default now();
    end if;
  end if;
end $$;

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

-- 수신자는 자기 알림만 조회/읽음/삭제 가능
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select using (auth.uid() = recipient_user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update using (auth.uid() = recipient_user_id) with check (auth.uid() = recipient_user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
for delete using (auth.uid() = recipient_user_id);

-- 알림 생성은 로그인한 사용자라면 가능(시연/테스트 용도)
-- 운영에서는 더 엄격하게(예: RPC/서버)로 바꿀 수 있습니다.
drop policy if exists "notifications_insert_auth" on public.notifications;
create policy "notifications_insert_auth" on public.notifications
for insert with check (auth.uid() is not null);

-- 3) 팔로우(사용자별)
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows_select" on public.follows;
create policy "follows_select" on public.follows
for select using (auth.uid() is not null);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
for insert with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
for delete using (auth.uid() = follower_id);

-- 4) 댓글(경합 방지: posts.comments 배열 대신 테이블로 저장)
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
for select using (auth.uid() is not null);

drop policy if exists "post_comments_insert_auth" on public.post_comments;
create policy "post_comments_insert_auth" on public.post_comments
for insert with check (auth.uid() is not null);

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own" on public.post_comments
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments
for delete using (auth.uid() = user_id);

-- 5) likes_count 자동 유지(재진입/동기화 안정화)
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
for each row execute function public.on_post_likes_changed();

-- 6) 좋아요 RPC (409 완전 제거용)
-- insert ... on conflict do nothing 을 DB에서 처리하면 PostgREST 409가 발생하지 않습니다.
create or replace function public.like_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rc integer := 0;
begin
  if auth.uid() is null then
    return false;
  end if;

  begin
    insert into public.post_likes (post_id, user_id)
    values (p_post_id, auth.uid())
    on conflict (post_id, user_id) do nothing;
  exception
    when unique_violation then
      rc := 0;
    when foreign_key_violation then
      return false;
    when others then
      return false;
  end;

  get diagnostics rc = row_count;

  perform public.recalc_post_likes_count(p_post_id);
  return (rc > 0);
end;
$$;

create or replace function public.unlike_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rc integer := 0;
begin
  if auth.uid() is null then
    return false;
  end if;

  delete from public.post_likes
  where post_id = p_post_id and user_id = auth.uid();

  get diagnostics rc = row_count;

  perform public.recalc_post_likes_count(p_post_id);
  return (rc > 0);
end;
$$;

grant execute on function public.like_post(uuid) to authenticated;
grant execute on function public.unlike_post(uuid) to authenticated;

-- 7) 좋아요 설정 RPC (프론트 최종값 즉시 반영용)
drop function if exists public.set_post_like(uuid, boolean);
drop function if exists public.set_post_like(text, boolean);
create or replace function public.set_post_like(p_post_id text, p_like boolean)
returns table (is_liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
  v_count integer := 0;
begin
  begin
    v_post_id := p_post_id::uuid;
  exception when others then
    return query select false, 0;
    return;
  end;

  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  begin
    if p_like then
      insert into public.post_likes (post_id, user_id)
      values (v_post_id, auth.uid())
      on conflict (post_id, user_id) do nothing;
    else
      delete from public.post_likes
      where post_id = v_post_id and user_id = auth.uid();
    end if;
  exception when others then
    null;
  end;

  select count(*) into v_count
  from public.post_likes pl
  where pl.post_id = v_post_id;

  begin
    update public.posts p
    set likes_count = v_count
    where p.id = v_post_id;
  exception when others then
    null;
  end;

  return query
    select
      exists(select 1 from public.post_likes where post_id = v_post_id and user_id = auth.uid()) as is_liked,
      v_count as likes_count;
end;
$$;

grant execute on function public.set_post_like(text, boolean) to authenticated;

-- 보안/디버깅: 익명(anon) 호출 시 "0으로 보이는 정상 응답"처럼 나오지 않게 차단
revoke execute on function public.set_post_like(text, boolean) from anon;
revoke execute on function public.set_post_like(text, boolean) from public;


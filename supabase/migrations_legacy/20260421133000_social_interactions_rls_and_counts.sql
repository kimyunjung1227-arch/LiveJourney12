-- Ensure social interaction tables, RLS, and server-side counters/notifications work consistently across devices.
-- This migration is defensive: it only creates/updates objects if their dependencies exist.

create extension if not exists pgcrypto;

-- 0) Ensure core interaction tables exist (if your project already has them, these are no-ops)
do $$
begin
  if to_regclass('public.posts') is null then
    -- posts table is expected to exist in this project; do not create it here.
    raise notice 'public.posts not found; skipping likes/comments counters setup.';
    return;
  end if;

  -- post_likes
  if to_regclass('public.post_likes') is null then
    create table public.post_likes (
      user_id uuid not null references auth.users(id) on delete cascade,
      post_id uuid not null references public.posts(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, post_id)
    );
  end if;

  -- post_comments
  if to_regclass('public.post_comments') is null then
    create table public.post_comments (
      id uuid primary key default gen_random_uuid(),
      post_id uuid not null references public.posts(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      username text null,
      avatar_url text null,
      content text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at asc);
  end if;

  -- follows
  if to_regclass('public.follows') is null then
    create table public.follows (
      follower_id uuid not null references auth.users(id) on delete cascade,
      following_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (follower_id, following_id)
    );
    create index if not exists follows_following_idx on public.follows (following_id);
  end if;
end $$;

-- 1) RLS policies for interaction tables (required for multi-device reads/writes)
do $$
begin
  if to_regclass('public.post_likes') is not null then
    alter table public.post_likes enable row level security;
    drop policy if exists post_likes_select_all on public.post_likes;
    create policy post_likes_select_all on public.post_likes for select using (true);
    drop policy if exists post_likes_insert_own on public.post_likes;
    create policy post_likes_insert_own on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
    drop policy if exists post_likes_delete_own on public.post_likes;
    create policy post_likes_delete_own on public.post_likes for delete to authenticated using (auth.uid() = user_id);
  end if;

  if to_regclass('public.post_comments') is not null then
    alter table public.post_comments enable row level security;
    drop policy if exists post_comments_select_all on public.post_comments;
    create policy post_comments_select_all on public.post_comments for select using (true);
    drop policy if exists post_comments_insert_own on public.post_comments;
    create policy post_comments_insert_own on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
    drop policy if exists post_comments_update_own on public.post_comments;
    create policy post_comments_update_own on public.post_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    drop policy if exists post_comments_delete_own on public.post_comments;
    create policy post_comments_delete_own on public.post_comments for delete to authenticated using (auth.uid() = user_id);
  end if;

  if to_regclass('public.follows') is not null then
    alter table public.follows enable row level security;
    drop policy if exists follows_select_all on public.follows;
    create policy follows_select_all on public.follows for select using (true);
    drop policy if exists follows_insert_own on public.follows;
    create policy follows_insert_own on public.follows for insert to authenticated with check (auth.uid() = follower_id);
    drop policy if exists follows_delete_own on public.follows;
    create policy follows_delete_own on public.follows for delete to authenticated using (auth.uid() = follower_id);
  end if;
end $$;

-- 2) Ensure server-side counters exist on posts and are maintained by triggers
do $$
begin
  if to_regclass('public.posts') is null then return; end if;

  alter table public.posts add column if not exists likes_count integer not null default 0;
  alter table public.posts add column if not exists comments_count integer not null default 0;
end $$;

create or replace function public.recalc_post_likes_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.post_likes') is null then
    return;
  end if;
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
declare
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  perform public.recalc_post_likes_count(v_post_id);
  return null;
end;
$$;

do $$
begin
  if to_regclass('public.post_likes') is not null then
    drop trigger if exists post_likes_after_change on public.post_likes;
    create trigger post_likes_after_change
      after insert or delete on public.post_likes
      for each row execute function public.on_post_likes_changed();
  end if;
end $$;

-- Backfill counters (best-effort)
do $$
begin
  if to_regclass('public.posts') is null then return; end if;
  if to_regclass('public.post_likes') is not null then
    update public.posts p
    set likes_count = coalesce(x.cnt, 0)
    from (
      select post_id, count(*)::int as cnt
      from public.post_likes
      group by post_id
    ) x
    where p.id = x.post_id;
  end if;
  if to_regclass('public.post_comments') is not null then
    update public.posts p
    set comments_count = coalesce(x.cnt, 0)
    from (
      select post_id, count(*)::int as cnt
      from public.post_comments
      group by post_id
    ) x
    where p.id = x.post_id;
  end if;
end $$;

-- 3) Ensure notification triggers are installed only when tables exist
do $$
begin
  if to_regclass('public.notifications') is null then
    -- notifications table should be created by 20260420090000_social_notifications.sql
    return;
  end if;

  -- like/comment/follow triggers (functions are created in existing migrations; only wire triggers if tables exist)
  if to_regclass('public.post_likes') is not null and to_regproc('public._lj_on_post_like_created()') is not null then
    drop trigger if exists lj_post_likes_notify on public.post_likes;
    create trigger lj_post_likes_notify
      after insert on public.post_likes
      for each row execute function public._lj_on_post_like_created();
  end if;

  if to_regclass('public.post_comments') is not null and to_regproc('public._lj_on_post_comment_created()') is not null then
    drop trigger if exists lj_post_comments_notify on public.post_comments;
    create trigger lj_post_comments_notify
      after insert on public.post_comments
      for each row execute function public._lj_on_post_comment_created();
  end if;

  if to_regclass('public.follows') is not null and to_regproc('public._lj_on_follow_created()') is not null then
    drop trigger if exists lj_follows_notify on public.follows;
    create trigger lj_follows_notify
      after insert on public.follows
      for each row execute function public._lj_on_follow_created();
  end if;
end $$;


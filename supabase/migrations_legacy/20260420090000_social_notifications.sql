-- 소셜 상호작용 알림(좋아요/댓글/팔로우) 자동 생성
-- 목적: 클라이언트에서 직접 notifications insert 하지 않아도,
--       DB에서 "상호작용 이벤트"가 발생하면 수신자에게 알림 row가 자동으로 쌓이게 한다.
--
-- 구성:
-- - public.notifications 테이블(없으면 생성)
-- - notifications.event_key(중복 방지용) + unique index
-- - post_likes / post_comments / follows에 AFTER INSERT 트리거로 알림 자동 생성

create extension if not exists pgcrypto;

-- 1) notifications 테이블(없으면 생성) + event_key(중복 방지용)
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

alter table public.notifications add column if not exists event_key text;

create unique index if not exists notifications_event_key_uidx
  on public.notifications (event_key)
  where event_key is not null;

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

-- 트리거가 SECURITY DEFINER로 insert할 수 있도록(테이블 오너로 실행됨)
drop policy if exists "notifications_insert_auth" on public.notifications;
create policy "notifications_insert_auth" on public.notifications
for insert to authenticated with check (auth.uid() is not null);


-- 2) 공통: actor 표시 이름/아바타 조회 (public.users가 있으면 우선)
create or replace function public._lj_actor_profile(p_user_id uuid)
returns table (username text, avatar_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.users') is not null then
    return query
      select
        nullif(trim(coalesce(u.username, split_part(u.email, '@', 1), '')), '') as username,
        nullif(trim(coalesce(u.avatar_url, '')), '') as avatar_url
      from public.users u
      where u.id = p_user_id
      limit 1;
    if found then
      return;
    end if;
  end if;

  -- fallback
  return query select '여행자'::text, null::text;
end;
$$;


-- 3) 공통: 알림 insert (event_key로 중복 방지)
create or replace function public._lj_insert_notification(
  p_event_key text,
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_type text,
  p_post_id uuid,
  p_message text,
  p_actor_username text,
  p_actor_avatar_url text,
  p_thumbnail_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_user_id is null then
    return;
  end if;
  if p_actor_user_id is not null and p_recipient_user_id = p_actor_user_id then
    return; -- 자기 자신에게는 알림 보내지 않음
  end if;

  insert into public.notifications (
    event_key,
    recipient_user_id,
    actor_user_id,
    type,
    post_id,
    actor_username,
    actor_avatar_url,
    thumbnail_url,
    message,
    read
  ) values (
    p_event_key,
    p_recipient_user_id,
    p_actor_user_id,
    p_type,
    p_post_id,
    p_actor_username,
    p_actor_avatar_url,
    p_thumbnail_url,
    p_message,
    false
  )
  on conflict (event_key) do nothing;
end;
$$;


-- 4) 좋아요 → 게시물 작성자에게 알림
create or replace function public._lj_on_post_like_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_imgs text[];
  v_thumb text;
  v_actor_name text;
  v_actor_avatar text;
  v_key text;
begin
  select p.user_id, p.images
    into v_owner, v_imgs
  from public.posts p
  where p.id = new.post_id
  limit 1;

  if v_owner is null then
    return null;
  end if;

  v_thumb := null;
  if v_imgs is not null and array_length(v_imgs, 1) >= 1 then
    v_thumb := v_imgs[1];
  end if;

  select ap.username, ap.avatar_url into v_actor_name, v_actor_avatar
  from public._lj_actor_profile(new.user_id) ap;
  v_actor_name := coalesce(nullif(trim(v_actor_name), ''), '여행자');

  v_key := 'like:' || new.post_id::text || ':' || new.user_id::text;

  perform public._lj_insert_notification(
    v_key,
    v_owner,
    new.user_id,
    'like',
    new.post_id,
    v_actor_name || '님이 회원님이 올린 정보를 좋아합니다.',
    v_actor_name,
    v_actor_avatar,
    v_thumb
  );

  return null;
end;
$$;

drop trigger if exists lj_post_likes_notify on public.post_likes;
create trigger lj_post_likes_notify
after insert on public.post_likes
for each row execute function public._lj_on_post_like_created();


-- 5) 댓글 → 게시물 작성자에게 알림
create or replace function public._lj_on_post_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_imgs text[];
  v_thumb text;
  v_actor_name text;
  v_actor_avatar text;
  v_key text;
begin
  select p.user_id, p.images
    into v_owner, v_imgs
  from public.posts p
  where p.id = new.post_id
  limit 1;

  if v_owner is null then
    return null;
  end if;

  v_thumb := null;
  if v_imgs is not null and array_length(v_imgs, 1) >= 1 then
    v_thumb := v_imgs[1];
  end if;

  v_actor_name := coalesce(nullif(trim(new.username), ''), nullif(trim((select username from public._lj_actor_profile(new.user_id))), ''), '여행자');
  v_actor_avatar := coalesce(nullif(trim(new.avatar_url), ''), (select avatar_url from public._lj_actor_profile(new.user_id)));

  v_key := 'comment:' || new.id::text;

  perform public._lj_insert_notification(
    v_key,
    v_owner,
    new.user_id,
    'comment',
    new.post_id,
    v_actor_name || '님이 회원님이 올린 정보에 댓글을 남겼습니다.',
    v_actor_name,
    v_actor_avatar,
    v_thumb
  );

  return null;
end;
$$;

drop trigger if exists lj_post_comments_notify on public.post_comments;
create trigger lj_post_comments_notify
after insert on public.post_comments
for each row execute function public._lj_on_post_comment_created();


-- 6) 팔로우 → 팔로우 당한 사람에게 알림
create or replace function public._lj_on_follow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_actor_avatar text;
  v_key text;
begin
  select ap.username, ap.avatar_url into v_actor_name, v_actor_avatar
  from public._lj_actor_profile(new.follower_id) ap;
  v_actor_name := coalesce(nullif(trim(v_actor_name), ''), '여행자');

  v_key := 'follow:' || new.follower_id::text || ':' || new.following_id::text;

  perform public._lj_insert_notification(
    v_key,
    new.following_id,
    new.follower_id,
    'follow',
    null,
    v_actor_name || '님이 회원님을 팔로우하기 시작했습니다',
    v_actor_name,
    v_actor_avatar,
    null
  );

  return null;
end;
$$;

drop trigger if exists lj_follows_notify on public.follows;
create trigger lj_follows_notify
after insert on public.follows
for each row execute function public._lj_on_follow_created();


-- 알림 확장: 뱃지 획득 + 팔로잉 유저의 새 게시물 알림
-- - notifications.type: post/badge 추가
-- - user_badges insert → badge 알림 생성
-- - posts insert → 팔로워들에게 post 알림 생성

create extension if not exists pgcrypto;

-- 1) notifications.type CHECK 제약 확장 (like/comment/follow/system → + post/badge)
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%type%in%';
  if cname is not null then
    execute format('alter table public.notifications drop constraint %I', cname);
  end if;
exception when others then
  null;
end $$;

alter table public.notifications
  add constraint notifications_type_check check (type in ('like','comment','follow','post','badge','system'));


-- 2) user_badges → badge 알림
create or replace function public._lj_on_user_badge_earned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge text;
  v_key text;
begin
  v_badge := coalesce(nullif(trim(new.badge_name), ''), '뱃지');
  v_key := 'badge:' || new.user_id::text || ':' || v_badge;

  -- NOTE: 프론트에서 system 메시지에 '뱃지를 획득'이 포함되면 badge로 렌더링하는 로직이 있으나,
  --       앞으로는 type='badge'도 허용하므로 명확하게 badge 타입으로 저장한다.
  perform public._lj_insert_notification(
    v_key,
    new.user_id,
    null,
    'badge',
    null,
    '"' || v_badge || '" 뱃지를 획득했습니다!',
    null,
    null,
    null
  );

  return null;
end;
$$;

do $$
begin
  if to_regclass('public.user_badges') is not null then
    drop trigger if exists lj_user_badges_notify on public.user_badges;
    create trigger lj_user_badges_notify
    after insert on public.user_badges
    for each row execute function public._lj_on_user_badge_earned();
  end if;
end $$;


-- 3) posts → 팔로워들에게 새 게시물 알림
create or replace function public._lj_on_post_created_notify_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_actor_avatar text;
  v_thumb text;
  v_rec uuid;
  v_key text;
begin
  -- 작성자 프로필
  select ap.username, ap.avatar_url into v_actor_name, v_actor_avatar
  from public._lj_actor_profile(new.user_id) ap;
  v_actor_name := coalesce(nullif(trim(v_actor_name), ''), '여행자');

  -- 썸네일(첫 이미지)
  v_thumb := null;
  if new.images is not null and array_length(new.images, 1) >= 1 then
    v_thumb := new.images[1];
  end if;

  -- 팔로워에게 개별 알림 생성 (event_key로 중복 방지)
  for v_rec in
    select f.follower_id
    from public.follows f
    where f.following_id = new.user_id
  loop
    v_key := 'post:' || new.id::text || ':' || v_rec::text;
    perform public._lj_insert_notification(
      v_key,
      v_rec,
      new.user_id,
      'post',
      new.id,
      v_actor_name || '님이 새 게시물을 올렸습니다.',
      v_actor_name,
      v_actor_avatar,
      v_thumb
    );
  end loop;

  return null;
end;
$$;

do $$
begin
  if to_regclass('public.posts') is not null and to_regclass('public.follows') is not null then
    drop trigger if exists lj_posts_notify_followers on public.posts;
    create trigger lj_posts_notify_followers
    after insert on public.posts
    for each row execute function public._lj_on_post_created_notify_followers();
  end if;
end $$;


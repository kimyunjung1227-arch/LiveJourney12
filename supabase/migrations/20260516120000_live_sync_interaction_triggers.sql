-- LiveJourney: 라이브 싱크 상호작용 가산/감산 트리거
-- - 기존 compute_live_sync_pct 기반 recompute 트리거는 클라이언트의 EXIF/체온점수식 가감과
--   충돌하기 때문에(매번 공식 재계산으로 덮어씀) 제거하고, "받은 상호작용"에 대한
--   직접 ±N delta 트리거로 일원화한다.
-- - "준 상호작용"(좋아요·댓글 등 본인 행위)은 클라이언트 bumpLiveSync* 에서 처리.
-- - 모든 함수는 SECURITY DEFINER 로 RLS 우회.

create or replace function public.lj_adjust_live_sync(p_user_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_user_id is null or p_delta is null or p_delta = 0 then
    return;
  end if;
  if to_regclass('public.profiles') is null then
    return;
  end if;
  update public.profiles
  set live_sync_pct = greatest(0, least(100, coalesce(live_sync_pct, 35) + p_delta)),
      live_sync_updated_at = now()
  where id = p_user_id;
end;
$$;

-- 기존 recompute 기반 트리거 제거 (계속 두면 매 이벤트마다 compute_live_sync_pct가
-- 클라이언트 가감을 덮어쓰게 됨)
do $$ begin
  if to_regclass('public.posts') is not null then
    drop trigger if exists lj_posts_live_sync_after_change on public.posts;
  end if;
  if to_regclass('public.post_likes') is not null then
    drop trigger if exists lj_post_likes_live_sync_after_change on public.post_likes;
  end if;
  if to_regclass('public.help_answer_accepts') is not null then
    drop trigger if exists lj_help_answer_accepts_live_sync_after_insert on public.help_answer_accepts;
  end if;
end $$;

-- 1) 게시물 좋아요 받음/취소: 게시물 작성자 ±1 (셀프 좋아요는 무시)
create or replace function public.tg_lj_post_likes_adjust_author()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_author uuid;
  v_actor uuid;
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  v_actor := coalesce(new.user_id, old.user_id);
  if v_post_id is null then
    return null;
  end if;
  select user_id into v_author from public.posts where id = v_post_id;
  if v_author is null or v_author = v_actor then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.lj_adjust_live_sync(v_author, 1);
  elsif tg_op = 'DELETE' then
    perform public.lj_adjust_live_sync(v_author, -1);
  end if;
  return null;
end;
$$;

do $$ begin
  if to_regclass('public.post_likes') is not null then
    drop trigger if exists lj_post_likes_adjust_author on public.post_likes;
    create trigger lj_post_likes_adjust_author
      after insert or delete on public.post_likes
      for each row execute function public.tg_lj_post_likes_adjust_author();
  end if;
end $$;

-- 2) 댓글 받음/삭제됨: 게시물 작성자 ±1 (셀프 댓글은 무시)
create or replace function public.tg_lj_post_comments_adjust_author()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_author uuid;
  v_actor uuid;
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  v_actor := coalesce(new.user_id, old.user_id);
  if v_post_id is null then
    return null;
  end if;
  select user_id into v_author from public.posts where id = v_post_id;
  if v_author is null or v_author = v_actor then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.lj_adjust_live_sync(v_author, 1);
  elsif tg_op = 'DELETE' then
    perform public.lj_adjust_live_sync(v_author, -1);
  end if;
  return null;
end;
$$;

do $$ begin
  if to_regclass('public.post_comments') is not null then
    drop trigger if exists lj_post_comments_adjust_author on public.post_comments;
    create trigger lj_post_comments_adjust_author
      after insert or delete on public.post_comments
      for each row execute function public.tg_lj_post_comments_adjust_author();
  end if;
end $$;

-- 3) 댓글 좋아요 받음/취소: 댓글 작성자 ±1 (셀프 댓글 좋아요는 무시)
create or replace function public.tg_lj_post_comment_likes_adjust_author()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_author uuid;
  v_actor uuid;
  v_comment_id uuid;
begin
  v_comment_id := coalesce(new.comment_id, old.comment_id);
  v_actor := coalesce(new.user_id, old.user_id);
  if v_comment_id is null then
    return null;
  end if;
  select user_id into v_author from public.post_comments where id = v_comment_id;
  if v_author is null or v_author = v_actor then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.lj_adjust_live_sync(v_author, 1);
  elsif tg_op = 'DELETE' then
    perform public.lj_adjust_live_sync(v_author, -1);
  end if;
  return null;
end;
$$;

do $$ begin
  if to_regclass('public.post_comment_likes') is not null then
    drop trigger if exists lj_post_comment_likes_adjust_author on public.post_comment_likes;
    create trigger lj_post_comment_likes_adjust_author
      after insert or delete on public.post_comment_likes
      for each row execute function public.tg_lj_post_comment_likes_adjust_author();
  end if;
end $$;

-- 4) Q&A 답변 채택됨: 답변자(accepted_user_id) +5
create or replace function public.tg_lj_help_answer_accepts_adjust()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.accepted_user_id is not null then
    perform public.lj_adjust_live_sync(new.accepted_user_id, 5);
  end if;
  return null;
end;
$$;

do $$ begin
  if to_regclass('public.help_answer_accepts') is not null then
    drop trigger if exists lj_help_answer_accepts_adjust on public.help_answer_accepts;
    create trigger lj_help_answer_accepts_adjust
      after insert on public.help_answer_accepts
      for each row execute function public.tg_lj_help_answer_accepts_adjust();
  end if;
end $$;

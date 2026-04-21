-- 좋아요/댓글 "갯수"를 기기/계정 상관없이 동일하게 표시하기 위한 서버 기준 카운트 유지
-- - likes_count: 기존 post_likes 기반 트리거/ RPC가 이미 유지한다고 가정
-- - comments_count: post_comments 테이블 기준으로 posts.comments_count를 DB에서 자동 갱신

create extension if not exists pgcrypto;

-- posts에 comments_count 컬럼 추가
alter table public.posts add column if not exists comments_count integer not null default 0;

-- 현재 데이터 백필 (post_comments 테이블이 있는 경우만)
do $$
begin
  if to_regclass('public.post_comments') is not null then
    update public.posts p
    set comments_count = coalesce(x.cnt, 0)
    from (
      select post_id, count(*)::int as cnt
      from public.post_comments
      group by post_id
    ) x
    where p.id = x.post_id;

    -- 댓글이 0개인 게시물도 확실히 0으로
    update public.posts p
    set comments_count = 0
    where not exists (select 1 from public.post_comments c where c.post_id = p.id);
  end if;
end $$;

-- 댓글 수 재계산 함수
create or replace function public.recalc_post_comments_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.post_comments') is null then
    return;
  end if;
  update public.posts
  set comments_count = (select count(*) from public.post_comments where post_id = p_post_id)
  where id = p_post_id;
end;
$$;

-- post_comments insert/delete 시 comments_count 갱신 트리거
create or replace function public.on_post_comments_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  perform public.recalc_post_comments_count(v_post_id);
  return null;
end;
$$;

do $$
begin
  if to_regclass('public.post_comments') is not null then
    drop trigger if exists post_comments_after_change on public.post_comments;
    create trigger post_comments_after_change
    after insert or delete on public.post_comments
    for each row execute function public.on_post_comments_changed();
  end if;
end $$;


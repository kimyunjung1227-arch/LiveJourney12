-- LiveJourney: comment replies and comment likes
--
-- Adds nested replies to post_comments and a per-user comment like table.
-- RLS keeps reads public and writes limited to the authenticated owner.

create extension if not exists pgcrypto;

alter table if exists public.post_comments
  add column if not exists parent_comment_id uuid null,
  add column if not exists likes_count integer not null default 0;

do $$
begin
  if to_regclass('public.post_comments') is not null then
    begin
      alter table public.post_comments
        add constraint post_comments_parent_comment_id_fkey
        foreign key (parent_comment_id)
        references public.post_comments(id)
        on delete cascade;
    exception
      when duplicate_object then null;
    end;

    create index if not exists post_comments_parent_created_idx
      on public.post_comments(parent_comment_id, created_at asc);
  end if;
end $$;

create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.post_comment_likes enable row level security;

drop policy if exists post_comment_likes_select_all on public.post_comment_likes;
create policy post_comment_likes_select_all
on public.post_comment_likes
for select
to public
using (true);

drop policy if exists post_comment_likes_insert_own on public.post_comment_likes;
create policy post_comment_likes_insert_own
on public.post_comment_likes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists post_comment_likes_delete_own on public.post_comment_likes;
create policy post_comment_likes_delete_own
on public.post_comment_likes
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.recalc_post_comment_likes_count(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  update public.post_comments
  set likes_count = (
    select count(*)::int
    from public.post_comment_likes
    where comment_id = p_comment_id
  )
  where id = p_comment_id;
end;
$$;

create or replace function public.on_post_comment_likes_changed()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_comment_id uuid;
begin
  v_comment_id := coalesce(new.comment_id, old.comment_id);
  perform public.recalc_post_comment_likes_count(v_comment_id);
  return null;
end;
$$;

drop trigger if exists post_comment_likes_after_change on public.post_comment_likes;
create trigger post_comment_likes_after_change
after insert or delete on public.post_comment_likes
for each row execute function public.on_post_comment_likes_changed();

update public.post_comments c
set likes_count = coalesce(x.cnt, 0)
from (
  select comment_id, count(*)::int as cnt
  from public.post_comment_likes
  group by comment_id
) x
where c.id = x.comment_id;

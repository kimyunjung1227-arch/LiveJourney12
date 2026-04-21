-- LiveJourney: fix likes_count trigger function mismatch
--
-- Problem:
-- - public.on_post_likes_changed() called recalc_post_likes_count(post_id)
-- - but only a trigger-shaped recalc_post_likes_count() existed (no args)
-- Result: post_likes INSERT/DELETE could error and rollback.
--
-- Fix:
-- - add an overload recalc_post_likes_count(uuid) that recomputes count(*)
-- - update on_post_likes_changed() to call the uuid overload

create or replace function public.recalc_post_likes_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.posts
  set likes_count = (
    select count(*)::int
    from public.post_likes
    where post_id = p_post_id
  )
  where id = p_post_id;
end;
$$;

create or replace function public.on_post_likes_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_post_id uuid;
begin
  v_post_id := coalesce(new.post_id, old.post_id);
  perform public.recalc_post_likes_count(v_post_id);
  return null;
end;
$$;


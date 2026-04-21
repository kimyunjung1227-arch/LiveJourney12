-- Deduplicate conflicting like/comment count triggers.
-- Observed triggers in production:
-- - post_likes: post_likes_after_change(on_post_likes_changed), tr_post_likes_changed(recalc_post_likes_count),
--              tr_likes_sync_engine(sync_likes_engine)
-- - post_comments: post_comments_after_change(on_post_comments_changed), tr_post_comments_sync(update_post_counts)
-- Multiple engines can fight and produce stale counts. We keep the simple COUNT(*) based recalculation triggers.

do $$
begin
  -- Likes: keep ONE counter trigger
  if to_regclass('public.post_likes') is not null then
    -- Drop custom/legacy engines if present
    drop trigger if exists tr_likes_sync_engine on public.post_likes;
    drop trigger if exists tr_post_likes_changed on public.post_likes;

    -- Ensure our trigger exists (created in 20260421133000_... but re-create defensively)
    drop trigger if exists post_likes_after_change on public.post_likes;
    create trigger post_likes_after_change
      after insert or delete on public.post_likes
      for each row execute function public.on_post_likes_changed();
  end if;

  -- Comments: keep ONE counter trigger
  if to_regclass('public.post_comments') is not null then
    drop trigger if exists tr_post_comments_sync on public.post_comments;

    drop trigger if exists post_comments_after_change on public.post_comments;
    create trigger post_comments_after_change
      after insert or delete on public.post_comments
      for each row execute function public.on_post_comments_changed();
  end if;
end $$;


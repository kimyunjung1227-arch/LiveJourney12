-- Fix: deleting a post can fail if notifications.post_id FK isn't cascading.
-- Ensure notifications_post_id_fkey is ON DELETE/UPDATE CASCADE.

alter table if exists public.notifications
  drop constraint if exists notifications_post_id_fkey;

alter table if exists public.notifications
  add constraint notifications_post_id_fkey
  foreign key (post_id)
  references public.posts(id)
  on delete cascade
  on update cascade;


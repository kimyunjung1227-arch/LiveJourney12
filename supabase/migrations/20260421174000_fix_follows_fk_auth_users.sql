-- LiveJourney: fix follows FK to auth.users
--
-- Why
-- - Some legacy SQL created follows FK referencing public.users(id).
-- - If a profile row is missing, follows insert fails with FK violation (often surfaced as 409).
--
-- Fix
-- - Ensure follows(follower_id, following_id) references auth.users(id).

alter table public.follows drop constraint if exists follows_follower_id_fkey;
alter table public.follows drop constraint if exists follows_following_id_fkey;

alter table public.follows
  add constraint follows_follower_id_fkey
  foreign key (follower_id) references auth.users(id) on delete cascade;

alter table public.follows
  add constraint follows_following_id_fkey
  foreign key (following_id) references auth.users(id) on delete cascade;


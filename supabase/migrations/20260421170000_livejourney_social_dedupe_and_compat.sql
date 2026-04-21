-- LiveJourney: Social dedupe + legacy/new compat (A plan)
--
-- Goal
-- - Keep all "all-in-one SQL" capabilities, but remove conflicts.
-- - Ensure legacy notification inserts (recipient_id/actor_id) and new schema (recipient_user_id/actor_user_id)
--   both work without breaking RLS.
-- - Prevent like counters from breaking due to duplicated function signatures.
--
-- Key changes
-- 1) notifications BEFORE INSERT trigger: fill legacy/new columns consistently.
-- 2) legacy create_social_notification() remains available but writes using the modern columns too.
-- 3) like_post/unlike_post updated to be RLS-independent (row_security off).
-- 4) Remove unused trigger-shaped recalc_post_likes_count() to avoid signature confusion.

-- 1) notifications: unify legacy/new columns
CREATE OR REPLACE FUNCTION public._lj_notifications_fill_legacy_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- legacy -> new
  IF NEW.recipient_user_id IS NULL THEN
    NEW.recipient_user_id := NEW.recipient_id;
  END IF;
  IF NEW.actor_user_id IS NULL THEN
    NEW.actor_user_id := NEW.actor_id;
  END IF;

  -- new -> legacy
  IF NEW.recipient_id IS NULL THEN
    NEW.recipient_id := NEW.recipient_user_id;
  END IF;
  IF NEW.actor_id IS NULL THEN
    NEW.actor_id := NEW.actor_user_id;
  END IF;

  -- very-legacy column
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.recipient_user_id;
  END IF;

  -- read / is_read sync
  IF NEW.read IS NULL THEN
    NEW.read := coalesce(NEW.is_read, false);
  END IF;
  IF NEW.is_read IS NULL THEN
    NEW.is_read := NEW.read;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) legacy create_social_notification(): keep, but write modern columns
CREATE OR REPLACE FUNCTION public.create_social_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_recipient uuid;
  v_type text;
  v_msg text;
  v_post_id uuid;
BEGIN
  IF (TG_TABLE_NAME = 'post_likes') THEN
    SELECT user_id INTO v_recipient FROM public.posts WHERE id = NEW.post_id;
    v_type := 'like';
    v_msg := '님이 회원님의 게시물을 좋아합니다.';
    v_post_id := NEW.post_id;
  ELSIF (TG_TABLE_NAME = 'post_comments') THEN
    SELECT user_id INTO v_recipient FROM public.posts WHERE id = NEW.post_id;
    v_type := 'comment';
    v_msg := '님이 댓글을 남겼습니다.';
    v_post_id := NEW.post_id;
  ELSIF (TG_TABLE_NAME = 'follows') THEN
    v_recipient := NEW.following_id;
    v_type := 'follow';
    v_msg := '님이 회원님을 팔로우하기 시작했습니다.';
    v_post_id := NULL;
  ELSE
    RETURN NEW;
  END IF;

  IF v_recipient IS NOT NULL AND auth.uid() IS NOT NULL AND v_recipient != auth.uid() THEN
    INSERT INTO public.notifications (
      recipient_user_id,
      actor_user_id,
      recipient_id,
      actor_id,
      type,
      post_id,
      message,
      read,
      created_at
    ) VALUES (
      v_recipient,
      auth.uid(),
      v_recipient,
      auth.uid(),
      v_type,
      v_post_id,
      v_msg,
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3) like_post/unlike_post: stability
CREATE OR REPLACE FUNCTION public.like_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  rc integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.post_likes (post_id, user_id)
    VALUES (p_post_id, auth.uid())
    ON CONFLICT (post_id, user_id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      rc := 0;
    WHEN foreign_key_violation THEN
      RETURN false;
    WHEN OTHERS THEN
      RETURN false;
  END;

  GET DIAGNOSTICS rc = row_count;
  PERFORM public.recalc_post_likes_count(p_post_id);
  RETURN (rc > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.unlike_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  rc integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.post_likes
  WHERE post_id = p_post_id AND user_id = auth.uid();

  GET DIAGNOSTICS rc = row_count;
  PERFORM public.recalc_post_likes_count(p_post_id);
  RETURN (rc > 0);
END;
$$;

-- 4) Remove unused trigger-shaped recalc_post_likes_count()
DROP FUNCTION IF EXISTS public.recalc_post_likes_count();


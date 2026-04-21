-- LiveJourney: RLS policy cleanup + like count stability
--
-- Why
-- - Duplicate/conflicting RLS policies caused unpredictable behavior.
-- - Some policies referenced legacy columns (e.g. notifications.recipient_id).
-- - likes_count updates should not rely on permissive UPDATE policies on posts.
--
-- What
-- 1) Replace RLS policies for public.post_likes with a minimal, deterministic set.
-- 2) Replace RLS policies for public.notifications to use recipient_user_id consistently.
-- 3) Ensure like count recalculation functions can update posts regardless of posts UPDATE policies
--    by setting `row_security` to off inside SECURITY DEFINER functions.

-- 1) post_likes policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='post_likes'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_likes', r.policyname);
  END LOOP;
END $$;

CREATE POLICY post_likes_select_all
ON public.post_likes
FOR SELECT
TO public
USING (true);

CREATE POLICY post_likes_insert_own
ON public.post_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY post_likes_delete_own
ON public.post_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2) notifications policies
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', r.policyname);
  END LOOP;
END $$;

CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_user_id)
WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE POLICY notifications_insert_auth
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Like count functions (RLS-independent updates)
CREATE OR REPLACE FUNCTION public.recalc_post_likes_count(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  UPDATE public.posts
  SET likes_count = (
    SELECT count(*)::int
    FROM public.post_likes
    WHERE post_id = p_post_id
  )
  WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_post_likes_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_post_id uuid;
BEGIN
  v_post_id := coalesce(NEW.post_id, OLD.post_id);
  PERFORM public.recalc_post_likes_count(v_post_id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_post_like(p_post_id text, p_like boolean)
RETURNS TABLE(is_liked boolean, likes_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_post_id uuid;
  v_count integer := 0;
BEGIN
  BEGIN
    v_post_id := p_post_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END;

  IF auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT false, coalesce((SELECT p.likes_count FROM public.posts p WHERE p.id = v_post_id), 0);
    RETURN;
  END IF;

  BEGIN
    IF p_like THEN
      INSERT INTO public.post_likes (post_id, user_id)
      VALUES (v_post_id, auth.uid())
      ON CONFLICT (post_id, user_id) DO NOTHING;
    ELSE
      DELETE FROM public.post_likes
      WHERE post_id = v_post_id AND user_id = auth.uid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT count(*) INTO v_count
  FROM public.post_likes pl
  WHERE pl.post_id = v_post_id;

  BEGIN
    UPDATE public.posts p
    SET likes_count = v_count
    WHERE p.id = v_post_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
    SELECT
      EXISTS(SELECT 1 FROM public.post_likes WHERE post_id = v_post_id AND user_id = auth.uid()) AS is_liked,
      v_count AS likes_count;
END;
$$;


-- 래플: 진행 일수(duration_days), 시작·종료 시각, 만료 시 자동 완료 처리
-- RLS: admin_users 조회가 RLS에 막히는 경우를 피하기 위해 SECURITY DEFINER 헬퍼 사용

ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS duration_days INT NOT NULL DEFAULT 7;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.raffles.duration_days IS '진행 일수 N: 서울 1일차 00시 시작 ~ N일차 00시 종료(ends_at)';
COMMENT ON COLUMN public.raffles.starts_at IS '진행 시작 시각(래플 시작 버튼 시 서울 당일 00시)';
COMMENT ON COLUMN public.raffles.ends_at IS '진행 종료 시각 = starts_at + (duration_days - 1)일';

CREATE OR REPLACE FUNCTION public.lj_is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.lj_is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lj_is_admin_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.close_expired_raffles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.raffles r
  SET
    kind = 'completed',
    category = COALESCE(NULLIF(btrim(COALESCE(r.category, '')), ''), '래플 종료'),
    status_message = COALESCE(NULLIF(btrim(COALESCE(r.status_message, '')), ''), '진행 기간이 종료되었습니다.'),
    badge = COALESCE(r.badge, '미응모'),
    days_left = NULL,
    updated_at = now()
  WHERE r.kind = 'ongoing'
    AND r.ends_at IS NOT NULL
    AND r.ends_at <= now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.close_expired_raffles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_raffles() TO anon, authenticated;

DROP POLICY IF EXISTS raffles_insert_admin ON public.raffles;
DROP POLICY IF EXISTS raffles_update_admin ON public.raffles;
DROP POLICY IF EXISTS raffles_delete_admin ON public.raffles;

CREATE POLICY raffles_insert_admin ON public.raffles
  FOR INSERT TO authenticated
  WITH CHECK (public.lj_is_admin_user());

CREATE POLICY raffles_update_admin ON public.raffles
  FOR UPDATE TO authenticated
  USING (public.lj_is_admin_user())
  WITH CHECK (public.lj_is_admin_user());

CREATE POLICY raffles_delete_admin ON public.raffles
  FOR DELETE TO authenticated
  USING (public.lj_is_admin_user());

-- 진행 예정(scheduled) 중 ends_at이 지난 행은 자동 삭제(00시 예약 취소 등)

CREATE OR REPLACE FUNCTION public.close_expired_raffles()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  m int;
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

  DELETE FROM public.raffles r
  WHERE r.kind = 'scheduled'
    AND r.ends_at IS NOT NULL
    AND r.ends_at <= now();

  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END;
$$;

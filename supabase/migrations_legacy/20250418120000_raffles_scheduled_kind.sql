-- 진행 예정 래플용 kind 값 추가
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'raffles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%kind%IN%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.raffles DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.raffles
  ADD CONSTRAINT raffles_kind_check CHECK (kind IN ('scheduled', 'ongoing', 'completed'));

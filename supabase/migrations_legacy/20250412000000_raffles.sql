-- 래플 (진행 중 / 완료) — 앱 래플 화면 및 어드민에서 관리
CREATE TABLE IF NOT EXISTS public.raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('ongoing', 'completed')),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  days_left TEXT,
  category TEXT,
  status_message TEXT,
  badge TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffles_kind_sort ON public.raffles (kind, sort_order, created_at DESC);

ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raffles_select_all ON public.raffles;
CREATE POLICY raffles_select_all ON public.raffles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS raffles_insert_admin ON public.raffles;
CREATE POLICY raffles_insert_admin ON public.raffles
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS raffles_update_admin ON public.raffles;
CREATE POLICY raffles_update_admin ON public.raffles
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS raffles_delete_admin ON public.raffles;
CREATE POLICY raffles_delete_admin ON public.raffles
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_raffles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS raffles_updated_at ON public.raffles;
CREATE TRIGGER raffles_updated_at
  BEFORE UPDATE ON public.raffles
  FOR EACH ROW EXECUTE PROCEDURE public.set_raffles_updated_at();

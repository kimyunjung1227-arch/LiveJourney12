-- Live Journey v2: 게시물 신고
-- 사유 enum: spam / inappropriate(부적절) / misinformation(허위) / harassment / other
-- RLS: 비로그인 anon도 reporter_id NULL로 신고 가능. 본인 신고 내역만 read.

set search_path = public;

create table if not exists public.lj_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('spam', 'inappropriate', 'misinformation', 'harassment', 'other')),
  detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

create index if not exists lj_post_reports_post_idx on public.lj_post_reports (post_id, created_at desc);
create index if not exists lj_post_reports_status_idx on public.lj_post_reports (status, created_at desc);

alter table public.lj_post_reports enable row level security;

drop policy if exists lj_post_reports_insert on public.lj_post_reports;
create policy lj_post_reports_insert on public.lj_post_reports
  for insert with check (
    reporter_id is null or auth.uid() = reporter_id
  );

drop policy if exists lj_post_reports_read_own on public.lj_post_reports;
create policy lj_post_reports_read_own on public.lj_post_reports
  for select using (auth.uid() = reporter_id);

create or replace function public.lj_post_reports_clip_detail()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.detail is not null and length(new.detail) > 1500 then
    new.detail := left(new.detail, 1500);
  end if;
  return new;
end;
$$;

drop trigger if exists lj_post_reports_clip_trg on public.lj_post_reports;
create trigger lj_post_reports_clip_trg
  before insert or update on public.lj_post_reports
  for each row execute function public.lj_post_reports_clip_detail();

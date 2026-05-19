-- 검색 화면용 신규 테이블: questions, question_answers, seasonal_highlights
-- places 테이블이 없으므로 place_name(text)으로 장소를 식별.

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) not null,
  body text not null,
  place_name text,
  category text check (category in ('nature','weather','event','crowd','sunset','business')),
  is_answered boolean default false,
  answer_count int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_questions_created on public.questions(created_at desc);
create index if not exists idx_questions_place on public.questions(place_name);
alter table public.questions enable row level security;
drop policy if exists "questions_select" on public.questions;
drop policy if exists "questions_insert" on public.questions;
drop policy if exists "questions_update_own" on public.questions;
create policy "questions_select" on public.questions for select using (true);
create policy "questions_insert" on public.questions for insert with check (auth.uid() = user_id);
create policy "questions_update_own" on public.questions for update using (auth.uid() = user_id);

create table if not exists public.question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (question_id, post_id)
);
create index if not exists idx_qa_question on public.question_answers(question_id);
create index if not exists idx_qa_post on public.question_answers(post_id);
alter table public.question_answers enable row level security;
drop policy if exists "qa_select" on public.question_answers;
drop policy if exists "qa_insert" on public.question_answers;
create policy "qa_select" on public.question_answers for select using (true);
create policy "qa_insert" on public.question_answers for insert with check (auth.uid() is not null);

create table if not exists public.seasonal_highlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_label text not null,
  category text,
  related_place_names text[],
  cover_color_start text,
  cover_color_end text,
  starts_at date,
  ends_at date,
  display_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_seasonal_active on public.seasonal_highlights(is_active, display_order);
alter table public.seasonal_highlights enable row level security;
drop policy if exists "seasonal_select" on public.seasonal_highlights;
create policy "seasonal_select" on public.seasonal_highlights for select using (true);

-- GIN 인덱스(pg_trgm)로 ilike 검색 성능 향상
create extension if not exists pg_trgm;
create index if not exists idx_posts_content_trgm on public.posts using gin (content gin_trgm_ops);
create index if not exists idx_posts_place_name_trgm on public.posts using gin (place_name gin_trgm_ops);
create index if not exists idx_posts_region_trgm on public.posts using gin (region gin_trgm_ops);
create index if not exists idx_questions_body_trgm on public.questions using gin (body gin_trgm_ops);

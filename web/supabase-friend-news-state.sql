-- 친구소식 탭: 읽음·마지막 확인 시각을 계정(기기) 간 동기화
-- Supabase SQL Editor에서 한 번 실행하세요.

create table if not exists public.friend_news_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_ms bigint not null default 0,
  read_map jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists friend_news_state_updated_idx on public.friend_news_state (updated_at desc);

alter table public.friend_news_state enable row level security;

drop policy if exists "friend_news_state_select_own" on public.friend_news_state;
create policy "friend_news_state_select_own" on public.friend_news_state
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "friend_news_state_insert_own" on public.friend_news_state;
create policy "friend_news_state_insert_own" on public.friend_news_state
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "friend_news_state_update_own" on public.friend_news_state;
create policy "friend_news_state_update_own" on public.friend_news_state
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 장소 소개 글 서버 캐시
-- 목적: (장소 × 시기) 단위로 1번만 생성해 전 사용자 공유 → Claude API 호출/비용 최소화.
--  - time_bucket 은 'YYYY-MM' (월 단위). 달이 바뀌면 키가 달라져 계절에 맞는 설명이 새로 생성된다.
--  - 쓰기는 Edge Function(service_role)만, 읽기는 공개(anon 포함) 허용.

create table if not exists public.place_descriptions (
  id           uuid primary key default gen_random_uuid(),
  place_key    text not null,
  time_bucket  text not null,                 -- 예: '2026-04'
  region_hint  text not null default '',
  description  text not null,
  model        text not null default '',
  method       text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (place_key, time_bucket)
);

create index if not exists idx_place_descriptions_lookup
  on public.place_descriptions (place_key, time_bucket);

alter table public.place_descriptions enable row level security;

-- 읽기: 누구나 (캐시된 소개 글은 공개 콘텐츠)
drop policy if exists place_descriptions_select_all on public.place_descriptions;
create policy place_descriptions_select_all
  on public.place_descriptions
  for select
  using (true);

-- 쓰기 정책 없음 → anon/authenticated 는 insert/update 불가.
-- Edge Function 은 service_role 키로 RLS 를 우회해 upsert 한다.

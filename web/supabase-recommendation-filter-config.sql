-- LiveJourney: 추천 필터 동적 설정 (시즌별 가중치·태그)
-- 앱은 localStorage `lj_recommendation_filter_config` 또는 이 테이블을 읽어 병합할 수 있습니다.

create extension if not exists pgcrypto;

create table if not exists public.recommendation_filter_config (
  id uuid primary key default gen_random_uuid(),
  season_key text not null default 'spring',
  label text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  valid_from date,
  valid_to date,
  updated_at timestamptz not null default now()
);

comment on table public.recommendation_filter_config is '필터별 weight/tags 등 JSON. 예: {"active_filters":[{"id":"season_peak","weight":1.5,"tags":["cherry"]}]}';

create index if not exists recommendation_filter_config_active_idx
  on public.recommendation_filter_config (is_active, season_key);

-- 읽기 전용(로그인 사용자) — 운영에 맞게 조정
alter table public.recommendation_filter_config enable row level security;

drop policy if exists "recommendation_filter_config_select_auth" on public.recommendation_filter_config;
create policy "recommendation_filter_config_select_auth" on public.recommendation_filter_config
for select using (auth.uid() is not null);

-- 시드(봄 기본, 테이블이 비어 있을 때만)
insert into public.recommendation_filter_config (season_key, label, config, is_active)
select
  'spring',
  '봄: 벚꽃·한적·바다',
  '{
    "active_filters": [
      {"id": "season_peak", "weight": 1.5, "tags": ["cherry", "flower", "bloom"]},
      {"id": "lively_vibe", "weight": 1.25, "tags": ["crowd", "hot"]},
      {"id": "night_good", "weight": 1.0, "tags": ["night", "city_light"]},
      {"id": "silent_healing", "weight": 1.0, "tags": ["quiet", "park", "trail"]},
      {"id": "deep_sea_blue", "weight": 1.0, "tags": ["sea", "beach", "blue"]}
    ],
    "season_key": "spring"
  }'::jsonb,
  true
where not exists (select 1 from public.recommendation_filter_config limit 1);

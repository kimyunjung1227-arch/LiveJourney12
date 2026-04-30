-- EXIF 동의: profiles에 저장 (클라이언트 localStorage 미사용)

alter table public.profiles
  add column if not exists exif_consent text,
  add column if not exists exif_consent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_exif_consent_check'
  ) then
    alter table public.profiles
      add constraint profiles_exif_consent_check
      check (exif_consent is null or exif_consent in ('granted', 'declined'));
  end if;
end $$;

-- 기존에 Auth user_metadata에만 저장돼 있던 값을 profiles로 옮김 (한 번만)
update public.profiles p
set
  exif_consent = coalesce(p.exif_consent, nullif(trim(u.raw_user_meta_data->>'exif_consent'), '')),
  exif_consent_at = coalesce(
    p.exif_consent_at,
    case
      when nullif(trim(u.raw_user_meta_data->>'exif_consent_at'), '') is not null
      then (nullif(trim(u.raw_user_meta_data->>'exif_consent_at'), ''))::timestamptz
      else null
    end
  )
from auth.users u
where p.id = u.id
  and p.exif_consent is null
  and coalesce((u.raw_user_meta_data->>'exif_consent_resolved')::boolean, false) = true
  and nullif(trim(u.raw_user_meta_data->>'exif_consent'), '') in ('granted', 'declined');

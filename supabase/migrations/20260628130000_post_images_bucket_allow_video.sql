-- 영상 업로드 허용: post-images 버킷이 이미지만 받도록 제한돼 있으면 영상이 거부된다.
-- (대시보드에서 수동 생성된 버킷의 allowed_mime_types / file_size_limit 를 코드로 확정한다.)
--
-- 증상: 사진은 업로드되는데 "영상으로 촬영된 것"은 업로드 실패.
-- 원인: 버킷 allowed_mime_types 가 image/* 만 허용하거나, file_size_limit 가 영상 크기보다 작음.
-- 조치: image/* + video/* 허용, 용량 한도 100MB 로 상향. (클라이언트도 동영상 100MB 상한)

-- 버킷이 없으면 생성, 있으면 설정만 갱신 (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  104857600, -- 100MB
  array['image/*', 'video/*']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 104857600),
  allowed_mime_types = array['image/*', 'video/*']::text[];

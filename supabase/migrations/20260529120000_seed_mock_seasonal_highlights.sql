-- 검색화면 매거진(seasonal_highlights) 목업 5건 시드
-- - 5월 말 ~ 7월 초 시즌 기준, 모두 is_active=true / 현재 활성 상태
-- - title 기준으로 멱등 INSERT (이미 있으면 스킵)

insert into public.seasonal_highlights
  (title, period_label, category, related_place_names,
   cover_color_start, cover_color_end,
   starts_at, ends_at, display_order, is_active,
   curation_body, peak_label, peak_ends_at)
select * from (values
  (
    '서울 장미축제 현장',
    '5월 마지막주',
    'event',
    array['중랑천 장미공원', '서울숲', '올림픽공원'],
    '#FF8FA3', '#E84A6F',
    date '2026-05-20', date '2026-06-05',
    1, true,
    '5월 말 장미가 만개하는 서울 곳곳의 산책 코스. 야간 조명도 함께 살아나는 시기입니다.',
    '만개',
    date '2026-06-02'
  ),
  (
    '제주 수국 명소 라이브',
    '6월 초~중순',
    'nature',
    array['혼인지', '카멜리아힐', '안덕면 일대'],
    '#9F7AEA', '#5B3FB8',
    date '2026-05-28', date '2026-06-25',
    2, true,
    '6월의 제주는 수국의 계절. 한 주 단위로 색이 바뀌는 길과 정원을 실시간으로 확인해 보세요.',
    '개화 진행',
    date '2026-06-18'
  ),
  (
    '서해안 노을 골든타임',
    '5월~6월',
    'sunset',
    array['궁평항', '왜목마을', '대천해수욕장'],
    '#F6AD55', '#DD6B20',
    date '2026-05-01', date '2026-06-30',
    3, true,
    '하지가 가까워질수록 해가 가장 길게 머무는 서해안. 19시 전후의 골든타임 컷이 가장 빛납니다.',
    '하지 임박',
    date '2026-06-21'
  ),
  (
    '강릉 초여름 바다',
    '6월',
    'weather',
    array['경포해변', '안목해변', '주문진'],
    '#4FD1C5', '#2C7A7B',
    date '2026-05-25', date '2026-06-30',  -- 지금 시점 활성으로 보이도록 5/25 시작
    4, true,
    '아직 한낮 더위가 매섭지 않은 6월의 동해. 새벽 안개·물때·바람 정보를 실시간으로 확인하세요.',
    '바다 입성',
    date '2026-06-15'
  ),
  (
    '한강 야시장 & 푸드페스타',
    '5월 말 ~ 7월 초',
    'event',
    array['뚝섬한강공원', '여의도한강공원', '반포한강공원'],
    '#87CEEB', '#1A6EA8',
    date '2026-05-24', date '2026-07-06',
    5, true,
    '주말 저녁마다 열리는 한강 야시장. 현장 줄 길이와 인기 부스 정보를 라이브로.',
    '주말 피크',
    date '2026-07-05'
  )
) as v(title, period_label, category, related_place_names,
       cover_color_start, cover_color_end,
       starts_at, ends_at, display_order, is_active,
       curation_body, peak_label, peak_ends_at)
where not exists (
  select 1 from public.seasonal_highlights sh where sh.title = v.title
);

const normalize = (s) => String(s || '').trim();

const pick = (seed, list) => {
  const text = String(seed || 'seed');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return list[Math.abs(hash) % list.length];
};

const INTRO_BY_REGION = {
  '구미': '구미시를 대표하는 금오산은 다양한 문화재를 품고 있으며 수려한 자연경관을 자랑한다.',
  '구미시': '구미시를 대표하는 금오산은 다양한 문화재를 품고 있으며 수려한 자연경관을 자랑한다.',
  '경주': '경주는 천년 고도의 유산이 도시 곳곳에 남아 있어, 낮에는 역사 산책을 즐기고 밤에는 고즈넉한 야경을 만끽하기 좋다.',
  '전주': '전주는 한옥마을을 중심으로 전통의 멋과 감성이 어우러져, 골목 산책만으로도 여행의 리듬이 살아난다.',
  '부산': '부산은 바다를 품은 도시답게 해변과 야경이 매력적이며, 골목마다 개성 있는 맛집과 카페가 여행을 풍성하게 만든다.',
  '속초': '속초는 설악산과 바다를 동시에 즐길 수 있어, 드라이브·산책·먹거리까지 하루 코스로도 충분히 만족스럽다.',
  '강릉': '강릉은 바다 풍경과 커피 문화가 자연스럽게 이어져, 여유로운 산책과 감성적인 하루를 보내기 좋다.',
  '여수': '여수는 푸른 바다와 섬의 풍경이 어우러져, 해질녘이면 도시 전체가 낭만적인 여행지로 변한다.',
  '제주': '제주는 오름과 바다, 숲이 가까이 있어 짧은 이동만으로도 완전히 다른 풍경을 만날 수 있는 곳이다.',
  '서울': '서울은 전통과 현대가 공존해, 한강 산책부터 골목 투어까지 원하는 분위기에 맞춰 코스를 바꾸기 좋다.',
  '인천': '인천은 바다와 도심이 맞닿아 있어, 감성적인 항구 풍경과 다양한 먹거리를 함께 즐길 수 있다.',
  '춘천': '춘천은 호수와 산이 가까워 드라이브와 산책이 좋고, 담백한 로컬 맛집도 여행의 재미를 더한다.',
  '수원': '수원은 화성을 중심으로 역사와 일상이 자연스럽게 이어져, 가볍게 걷기만 해도 볼거리가 풍부하다.',
  '창원': '창원은 바다와 공원이 가까워 여유롭게 쉬기 좋고, 가족·연인 모두 만족할 코스가 다양하다.',
};

const FALLBACK_OPENERS = [
  '도시의 매력과 자연이 함께 어우러져',
  '걷기 좋은 동선과 풍경이 살아 있어',
  '맛집과 볼거리가 고르게 분포해',
  '짧게 다녀와도 만족도가 높아',
];
const FALLBACK_CLOSERS = [
  '지금 떠나기 좋은 코스예요.',
  '사진 한 장만으로도 분위기가 전해져요.',
  '가벼운 산책부터 제대로 된 여행까지 모두 가능해요.',
  '오늘의 순간을 남기기 좋은 곳이에요.',
];

export function getRegionIntro(regionName) {
  const name = normalize(regionName);
  if (!name) return '';
  const direct = INTRO_BY_REGION[name];
  if (direct) return direct;
  const base = name.replace(/\s+(전체|일대|권역)$/g, '').trim();
  const opener = pick(base, FALLBACK_OPENERS);
  const closer = pick(`${base}-c`, FALLBACK_CLOSERS);
  return `${base}은(는) ${opener} ${closer}`;
}

export function getBestRegionTag(regionName, regionPosts = []) {
  const name = normalize(regionName);
  const posts = Array.isArray(regionPosts) ? regionPosts : [];
  const blob = posts
    .map((p) => [
      p?.note,
      p?.content,
      p?.categoryName,
      p?.category,
      p?.location,
      p?.placeName,
      ...(Array.isArray(p?.tags) ? p.tags : []),
      ...(Array.isArray(p?.aiLabels) ? p.aiLabels : []),
      ...(Array.isArray(p?.reasonTags) ? p.reasonTags : []),
    ].filter(Boolean).join(' '))
    .join(' ')
    .toLowerCase();

  const candidates = [
    { key: '벚꽃', match: /벚꽃|개화|만개|절정/, label: '벚꽃 절정' },
    { key: '단풍', match: /단풍|가을|낙엽/, label: '단풍 명소' },
    { key: '바다', match: /바다|해변|파도|윤슬|오션|beach|sea/, label: '바다 무드' },
    { key: '야경', match: /야경|night/, label: '야경 스팟' },
    { key: '산', match: /산|등산|트레킹|오름|hiking/, label: '산책·등산' },
    { key: '호수', match: /호수|강|하천|water|리버/, label: '물멍 코스' },
    { key: '카페', match: /카페|coffee|cafe|브런치/, label: '카페 감성' },
    { key: '맛집', match: /맛집|식당|음식|푸드|food|국밥|면|고기|횟집/, label: '맛집 탐방' },
    { key: '축제', match: /축제|페스티벌|festival|행사/, label: '축제 시즌' },
    { key: '사진', match: /포토|사진|인스타|스냅|photo|spot/, label: '포토 스팟' },
  ];

  const best = candidates.find((c) => c.match.test(blob));
  if (best) return best.label;

  const fallback = ['지금 추천', '여행 코스', '감성 스팟', '핫플', '산책 코스'];
  return pick(name, fallback);
}


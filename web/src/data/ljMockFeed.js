// Live Journey v2 (HomeScreen + PostDetailScreen) 데모용 mock 데이터.
// Supabase lj_posts/lj_comments가 비어있을 때 폴백으로 사용된다.

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const inHours = (h) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

// 인라인 SVG → 사진 placeholder. 외부 이미지 없이 동작.
function gradientSvg(stops, label) {
  const id = label.replace(/\s+/g, '-');
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'>
      <defs>
        <linearGradient id='g-${id}' x1='0' y1='0' x2='1' y2='1'>
          ${stops.map((s) => `<stop offset='${s.at}' stop-color='${s.color}'/>`).join('')}
        </linearGradient>
      </defs>
      <rect width='600' height='600' fill='url(#g-${id})'/>
      <text x='50%' y='52%' text-anchor='middle' font-family='Pretendard, sans-serif'
            font-size='28' font-weight='600' fill='rgba(255,255,255,0.85)'
            letter-spacing='-0.5'>${label}</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const LJ_MOCK_POSTS = [
  {
    id: 'mock-post-1',
    author_id: 'mock-user-1',
    author: { id: 'mock-user-1', nickname: '김지혜', avatar_url: null, helped_count: 312 },
    photo_url: gradientSvg(
      [
        { at: '0%', color: '#FFD3E0' },
        { at: '60%', color: '#FFB8C5' },
        { at: '100%', color: '#C9E4F2' },
      ],
      '여의도 벚꽃'
    ),
    category: 'nature',
    place_id: 'mock-place-yeouido',
    place_name: '여의도 한강공원',
    body: '윤중로 80% 만개. 입구쪽 풍경이에요. 주말이 절정일 듯해요.',
    exif_taken_at: minutesAgo(23),
    expires_at: inHours(47),
    is_on_site: true,
    helped_count: 312,
    like_count: 42,
    comment_count: 8,
    save_count: 18,
    created_at: minutesAgo(20),
  },
  {
    id: 'mock-post-2',
    author_id: 'mock-user-2',
    author: { id: 'mock-user-2', nickname: '박지원', avatar_url: null, helped_count: 41 },
    photo_url: gradientSvg(
      [
        { at: '0%', color: '#E8DCC4' },
        { at: '60%', color: '#D4B896' },
        { at: '100%', color: '#8B6B47' },
      ],
      '경복궁 야경'
    ),
    category: 'event',
    place_id: 'mock-place-gyeongbok',
    place_name: '경복궁',
    body: '오늘 야간 개장. 사람 적당, 사진 찍기 좋아요.',
    exif_taken_at: hoursAgo(2),
    expires_at: inHours(38),
    is_on_site: false,
    helped_count: 41,
    like_count: 21,
    comment_count: 4,
    save_count: 9,
    created_at: hoursAgo(2),
  },
  {
    id: 'mock-post-3',
    author_id: 'mock-user-3',
    author: { id: 'mock-user-3', nickname: '이수민', avatar_url: null, helped_count: 88 },
    photo_url: gradientSvg(
      [
        { at: '0%', color: '#D6E5F2' },
        { at: '60%', color: '#B8D0E0' },
        { at: '100%', color: '#8FAFC5' },
      ],
      '성수동 흐린 오후'
    ),
    category: 'weather',
    place_id: 'mock-place-seongsu',
    place_name: '성수동 카페거리',
    body: '오후 비 살짝. 야외석은 비추, 안쪽이 따뜻해요.',
    exif_taken_at: hoursAgo(6),
    expires_at: inHours(32),
    is_on_site: false,
    helped_count: 88,
    like_count: 14,
    comment_count: 2,
    save_count: 6,
    created_at: hoursAgo(6),
  },
  {
    id: 'mock-post-4',
    author_id: 'mock-user-4',
    author: { id: 'mock-user-4', nickname: '최우진', avatar_url: null, helped_count: 22 },
    photo_url: gradientSvg(
      [
        { at: '0%', color: '#C5D8B3' },
        { at: '60%', color: '#A3BF8C' },
        { at: '100%', color: '#6B8F5A' },
      ],
      '북한산 신록'
    ),
    category: 'nature',
    place_id: 'mock-place-bukhansan',
    place_name: '북한산 백운대',
    body: '신록이 한창. 정상까지 두 시간, 바람 시원해요.',
    exif_taken_at: hoursAgo(8),
    expires_at: inHours(28),
    is_on_site: true,
    helped_count: 22,
    like_count: 31,
    comment_count: 6,
    save_count: 12,
    created_at: hoursAgo(8),
  },
  {
    id: 'mock-post-5',
    author_id: 'mock-user-5',
    author: { id: 'mock-user-5', nickname: '정민호', avatar_url: null, helped_count: 17 },
    photo_url: gradientSvg(
      [
        { at: '0%', color: '#F3D1B0' },
        { at: '50%', color: '#E89B73' },
        { at: '100%', color: '#5C3D6E' },
      ],
      '광안리 노을'
    ),
    category: 'sunset',
    place_id: 'mock-place-gwangalli',
    place_name: '광안리 해변',
    body: '노을 절정. 다리에 불 들어오기 직전이 가장 예뻐요.',
    exif_taken_at: hoursAgo(12),
    expires_at: inHours(24),
    is_on_site: false,
    helped_count: 17,
    like_count: 58,
    comment_count: 12,
    save_count: 24,
    created_at: hoursAgo(12),
  },
];

export const LJ_MOCK_LIVE_COUNT = 47;

export const LJ_MOCK_COMMENTS = [
  {
    id: 'mock-c-1',
    post_id: 'mock-post-1',
    parent_id: null,
    author_id: 'mock-user-2',
    author: { id: 'mock-user-2', nickname: '박민수', avatar_url: null },
    body: '오늘 가려고 했는데 정보 감사해요! 주말까지 갈 수 있을까요?',
    like_count: 3,
    created_at: minutesAgo(15),
  },
  {
    id: 'mock-c-1-r1',
    post_id: 'mock-post-1',
    parent_id: 'mock-c-1',
    author_id: 'mock-user-1',
    author: { id: 'mock-user-1', nickname: '김지혜', avatar_url: null },
    body: '네 주말까지는 충분히 보실 수 있을 거예요. 비 예보 없으면요!',
    like_count: 2,
    created_at: minutesAgo(10),
    is_author: true,
  },
  {
    id: 'mock-c-2',
    post_id: 'mock-post-1',
    parent_id: null,
    author_id: 'mock-user-3',
    author: { id: 'mock-user-3', nickname: '이수민', avatar_url: null },
    body: '저도 어제 다녀왔는데 정말 절정이었어요!',
    like_count: 5,
    created_at: minutesAgo(8),
  },
];

export const LJ_CATEGORY_LABELS = {
  nature: '개화·자연',
  weather: '날씨·체감',
  event: '이벤트·축제',
  crowd: '혼잡도·대기',
  sunset: '노을·야경',
  business: '영업·운영',
};

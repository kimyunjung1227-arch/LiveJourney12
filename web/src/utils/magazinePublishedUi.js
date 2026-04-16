import { getTimeAgo, filterRecentPosts } from './timeUtils';
import { getDisplayImageUrl } from '../api/upload';
import { getMapThumbnailUri } from './postMedia';
import { getLandmarksByRegion } from './regionLandmarks';

export const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export const mediaUrlsFromPost = (p) => {
  const raw = [];
  if (Array.isArray(p?.images)) raw.push(...p.images);
  else if (p?.images) raw.push(p.images);
  if (p?.image) raw.push(p.image);
  if (p?.thumbnail) raw.push(p.thumbnail);
  const urls = raw.map((v) => getDisplayImageUrl(v)).filter(Boolean);
  return [...new Set(urls)];
};

export const toSearchText = (p) =>
  [
    p?.detailedLocation,
    p?.placeName,
    p?.location,
    p?.note,
    p?.content,
    ...(Array.isArray(p?.tags) ? p.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const FIELD_VOICE_MAX = 4;
const FIELD_VOICE_MAX_CHARS = 96;

const getVoiceAuthor = (p) => {
  const u = p?.user;
  const username =
    (typeof u === 'string' ? u : u?.username) ||
    p?.userName ||
    p?.author?.name ||
    '여행자';
  return String(username || '여행자');
};

const truncateVoiceText = (s, maxChars) => {
  const t = String(s || '').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
};

/**
 * 장소에 맞는 게시물에서 짧은 글(note/content)만 뽑아 '현장의 목소리'용 데이터 생성
 */
export const buildFieldVoicesFromPosts = (posts, options = {}) => {
  const max = options.max ?? FIELD_VOICE_MAX;
  const maxChars = options.maxChars ?? FIELD_VOICE_MAX_CHARS;
  const list = Array.isArray(posts) ? posts : [];
  const byRecency = (a, b) => {
    const now = Date.now();
    const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
    const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
    return tb - ta;
  };
  return list
    .filter((p) => String(p?.note || p?.content || '').trim().length > 0)
    .sort(byRecency)
    .slice(0, max)
    .map((p) => ({
      id: String(p.id ?? `voice-${p.timestamp || p.createdAt || Math.random()}`),
      text: truncateVoiceText(String(p.note || p.content || '').trim(), maxChars),
      author: getVoiceAuthor(p),
      timeLabel: getTimeAgo(p.timestamp || p.createdAt),
      thumbUrl: mediaUrlsFromPost(p)[0] || '',
    }));
};

/**
 * 지역명 + 장소 문자열로 주변 명소·맛집 스폿 AI 추천 (로컬 랜드마크 DB + 피드 썸네일 매칭)
 */
export const buildAiAroundSuggestions = (locKey, sectionIndex, pickFirstMediaForKeyword) => {
  const key = normalizeSpace(locKey);
  const parts = key.split(/\s+/).filter(Boolean);
  const region = parts[0] || '';
  if (!region) return [];
  let landmarks = getLandmarksByRegion(region);
  if (!landmarks.length && parts.length > 1) {
    landmarks = getLandmarksByRegion(parts[1]);
  }
  const locLower = key.toLowerCase();
  const filtered = landmarks.filter((l) => {
    const name = String(l?.name || '').trim();
    if (!name) return false;
    return !locLower.includes(name.toLowerCase());
  });
  return filtered.slice(0, 6).map((l, i) => {
    const nm = String(l.name).trim();
    const kw = Array.isArray(l.keywords) ? l.keywords.find((k) => k && String(k).trim()) : '';
    const image = pickFirstMediaForKeyword(nm) || (kw ? pickFirstMediaForKeyword(kw) : '');
    return {
      id: `ai-ar-${sectionIndex}-${l.id || i}`,
      name: nm,
      desc: '',
      image,
    };
  });
};

export const buildRegionSummary = (posts) => {
  if (!Array.isArray(posts) || posts.length === 0) return '';
  const text = posts.map((p) => toSearchText(p)).join(' ');
  const lower = text.toLowerCase();
  const sentences = [];

  if (/벚꽃|꽃길|cherry blossom/i.test(text)) {
    sentences.push('벚꽃과 계절감 있는 풍경 사진이 많이 올라오는 곳이에요.');
  }
  if (/카페|커피|라떼|디저트|cafe/i.test(lower)) {
    sentences.push('카페와 디저트 사진이 많아서 쉬어가기 좋은 스팟이에요.');
  }
  if (/바다|해변|sea|해수욕장/i.test(lower)) {
    sentences.push('바다와 수변 풍경이 중심이라 탁 트인 뷰를 즐기기 좋아요.');
  }
  if (/산책로|둘레길|trail|산책/i.test(lower)) {
    sentences.push('산책하기 좋은 코스가 많아 가볍게 걷기 좋아 보여요.');
  }
  if (/야경|night/i.test(lower)) {
    sentences.push('야경 사진이 많아서 밤에도 분위기가 좋은 편이에요.');
  }

  if (!sentences.length) {
    return 'AI가 이 지역에 올라온 사진들을 분석했어요. 다양한 분위기의 사진이 올라오는 인기 여행 스폿이에요.';
  }

  return sentences.join(' ');
};

/**
 * 단일 발행 매거진 → 장소 슬라이드 (MagazineList / Detail 공통)
 */
export const buildSlidesForMagazine = (mag, allPosts, gridPosts) => {
  const posts = Array.isArray(allPosts) ? allPosts : [];
  const byRecency = (a, b) => {
    const now = Date.now();
    const ta = new Date(a?.timestamp || a?.createdAt || now).getTime();
    const tb = new Date(b?.timestamp || b?.createdAt || now).getTime();
    return tb - ta;
  };

  if (mag && Array.isArray(mag.sections) && mag.sections.length > 0) {
    const magTitle = String(mag.title || '').trim() || '라이브매거진';
    const pickFirstMediaForKeyword = (keyword) => {
      const k = String(keyword || '').trim().toLowerCase();
      if (!k) return '';
      const matched = posts
        .filter((p) => toSearchText(p).includes(k))
        .sort(byRecency)[0];
      return matched ? (mediaUrlsFromPost(matched)[0] || '') : '';
    };

    return mag.sections.map((sec, idx) => {
      const locKey = normalizeSpace(sec?.location || '');
      const matchedPosts = posts
        .filter((p) => locKey && toSearchText(p).includes(locKey.toLowerCase()))
        .sort(byRecency);
      const uniqMedia = matchedPosts.flatMap(mediaUrlsFromPost);
      const uniq = [...new Set(uniqMedia)].filter(Boolean);
      const fallbackImg = gridPosts[0] ? getMapThumbnailUri(gridPosts[0]) : '';
      const heroImage = uniq[0] || fallbackImg;
      const editorDescription = String(sec?.description || '').trim();
      const aroundDisplay = buildAiAroundSuggestions(locKey, idx, pickFirstMediaForKeyword);
      const locationInfoLine = String(sec?.locationInfo || '').trim();

      return {
        kind: 'magazine',
        mag,
        magTitle,
        sectionIndex: idx,
        sectionLabel: `장소 ${idx + 1}`,
        placeTitle: locKey || `장소 ${idx + 1}`,
        locationInfoLine,
        description:
          editorDescription ||
          '장소 설명은 관리자 매거진 발행 화면에서 입력한 내용이 여기에 표시됩니다.',
        image: heroImage,
        timeLabel: matchedPosts[0]
          ? getTimeAgo(matchedPosts[0].timestamp || matchedPosts[0].createdAt)
          : getTimeAgo(mag.created_at || mag.createdAt),
        askQuery: locKey || mag.title,
        regionSummary: buildRegionSummary(matchedPosts),
        fieldVoices: buildFieldVoicesFromPosts(matchedPosts),
        locKey,
        matchedPosts,
        aroundDisplay,
      };
    });
  }
  return [];
};

/**
 * 목록 화면: 첫 매거진 또는 피드 폴백 슬라이드
 */
export const buildMagazineListSlides = (published, allPosts, gridPosts) => {
  const mag = published[0];
  const slides = buildSlidesForMagazine(mag, allPosts, gridPosts);
  if (slides.length > 0) return slides;

  const p0 = gridPosts[0];
  if (p0) {
    const loc =
      normalizeSpace(p0.detailedLocation || p0.placeName || p0.location || '').split(' ').slice(0, 4).join(' ') ||
      '지금 여행지';
    return [
      {
        kind: 'feed',
        mag: null,
        magTitle: '지금 꼭 볼 실시간 여행지',
        sectionIndex: 0,
        placeTitle: loc,
        description:
          String(p0.note || p0.content || '').trim().slice(0, 200) ||
          '라이브저니에 올라온 최근 사진을 모았어요.',
        image: getMapThumbnailUri(p0),
        timeLabel: getTimeAgo(p0.timestamp || p0.createdAt),
        askQuery: loc,
        postId: p0.id,
        regionSummary: buildRegionSummary([p0]),
        fieldVoices: buildFieldVoicesFromPosts([p0], { max: 2 }),
        locKey: loc.toLowerCase(),
        matchedPosts: [p0],
      },
    ];
  }
  return [];
};

export const getGridPostsPool = (allPosts) => {
  const withThumb = (Array.isArray(allPosts) ? allPosts : []).filter((p) => getMapThumbnailUri(p));
  const recent = filterRecentPosts(withThumb, 2, 72);
  const pool = recent.length >= 6 ? recent : withThumb;
  return pool.slice(0, 12);
};

export const getRegionPostsForSlide = (currentSlide, allPosts, gridPosts) => {
  if (!currentSlide) return [];
  const withThumb = (arr) =>
    (Array.isArray(arr) ? arr : []).filter((p) => p && getMapThumbnailUri(p));
  if (currentSlide.kind === 'magazine' && currentSlide.matchedPosts?.length) {
    return withThumb(currentSlide.matchedPosts).slice(0, 20);
  }
  const key = normalizeSpace(currentSlide.locKey || currentSlide.placeTitle || '').toLowerCase();
  if (!key) return withThumb(gridPosts).slice(0, 12);
  return withThumb(
    (Array.isArray(allPosts) ? allPosts : []).filter(
      (p) => toSearchText(p).includes(key) && getMapThumbnailUri(p)
    )
  ).slice(0, 20);
};

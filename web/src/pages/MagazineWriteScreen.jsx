import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import MagazinePublishedCarousel from '../components/MagazinePublishedCarousel';
import { publishMagazine } from '../utils/magazinesStore';
import { useAuth } from '../contexts/AuthContext';
import { useAdminState } from '../utils/admin';
import { fetchPostsSupabase } from '../api/postsSupabase';
import { normalizePostsForFeed } from '../utils/postNormalize';
import { buildSlidesForMagazine, getGridPostsPool, getRegionPostsForSlide } from '../utils/magazinePublishedUi';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const DRAFT_KEY = 'magazinePublishDraft';

const extractBetween = (text, startRe, endRe) => {
  const s = text.search(startRe);
  if (s < 0) return '';
  const after = text.slice(s).replace(startRe, '');
  if (!endRe) return after.trim();
  const e = after.search(endRe);
  return (e < 0 ? after : after.slice(0, e)).trim();
};

const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const pickLabelLine = (body, labelRe) => {
  const mm = String(body || '').match(labelRe);
  return mm ? String(mm[1] || '').trim() : '';
};

const parsePreviewName = (rawLine) => {
  const line = String(rawLine || '').trim();
  if (!line) return '';
  // "불국사 토함산 식당 (피드 언급 1위: ...)" -> "불국사 토함산 식당"
  return normalizeSpace(line.split('(')[0]).replace(/[:：]\s*$/, '').trim();
};

const pickMagazineTitleFromLines = (lines) => {
  const arr = Array.isArray(lines) ? lines.map((l) => String(l || '').trim()).filter(Boolean) : [];
  if (arr.length === 0) return '';
  const bracket = arr.find((l) => /^\[[^\]]+\]/.test(l));
  if (bracket) return bracket;
  return arr[0];
};

const splitCommaList = (s) =>
  String(s || '')
    .split(/,|·|•|ㆍ/)
    .map((x) => normalizeSpace(x))
    .filter(Boolean);

const extractLabelBlock = (body, startLabelRe, endLabelRes = []) => {
  const start = String(body || '').search(startLabelRe);
  if (start < 0) return '';
  const after = String(body || '').slice(start).replace(startLabelRe, '');
  if (!Array.isArray(endLabelRes) || endLabelRes.length === 0) return after.trim();
  const nextIdx = endLabelRes.reduce((min, re) => {
    const idx = after.search(re);
    return idx >= 0 ? Math.min(min, idx) : min;
  }, Infinity);
  return (nextIdx === Infinity ? after : after.slice(0, nextIdx)).trim();
};

const parseMagazinePasteFreeform = (raw) => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const lines = text.split('\n').map((l) => l.trim());
  const title = pickMagazineTitleFromLines(lines);

  // "장소 제목:" 단위로 블록을 분리
  const blocks = [];
  const re = /(^|\n)([^\n]*?)\n?\s*장소\s*제목\s*:\s*([^\n]+)\n([\s\S]*?)(?=\n[^\n]*?\n?\s*장소\s*제목\s*:|\n\s*장소\s*제목\s*:|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const maybeMood = normalizeSpace(m[2] || '');
    const locationTitle = normalizeSpace(m[3] || '');
    const body = String(m[4] || '');

    const locationInfo =
      pickLabelLine(body, /장소\s*위치\s*:\s*([^\n]+)/i) || pickLabelLine(body, /장소\s*주소\s*:\s*([^\n]+)/i) || '';

    const description = extractLabelBlock(body, /장소\s*설명\s*:\s*/i, [
      /\n\s*실시간\s*팁\s*:/i,
      /\n\s*주변\s*장소\s*:/i,
      /\n\s*장소\s*제목\s*:/i,
    ]);
    const realtimeTip = extractLabelBlock(body, /실시간\s*팁\s*:\s*/i, [/\n\s*주변\s*장소\s*:/i, /\n\s*장소\s*제목\s*:/i]);
    const aroundRaw = pickLabelLine(body, /주변\s*장소\s*:\s*([^\n]+)/i);
    const around = splitCommaList(aroundRaw);

    const mergedDescription = [
      description,
      realtimeTip ? `실시간 팁: ${realtimeTip.replace(/^["“]|["”]$/g, '').trim()}` : '',
    ]
      .filter((v) => String(v || '').trim())
      .join('\n\n');

    blocks.push({
      moodTitle: maybeMood,
      locationTitle,
      locationInfo,
      description: mergedDescription,
      around,
    });
  }

  // moodTitle이 비어있으면 "장소 제목:" 직전의 마지막 문장(레이블 제외)을 보충
  if (blocks.length > 0) {
    // 이미 정규식이 mood를 잡아주지만, 빈 경우를 대비
    blocks.forEach((b) => {
      if (String(b.moodTitle || '').trim()) return;
      b.moodTitle = '';
    });
  }

  if (!blocks.length) return null;
  return { title, sections: blocks };
};

const parseMagazinePaste = (raw) => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim());
  const titleLine = lines.find((l) => l && !/^\d+\./.test(l)) || '';

  const blocks = [];
  const re = /(^|\n)(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n\d+\.\s|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const moodTitle = String(m[3] || '').trim();
    const body = String(m[4] || '');
    const locationTitle = pickLabelLine(body, /장소\s*이름\s*:\s*([^\n]+)/i) || moodTitle;
    const locationInfo = pickLabelLine(body, /위치정보\s*:\s*([^\n]+)/i);
    const description = extractBetween(body, /장소\s*설명\s*:\s*/i, /\n\s*\[LiveJourney Preview\]|\n\s*💡|$/i);

    const previewFoodRaw = pickLabelLine(body, /🍴\s*맛집\s*:\s*([^\n]+)/i);
    const previewSpotRaw = pickLabelLine(body, /🚩\s*명소\s*:\s*([^\n]+)/i);
    const previewFood = parsePreviewName(previewFoodRaw);
    const previewSpot = parsePreviewName(previewSpotRaw);
    const around = [previewFood, previewSpot].filter(Boolean);
    const realtimeFeed = pickLabelLine(body, /📸\s*실시간\s*피드\s*:\s*([^\n]+)/i);

    const extraLines = [];
    if (around.length > 0 || realtimeFeed) {
      extraLines.push('[LiveJourney Preview]');
      if (previewFoodRaw) extraLines.push(`🍴 맛집: ${previewFoodRaw}`);
      if (previewSpotRaw) extraLines.push(`🚩 명소: ${previewSpotRaw}`);
      if (realtimeFeed) extraLines.push(`📸 실시간 피드: ${realtimeFeed}`);
    }

    const mergedDescription = [description, extraLines.join('\n')].filter((v) => String(v || '').trim()).join('\n\n');

    blocks.push({
      moodTitle: moodTitle.replace(/^['"]|['"]$/g, '').trim(),
      locationTitle: locationTitle.replace(/^['"]|['"]$/g, '').trim(),
      locationInfo,
      description: mergedDescription,
      around,
    });
  }

  if (!blocks.length) return null;
  return { title: titleLine, sections: blocks };
};

/**
 * 보편 paste 파서 — strict한 numbered/장소 제목 양식이 모두 실패했을 때 시도되는 fallback.
 *
 * 인식하는 패턴:
 * - 블록 구분: "1.", "1)", "(1)", "①~⑳", "❶~❿", "# 1.", "## 1.", "장소 제목:", "장소 이름:"
 * - 라벨(:/：) 다양: 장소(이름/제목/명), 위치/주소/장소 위치, 설명/장소 설명/소개,
 *   분위기, 주변(장소/맛집/명소), 그리고 영문 별칭(title/location/address/description/nearby).
 * - 마크다운 강조(**, __, _, *, ##, > 등) 자동 제거.
 * - 라벨이 없는 줄은 현재 active 필드(기본: description)에 누적되어 본문이 자연스럽게 합쳐짐.
 */
const MAGAZINE_LABEL_VARIANTS = {
  locationTitle: [
    /^장소\s*(?:이름|제목|명)$/i,
    /^place(?:\s*name)?$/i,
    /^title$/i,
    /^이름$/,
    /^제목$/,
    /^명칭$/,
    /^spot$/i,
  ],
  locationInfo: [
    /^장소\s*(?:위치|주소)$/i,
    /^위치(?:\s*정보)?$/i,
    /^주소$/,
    /^소재지$/,
    /^address$/i,
    /^location$/i,
  ],
  description: [
    /^장소\s*설명$/i,
    /^설명$/,
    /^소개$/,
    /^본문$/,
    /^내용$/,
    /^description$/i,
    /^desc$/i,
    /^about$/i,
    /^intro$/i,
  ],
  realtimeTip: [
    /^실시간\s*팁$/i,
    /^현장\s*팁$/i,
    /^팁$/,
    /^tip$/i,
    /^꿀팁$/,
  ],
  moodTitle: [
    /^분위기(?:\s*제목)?$/i,
    /^키워드$/,
    /^테마$/,
    /^mood$/i,
    /^theme$/i,
    /^한\s*줄$/,
  ],
  around: [
    /^주변\s*여행지$/i,
    /^주변(?:\s*(?:장소|스폿|맛집|명소))?$/i,
    /^함께\s*(?:가볼|가볼만한|볼만한)/i,
    /^추천\s*(?:장소|코스|여행지)$/i,
    /^근처(?:\s*(?:여행지|명소|맛집))?$/i,
    /^nearby$/i,
  ],
};

const stripMarkdown = (line) =>
  String(line || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[-*+•]\s+/, '')
    .replace(/^>+\s*/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

const BLOCK_DELIMITER_PATTERNS = [
  /^\s*(\d+)\s*[.)]\s+\S/, // "1. 장소" / "1) 장소"
  /^\s*\((\d+)\)\s+\S/, // "(1) 장소"
  /^\s*[①-⑳]\s*\S/, // "① 장소"
  /^\s*[❶-❿]\s*\S/, // "❶ 장소"
  /^\s*#{1,3}\s*\d+\s*[.)]?\s*\S/, // "# 1 장소" / "## 1. 장소"
  /^\s*[【\[]?\s*(?:장소|명소|코스|spot|place)\s*\d+\s*[】\]]?\s*[:：.)]?\s*/i, // "장소 1", "[장소1]", "명소 2:"
  /^\s*(?:장소|명소|코스)\s*(?:제목|이름|명)?\s*[:：]\s*\S/i, // "장소 이름: ..."
  /^\s*\d+\s*번\s*[:：.)]?\s*\S/, // "1번 장소"
  /^\s*[▶▷■□●○◆◇★☆]\s*\S/, // 불릿 헤딩
];

const isBlockDelimiter = (cleaned) => BLOCK_DELIMITER_PATTERNS.some((re) => re.test(cleaned));

const stripBlockPrefix = (cleaned) =>
  String(cleaned || '')
    .replace(/^\s*\d+\s*[.)]\s+/, '')
    .replace(/^\s*\(\d+\)\s+/, '')
    .replace(/^\s*[①-⑳]\s*/, '')
    .replace(/^\s*[❶-❿]\s*/, '')
    .replace(/^\s*#{1,3}\s*\d+\s*[.)]?\s*/, '')
    .replace(/^\s*[【\[]?\s*(?:장소|명소|코스|spot|place)\s*\d+\s*[】\]]?\s*[:：.)]?\s*/i, '')
    .replace(/^\s*(?:장소|명소|코스)\s*(?:제목|이름|명)?\s*[:：]\s*/i, '')
    .replace(/^\s*\d+\s*번\s*[:：.)]?\s*/, '')
    .replace(/^\s*[▶▷■□●○◆◇★☆]\s*/, '')
    .replace(/^["“'`]|["”'`]$/g, '')
    .trim();

const findMagazineLabelKey = (rawLabel) => {
  const normalized = normalizeSpace(rawLabel).replace(/[*_`~]/g, '');
  for (const [key, patterns] of Object.entries(MAGAZINE_LABEL_VARIANTS)) {
    if (patterns.some((re) => re.test(normalized))) return key;
  }
  return null;
};

/** strict 파서들이 모두 실패했을 때 사용하는 매거진 paste 보편 파서 */
const parseMagazinePasteUniversal = (raw) => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const linesRaw = text.split('\n');
  const lines = linesRaw.map((l) => stripMarkdown(l));

  // 매거진 전체 타이틀 후보: 첫 비어있지 않은 블록 구분자 아닌 줄
  let title = '';
  for (let i = 0; i < Math.min(lines.length, 6); i += 1) {
    const c = lines[i];
    if (!c) continue;
    if (isBlockDelimiter(c)) break;
    title = c.replace(/^[\[【]|[\]】]$/g, '').trim();
    break;
  }

  const blocks = [];
  let current = null;
  let activeField = 'description';

  const flush = () => {
    if (!current) return;
    current.description = String(current.description || '').replace(/\n{3,}/g, '\n\n').trim();
    if (Array.isArray(current.around)) {
      current.around = current.around.map((x) => normalizeSpace(x)).filter(Boolean);
    }
    blocks.push(current);
    current = null;
    activeField = 'description';
  };

  for (let i = 0; i < lines.length; i += 1) {
    const cleaned = lines[i];

    if (isBlockDelimiter(cleaned)) {
      flush();
      const head = stripBlockPrefix(cleaned);
      current = {
        moodTitle: '',
        locationTitle: head,
        locationInfo: '',
        description: '',
        around: [],
      };
      activeField = 'description';
      continue;
    }

    if (!current) {
      if (!cleaned) continue;
      if (title && cleaned === title) continue;
      // 첫 헤딩이 곧 첫 장소 이름이 되는 케이스
      current = {
        moodTitle: '',
        locationTitle: cleaned,
        locationInfo: '',
        description: '',
        around: [],
      };
      activeField = 'description';
      continue;
    }

    if (!cleaned) {
      if (activeField === 'description' && current.description) {
        current.description += '\n\n';
      }
      continue;
    }

    const labelMatch = cleaned.match(/^([^:：]{1,16})\s*[:：]\s*(.*)$/);
    if (labelMatch) {
      const key = findMagazineLabelKey(labelMatch[1]);
      if (key) {
        const value = String(labelMatch[2] || '').trim();
        if (key === 'around') {
          current.around = splitCommaList(value);
          activeField = 'around';
        } else if (key === 'description') {
          if (value) {
            current.description = current.description
              ? `${current.description}\n${value}`
              : value;
          }
          activeField = 'description';
        } else if (key === 'realtimeTip') {
          // 실시간 팁은 "장소 설명" 본문에 합쳐서 표시
          const tip = value ? `실시간 팁: ${value}` : '실시간 팁:';
          current.description = current.description ? `${current.description}\n\n${tip}` : tip;
          activeField = 'description';
        } else {
          current[key] = value;
          activeField = key;
        }
        continue;
      }
    }

    // 라벨 없음 → 현재 active 필드에 누적
    if (activeField === 'description') {
      current.description = current.description ? `${current.description}\n${cleaned}` : cleaned;
    } else if (activeField === 'around') {
      current.around = [...(current.around || []), ...splitCommaList(cleaned)];
    } else if (typeof current[activeField] === 'string') {
      current[activeField] = current[activeField] ? `${current[activeField]} ${cleaned}` : cleaned;
    }
  }
  flush();

  const filtered = blocks.filter(
    (b) =>
      String(b.locationTitle || '').trim() ||
      String(b.description || '').trim() ||
      String(b.locationInfo || '').trim()
  );

  if (filtered.length === 0) return null;
  return { title, sections: filtered };
};

const createEmptySection = (seed = {}) => ({
  id: `sec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  moodTitle: seed.moodTitle || '',
  locationTitle: seed.locationTitle || '',
  locationInfo: seed.locationInfo || '',
  description: seed.description || '',
  around: Array.isArray(seed.around) ? seed.around : [],
  liveSituation: seed.liveSituation || '',
});

/**
 * 매거진 현재 구조 전용 파서.
 * 인식 라벨:
 *   제목 / 부제목 (매거진 단위)
 *   장소 이름 / 장소 위치 / 장소 설명 / 실시간 팁 / 주변 여행지 / 실시간 상황 (장소 단위, "장소 이름:"으로 블록 분리)
 * - 장소 설명 + 실시간 팁 → description 으로 병합 (상세화면 "장소설명" 영역)
 * - 주변 여행지 → around (콤마/줄바꿈 구분)
 * - 실시간 상황 → liveSituation (상세화면 시안색 실시간 박스 = regionSummary)
 */
const parseMagazineStructured = (raw) => {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  // 신규 구조 전용 라벨이 하나도 없으면 이 파서는 건너뜀(구 번호/이모지 형식 보호)
  const hasStructuredMarker =
    /\n?\s*장소\s*이름\s*[:：]/i.test(text) &&
    /(부제목|장소\s*위치|주변\s*여행지|실시간\s*상황)\s*[:：]/i.test(text);
  if (!hasStructuredMarker) return null;

  const title = pickLabelLine(text, /(?:^|\n)\s*제목\s*[:：]\s*([^\n]+)/i);
  const subtitle = pickLabelLine(text, /(?:^|\n)\s*부제목\s*[:：]\s*([^\n]+)/i);

  // "장소 이름:" 을 블록 구분자로 분리
  const re = /(?:^|\n)\s*장소\s*이름\s*[:：]\s*([^\n]+)\n?([\s\S]*?)(?=\n\s*장소\s*이름\s*[:：]|$)/g;
  const blocks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const locationTitle = normalizeSpace(m[1] || '');
    const body = String(m[2] || '');

    const locationInfo = pickLabelLine(body, /장소\s*위치\s*[:：]\s*([^\n]+)/i);
    const description = extractLabelBlock(body, /장소\s*설명\s*[:：]\s*/i, [
      /\n\s*실시간\s*팁\s*[:：]/i,
      /\n\s*주변\s*여행지\s*[:：]/i,
      /\n\s*실시간\s*상황\s*[:：]/i,
      /\n\s*장소\s*이름\s*[:：]/i,
    ]);
    const realtimeTip = extractLabelBlock(body, /실시간\s*팁\s*[:：]\s*/i, [
      /\n\s*주변\s*여행지\s*[:：]/i,
      /\n\s*실시간\s*상황\s*[:：]/i,
      /\n\s*장소\s*이름\s*[:：]/i,
    ]);
    const aroundRaw = extractLabelBlock(body, /주변\s*여행지\s*[:：]\s*/i, [
      /\n\s*실시간\s*상황\s*[:：]/i,
      /\n\s*장소\s*이름\s*[:：]/i,
    ]);
    const liveSituation = extractLabelBlock(body, /실시간\s*상황\s*[:：]\s*/i, [
      /\n\s*장소\s*이름\s*[:：]/i,
    ]);

    const mergedDescription = [
      description,
      realtimeTip ? `실시간 팁: ${realtimeTip.replace(/^["“]|["”]$/g, '').trim()}` : '',
    ]
      .filter((v) => String(v || '').trim())
      .join('\n\n');

    blocks.push({
      moodTitle: '',
      locationTitle,
      locationInfo,
      description: mergedDescription,
      around: splitCommaList(String(aroundRaw || '').replace(/\n/g, ',')),
      liveSituation: normalizeSpace(liveSituation),
    });
  }

  if (!blocks.length) return null;

  // "제목:" 라벨이 없으면 첫 비어있지 않은 줄(라벨 줄 제외)을 제목으로 보충
  let finalTitle = title;
  if (!finalTitle) {
    const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
    if (!/^(?:부제목|장소\s*(?:이름|위치|설명)|실시간\s*(?:팁|상황)|주변\s*여행지)\s*[:：]/i.test(firstLine)) {
      finalTitle = firstLine;
    }
  }

  return { title: finalTitle, subtitle, sections: blocks };
};

/** strict 파서 → 보편 파서 순서로 시도. 결과 + 어느 파서가 매칭됐는지 반환 */
const tryParseMagazinePaste = (raw) => {
  if (!String(raw || '').trim()) return null;
  // 현재 매거진 구조(제목/부제목/장소 이름·위치·설명·실시간 팁/주변 여행지/실시간 상황) 우선 인식
  const structured = parseMagazineStructured(raw);
  if (structured?.sections?.length) return { ...structured, source: 'structured' };
  const strict = parseMagazinePaste(raw);
  if (strict?.sections?.length) return { ...strict, source: 'strict' };
  const free = parseMagazinePasteFreeform(raw);
  if (free?.sections?.length) return { ...free, source: 'freeform' };
  const universal = parseMagazinePasteUniversal(raw);
  if (universal?.sections?.length) return { ...universal, source: 'universal' };
  return null;
};

const MagazineWriteScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminState(user);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [sections, setSections] = useState([createEmptySection()]);
  const [pasteText, setPasteText] = useState('');
  const [pasteStatus, setPasteStatus] = useState(null); // { kind: 'ok'|'fail', message: string }
  const [saving, setSaving] = useState(false);
  const [allPosts, setAllPosts] = useState([]);
  const [feedRefresh, setFeedRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const localPosts = getUploadedPostsSafe();
        const supabasePosts = await fetchPostsSupabase();
        const byId = new Map();
        [...(Array.isArray(supabasePosts) ? supabasePosts : []), ...(Array.isArray(localPosts) ? localPosts : [])].forEach(
          (p) => {
            if (p && p.id && !byId.has(p.id)) byId.set(p.id, p);
          }
        );
        const combined = normalizePostsForFeed(Array.from(byId.values()));
        if (alive) setAllPosts(combined);
      } catch {
        if (alive) setAllPosts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [feedRefresh]);

  useEffect(() => {
    const id = setInterval(() => setFeedRefresh((n) => n + 1), 45000);
    const onVis = () => {
      if (document.visibilityState === 'visible') setFeedRefresh((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    try {
      // 서버 운영 전환: localStorage draft 복원 제거
    } catch (_) {
      // ignore
    }
  }, []);

  const applyPaste = useCallback((raw) => {
    const parsed = tryParseMagazinePaste(raw);
    if (!parsed) {
      setPasteStatus({
        kind: 'fail',
        message:
          '장소를 자동 인식하지 못했어요. "장소 이름:", "위치:", "설명:" 같은 라벨이나 "1. 장소명" 번호 매김을 포함해 주세요.',
      });
      return false;
    }
    if (parsed.title) setTitle(parsed.title);
    if (parsed.subtitle) setSubtitle(parsed.subtitle);
    setSections(parsed.sections.map((s) => createEmptySection(s)));
    setPasteText('');
    setPasteStatus({
      kind: 'ok',
      message: `${parsed.sections.length}개 장소가 자동으로 채워졌어요.${
        parsed.source === 'universal' ? ' (자유 형식 인식)' : ''
      }`,
    });
    return true;
  }, []);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!Array.isArray(sections) || sections.length === 0) return false;
    return sections.some((s) => String(s?.locationTitle || '').trim() && String(s?.description || '').trim());
  }, [title, sections]);

  const previewMagazine = useMemo(() => {
    if (!title.trim()) return null;
    const normalizedSections = (Array.isArray(sections) ? sections : [])
      .map((s) => ({
        moodTitle: String(s?.moodTitle || '').trim(),
        locationTitle: String(s?.locationTitle || '').trim(),
        locationInfo: String(s?.locationInfo || '').trim(),
        description: String(s?.description || '').trim(),
        around: Array.isArray(s?.around) ? s.around.filter((x) => String(x || '').trim()) : [],
        liveSituation: String(s?.liveSituation || '').trim(),
      }))
      .filter((s) => s.locationTitle || s.locationInfo || s.description);
    if (normalizedSections.length === 0) return null;
    if (!normalizedSections.some((s) => s.locationTitle && s.description)) return null;
    return {
      id: 'draft-preview',
      title: title.trim(),
      subtitle: subtitle.trim(),
      author: user?.email || user?.username || 'LiveJourney',
      createdAt: new Date().toISOString(),
      sections: normalizedSections.map((s) => ({
        location: s.locationTitle || s.locationInfo || title.trim(),
        moodTitle: s.moodTitle,
        locationInfo: s.locationInfo,
        description: s.description,
        around: s.around,
        liveSituation: s.liveSituation,
      })),
    };
  }, [title, subtitle, sections, user?.email, user?.username]);

  const gridPostsPub = useMemo(() => getGridPostsPool(allPosts), [allPosts]);
  const previewSlides = useMemo(
    () => (previewMagazine ? buildSlidesForMagazine(previewMagazine, allPosts, gridPostsPub) : []),
    [previewMagazine, allPosts, gridPostsPub]
  );
  const previewPostsPerSlide = useMemo(
    () => previewSlides.map((slide) => getRegionPostsForSlide(slide, allPosts, gridPostsPub)),
    [previewSlides, allPosts, gridPostsPub]
  );

  const saveDraft = useCallback(() => {
    try {
      // 서버 운영 전환: localStorage draft 저장 제거
      alert('임시저장 기능은 비활성화되었습니다.');
    } catch (_) {
      alert('임시저장에 실패했습니다.');
    }
  }, [title, sections]);

  const handleAddSection = useCallback(() => {
    setSections((prev) => {
      const last = prev && prev.length ? prev[prev.length - 1] : null;
      return [...(Array.isArray(prev) ? prev : []), createEmptySection(last || {})];
    });
  }, []);

  const handleRemoveSection = useCallback((id) => {
    setSections((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.length <= 1) {
        // 마지막 1개는 삭제 대신 초기화
        return [createEmptySection()];
      }
      return arr.filter((s) => s.id !== id);
    });
  }, []);

  const handleChangeSection = useCallback((id, field, value) => {
    setSections((prev) => (Array.isArray(prev) ? prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)) : prev));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!title.trim()) {
        alert('제목을 입력해 주세요.');
        return;
      }
      const normalizedSections = (Array.isArray(sections) ? sections : [])
        .map((s) => ({
          moodTitle: String(s?.moodTitle || '').trim(),
          locationTitle: String(s?.locationTitle || '').trim(),
          locationInfo: String(s?.locationInfo || '').trim(),
          description: String(s?.description || '').trim(),
          around: Array.isArray(s?.around) ? s.around.filter((x) => String(x || '').trim()) : [],
          liveSituation: String(s?.liveSituation || '').trim(),
        }))
        .filter((s) => s.locationTitle || s.locationInfo || s.description);
      if (normalizedSections.length === 0) {
        alert('최소 1개의 위치를 입력해 주세요.');
        return;
      }
      if (!normalizedSections.some((s) => s.locationTitle && s.description)) {
        alert('위치와 위치에 대한 설명은 최소 1개 이상 입력해 주세요.');
        return;
      }

      setSaving(true);
      const res = await publishMagazine({
        title: title.trim(),
        subtitle: subtitle.trim(),
        sections: normalizedSections.map((s) => ({
          location: s.locationTitle || s.locationInfo || title.trim(),
          moodTitle: s.moodTitle,
          locationInfo: s.locationInfo,
          description: s.description,
          around: s.around,
          liveSituation: s.liveSituation,
        })),
      });
      setSaving(false);

      if (!res.success) {
        alert('매거진 발행에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      try {
        // 서버 운영 전환: localStorage 제거
      } catch (_) {}
      navigate(`/magazine/${res.magazine.id}`, { replace: true, state: { magazine: res.magazine } });
    },
    [title, subtitle, sections, navigate]
  );

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-screen overflow-hidden">
      <div className="screen-content flex flex-col h-full">
        <header className="screen-header flex-shrink-0 grid grid-cols-[minmax(40px,1fr)_auto_minmax(40px,1fr)] items-center gap-1 px-4 py-3 bg-white dark:bg-gray-900 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex justify-start min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="뒤로"
            >
              <span className="material-symbols-outlined text-[22px] text-text-primary-light dark:text-text-primary-dark">
                arrow_back
              </span>
            </button>
          </div>
          <h1 className="text-[17px] font-extrabold text-text-primary-light dark:text-text-primary-dark m-0 truncate text-center max-w-[min(280px,70vw)]">
            {previewSlides.length > 0 ? '라이브매거진' : '라이브매거진 발행'}
          </h1>
          <div className="flex shrink-0 items-center justify-end gap-2 min-w-0">
            <button
              type="button"
              onClick={saveDraft}
              className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 px-1 py-2 min-w-0"
            >
              임시저장
            </button>
            <button
              type="submit"
              form="magazine-publish-form"
              disabled={!canSubmit || saving}
              className={`text-[13px] font-extrabold px-1 py-2 min-w-[40px] ${
                !canSubmit || saving ? 'text-gray-300 dark:text-gray-600' : 'text-[#22c55e]'
              }`}
            >
              등록
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth px-4 pt-3 pb-24 max-w-full [-webkit-overflow-scrolling:touch]">
          {adminLoading ? (
            <div className="py-12 text-center text-[13px] text-gray-500">권한 확인 중...</div>
          ) : !isAdmin ? (
            <div className="py-12 text-center text-[13px] text-gray-500 dark:text-gray-400">
              <p className="mb-2 font-semibold text-gray-800 dark:text-gray-100">라이브매거진 발행은 관리자 승인 계정만 가능합니다.</p>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white px-4 py-2 text-[13px] font-semibold"
              >
                돌아가기
              </button>
            </div>
          ) : (
            <>
              {/* MagazineDetailScreen(발행 매거진)과 동일: 상단 미리보기 = 캐러셀만 */}
              {previewSlides.length > 0 ? (
                <div className="w-full shrink-0">
                  <MagazinePublishedCarousel
                    variant="detail"
                    slides={previewSlides}
                    postsPerSlide={previewPostsPerSlide}
                  />
                </div>
              ) : (
                <div className="w-full shrink-0 flex flex-col items-center justify-center px-2 py-10 text-center">
                  <span className="material-symbols-outlined text-5xl text-zinc-300 dark:text-zinc-600 mb-3">book_5</span>
                  <p className="m-0 text-[14px] font-medium text-gray-800 dark:text-gray-100 mb-1">
                    미리보기를 불러올 수 있어요
                  </p>
                  <p className="m-0 text-[13px] text-gray-500 dark:text-gray-400 max-w-[280px] leading-relaxed">
                    아래에서 제목과 장소·설명을 입력하면 라이브매거진 상세 화면과 같은 구조로 여기에 표시돼요.
                  </p>
                </div>
              )}

              <form
                id="magazine-publish-form"
                className="space-y-6 pb-8 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800"
                onSubmit={handleSubmit}
              >
                <div className="rounded-xl border border-zinc-100 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-gray-900/40">
                  <p className="m-0 mb-3 text-[13px] font-bold text-gray-900 dark:text-gray-50">발행 내용 편집</p>
                  <div>
                    <label className="block mb-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300">라이브매거진 제목</label>
                    <input
                      className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[16px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                      placeholder="제목"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="mt-3">
                    <label className="block mb-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300">부제목</label>
                    <input
                      className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none"
                      placeholder="예: 벚꽃과 함께하는 천년고도"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-gray-900/40">
                  <label className="block mb-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                    복사한 글 붙여넣기 (자동 입력)
                  </label>
                  <textarea
                    className="w-full min-h-[100px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-gray-900/30 px-3 py-2 text-[13px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                    placeholder={
                      '전체 문구를 붙여넣으면 매거진 구조로 자동 입력돼요.\n\n제목: ...\n부제목: ...\n\n장소 이름: ...\n장소 위치: ...\n장소 설명: ...\n실시간 팁: ...\n주변 여행지: ..., ...\n실시간 상황: ...'
                    }
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      if (pasteStatus) setPasteStatus(null);
                    }}
                    onPaste={(e) => {
                      const clip = e?.clipboardData?.getData?.('text/plain');
                      if (!clip) return;
                      e.preventDefault();
                      applyPaste(clip);
                    }}
                    onBlur={() => {
                      if (!pasteText.trim()) return;
                      applyPaste(pasteText);
                    }}
                  />
                  {pasteStatus ? (
                    <p
                      className={`mt-2 text-[12px] font-semibold ${
                        pasteStatus.kind === 'ok'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pasteStatus.message}
                    </p>
                  ) : null}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => applyPaste(pasteText)}
                      className="rounded-full bg-gray-900 text-white px-4 py-2 text-[12px] font-semibold"
                    >
                      자동 채우기
                    </button>
                  </div>
                </div>

                {sections.map((sec, idx) => (
                  <section key={sec.id} className="rounded-xl border border-zinc-100 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-gray-900/40">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[11px] font-extrabold uppercase tracking-wide text-primary">장소 {idx + 1}</div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(sec.id)}
                        className="text-[12px] font-semibold text-rose-600 px-2 py-1"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">장소 이름</label>
                        <input
                          className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[15px] font-semibold text-gray-900 dark:text-gray-50 focus:outline-none"
                          placeholder="예: 경기 수원"
                          value={sec.locationTitle}
                          onChange={(e) => handleChangeSection(sec.id, 'locationTitle', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">장소 위치</label>
                        <input
                          className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none"
                          placeholder="예: 수원 화성 · 수원시 팔달구"
                          value={sec.locationInfo}
                          onChange={(e) => handleChangeSection(sec.id, 'locationInfo', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">장소 설명 · 실시간 팁</label>
                        <textarea
                          className="w-full min-h-[120px] bg-transparent px-0 py-2 text-[15px] leading-relaxed text-gray-900 dark:text-gray-50 focus:outline-none resize-none"
                          placeholder="장소 설명을 입력하세요. (붙여넣기 시 '실시간 팁:'은 설명 아래에 함께 합쳐져요)"
                          value={sec.description}
                          onChange={(e) => handleChangeSection(sec.id, 'description', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block mb-1.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">주변 여행지</label>
                        <input
                          className="w-full border-b border-zinc-200 dark:border-zinc-700 bg-transparent px-0 py-2.5 text-[14px] text-gray-900 dark:text-gray-50 focus:outline-none"
                          placeholder="예: 석굴암, 토함산 (콤마로 구분)"
                          value={Array.isArray(sec.around) ? sec.around.join(', ') : ''}
                          onChange={(e) =>
                            handleChangeSection(
                              sec.id,
                              'around',
                              e.target.value
                                .split(/,|·|•|ㆍ/)
                                .map((x) => x.trim())
                                .filter(Boolean)
                            )
                          }
                        />
                      </div>

                      <p className="m-0 rounded-lg bg-zinc-50/90 px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:bg-zinc-900/40 dark:text-gray-400">
                        주변 여행지를 비워두면 미리보기에서{' '}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">주변 맛집·명소 추천</span>이 지역 데이터와
                        피드 사진을 바탕으로 자동 표시돼요.
                      </p>
                    </div>
                  </section>
                ))}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="w-full rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-gray-900/40 py-3 text-[14px] font-extrabold text-gray-900 dark:text-gray-50"
                  >
                    + 장소 추가하기
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MagazineWriteScreen;


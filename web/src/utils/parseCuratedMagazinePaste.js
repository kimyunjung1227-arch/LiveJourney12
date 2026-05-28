/**
 * 큐레이션 매거진 발행화면의 "텍스트 일괄 붙여넣기" 파서.
 *
 * 1) 라벨 인식 (가장 정확):
 *    [제목]      ← 다음 라벨 직전까지를 제목
 *    [부제]      ← 부제
 *    [지역]      ← 대표 지역
 *    [인트로]    ← 커버 아래 첫 문단
 *    [본문]      ← 자유 텍스트 (자동으로 단락별 text 블록)
 *    [장소: 혼인지]
 *      주소: 제주특별자치도 ...
 *      설명: ...
 *      팁: ...
 *    [이미지: 캡션 텍스트]
 *      https://...png
 *
 * 2) 라벨이 하나도 없으면 휴리스틱:
 *    - 첫 줄 → 제목
 *    - 두 번째 짧은 줄(≤80자) → 부제
 *    - 그 다음 첫 단락 → 인트로
 *    - 나머지 단락 → 각각 text 블록
 */

const LABEL_NAMES = new Set(['제목', '부제', '지역', '인트로', '본문', '장소', '이미지']);

const trimRight = (s) => String(s || '').replace(/\s+$/g, '');

const splitParagraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => trimRight(p).replace(/^\s+/, ''))
    .filter(Boolean);

function findLabels(text) {
  // [라벨] 또는 [라벨: 인자] — 각각의 위치/헤더 길이
  const re = /\[([^\]:\n]+?)(?:\s*[:：]\s*([^\]\n]+))?\]/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const label = (m[1] || '').trim();
    if (!LABEL_NAMES.has(label)) continue;
    out.push({
      label,
      argument: (m[2] || '').trim(),
      headerStart: m.index,
      headerEnd: m.index + m[0].length,
    });
  }
  return out;
}

function sectionsFromLabels(text, labels) {
  return labels.map((cur, i) => {
    const next = labels[i + 1];
    const bodyStart = cur.headerEnd;
    const bodyEnd = next ? next.headerStart : text.length;
    return {
      label: cur.label,
      argument: cur.argument,
      body: text.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

function parsePlaceBody(body, argument) {
  const lines = body.split('\n').map((l) => l.trim());
  const place = {
    type: 'place',
    name: argument || '',
    address: '',
    description: '',
    tip: '',
    image_url: '',
  };
  const desc = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^장소명\s*[:：]/.test(line)) {
      if (!place.name) place.name = line.replace(/^장소명\s*[:：]\s*/, '');
    } else if (/^주소\s*[:：]/.test(line)) {
      place.address = line.replace(/^주소\s*[:：]\s*/, '');
    } else if (/^팁\s*[:：]/.test(line)) {
      place.tip = line.replace(/^팁\s*[:：]\s*/, '');
    } else if (/^설명\s*[:：]/.test(line)) {
      desc.push(line.replace(/^설명\s*[:：]\s*/, ''));
    } else if (/^이미지\s*[:：]/.test(line) || /^사진\s*[:：]/.test(line)) {
      place.image_url = line.replace(/^(이미지|사진)\s*[:：]\s*/, '');
    } else if (/^(https?:\/\/\S+\.(?:png|jpe?g|webp|gif))$/i.test(line) && !place.image_url) {
      place.image_url = line;
    } else {
      desc.push(line);
    }
  }
  place.description = desc.join('\n').trim();
  return place;
}

function parseImageBody(body, argument) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  let url = '';
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) {
      url = line;
      break;
    }
  }
  return { type: 'image', image_url: url, caption: argument || '' };
}

function textBlocksFromBody(body) {
  return splitParagraphs(body).map((p) => ({ type: 'text', body: p }));
}

function paragraphsToBlocks(paragraphs) {
  return paragraphs.map((p) => ({ type: 'text', body: p }));
}

export function parseCuratedMagazinePaste(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return null;

  const labels = findLabels(text);
  const out = {
    title: '',
    subtitle: '',
    region: '',
    intro_body: '',
    blocks: [],
  };

  if (labels.length > 0) {
    const sections = sectionsFromLabels(text, labels);
    for (const sec of sections) {
      switch (sec.label) {
        case '제목':
          if (!out.title) out.title = sec.body.replace(/\n+/g, ' ').trim();
          break;
        case '부제':
          if (!out.subtitle) out.subtitle = sec.body.replace(/\n+/g, ' ').trim();
          break;
        case '지역':
          if (!out.region) out.region = sec.body.replace(/\n+/g, ' ').trim();
          break;
        case '인트로':
          if (!out.intro_body) out.intro_body = sec.body;
          break;
        case '본문':
          out.blocks.push(...textBlocksFromBody(sec.body));
          break;
        case '장소':
          out.blocks.push(parsePlaceBody(sec.body, sec.argument));
          break;
        case '이미지':
          out.blocks.push(parseImageBody(sec.body, sec.argument));
          break;
        default:
          break;
      }
    }
    return out;
  }

  // 라벨 없음 — 휴리스틱
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return null;

  const firstPara = paragraphs[0];
  const firstLines = firstPara.split('\n').map((l) => l.trim()).filter(Boolean);

  out.title = firstLines[0] || '';
  let restLines = firstLines.slice(1);

  // 두 번째 줄이 짧으면 부제로
  if (restLines[0] && restLines[0].length <= 80) {
    out.subtitle = restLines[0];
    restLines = restLines.slice(1);
  }
  if (restLines.length > 0) {
    out.intro_body = restLines.join('\n');
  } else if (paragraphs[1]) {
    out.intro_body = paragraphs[1];
  }

  // 인트로로 쓴 단락 다음부터 텍스트 블록
  const introUsedFromSecond = !out.intro_body ? 0 : restLines.length === 0 ? 2 : 1;
  const tail = paragraphs.slice(introUsedFromSecond);
  out.blocks = paragraphsToBlocks(tail);

  return out;
}

export default parseCuratedMagazinePaste;

// 지역 뱃지 PNG에서 박혀있는 텍스트를 잘라낸다.
// - 알파 채널을 row 단위로 분석해서 의미 있는(non-transparent)픽셀의 분포를 찾고
// - 가장 큰 연속 영역(=아이콘)만 남긴다.
// - 정사각 캔버스에 transparent 패딩.
const sharp = require('sharp');
const path = require('path');

const BADGES_DIR = path.join(__dirname, '..', 'web', 'src', 'assets', 'badges');
const TARGETS = ['seoul', 'jeju', 'busan', 'gangneung', 'gyeongju'];

// 픽셀이 "확실히 보이는" 알파 임계
const ALPHA_THRESHOLD = 64;
// row 한 줄에서 보이는 픽셀이 이 정도는 있어야 의미 있다고 간주 (텍스트의 얇은 획 제거)
const ROW_PIXEL_RATIO = 0.04;

async function analyzeAndCrop(name) {
  const inPath = path.join(BADGES_DIR, `${name}.png`);
  const img = sharp(inPath).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width;
  const H = meta.height;

  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  // data: [R,G,B,A] per pixel, length = W*H*4

  // row 별 의미 있는 픽셀 개수와 좌/우 끝
  const rowSpan = new Array(H).fill(null);
  for (let y = 0; y < H; y += 1) {
    let count = 0;
    let minX = W;
    let maxX = -1;
    for (let x = 0; x < W; x += 1) {
      const a = data[(y * W + x) * 4 + 3];
      if (a >= ALPHA_THRESHOLD) {
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    rowSpan[y] = { count, minX, maxX };
  }

  const minRowPx = Math.max(2, Math.floor(W * ROW_PIXEL_RATIO));

  // row 단위로 "filled" 여부 라벨
  const filled = rowSpan.map((r) => r.count >= minRowPx);

  // 연속 영역(run) 찾기
  const runs = [];
  let runStart = -1;
  for (let y = 0; y <= H; y += 1) {
    if (y < H && filled[y]) {
      if (runStart === -1) runStart = y;
    } else if (runStart !== -1) {
      runs.push({ start: runStart, end: y - 1, size: y - runStart });
      runStart = -1;
    }
  }
  if (runs.length === 0) {
    console.warn(`[${name}] 의미 있는 영역을 찾지 못함, 스킵`);
    return;
  }

  // 가장 큰 run = 아이콘
  runs.sort((a, b) => b.size - a.size);
  const icon = runs[0];

  // 가로 bbox
  let bbMinX = W;
  let bbMaxX = -1;
  for (let y = icon.start; y <= icon.end; y += 1) {
    if (rowSpan[y].minX < bbMinX) bbMinX = rowSpan[y].minX;
    if (rowSpan[y].maxX > bbMaxX) bbMaxX = rowSpan[y].maxX;
  }

  // 약간의 패딩 (정사각 캔버스용)
  const pad = Math.round(Math.min(W, H) * 0.04);
  const cropTop = Math.max(0, icon.start - pad);
  const cropBottom = Math.min(H - 1, icon.end + pad);
  const cropLeft = Math.max(0, bbMinX - pad);
  const cropRight = Math.min(W - 1, bbMaxX + pad);

  const cropW = cropRight - cropLeft + 1;
  const cropH = cropBottom - cropTop + 1;
  const side = Math.max(cropW, cropH);

  console.log(
    `[${name}] ${W}x${H} → bbox y=${icon.start}..${icon.end} x=${bbMinX}..${bbMaxX} → crop ${cropW}x${cropH} → square ${side}`,
  );

  // 1) crop, 2) extend to square with transparent
  const left = Math.round((side - cropW) / 2);
  const top = Math.round((side - cropH) / 2);

  await sharp(inPath)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .extend({
      top,
      bottom: side - cropH - top,
      left,
      right: side - cropW - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(BADGES_DIR, `${name}.png.new`));

  // overwrite atomically
  const fs = require('fs');
  fs.renameSync(
    path.join(BADGES_DIR, `${name}.png.new`),
    path.join(BADGES_DIR, `${name}.png`),
  );
}

(async () => {
  for (const t of TARGETS) {
    try {
      await analyzeAndCrop(t);
    } catch (e) {
      console.error(`[${t}] 실패:`, e.message);
    }
  }
})();

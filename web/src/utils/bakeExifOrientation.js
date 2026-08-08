/**
 * EXIF Orientation 태그를 픽셀에 직접 구워 넣어 "찍은 방향 그대로" 보이게 만든다.
 *
 * 왜 필요한가:
 *   폰 카메라는 센서 픽셀을 그대로 두고 "이 사진은 90도 돌려서 보라"는 태그(Orientation)만 남긴다.
 *   <img> 는 이 태그를 반영해 주지만, CSS background-image·canvas·서버 썸네일 변환·다른 앱 등
 *   태그를 무시하는 곳에서는 사진이 옆으로 누워 보인다. 업로드 전에 픽셀을 실제로 돌려두면
 *   어디서 열어도 찍은 방향 그대로 나온다.
 *
 * 주의: 재인코딩하면 파일 안의 EXIF(GPS·촬영시각)가 사라지므로,
 *       EXIF 추출이 끝난 뒤(업로드 직전)에 호출해야 한다.
 */

/** JPEG 바이트에서 EXIF Orientation(1~8)을 읽는다. 없으면 1. */
async function readJpegOrientation(blob) {
  // EXIF(APP1)는 파일 맨 앞에 있다 — 앞부분만 읽으면 충분하다.
  const head = blob.slice(0, 256 * 1024);
  const buf = await head.arrayBuffer();
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1; // SOI 아님

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1; // 마커 정렬이 깨짐
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) return 1; // 이미지 데이터 시작 — EXIF 없음
    const segLength = view.getUint16(offset + 2, false);
    if (segLength < 2) return 1;

    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      // "Exif\0\0"
      if (view.getUint32(offset + 4, false) !== 0x45786966) {
        offset += 2 + segLength;
        continue;
      }
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return 1;
      const le = view.getUint16(tiff, false) === 0x4949; // 'II' = little endian
      if (view.getUint16(tiff + 2, le) !== 42) return 1;
      const ifd0 = tiff + view.getUint32(tiff + 4, le);
      if (ifd0 + 2 > view.byteLength) return 1;
      const count = view.getUint16(ifd0, le);
      for (let i = 0; i < count; i += 1) {
        const entry = ifd0 + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, le) === 0x0112) {
          const value = view.getUint16(entry + 8, le);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    offset += 2 + segLength;
  }
  return 1;
}

/** Orientation 값에 맞춰 캔버스 좌표계를 변환한다. (w, h = 원본 픽셀 크기) */
function applyOrientationTransform(ctx, orientation, w, h) {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break; // 좌우 반전
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break; // 180도
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break; // 상하 반전
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break; // 전치
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break; // 시계 90도
    case 7: ctx.transform(0, -1, -1, 0, h, w); break; // 역전치
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break; // 반시계 90도
    default: break;
  }
}

const isJpeg = (file) =>
  /^image\/jpe?g$/i.test(String(file?.type || '')) ||
  /\.jpe?g$/i.test(String(file?.name || ''));

/**
 * 이미지 파일의 EXIF 방향을 픽셀에 반영한 새 File 을 반환한다.
 * 정방향(Orientation 1)이거나 JPEG 가 아니면 원본을 그대로 돌려준다(재인코딩 없음).
 *
 * @param {File|Blob} file
 * @returns {Promise<File|Blob>}
 */
export async function bakeExifOrientation(file) {
  try {
    if (!file || typeof file.arrayBuffer !== 'function') return file;
    if (!isJpeg(file)) return file;
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

    const orientation = await readJpegOrientation(file);
    if (orientation <= 1) return file; // 이미 찍은 방향 그대로 — 손대지 않는다

    // 브라우저마다 EXIF 반영 여부가 달라지지 않도록 '원본 픽셀'로 디코드한 뒤 직접 회전한다.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
    const w = bitmap.width;
    const h = bitmap.height;
    const swap = orientation >= 5 && orientation <= 8;

    const canvas = document.createElement('canvas');
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    applyOrientationTransform(ctx, orientation, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) return file;

    const name = String(file.name || 'photo.jpg').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
  } catch (_) {
    // 실패하면 원본 그대로 업로드 — 업로드 자체를 막지는 않는다
    return file;
  }
}

export default bakeExifOrientation;

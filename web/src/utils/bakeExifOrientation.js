/**
 * EXIF Orientation 태그를 픽셀에 직접 구워 넣어 "찍은 방향 그대로" 보이게 만든다.
 *
 * 왜 필요한가:
 *   폰 카메라는 센서 픽셀을 그대로 두고 "이 사진은 90도 돌려서 보라"는 태그(Orientation)만 남긴다.
 *   <img> 는 이 태그를 반영해 주지만, CSS background-image·canvas·서버 썸네일 변환·다른 앱 등
 *   태그를 무시하는 곳에서는 사진이 옆으로 누워 보인다. 업로드 전에 픽셀을 실제로 돌려두면
 *   어디서 열어도 찍은 방향 그대로 나온다.
 *
 * 주의 1: 재인코딩하면 파일 안의 EXIF(GPS·촬영시각)가 사라지므로,
 *         EXIF 추출이 끝난 뒤(업로드 직전)에 호출해야 한다.
 * 주의 2: 브라우저가 디코드할 때 EXIF 를 이미 반영해 주는지 여부가 제각각이다.
 *         "이미 돌아간 픽셀"을 한 번 더 돌리면 사진이 옆으로 눕기 때문에,
 *         파일에 인코딩된 원본 크기(SOF)와 디코드 결과를 대조해 판별한 뒤에만 회전한다.
 */

/** APP1(Exif) 세그먼트에서 Orientation(1~8)을 읽는다. 없으면 0. */
function parseExifOrientation(view, segStart) {
  // "Exif\0\0"
  if (segStart + 6 > view.byteLength) return 0;
  if (view.getUint32(segStart, false) !== 0x45786966) return 0;
  const tiff = segStart + 6;
  if (tiff + 8 > view.byteLength) return 0;
  const le = view.getUint16(tiff, false) === 0x4949; // 'II' = little endian
  if (view.getUint16(tiff + 2, le) !== 42) return 0;
  const ifd0 = tiff + view.getUint32(tiff + 4, le);
  if (ifd0 + 2 > view.byteLength) return 0;
  const count = view.getUint16(ifd0, le);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > view.byteLength) return 0;
    if (view.getUint16(entry, le) === 0x0112) {
      const value = view.getUint16(entry + 8, le);
      return value >= 1 && value <= 8 ? value : 0;
    }
  }
  return 0;
}

/** SOF 마커인지 (DHT/JPG/DAC 는 같은 대역이지만 프레임 헤더가 아니다) */
function isSofMarker(marker) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

/**
 * JPEG 헤더에서 Orientation 과 "파일에 실제로 인코딩된 픽셀 크기"를 함께 읽는다.
 * rawWidth/rawHeight 는 EXIF 를 반영하기 전 크기라서,
 * 브라우저가 디코드해 준 결과와 대조하면 EXIF 가 이미 적용됐는지 알 수 있다.
 */
async function readJpegMeta(blob) {
  const meta = { orientation: 1, rawWidth: 0, rawHeight: 0 };
  // EXIF(APP1)·SOF 모두 파일 앞쪽에 있다 — 앞부분만 읽으면 충분하다.
  const buf = await blob.slice(0, 512 * 1024).arrayBuffer();
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return meta; // SOI 아님

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return meta; // 마커 정렬이 깨짐
    let marker = view.getUint8(offset + 1);
    // 0xFF 채움 바이트가 이어질 수 있다
    while (marker === 0xff && offset + 2 < view.byteLength) {
      offset += 1;
      marker = view.getUint8(offset + 1);
    }
    // 길이 필드가 없는 단독 마커
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return meta; // 압축 데이터 시작 — 헤더 끝

    const segLength = view.getUint16(offset + 2, false);
    if (segLength < 2) return meta;
    const segStart = offset + 4;

    if (marker === 0xe1 && meta.orientation === 1) {
      const found = parseExifOrientation(view, segStart);
      if (found) meta.orientation = found;
    } else if (isSofMarker(marker)) {
      // SOF: [precision(1)][height(2)][width(2)]...
      if (segStart + 5 <= view.byteLength) {
        meta.rawHeight = view.getUint16(segStart + 1, false);
        meta.rawWidth = view.getUint16(segStart + 3, false);
      }
      return meta; // 필요한 정보는 여기까지
    }
    offset += 2 + segLength;
  }
  return meta;
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

    const { orientation, rawWidth, rawHeight } = await readJpegMeta(file);
    if (orientation <= 1) return file; // 이미 찍은 방향 그대로 — 손대지 않는다

    // 'from-image' 는 최신 브라우저의 기본 동작과 같은 값이라,
    // imageOrientation 옵션을 무시하는 브라우저에서도 결과가 같다.
    // (예전처럼 'none' 을 쓰면, 옵션을 무시하고 EXIF 를 이미 반영해 주는 브라우저에서
    //  아래 회전이 한 번 더 걸려 세로 사진이 옆으로 눕는다.)
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const w = bitmap.width;
    const h = bitmap.height;
    const swap = orientation >= 5 && orientation <= 8;

    // 브라우저가 정말 EXIF 를 반영했는지 파일에 인코딩된 원본 크기와 대조한다.
    // 90도 계열(5~8)은 반영되면 가로·세로가 뒤바뀌므로 확실히 구분된다.
    // 크기가 안 바뀌는 2·3·4 나 정사각 사진은 구분할 수 없어 'from-image' 결과를 믿는다.
    const needsRotate =
      swap &&
      rawWidth > 0 &&
      rawHeight > 0 &&
      rawWidth !== rawHeight && // 정사각은 뒤바뀌어도 크기가 같아 판별 불가
      w === rawWidth &&
      h === rawHeight;

    const canvas = document.createElement('canvas');
    canvas.width = needsRotate ? h : w;
    canvas.height = needsRotate ? w : h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    if (needsRotate) applyOrientationTransform(ctx, orientation, w, h);
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

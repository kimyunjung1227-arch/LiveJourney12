/**
 * 업로드 미디어(이미지)를 90° 단위로 회전해 새 File/blobURL 을 만들어 반환.
 * 가로로 찍혀 옆으로 누운 사진을 사용자가 직접 정면으로 돌릴 때 사용한다.
 *
 * @param {{ url:string, file?:File, mimeType?:string }} media
 * @param {number} deg 시계방향 회전 각도 (기본 90)
 * @returns {Promise<{file:File, url:string, size:number, mimeType:string}>}
 */
export async function rotateImageMedia(media, deg = 90) {
  if (!media?.url) throw new Error('회전할 이미지가 없어요.');

  const img = await loadImage(media.url);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('이미지를 불러오지 못했어요.');

  const norm = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  const swap = norm === 90 || norm === 270;

  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((norm * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  const type =
    media.mimeType && media.mimeType.startsWith('image/') ? media.mimeType : 'image/jpeg';
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('이미지 회전에 실패했어요.'))),
      type,
      0.92,
    );
  });

  const name = media.file?.name || 'photo.jpg';
  const file = new File([blob], name, { type: blob.type, lastModified: Date.now() });
  const url = URL.createObjectURL(blob);
  return { file, url, size: blob.size, mimeType: blob.type };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

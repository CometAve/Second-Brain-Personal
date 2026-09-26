/** An inline image survives a note or draft reload without a separate asset API. */
const MAX_INLINE_IMAGE_BYTES = 512 * 1024;

function imageMimeType(bytes: Uint8Array): string | null {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
    return 'image/gif';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  return null;
}

export async function readInlineImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_INLINE_IMAGE_BYTES)
    throw new Error('512KB 이하의 PNG, JPEG, WebP 또는 GIF 이미지를 선택해 주세요.');

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const mimeType = imageMimeType(bytes);
  if (!mimeType) throw new Error('PNG, JPEG, WebP 또는 GIF 이미지만 추가할 수 있습니다.');

  // A valid header alone does not establish that the image data can render.
  // Decode before persisting so corrupt local files do not become broken notes.
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
  } catch {
    throw new Error('이미지 파일을 열 수 없습니다. 다른 이미지를 선택해 주세요.');
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다. 다시 시도해 주세요.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !/^data:[^,]*;base64,/.test(result)) {
        reject(new Error('이미지를 읽지 못했습니다. 다시 시도해 주세요.'));
        return;
      }
      resolve(`data:${mimeType};base64,${result.slice(result.indexOf(',') + 1)}`);
    };
    reader.readAsDataURL(file);
  });
}

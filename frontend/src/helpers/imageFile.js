export const IMAGE_FILE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

const MAX_STORED_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const TYPE_ERROR = 'Use a JPG, PNG, WebP, or iPhone HEIC/HEIF photo.';
const READ_ERROR = 'This photo could not be processed. Try a JPG, PNG, or WebP image.';
const LARGE_ERROR = 'This photo is too large to upload. Try a smaller image.';

const FORMAT_MIME = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heif: 'image/heic'
};

const HEIF_BRANDS = {
  heic: true,
  heix: true,
  hevc: true,
  hevx: true,
  heim: true,
  heis: true,
  hevm: true,
  hevs: true,
  mif1: true,
  msf1: true
};

function formatFromBytes(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (HEIF_BRANDS[brand]) return 'heif';
  }
  return '';
}

async function identify(file) {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return formatFromBytes(header);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to read the image.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read the image.'));
    reader.readAsDataURL(file);
  });
}

function renderJpeg(bitmap, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to encode JPEG.'));
    }, 'image/jpeg', quality);
  });
}

function fittedSize(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (!width || !height || longest <= maxEdge) {
    return { width: width || 1, height: height || 1 };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function compressBlob(source) {
  const bitmap = await createImageBitmap(source);
  try {
    const initial = fittedSize(bitmap.width, bitmap.height, 4096);
    let width = initial.width;
    let height = initial.height;
    let quality = 0.9;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const blob = await renderJpeg(bitmap, width, height, quality);
      if (blob.size <= MAX_STORED_BYTES) return blob;
      quality = Math.max(0.6, quality - 0.06);
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
    return null;
  } finally {
    bitmap.close();
  }
}

async function blobFromBrowser(file) {
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('Empty image.');
    const size = fittedSize(bitmap.width, bitmap.height, 4096);
    return await renderJpeg(bitmap, size.width, size.height, 0.92);
  } finally {
    bitmap.close();
  }
}

async function heifToJpegBlob(file) {
  try {
    return await blobFromBrowser(file);
  } catch {
    const { heicTo } = await import('heic-to');
    const blob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.92
    });
    if (!blob) throw new Error('Empty HEIC conversion.');
    return blob;
  }
}

function jpegFile(blob, name, lastModified) {
  const base = String(name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], base + '.jpg', {
    type: 'image/jpeg',
    lastModified: lastModified || Date.now()
  });
}

export async function prepareImageFile(file) {
  if (!file) return { error: TYPE_ERROR };
  if (file.size > MAX_SOURCE_BYTES) {
    return { error: 'This photo is too large to upload. The maximum size is 25 MB.' };
  }

  let format = '';
  try {
    format = await identify(file);
  } catch {
    return { error: READ_ERROR };
  }
  if (!format) return { error: TYPE_ERROR };

  try {
    let upload = file;
    const mime = FORMAT_MIME[format];
    if (format === 'heif') {
      let blob = await heifToJpegBlob(file);
      if (blob.size > MAX_STORED_BYTES) {
        blob = await compressBlob(blob);
        if (!blob) return { error: LARGE_ERROR };
      }
      upload = jpegFile(blob, file.name, file.lastModified);
    } else if (String(file.type || '').toLowerCase() !== mime) {
      const buffer = await file.arrayBuffer();
      upload = new File([buffer], file.name || 'photo', {
        type: mime,
        lastModified: file.lastModified
      });
    }

    if (upload.size > MAX_STORED_BYTES) {
      const compressed = await compressBlob(upload);
      if (!compressed) return { error: LARGE_ERROR };
      upload = jpegFile(compressed, file.name, file.lastModified);
    }

    const dataUrl = await readAsDataUrl(upload);
    if (!dataUrl.startsWith('data:image/')) return { error: READ_ERROR };
    return { dataUrl };
  } catch {
    return { error: READ_ERROR };
  }
}

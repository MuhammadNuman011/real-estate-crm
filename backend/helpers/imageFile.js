const sharp = require("sharp");
const convertHeif = require("heic-convert");

const MAX_STORED_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const CLAIMED_TYPES = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/x-citrix-jpeg": "jpeg",
  "image/png": "png",
  "image/x-png": "png",
  "image/webp": "webp",
  "image/heic": "heif",
  "image/heif": "heif",
  "image/heic-sequence": "heif",
  "image/heif-sequence": "heif",
  "application/octet-stream": "unknown",
  "binary/octet-stream": "unknown"
};

const EXTENSIONS = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp"
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

function formatError(label) {
  return label + " must be a JPG, PNG, WebP, or HEIC/HEIF image.";
}

function detectFormat(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    if (HEIF_BRANDS[brand]) return "heif";
  }
  return "";
}

async function convertHeifToJpeg(buffer) {
  const output = await convertHeif({
    buffer: buffer,
    format: "JPEG",
    quality: 0.92
  });
  const jpeg = Buffer.from(output);
  if (detectFormat(jpeg) !== "jpeg") {
    throw new Error("HEIC/HEIF conversion did not produce a JPEG.");
  }
  return jpeg;
}

async function compressToLimit(buffer, maxBytes) {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  let width = meta.width || 0;
  let height = meta.height || 0;
  if (!width || !height) return null;

  const longest = Math.max(width, height);
  if (longest > 4096) {
    const scale = 4096 / longest;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  let quality = 90;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const output = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: width,
        height: height,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: quality, mozjpeg: true })
      .toBuffer();
    if (output.length <= maxBytes) return output;
    quality = Math.max(60, quality - 6);
    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
  }

  return null;
}

async function prepareStoredImage(dataUrl, label) {
  if (typeof dataUrl !== "string") {
    return { error: formatError(label) };
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match || !CLAIMED_TYPES[String(match[1] || "").toLowerCase()]) {
    return { error: formatError(label) };
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    return { error: label + " could not be read." };
  }
  if (buffer.length > MAX_SOURCE_BYTES) {
    return { error: label + " must be under 25 MB." };
  }

  const actual = detectFormat(buffer);
  if (!actual) {
    return { error: label + " could not be processed. Use a JPG, PNG, WebP, or iPhone HEIC/HEIF photo." };
  }

  let stored = buffer;
  let format = actual;

  try {
    if (actual === "heif") {
      stored = await convertHeifToJpeg(buffer);
      format = "jpeg";
    }
  } catch (error) {
    console.error("HEIC/HEIF conversion failed:", error);
    return { error: label + " could not be converted. Try a JPG photo instead." };
  }

  if (stored.length > MAX_STORED_BYTES) {
    try {
      const fitted = await compressToLimit(stored, MAX_STORED_BYTES);
      if (!fitted) {
        return { error: label + " is too large to upload. Try a smaller photo." };
      }
      stored = fitted;
      format = "jpeg";
    } catch (error) {
      console.error("Image compression failed:", error);
      return { error: label + " could not be processed." };
    }
  }

  return {
    buffer: stored,
    extension: EXTENSIONS[format]
  };
}

module.exports = {
  MAX_STORED_BYTES: MAX_STORED_BYTES,
  MAX_SOURCE_BYTES: MAX_SOURCE_BYTES,
  prepareStoredImage: prepareStoredImage
};

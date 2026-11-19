const sharp = require("sharp");
const convertHeif = require("heic-convert");

const MAX_STORED_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const WATERMARK_MARKER = "crm-property-watermark";

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

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hasWatermarkMarker(metadata) {
  const marker = Buffer.from(WATERMARK_MARKER);
  if (metadata.exif && Buffer.isBuffer(metadata.exif) && metadata.exif.includes(marker)) return true;
  if (metadata.xmp && Buffer.isBuffer(metadata.xmp) && metadata.xmp.includes(marker)) return true;
  if (!Array.isArray(metadata.comments)) return false;
  return metadata.comments.some(function(comment) {
    return String(comment).indexOf(WATERMARK_MARKER) !== -1;
  });
}

async function applyCompanyWatermark(buffer, companyName) {
  const label = String(companyName || "").replace(/\s+/g, " ").trim();
  if (!label) return { buffer: buffer };

  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  if (hasWatermarkMarker(metadata)) return { buffer: buffer };

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) {
    throw new Error("Image dimensions are unavailable.");
  }

  const fontSize = Math.max(24, Math.min(120, Math.round(Math.min(width, height) * 0.08)));
  const pad = Math.max(10, Math.round(fontSize * 0.7));
  const maxChars = Math.max(4, Math.floor(Math.max(fontSize, width - pad * 2) / (fontSize * 0.55)));
  let text = label;
  if (text.length > maxChars) {
    text = text.slice(0, Math.max(1, maxChars - 3)) + "...";
  }

  const svgWidth = Math.min(width, Math.ceil(text.length * fontSize * 0.62) + pad * 2);
  const svgHeight = Math.min(height, Math.ceil(fontSize * 1.5) + pad);
  const textX = Math.round(svgWidth / 2);
  const textY = Math.round(svgHeight / 2 + fontSize * 0.35);
  const svg = Buffer.from(
    "<svg width=\"" + svgWidth + "\" height=\"" + svgHeight + "\" xmlns=\"http://www.w3.org/2000/svg\">" +
      "<text x=\"" + textX + "\" y=\"" + textY + "\" text-anchor=\"middle\" " +
      "font-family=\"Arial, Helvetica, sans-serif\" font-size=\"" + fontSize + "\" font-weight=\"600\" " +
      "fill=\"rgba(255,255,255,0.58)\" stroke=\"rgba(0,0,0,0.38)\" stroke-width=\"" + Math.max(1, Math.round(fontSize / 16)) + "\" " +
      "paint-order=\"stroke\">" + escapeXml(text) + "</text></svg>"
  );

  let pipeline = sharp(buffer, { failOn: "none" })
    .composite([{
      input: svg,
      left: Math.round((width - svgWidth) / 2),
      top: Math.round((height - svgHeight) / 2)
    }])
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: WATERMARK_MARKER
        }
      }
    });

  const format = metadata.format;
  if (format === "png") {
    pipeline = pipeline.png();
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality: 92 });
  } else {
    pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
  }

  let output = await pipeline.toBuffer();
  let extension = EXTENSIONS[format] || EXTENSIONS.jpeg;

  if (output.length > MAX_STORED_BYTES) {
    const fitted = await compressToLimit(output, MAX_STORED_BYTES);
    if (!fitted) {
      throw new Error("Watermarked image exceeds the stored size limit.");
    }
    output = await sharp(fitted, { failOn: "none" })
      .withMetadata({
        exif: {
          IFD0: {
            ImageDescription: WATERMARK_MARKER
          }
        }
      })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    extension = EXTENSIONS.jpeg;
  }

  return { buffer: output, extension: extension };
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
  prepareStoredImage: prepareStoredImage,
  applyCompanyWatermark: applyCompanyWatermark
};

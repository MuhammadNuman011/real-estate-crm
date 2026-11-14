const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");

const BROCHURE_DIR = path.join(__dirname, "../storage/brochures");
const BROCHURE_PREFIX = "/storage/brochures/";
const IMAGE_DIR = path.join(__dirname, "../uploads/properties");
const IMAGE_PREFIX = "/uploads/properties/";

function resolveBrochureFile(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith(BROCHURE_PREFIX)) return null;
  const filename = path.basename(storedPath);
  if (!/^[a-f0-9]{32}\.pdf$/.test(filename)) return null;
  const fullPath = path.resolve(BROCHURE_DIR, filename);
  const root = path.resolve(BROCHURE_DIR) + path.sep;
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

function removeBrochure(storedPath) {
  const fullPath = resolveBrochureFile(storedPath);
  if (!fullPath || !fs.existsSync(fullPath)) return;
  try {
    fs.unlinkSync(fullPath);
  } catch (error) {
    console.error("Unable to remove previous brochure:", error);
  }
}

function resolvePropertyUpload(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith(IMAGE_PREFIX)) return null;
  const filename = path.basename(storedPath);
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(filename)) return null;
  const fullPath = path.resolve(IMAGE_DIR, filename);
  const root = path.resolve(IMAGE_DIR) + path.sep;
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

async function loadImageForPdf(storedPath) {
  const fullPath = resolvePropertyUpload(storedPath);
  if (!fullPath || !fs.existsSync(fullPath)) return null;

  try {
    const rotated = await sharp(fullPath).rotate().toBuffer({ resolveWithObject: true });
    if (!rotated.info.width || !rotated.info.height) return null;

    if (rotated.info.format === "jpeg" || rotated.info.format === "png") {
      return {
        source: rotated.data,
        width: rotated.info.width,
        height: rotated.info.height
      };
    }

    const png = await sharp(rotated.data).png().toBuffer({ resolveWithObject: true });
    if (!png.info.width || !png.info.height) return null;
    return {
      source: png.data,
      width: png.info.width,
      height: png.info.height
    };
  } catch (error) {
    console.error("Skipping unreadable property image:", error);
    return null;
  }
}

function fittedSize(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function propertySummary(property) {
  const parts = [];
  const propertyType = property && property.property_type ? String(property.property_type).trim() : "";
  if (propertyType) parts.push(propertyType);
  if (property && property.rent_sale === "sale") parts.push("For sale");
  if (property && property.rent_sale === "rent") parts.push("For rent");

  const price = formatAmount(property && property.price);
  if (price) parts.push("Price " + price);

  if (property && property.bedrooms != null) parts.push(property.bedrooms + " bedrooms");
  if (property && property.bathrooms != null) parts.push(property.bathrooms + " bathrooms");

  const area = formatAmount(property && property.area);
  const unit = property && property.area_unit === "sqm" ? "sqm" : "sqft";
  if (area) parts.push(area + " " + unit);

  return parts.join("   ·   ");
}

function paintHeaders(doc, companyName) {
  const range = doc.bufferedPageRange();
  const label = String(companyName || "Company").trim() || "Company";

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const previousTop = doc.page.margins.top;
    doc.page.margins.top = 0;
    doc.save();
    doc.fillColor("#1f2933").font("Helvetica-Bold").fontSize(13);
    doc.text(label, 40, 26, {
      width: doc.page.width - 80,
      align: "center",
      lineBreak: false,
      ellipsis: true,
      height: 18
    });
    doc.moveTo(40, 50)
      .lineTo(doc.page.width - 40, 50)
      .strokeColor("#c5c9d1")
      .lineWidth(0.8)
      .stroke();
    doc.restore();
    doc.page.margins.top = previousTop;
  }
}

function buildPropertyBrochure(options) {
  const companyName = options.companyName;
  const property = options.property || {};
  const images = options.images || [];
  const description = String(property.description || "").trim() || "No description provided.";

  return new Promise(function(resolve, reject) {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 72, bottom: 50, left: 40, right: 40 },
      bufferPages: true,
      info: {
        Title: (property.property_type || "Property") + " brochure",
        Author: String(companyName || "Company").trim() || "Company"
      }
    });
    const chunks = [];
    doc.on("data", function(chunk) {
      chunks.push(chunk);
    });
    doc.on("error", reject);
    doc.on("end", function() {
      resolve(Buffer.concat(chunks));
    });

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const contentBottom = doc.page.height - doc.page.margins.bottom;
    const gap = 14;
    const columns = images.length > 1 ? 2 : 1;
    const cellWidth = columns === 1 ? contentWidth : (contentWidth - gap) / 2;
    const maxHeight = columns === 1 ? 460 : 240;
    let y = doc.page.margins.top;
    let column = 0;
    let rowHeight = 0;

    function contentBottomNow() {
      return doc.page.height - doc.page.margins.bottom;
    }

    function startPage() {
      doc.addPage();
      y = doc.page.margins.top;
      column = 0;
      rowHeight = 0;
    }

    images.forEach(function(image) {
      const size = fittedSize(image.width, image.height, cellWidth, maxHeight);
      const atTop = column === 0 && y <= doc.page.margins.top + 1;
      if (!atTop && y + size.height > contentBottomNow()) {
        startPage();
      }

      const x = left + column * (cellWidth + gap) + (cellWidth - size.width) / 2;
      doc.image(image.source, x, y, { width: size.width });
      rowHeight = Math.max(rowHeight, size.height);
      column += 1;

      if (column === columns) {
        y += rowHeight + gap;
        column = 0;
        rowHeight = 0;
      }
    });

    if (column !== 0) {
      y += rowHeight + gap;
    }

    if (!images.length) {
      doc.font("Helvetica-Oblique").fontSize(11).fillColor("#5c6570");
      doc.text("No pictures have been uploaded for this property.", left, y, {
        width: contentWidth
      });
      y = doc.y + 16;
    } else {
      y += 8;
    }

    if (y + 78 > contentBottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    const summary = propertySummary(property);
    if (summary) {
      doc.font("Helvetica").fontSize(10).fillColor("#3d4654");
      doc.text(summary, left, y, { width: contentWidth });
      y = doc.y + 12;
    }

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#1f2933");
    doc.text("Description", left, y, { width: contentWidth });
    y = doc.y + 8;
    doc.font("Helvetica").fontSize(11).fillColor("#222222");
    doc.text(description, left, y, {
      width: contentWidth,
      align: "left",
      lineGap: 3
    });

    paintHeaders(doc, companyName);
    doc.end();
  });
}

async function writePropertyBrochure(options) {
  const loaded = [];
  const sourcePaths = Array.isArray(options.imagePaths) ? options.imagePaths : [];

  for (let index = 0; index < sourcePaths.length; index += 1) {
    const image = await loadImageForPdf(sourcePaths[index]);
    if (image) loaded.push(image);
  }

  const buffer = await buildPropertyBrochure({
    companyName: options.companyName,
    property: options.property,
    images: loaded
  });

  fs.mkdirSync(BROCHURE_DIR, { recursive: true });
  const filename = crypto.randomBytes(16).toString("hex") + ".pdf";
  const fullPath = path.join(BROCHURE_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  return { path: BROCHURE_PREFIX + filename };
}

module.exports = {
  resolveBrochureFile: resolveBrochureFile,
  removeBrochure: removeBrochure,
  writePropertyBrochure: writePropertyBrochure,
  buildPropertyBrochure: buildPropertyBrochure
};

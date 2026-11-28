const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const { prepareLogoMark, compositeLogoMark } = require("../helpers/imageFile");

const BROCHURE_DIR = path.join(__dirname, "../storage/brochures");
const BROCHURE_PREFIX = "/storage/brochures/";
const IMAGE_DIR = path.join(__dirname, "../uploads/properties");
const IMAGE_PREFIX = "/uploads/properties/";
const LOGO_DIR = path.join(__dirname, "../uploads/companies");
const LOGO_PREFIX = "/uploads/companies/";

const LEGACY_BROCHURE_NAME = /^[a-f0-9]{32}\.pdf$/;
const NAMED_BROCHURE_NAME = /^[^<>:"/\\|?*\u0000-\u001f.][^<>:"/\\|?*\u0000-\u001f]{0,79}_[0-9]{8}\.pdf$/;

function isBrochureFilename(filename) {
  if (!filename || filename.includes("..")) return false;
  return LEGACY_BROCHURE_NAME.test(filename) || NAMED_BROCHURE_NAME.test(filename);
}

function safeCompanyLabel(companyName) {
  const cleaned = String(companyName || "Company")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 80);
  return cleaned || "Company";
}

function brochureFileName(companyName) {
  const digits = crypto.randomInt(0, 100000000).toString().padStart(8, "0");
  return safeCompanyLabel(companyName) + "_" + digits + ".pdf";
}

function resolveBrochureFile(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith(BROCHURE_PREFIX)) return null;
  const filename = path.basename(storedPath);
  if (!isBrochureFilename(filename)) return null;
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

function resolveCompanyLogo(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith(LOGO_PREFIX)) return null;
  const filename = path.basename(storedPath);
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(filename)) return null;
  const fullPath = path.resolve(LOGO_DIR, filename);
  const root = path.resolve(LOGO_DIR) + path.sep;
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

async function loadLogoMark(storedPath) {
  const fullPath = resolveCompanyLogo(storedPath);
  if (!fullPath || !fs.existsSync(fullPath)) return null;

  try {
    return await prepareLogoMark(fs.readFileSync(fullPath));
  } catch (error) {
    console.error("Company logo could not be read for the brochure:", error);
    return null;
  }
}

async function withLogoMark(image, logoMark) {
  if (!logoMark) return image;

  try {
    const marked = await compositeLogoMark(image.source, logoMark);
    if (!marked || !marked.width || !marked.height) return image;
    return {
      source: marked.buffer,
      width: marked.width,
      height: marked.height
    };
  } catch (error) {
    console.error("Property picture logo watermark failed:", error);
    return image;
  }
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

const PAGE_WIDTH = 595.28;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 50;
const MARGIN_X = 40;
const IMAGE_GAP = 14;

function contentWidth() {
  return PAGE_WIDTH - MARGIN_X - MARGIN_X;
}

function imagePlacement(image) {
  const available = contentWidth();
  const scale = available / image.width;
  return {
    width: available,
    height: Math.max(1, image.height * scale)
  };
}

function layoutHeight(doc, images, property) {
  const width = contentWidth();
  const description = String(property.description || "").trim() || "No description provided.";
  let y = MARGIN_TOP;

  images.forEach(function(image) {
    y += imagePlacement(image).height + IMAGE_GAP;
  });

  if (!images.length) {
    doc.font("Helvetica-Oblique").fontSize(11);
    y += doc.heightOfString("No pictures have been uploaded for this property.", { width: width }) + 16;
  } else {
    y += 8;
  }

  const summary = propertySummary(property);
  if (summary) {
    doc.font("Helvetica").fontSize(10);
    y += doc.heightOfString(summary, { width: width }) + 12;
  }

  doc.font("Helvetica-Bold").fontSize(13);
  y += doc.heightOfString("Description", { width: width }) + 8;
  doc.font("Helvetica").fontSize(11);
  y += doc.heightOfString(description, { width: width, lineGap: 3 });
  return y + MARGIN_BOTTOM;
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

function buildPropertyBrochure(options) {
  const companyName = options.companyName;
  const property = options.property || {};
  const images = options.images || [];
  const documentName = String(options.documentName || "").trim() || safeCompanyLabel(companyName);
  const description = String(property.description || "").trim() || "No description provided.";

  const margins = { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_X, right: MARGIN_X };
  const probe = new PDFDocument({ size: [PAGE_WIDTH, 200], margins: margins });
  probe.on("data", function() {});
  const pageHeight = layoutHeight(probe, images, property);
  probe.end();

  return new Promise(function(resolve, reject) {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, pageHeight],
      margins: margins,
      info: {
        Title: documentName,
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
    const columnWidth = contentWidth();
    let y = doc.page.margins.top;

    images.forEach(function(image) {
      const size = imagePlacement(image);
      doc.image(image.source, left, y, { width: size.width, height: size.height });
      y += size.height + IMAGE_GAP;
    });

    if (!images.length) {
      doc.font("Helvetica-Oblique").fontSize(11).fillColor("#5c6570");
      doc.text("No pictures have been uploaded for this property.", left, y, {
        width: columnWidth
      });
      y = doc.y + 16;
    } else {
      y += 8;
    }

    const summary = propertySummary(property);
    if (summary) {
      doc.font("Helvetica").fontSize(10).fillColor("#3d4654");
      doc.text(summary, left, y, { width: columnWidth });
      y = doc.y + 12;
    }

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#1f2933");
    doc.text("Description", left, y, { width: columnWidth });
    y = doc.y + 8;
    doc.font("Helvetica").fontSize(11).fillColor("#222222");
    doc.text(description, left, y, {
      width: columnWidth,
      align: "left",
      lineGap: 3
    });

    doc.end();
  });
}

async function writePropertyBrochure(options) {
  const loaded = [];
  const sourcePaths = Array.isArray(options.imagePaths) ? options.imagePaths : [];
  const logoMark = await loadLogoMark(options.logoPath);

  for (let index = 0; index < sourcePaths.length; index += 1) {
    const image = await loadImageForPdf(sourcePaths[index]);
    if (image) loaded.push(await withLogoMark(image, logoMark));
  }

  fs.mkdirSync(BROCHURE_DIR, { recursive: true });
  let filename = brochureFileName(options.companyName);
  let fullPath = path.join(BROCHURE_DIR, filename);
  for (let attempt = 0; fs.existsSync(fullPath) && attempt < 5; attempt += 1) {
    filename = brochureFileName(options.companyName);
    fullPath = path.join(BROCHURE_DIR, filename);
  }

  const buffer = await buildPropertyBrochure({
    companyName: options.companyName,
    documentName: filename.slice(0, -4),
    property: options.property,
    images: loaded
  });

  fs.writeFileSync(fullPath, buffer);
  return { path: BROCHURE_PREFIX + filename };
}

module.exports = {
  resolveBrochureFile: resolveBrochureFile,
  removeBrochure: removeBrochure,
  writePropertyBrochure: writePropertyBrochure,
  buildPropertyBrochure: buildPropertyBrochure
};

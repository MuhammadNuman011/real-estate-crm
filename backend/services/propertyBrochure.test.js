const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
  LOGO_MARK_OPACITY,
  prepareLogoMark,
  compositeLogoMark
} = require("../helpers/imageFile");
const {
  buildPropertyBrochure,
  writePropertyBrochure,
  removeBrochure
} = require("./propertyBrochure");

const PROPERTY_DIR = path.join(__dirname, "../uploads/properties");
const LOGO_DIR = path.join(__dirname, "../uploads/companies");

function solidPng(width, height, color) {
  return sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: color
    }
  }).png().toBuffer();
}

async function pixel(buffer, x, y) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
}

test("logo mark keeps aspect ratio, fades, and stays centered on every picture size", async function() {
  const logo = await solidPng(40, 20, { r: 0, g: 0, b: 255, alpha: 1 });
  const mark = await prepareLogoMark(logo);
  assert.equal(mark.width, 40);
  assert.equal(mark.height, 20);
  assert.equal(mark.buffer.slice(0, 4).toString("hex"), "89504e47");

  const faded = await pixel(mark.buffer, 20, 10);
  assert.equal(faded[2], 255);
  assert.equal(faded[3], Math.round(255 * LOGO_MARK_OPACITY));

  const landscape = await solidPng(200, 100, { r: 255, g: 0, b: 0, alpha: 1 });
  const portrait = await solidPng(120, 240, { r: 0, g: 180, b: 0, alpha: 1 });
  const wide = await compositeLogoMark(landscape, mark);
  const tall = await compositeLogoMark(portrait, mark);

  assert.equal(wide.width, 200);
  assert.equal(wide.height, 100);
  assert.equal(tall.width, 120);
  assert.equal(tall.height, 240);
  assert.equal(mark.sized.size, 2);

  const again = await compositeLogoMark(landscape, mark);
  assert.equal(mark.sized.size, 2);
  assert.equal(again.width, 200);

  const center = await pixel(wide.buffer, 100, 50);
  const corner = await pixel(wide.buffer, 2, 2);
  assert.ok(center[2] > 80, "center should show the blue logo");
  assert.ok(center[0] > 80, "logo should stay semi-transparent");
  assert.deepEqual(corner.slice(0, 3), [255, 0, 0]);

  const portraitCenter = await pixel(tall.buffer, 60, 120);
  const portraitCorner = await pixel(tall.buffer, 2, 2);
  assert.ok(portraitCenter[2] > 80);
  assert.deepEqual(portraitCorner.slice(0, 3), [0, 180, 0]);
});

test("transparent logo pixels do not paint the property picture", async function() {
  const logo = await sharp({
    create: {
      width: 40,
      height: 20,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite([{
    input: await solidPng(20, 20, { r: 0, g: 0, b: 255, alpha: 1 }),
    left: 10,
    top: 0
  }]).png().toBuffer();

  const mark = await prepareLogoMark(logo);
  const photo = await solidPng(200, 100, { r: 255, g: 0, b: 0, alpha: 1 });
  const stamped = await compositeLogoMark(photo, mark);
  const clear = await pixel(stamped.buffer, 68, 50);
  const covered = await pixel(stamped.buffer, 100, 50);
  assert.deepEqual(clear.slice(0, 3), [255, 0, 0]);
  assert.ok(covered[2] > 80);
});

test("jpg and webp logos are converted before they are stamped", async function() {
  const jpeg = await sharp({
    create: { width: 30, height: 10, channels: 3, background: { r: 20, g: 20, b: 20 } }
  }).jpeg().toBuffer();
  const webp = await sharp({
    create: { width: 16, height: 24, channels: 4, background: { r: 10, g: 200, b: 10, alpha: 1 } }
  }).webp().toBuffer();

  const fromJpeg = await prepareLogoMark(jpeg);
  const fromWebp = await prepareLogoMark(webp);
  assert.equal(fromJpeg.buffer.slice(0, 4).toString("hex"), "89504e47");
  assert.equal(fromWebp.buffer.slice(0, 4).toString("hex"), "89504e47");
  assert.equal(fromJpeg.width / fromJpeg.height, 3);
  assert.equal(fromWebp.width / fromWebp.height, 16 / 24);
});

function pageBoxes(pdf) {
  const text = pdf.toString("latin1");
  const pages = text.match(/\/Type \/Page(?!s)/g) || [];
  const boxes = [];
  const pattern = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g;
  let match = pattern.exec(text);
  while (match) {
    boxes.push({ width: Number(match[1]), height: Number(match[2]) });
    match = pattern.exec(text);
  }
  return { count: pages.length, boxes: boxes };
}

test("a long brochure stays on one page with a dynamic height", async function() {
  const source = await sharp({
    create: { width: 400, height: 800, channels: 3, background: { r: 30, g: 80, b: 140 } }
  }).jpeg().toBuffer();
  const images = [0, 1, 2].map(function() {
    return { source: source, width: 400, height: 800 };
  });
  const description = new Array(30).fill("A bright apartment with a long description line.").join(" ");
  const pdf = await buildPropertyBrochure({
    companyName: "North Realty",
    property: {
      description: description,
      property_type: "Villa",
      rent_sale: "sale",
      price: 250000,
      bedrooms: 4,
      bathrooms: 3,
      area: 2200,
      area_unit: "sqft"
    },
    images: images
  });
  const pages = pageBoxes(pdf);
  assert.equal(pages.count, 1);
  assert.equal(pages.boxes.length, 1);
  assert.equal(pages.boxes[0].width, 595.28);
  assert.ok(pages.boxes[0].height > 841.89);
});

test("a short brochure uses one page shorter than A4", async function() {
  const pdf = await buildPropertyBrochure({
    companyName: "North Realty",
    property: { description: "Short note." },
    images: []
  });
  const pages = pageBoxes(pdf);
  assert.equal(pages.count, 1);
  assert.equal(pages.boxes[0].width, 595.28);
  assert.ok(pages.boxes[0].height < 841.89);
  assert.ok(pages.boxes[0].height > 80);
});

test("a missing or unreadable logo does not block the brochure", async function() {
  assert.equal(await prepareLogoMark(Buffer.alloc(0)), null);
  assert.equal(await prepareLogoMark(Buffer.from("not-an-image")), null);

  const property = {
    description: "A bright apartment.",
    property_type: "Apartment",
    rent_sale: "rent",
    price: 1500,
    bedrooms: 2,
    bathrooms: 1,
    area: 900,
    area_unit: "sqft"
  };
  const pdf = await buildPropertyBrochure({
    companyName: "North Realty",
    property: property,
    images: []
  });
  assert.equal(pdf.slice(0, 5).toString(), "%PDF-");
  assert.match(pdf.toString("latin1"), /North Realty/);
  assert.equal(pdf.toString("latin1").split("/Subtype /Image").length - 1, 0);
});

test("brochure pdf embeds the logo on each included property picture", async function() {
  fs.mkdirSync(PROPERTY_DIR, { recursive: true });
  fs.mkdirSync(LOGO_DIR, { recursive: true });

  const coverName = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg";
  const wideName = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg";
  const tallName = "cccccccccccccccccccccccccccccccc.png";
  const logoName = "dddddddddddddddddddddddddddddddd.png";
  const coverPath = path.join(PROPERTY_DIR, coverName);
  const widePath = path.join(PROPERTY_DIR, wideName);
  const tallPath = path.join(PROPERTY_DIR, tallName);
  const logoPath = path.join(LOGO_DIR, logoName);
  let brochurePath = null;

  try {
    await sharp({
      create: { width: 80, height: 60, channels: 3, background: { r: 240, g: 240, b: 240 } }
    }).jpeg().toFile(coverPath);
    await sharp({
      create: { width: 320, height: 180, channels: 3, background: { r: 180, g: 40, b: 40 } }
    }).jpeg().toFile(widePath);
    await sharp({
      create: { width: 180, height: 320, channels: 3, background: { r: 40, g: 90, b: 180 } }
    }).png().toFile(tallPath);
    await sharp({
      create: { width: 48, height: 24, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    }).png().toFile(logoPath);

    const plain = await writePropertyBrochure({
      companyName: "North Realty",
      logoPath: "/uploads/companies/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png",
      property: { description: "No logo on these pictures.", property_type: "Villa", rent_sale: "sale" },
      imagePaths: [
        "/uploads/properties/" + coverName,
        "/uploads/properties/" + wideName,
        "/uploads/properties/" + tallName
      ]
    });
    const plainFile = path.join(__dirname, "../storage/brochures", path.basename(plain.path));
    const plainPdf = fs.readFileSync(plainFile);
    removeBrochure(plain.path);

    const marked = await writePropertyBrochure({
      companyName: "North Realty",
      logoPath: "/uploads/companies/" + logoName,
      property: { description: "Logo centered on each picture.", property_type: "Villa", rent_sale: "sale" },
      imagePaths: [
        "/uploads/properties/" + coverName,
        "/uploads/properties/" + wideName,
        "/uploads/properties/" + tallName
      ]
    });
    brochurePath = marked.path;
    const pdf = fs.readFileSync(path.join(__dirname, "../storage/brochures", path.basename(marked.path)));
    const text = pdf.toString("latin1");
    assert.equal(pdf.slice(0, 5).toString(), "%PDF-");
    assert.match(text, /North Realty/);
    assert.match(text, /\/Width 80/);
    assert.match(text, /\/Height 60/);
    assert.match(text, /\/Width 320/);
    assert.match(text, /\/Height 180/);
    assert.match(text, /\/Width 180/);
    assert.match(text, /\/Height 320/);
    assert.equal(pdf.equals(plainPdf), false);

    const jpegs = [];
    let from = 0;
    while (from < pdf.length) {
      const start = pdf.indexOf(Buffer.from([0xff, 0xd8]), from);
      if (start < 0) break;
      const end = pdf.indexOf(Buffer.from([0xff, 0xd9]), start);
      if (end < 0) break;
      jpegs.push(pdf.slice(start, end + 2));
      from = end + 2;
    }
    let wideJpeg = null;
    for (let index = 0; index < jpegs.length; index += 1) {
      const info = await sharp(jpegs[index]).metadata();
      if (info.width === 320 && info.height === 180) wideJpeg = jpegs[index];
    }
    assert.ok(wideJpeg);
    const embedded = await pixel(wideJpeg, 160, 90);
    const outside = await pixel(wideJpeg, 4, 4);
    assert.ok(embedded[1] > outside[1] + 40, "logo should lighten the center of the picture");
    assert.ok(outside[0] > outside[1]);
  } finally {
    [coverPath, widePath, tallPath, logoPath].forEach(function(filePath) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    if (brochurePath) removeBrochure(brochurePath);
  }
});

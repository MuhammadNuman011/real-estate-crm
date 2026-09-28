const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const Owners = require("../modals/Owner");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");

const UPLOAD_DIR = path.join(__dirname, "../uploads/owners");
const STORED_PREFIX = "/uploads/owners/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const COUNTRY_CODES = ["+966", "+971"];

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function companyId(req) {
  return String(req.company.id);
}

function normalizeMobile(countryCode, localNumber) {
  const code = trimmed(countryCode);
  if (!COUNTRY_CODES.includes(code)) {
    return { field: "country_code", error: "Country code must be KSA (+966) or UAE (+971)." };
  }

  let digits = trimmed(localNumber).replace(/[\s-]/g, "");
  if (!digits) {
    return { field: "mobile", error: "Mobile is required." };
  }
  if (!/^\d+$/.test(digits)) {
    return { field: "mobile", error: "Mobile must contain only digits." };
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^5\d{8}$/.test(digits)) {
    return { field: "mobile", error: "Enter a mobile number like 05xxxxxxxx." };
  }

  return { mobile: code + digits };
}

function saveImage(dataUrl, label) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match || !IMAGE_TYPES[match[1]]) {
    return { error: label + " must be a JPG, PNG, or WebP image." };
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return { error: label + " must be under 5 MB." };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomBytes(16).toString("hex") + IMAGE_TYPES[match[1]];
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { path: STORED_PREFIX + filename };
}

function removeImage(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith(STORED_PREFIX)) return;
  const filename = path.basename(storedPath);
  const fullPath = path.resolve(UPLOAD_DIR, filename);
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return;
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

function resolveImage(value, currentPath, label) {
  if (value == null || value === "") {
    return { error: label + " is required." };
  }
  if (typeof value !== "string") {
    return { error: label + " must be an image." };
  }

  const text = value.trim();
  if (text.startsWith("data:")) {
    const saved = saveImage(text, label);
    if (saved.error) return saved;
    return { path: saved.path, previous: currentPath || null, created: saved.path };
  }
  if (currentPath && text === currentPath) {
    return { path: currentPath };
  }
  return { error: label + " must be an image." };
}

function validateOwner(body) {
  const errors = {};
  const name = trimmed(body.name);
  const email = trimmed(body.email).toLowerCase();

  if (!name) errors.name = "Name is required.";
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email must be valid.";
  }

  const normalizedMobile = normalizeMobile(body.country_code, body.mobile);
  if (normalizedMobile.error) {
    errors[normalizedMobile.field] = normalizedMobile.error;
  }

  const status = trimmed(body.status) || "active";
  if (!["active", "inactive"].includes(status)) {
    errors.status = "Status must be active or inactive.";
  }

  return {
    errors: errors,
    values: {
      name: name,
      email: email,
      mobile: normalizedMobile.mobile || "",
      status: status
    }
  };
}

async function duplicateFields(email, mobile, ownerCompanyId, excludeId) {
  const where = {
    company_id: ownerCompanyId,
    [Op.or]: [{ email: email }, { mobile: mobile }]
  };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await Owners.findAll({ where: where });
  const fields = {};
  existing.forEach(function(owner) {
    if (owner.email === email) fields.email = "Email is already registered.";
    if (owner.mobile === mobile) fields.mobile = "Mobile is already registered.";
  });
  return Object.keys(fields).length ? fields : null;
}

function ownedByCompany(id, ownerCompanyId) {
  return Owners.findOne({
    where: {
      id: id,
      company_id: ownerCompanyId
    }
  });
}

module.exports = function(app) {
  app.get("/api/owners", requireCompanyAuth, async function(req, res) {
    try {
      const owners = await Owners.findAll({
        where: { company_id: companyId(req) },
        order: [["createdAt", "DESC"]]
      });
      return res.status(200).json(owners);
    } catch (error) {
      console.error("Get owners failed:", error);
      return res.status(500).json({ error: "Unable to retrieve owners." });
    }
  });

  app.get("/api/owners/:id", requireCompanyAuth, async function(req, res) {
    try {
      const owner = await ownedByCompany(req.params.id, companyId(req));
      if (!owner) {
        return res.status(404).json({ error: "Owner not found." });
      }
      return res.status(200).json(owner);
    } catch (error) {
      console.error("Get owner failed:", error);
      return res.status(500).json({ error: "Unable to retrieve owner." });
    }
  });

  app.post("/api/owners", requireCompanyAuth, async function(req, res) {
    const created = [];
    try {
      const body = req.body || {};
      const parsed = validateOwner(body);
      const front = resolveImage(body.national_id_front, null, "National ID front");
      const back = resolveImage(body.national_id_back, null, "National ID back");
      if (front.created) created.push(front.created);
      if (back.created) created.push(back.created);
      if (front.error) parsed.errors.national_id_front = front.error;
      if (back.error) parsed.errors.national_id_back = back.error;

      if (Object.keys(parsed.errors).length) {
        created.forEach(removeImage);
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const duplicates = await duplicateFields(parsed.values.email, parsed.values.mobile, companyId(req));
      if (duplicates) {
        created.forEach(removeImage);
        return res.status(409).json({ error: "Validation failed.", fields: duplicates });
      }

      const owner = await Owners.create({
        name: parsed.values.name,
        email: parsed.values.email,
        mobile: parsed.values.mobile,
        national_id_front: front.path,
        national_id_back: back.path,
        status: parsed.values.status,
        company_id: companyId(req)
      });

      return res.status(201).json(owner);
    } catch (error) {
      created.forEach(removeImage);
      console.error("Create owner failed:", error);
      return res.status(400).json({ error: "Unable to create owner." });
    }
  });

  app.patch("/api/owners/:id", requireCompanyAuth, async function(req, res) {
    const created = [];
    try {
      const owner = await ownedByCompany(req.params.id, companyId(req));
      if (!owner) {
        return res.status(404).json({ error: "Owner not found." });
      }

      const body = req.body || {};
      const parsed = validateOwner(body);
      const front = resolveImage(body.national_id_front, owner.national_id_front, "National ID front");
      const back = resolveImage(body.national_id_back, owner.national_id_back, "National ID back");
      if (front.created) created.push(front.created);
      if (back.created) created.push(back.created);
      if (front.error) parsed.errors.national_id_front = front.error;
      if (back.error) parsed.errors.national_id_back = back.error;

      if (Object.keys(parsed.errors).length) {
        created.forEach(removeImage);
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const duplicates = await duplicateFields(parsed.values.email, parsed.values.mobile, companyId(req), owner.id);
      if (duplicates) {
        created.forEach(removeImage);
        return res.status(409).json({ error: "Validation failed.", fields: duplicates });
      }

      await owner.update({
        name: parsed.values.name,
        email: parsed.values.email,
        mobile: parsed.values.mobile,
        national_id_front: front.path,
        national_id_back: back.path,
        status: parsed.values.status
      });

      if (front.previous && front.previous !== front.path) removeImage(front.previous);
      if (back.previous && back.previous !== back.path) removeImage(back.previous);

      return res.status(200).json(owner);
    } catch (error) {
      created.forEach(removeImage);
      console.error("Update owner failed:", error);
      return res.status(400).json({ error: "Unable to update owner." });
    }
  });
};

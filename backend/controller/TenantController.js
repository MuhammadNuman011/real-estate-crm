const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const Tenants = require("../modals/Tenant");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");

const UPLOAD_DIR = path.join(__dirname, "../uploads/tenants");
const STORED_PREFIX = "/uploads/tenants/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const COUNTRY_CODES = ["+966", "+971"];
const NATIONALITIES = [
  "Afghan",
  "Algerian",
  "American",
  "Australian",
  "Bahraini",
  "Bangladeshi",
  "British",
  "Canadian",
  "Chinese",
  "Egyptian",
  "Emirati",
  "Ethiopian",
  "Filipino",
  "French",
  "German",
  "Indian",
  "Indonesian",
  "Iranian",
  "Iraqi",
  "Italian",
  "Jordanian",
  "Kenyan",
  "Kuwaiti",
  "Lebanese",
  "Libyan",
  "Malaysian",
  "Moroccan",
  "Nepalese",
  "Nigerian",
  "Omani",
  "Pakistani",
  "Palestinian",
  "Qatari",
  "Russian",
  "Saudi",
  "Somali",
  "South African",
  "Sri Lankan",
  "Sudanese",
  "Syrian",
  "Tunisian",
  "Turkish",
  "Ukrainian",
  "Yemeni"
];

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

function validateTenant(body) {
  const errors = {};
  const name = trimmed(body.name);
  const email = trimmed(body.email).toLowerCase();
  const nationality = trimmed(body.nationality);

  if (!name) errors.name = "Name is required.";
  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email must be valid.";
  }
  if (!NATIONALITIES.includes(nationality)) {
    errors.nationality = "Select a nationality from the list.";
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
      nationality: nationality,
      status: status
    }
  };
}

async function duplicateFields(email, mobile, tenantCompanyId, excludeId) {
  const where = {
    company_id: tenantCompanyId,
    [Op.or]: [{ email: email }, { mobile: mobile }]
  };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await Tenants.findAll({ where: where });
  const fields = {};
  existing.forEach(function(tenant) {
    if (tenant.email === email) fields.email = "Email is already registered.";
    if (tenant.mobile === mobile) fields.mobile = "Mobile is already registered.";
  });
  return Object.keys(fields).length ? fields : null;
}

function ownedByCompany(id, tenantCompanyId) {
  return Tenants.findOne({
    where: {
      id: id,
      company_id: tenantCompanyId
    }
  });
}

module.exports = function(app) {
  app.get("/api/tenants", requireCompanyAuth, async function(req, res) {
    try {
      const tenants = await Tenants.findAll({
        where: { company_id: companyId(req) },
        order: [["createdAt", "DESC"]]
      });
      return res.status(200).json(tenants);
    } catch (error) {
      console.error("Get tenants failed:", error);
      return res.status(500).json({ error: "Unable to retrieve tenants." });
    }
  });

  app.get("/api/tenants/:id", requireCompanyAuth, async function(req, res) {
    try {
      const tenant = await ownedByCompany(req.params.id, companyId(req));
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found." });
      }
      return res.status(200).json(tenant);
    } catch (error) {
      console.error("Get tenant failed:", error);
      return res.status(500).json({ error: "Unable to retrieve tenant." });
    }
  });

  app.post("/api/tenants", requireCompanyAuth, async function(req, res) {
    const created = [];
    try {
      const body = req.body || {};
      const parsed = validateTenant(body);
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

      const tenant = await Tenants.create({
        name: parsed.values.name,
        email: parsed.values.email,
        mobile: parsed.values.mobile,
        nationality: parsed.values.nationality,
        national_id_front: front.path,
        national_id_back: back.path,
        status: parsed.values.status,
        company_id: companyId(req)
      });

      return res.status(201).json(tenant);
    } catch (error) {
      created.forEach(removeImage);
      console.error("Create tenant failed:", error);
      return res.status(400).json({ error: "Unable to create tenant." });
    }
  });

  app.patch("/api/tenants/:id", requireCompanyAuth, async function(req, res) {
    const created = [];
    try {
      const tenant = await ownedByCompany(req.params.id, companyId(req));
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found." });
      }

      const body = req.body || {};
      const parsed = validateTenant(body);
      const front = resolveImage(body.national_id_front, tenant.national_id_front, "National ID front");
      const back = resolveImage(body.national_id_back, tenant.national_id_back, "National ID back");
      if (front.created) created.push(front.created);
      if (back.created) created.push(back.created);
      if (front.error) parsed.errors.national_id_front = front.error;
      if (back.error) parsed.errors.national_id_back = back.error;

      if (Object.keys(parsed.errors).length) {
        created.forEach(removeImage);
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const duplicates = await duplicateFields(parsed.values.email, parsed.values.mobile, companyId(req), tenant.id);
      if (duplicates) {
        created.forEach(removeImage);
        return res.status(409).json({ error: "Validation failed.", fields: duplicates });
      }

      await tenant.update({
        name: parsed.values.name,
        email: parsed.values.email,
        mobile: parsed.values.mobile,
        nationality: parsed.values.nationality,
        national_id_front: front.path,
        national_id_back: back.path,
        status: parsed.values.status
      });

      if (front.previous && front.previous !== front.path) removeImage(front.previous);
      if (back.previous && back.previous !== back.path) removeImage(back.previous);

      return res.status(200).json(tenant);
    } catch (error) {
      created.forEach(removeImage);
      console.error("Update tenant failed:", error);
      return res.status(400).json({ error: "Unable to update tenant." });
    }
  });
};

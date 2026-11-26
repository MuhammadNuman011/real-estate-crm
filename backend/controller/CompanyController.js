const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const Companies = require("../modals/Comapnies");
const { hashPassword, authenticateCompany } = require("../helpers/helper");
const { createCompanyToken } = require("../helpers/token");
const { issueRefreshToken } = require("../helpers/refreshSession");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");
const { validateCompanyPatch } = require("../helpers/companyProfile");
const { prepareStoredImage, MAX_SOURCE_BYTES } = require("../helpers/imageFile");
const { parseMultipart, readRequestBody } = require("../helpers/multipartForm");

const UPLOAD_DIR = path.join(__dirname, "../uploads/companies");
const STORED_PREFIX = "/uploads/companies/";
const MAX_UPLOAD_BYTES = MAX_SOURCE_BYTES + (1024 * 1024);

function serializeCompany(company) {
  const data = company.toJSON();
  delete data.password;
  return data;
}

async function readCompanyBody(req) {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.toLowerCase().indexOf("multipart/form-data") === -1) {
    return { body: req.body || {} };
  }

  const raw = await readRequestBody(req, MAX_UPLOAD_BYTES);
  const parsed = parseMultipart(raw, contentType);
  if (parsed.error) return { error: parsed.error, status: 400 };

  const body = parsed.fields || {};
  if (parsed.file) {
    const mime = parsed.file.type || "application/octet-stream";
    body.logo = "data:" + mime + ";base64," + parsed.file.buffer.toString("base64");
  }
  return { body: body };
}

async function saveLogo(dataUrl) {
  const prepared = await prepareStoredImage(dataUrl, "Logo");
  if (prepared.error) return prepared;

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomBytes(16).toString("hex") + prepared.extension;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), prepared.buffer);
  return { path: STORED_PREFIX + filename };
}

function removeLogo(storedPath) {
  if (typeof storedPath !== "string" || storedPath.indexOf(STORED_PREFIX) !== 0) return;
  const filename = path.basename(storedPath);
  const fullPath = path.resolve(UPLOAD_DIR, filename);
  if (fullPath.indexOf(path.resolve(UPLOAD_DIR) + path.sep) !== 0) return;
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

async function resolveLogo(value, currentPath) {
  if (value == null || (typeof value === "string" && !value.trim())) {
    return { path: null, previous: currentPath || null };
  }
  if (typeof value !== "string") {
    return { error: "Logo must be an image." };
  }

  const text = value.trim();
  if (text.indexOf("data:") === 0) {
    const saved = await saveLogo(text);
    if (saved.error) return saved;
    return { path: saved.path, previous: currentPath || null, created: saved.path };
  }
  if (currentPath && text === currentPath) {
    return { path: currentPath };
  }
  return { error: "Logo must be an image." };
}

async function duplicateFields(values, companyId) {
  const checks = [];
  if (values.email) checks.push({ email: values.email });
  if (values.adminid) checks.push({ adminid: values.adminid });
  if (!checks.length) return null;

  const existing = await Companies.findAll({
    where: {
      id: { [Op.ne]: companyId },
      [Op.or]: checks
    }
  });
  const fields = {};
  existing.forEach(function(company) {
    if (values.email && company.email === values.email) fields.email = "Email is already registered.";
    if (values.adminid && company.adminid === values.adminid) fields.adminid = "Admin ID is already registered.";
  });
  return Object.keys(fields).length ? fields : null;
}

module.exports = function(app) {

  app.get("/api/company", requireCompanyAuth, async function(req, res) {
    try {
      const company = await Companies.findByPk(req.company.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found." });
      }
      return res.status(200).json([serializeCompany(company)]);
    } catch (error) {
      console.error("Get companies failed:", error);
      return res.status(500).json({ error: "Unable to retrieve Companies." });
    }
  });

  app.post("/api/company", async function(req, res) {
    try {
      const body = req.body || {};
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const adminid = typeof body.adminid === "string" ? body.adminid.trim() : "";

      const errors = {};
      if (!name) errors.name = "Name is required.";
      if (!adminid) errors.adminid = "Admin ID is required.";
      if (!email) {
        errors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = "Email must be valid.";
      }
      if (!password) {
        errors.password = "Password is required.";
      } else if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long.";
      }

      if (Object.keys(errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: errors });
      }

      const registeredCompany = await Companies.findOne({
        where: { email: email }
      });

      if (registeredCompany) {
        return res.status(409).json({ error: "Email is already registered." });
      }

      const company = await Companies.create({
        name: name,
        email: email,
        password: await hashPassword(password),
        adminid: adminid,
        mobile: typeof body.mobile === "string" ? body.mobile.trim() : undefined
      });

      return res.status(201).json(serializeCompany(company));
    } catch (error) {
      console.error("Company register  failed:", error);

      if (error.name === "SequelizeUniqueConstraintError") {
        if (error.errors && error.errors[0] && error.errors[0].path === "adminid") {
          return res.status(409).json({ error: "Admin ID is already registered." });
        }
        return res.status(409).json({ error: "Email is already registered." });
      }

      return res.status(400).json({ error: "Unable to create company." });
    }
  });

  app.post("/api/company/login", async function(req, res) {
    try {
      const body = req.body || {};
      const adminid = typeof body.adminid === "string"
        ? body.adminid.trim()
        : (typeof body.username === "string" ? body.username.trim() : "");
      const password = typeof body.password === "string" ? body.password : "";

      if (!adminid || !password) {
        return res.status(422).json({
          error: "Validation failed.",
          fields: {
            ...(!adminid ? { adminid: "Admin ID is required." } : {}),
            ...(!password ? { password: "Password is required." } : {})
          }
        });
      }

      const authentication = await authenticateCompany(adminid, password);
      if (!authentication.company || !authentication.isPasswordValid) {
        return res.status(401).json({ error: "Invalid admin ID or password." });
      }

      if (authentication.company.status !== "active") {
        return res.status(403).json({ error: "Company account is inactive." });
      }

      const accessToken = createCompanyToken(authentication.company);
      const refreshToken = await issueRefreshToken("company", authentication.company.id);
      return res.status(200).json({
        message: "Company successfully logged in.",
        token: accessToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        company: serializeCompany(authentication.company)
      });
    } catch (error) {
      console.error("Company login failed:", error);
      return res.status(500).json({ error: "Unable to log in." });
    }
  });

  app.patch("/api/company", requireCompanyAuth, async function(req, res) {
    const created = [];
    try {
      const company = await Companies.findByPk(req.company.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found." });
      }

      let incoming;
      try {
        incoming = await readCompanyBody(req);
      } catch (error) {
        if (error.code === "LIMIT") {
          return res.status(413).json({ error: "Upload is too large." });
        }
        console.error("Company logo upload failed:", error);
        return res.status(400).json({ error: "Upload could not be read." });
      }
      if (incoming.error) {
        return res.status(incoming.status || 400).json({ error: incoming.error });
      }

      const parsed = validateCompanyPatch(incoming.body);
      let logoResult = null;
      if (parsed.logoProvided) {
        logoResult = await resolveLogo(parsed.logo, company.logo);
        if (logoResult.created) created.push(logoResult.created);
        if (logoResult.error) parsed.errors.logo = logoResult.error;
      }

      if (Object.keys(parsed.errors).length) {
        created.forEach(removeLogo);
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const duplicates = await duplicateFields(parsed.values, company.id);
      if (duplicates) {
        created.forEach(removeLogo);
        return res.status(409).json({ error: "Validation failed.", fields: duplicates });
      }

      const updates = Object.assign({}, parsed.values);
      if (logoResult) updates.logo = logoResult.path;
      if (Object.keys(updates).length) {
        await company.update(updates);
      }

      if (logoResult && logoResult.previous && logoResult.previous !== logoResult.path) {
        removeLogo(logoResult.previous);
      }

      return res.status(200).json(serializeCompany(company));
    } catch (error) {
      created.forEach(removeLogo);
      console.error("Company update failed:", error);

      if (error.name === "SequelizeUniqueConstraintError") {
        const pathName = error.errors && error.errors[0] && error.errors[0].path;
        if (pathName === "adminid") {
          return res.status(409).json({
            error: "Validation failed.",
            fields: { adminid: "Admin ID is already registered." }
          });
        }
        if (pathName === "email") {
          return res.status(409).json({
            error: "Validation failed.",
            fields: { email: "Email is already registered." }
          });
        }
        return res.status(409).json({ error: "Company details are already registered." });
      }

      return res.status(400).json({ error: "Unable to update company." });
    }
  });
};

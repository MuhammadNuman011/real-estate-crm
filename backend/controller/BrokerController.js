const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const Brokers = require("../modals/Broker");
const { hashPassword, authenticateBroker } = require("../helpers/helper");
const { createBrokerToken } = require("../helpers/token");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");

const UPLOAD_DIR = path.join(__dirname, "../uploads/brokers");
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

function optionalText(value) {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || null;
}

function serializeBroker(broker) {
  const data = broker.toJSON();
  delete data.password;
  return data;
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

function saveProfilePicture(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match || !IMAGE_TYPES[match[1]]) {
    return { error: "Profile picture must be a JPG, PNG, or WebP image." };
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return { error: "Profile picture must be under 5 MB." };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomBytes(16).toString("hex") + IMAGE_TYPES[match[1]];
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { path: "/uploads/brokers/" + filename };
}

function removeProfilePicture(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith("/uploads/brokers/")) return;
  const filename = path.basename(storedPath);
  const fullPath = path.resolve(UPLOAD_DIR, filename);
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return;
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

function resolveProfilePicture(value, currentPath) {
  if (value == null || value === "") {
    return { path: null, previous: currentPath || null };
  }
  if (typeof value !== "string") {
    return { error: "Profile picture must be an image." };
  }

  const text = value.trim();
  if (text.startsWith("data:")) {
    const saved = saveProfilePicture(text);
    if (saved.error) return saved;
    return { path: saved.path, previous: currentPath || null, created: saved.path };
  }
  if (currentPath && text === currentPath) {
    return { path: currentPath };
  }
  return { error: "Profile picture must be an image." };
}

function validateBroker(body, options) {
  const errors = {};
  const name = trimmed(body.name);
  const email = trimmed(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

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

  if (options.requirePassword) {
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }
  } else if (password && password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  }

  const status = trimmed(body.status) || "active";
  if (!["active", "inactive", "blocked"].includes(status)) {
    errors.status = "Status must be active, inactive, or blocked.";
  }

  const licenseNumber = optionalText(body.license_number);
  const bio = optionalText(body.bio);
  const address = optionalText(body.address);

  if (licenseNumber === undefined) errors.license_number = "License number must be text.";
  if (bio === undefined) errors.bio = "Bio must be text.";
  if (address === undefined) errors.address = "Address must be text.";

  return {
    errors: errors,
    values: {
      name: name,
      email: email,
      mobile: normalizedMobile.mobile || "",
      password: password,
      status: status,
      license_number: licenseNumber || null,
      bio: bio || null,
      address: address || null
    }
  };
}

async function duplicateFields(email, mobile, excludeId) {
  const where = {
    [Op.or]: [{ email: email }, { mobile: mobile }]
  };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await Brokers.findOne({ where: where });
  if (!existing) return null;

  const fields = {};
  if (existing.email === email) fields.email = "Email is already registered.";
  if (existing.mobile === mobile) fields.mobile = "Mobile is already registered.";
  return fields;
}

function uniqueConstraintResponse(error) {
  const path = error.errors && error.errors[0] && error.errors[0].path;
  if (path === "email") {
    return { error: "Email is already registered.", fields: { email: "Email is already registered." } };
  }
  if (path === "mobile") {
    return { error: "Mobile is already registered.", fields: { mobile: "Mobile is already registered." } };
  }
  return { error: "A broker with these details already exists." };
}

module.exports = function(app) {
  app.post("/api/broker/login", async function(req, res) {
    try {
      const body = req.body || {};
      const email = trimmed(body.email).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";

      const errors = {};
      if (!email) {
        errors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = "Email must be valid.";
      }
      if (!password) errors.password = "Password is required.";

      if (Object.keys(errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: errors });
      }

      const authentication = await authenticateBroker(email, password);
      if (!authentication.broker || !authentication.isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      if (authentication.broker.status !== "active") {
        return res.status(403).json({ error: "Broker account is inactive." });
      }

      await authentication.broker.update({ last_login_at: new Date() });

      return res.status(200).json({
        message: "Broker successfully logged in.",
        token: createBrokerToken(authentication.broker),
        broker: serializeBroker(authentication.broker)
      });
    } catch (error) {
      console.error("Broker login failed:", error);
      return res.status(500).json({ error: "Unable to log in." });
    }
  });

  app.get("/api/brokers", requireCompanyAuth, async function(req, res) {
    try {
      const brokers = await Brokers.findAll({
        where: { company_id: companyId(req) },
        order: [["createdAt", "DESC"]]
      });
      return res.status(200).json(brokers.map(serializeBroker));
    } catch (error) {
      console.error("Get brokers failed:", error);
      return res.status(500).json({ error: "Unable to retrieve brokers." });
    }
  });

  app.get("/api/brokers/:id", requireCompanyAuth, async function(req, res) {
    try {
      const broker = await Brokers.findOne({
        where: {
          id: req.params.id,
          company_id: companyId(req)
        }
      });
      if (!broker) {
        return res.status(404).json({ error: "Broker not found." });
      }
      return res.status(200).json(serializeBroker(broker));
    } catch (error) {
      console.error("Get broker failed:", error);
      return res.status(500).json({ error: "Unable to retrieve broker." });
    }
  });

  app.post("/api/brokers", requireCompanyAuth, async function(req, res) {
    try {
      const body = req.body || {};
      const parsed = validateBroker(body, { requirePassword: true });
      if (Object.keys(parsed.errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const duplicates = await duplicateFields(parsed.values.email, parsed.values.mobile);
      if (duplicates) {
        return res.status(409).json({ error: "Validation failed.", fields: duplicates });
      }

      const picture = resolveProfilePicture(body.profile_picture, null);
      if (picture.error) {
        return res.status(422).json({
          error: "Validation failed.",
          fields: { profile_picture: picture.error }
        });
      }

      let broker;
      try {
      broker = await Brokers.create({
        name: parsed.values.name,
        email: parsed.values.email,
        mobile: parsed.values.mobile,
        password: await hashPassword(parsed.values.password),
        profile_picture: picture.path,
        status: parsed.values.status,
        company_id: companyId(req),
        license_number: parsed.values.license_number,
        bio: parsed.values.bio,
        address: parsed.values.address
      });
      } catch (error) {
        removeProfilePicture(picture.created);
        throw error;
      }

      return res.status(201).json(serializeBroker(broker));
    } catch (error) {
      console.error("Create broker failed:", error);
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json(uniqueConstraintResponse(error));
      }
      return res.status(400).json({ error: "Unable to create broker." });
    }
  });

  app.patch("/api/brokers/:id", requireCompanyAuth, async function(req, res) {
    try {
      const broker = await Brokers.findOne({
        where: {
          id: req.params.id,
          company_id: companyId(req)
        }
      });
      if (!broker) {
        return res.status(404).json({ error: "Broker not found." });
      }

      const body = req.body || {};
      const parsed = validateBroker(body, { requirePassword: false });
      if (Object.keys(parsed.errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const duplicates = await duplicateFields(parsed.values.email, parsed.values.mobile, broker.id);
      if (duplicates) {
        return res.status(409).json({ error: "Validation failed.", fields: duplicates });
      }

      const picture = resolveProfilePicture(body.profile_picture, broker.profile_picture);
      if (picture.error) {
        return res.status(422).json({
          error: "Validation failed.",
          fields: { profile_picture: picture.error }
        });
      }

      const updates = {
        name: parsed.values.name,
        email: parsed.values.email,
        mobile: parsed.values.mobile,
        profile_picture: picture.path,
        status: parsed.values.status,
        license_number: parsed.values.license_number,
        bio: parsed.values.bio,
        address: parsed.values.address
      };

      if (parsed.values.password) {
        updates.password = await hashPassword(parsed.values.password);
      }

      try {
        await broker.update(updates);
      } catch (error) {
        removeProfilePicture(picture.created);
        throw error;
      }
      if (picture.previous && picture.previous !== picture.path) {
        removeProfilePicture(picture.previous);
      }
      return res.status(200).json(serializeBroker(broker));
    } catch (error) {
      console.error("Update broker failed:", error);
      if (error.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json(uniqueConstraintResponse(error));
      }
      return res.status(400).json({ error: "Unable to update broker." });
    }
  });
};

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Properties = require("../modals/Properties");
const PropertyImages = require("../modals/PropertyImage");
const PropertyContracts = require("../modals/PropertyContract");
const Brokers = require("../modals/Broker");
const Owners = require("../modals/Owner");
const Tenants = require("../modals/Tenant");
const Companies = require("../modals/Comapnies");
const db = require("../config/db");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");
const requireBrokerAuth = require("../middleware/requireBrokerAuth");
const { Op } = require("sequelize");
const {
  resolveBrochureFile,
  removeBrochure,
  writePropertyBrochure
} = require("../services/propertyBrochure");

const UPLOAD_DIR = path.join(__dirname, "../uploads/properties");
const STORED_PREFIX = "/uploads/properties/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 12;
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredNumber(value, label, errors, field, options) {
  if (value === "" || value === null || value === undefined) {
    errors[field] = label + " is required.";
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors[field] = label + " must be a number.";
    return null;
  }

  if (options.integer && !Number.isInteger(number)) {
    errors[field] = label + " must be a whole number.";
    return null;
  }

  if (options.min != null && number < options.min) {
    errors[field] = label + " must be at least " + options.min + ".";
    return null;
  }

  return number;
}

const LIST_ATTRIBUTES = [
  "id",
  "title",
  "property_type",
  "price",
  "bedrooms",
  "bathrooms",
  "allowed_nationalities",
  "furnishing",
  "maid_room",
  "available_from",
  "status",
  "lat",
  "long",
  "description",
  "image",
  "pdf_path"
];

function companyId(req) {
  return String(req.company.id);
}

function propertyListWhere(req, baseWhere) {
  const where = Object.assign({}, baseWhere);
  const propertyType = trimmed(req.query.property_type);
  const allowedNationalities = trimmed(req.query.allowed_nationalities);

  if (propertyType) {
    where.property_type = { [Op.like]: "%" + propertyType + "%" };
  }

  if (allowedNationalities) {
    where.allowed_nationalities = {
      [Op.like]: "%" + allowedNationalities + "%"
    };
  }

  if (req.query.bedrooms !== undefined && req.query.bedrooms !== "") {
    const bedrooms = Number(req.query.bedrooms);
    if (!Number.isInteger(bedrooms) || bedrooms < 0) {
      return { error: "Bedrooms must be a non-negative whole number." };
    }
    where.bedrooms = bedrooms;
  }

  return { where: where };
}

function savePropertyImage(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match || !IMAGE_TYPES[match[1]]) {
    return { error: "Property image must be a JPG, JPEG, PNG, or WebP image." };
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return { error: "Property image must be under 5 MB." };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = crypto.randomBytes(16).toString("hex") + IMAGE_TYPES[match[1]];
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { path: STORED_PREFIX + filename };
}

function removePropertyImage(storedPath) {
  if (typeof storedPath !== "string" || !storedPath.startsWith(STORED_PREFIX)) return;
  const filename = path.basename(storedPath);
  const fullPath = path.resolve(UPLOAD_DIR, filename);
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return;
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

function samePaths(left, right) {
  if (left.length !== right.length) return false;
  return left.every(function(item, index) {
    return item === right[index];
  });
}

function resolveImageList(items, currentPaths) {
  if (!Array.isArray(items)) {
    return { error: "Property pictures must be a list of images.", created: [] };
  }
  if (items.length > MAX_IMAGES) {
    return { error: "Upload at most " + MAX_IMAGES + " pictures.", created: [] };
  }

  const current = new Set(currentPaths);
  const next = [];
  const created = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== "string") {
      return { error: "Each property picture must be an image.", created: created };
    }

    const text = item.trim();
    if (text.startsWith("data:")) {
      const saved = savePropertyImage(text);
      if (saved.error) return { error: saved.error, created: created };
      next.push(saved.path);
      created.push(saved.path);
      continue;
    }

    if (current.has(text)) {
      if (next.includes(text)) {
        return { error: "Each property picture can only be used once.", created: created };
      }
      next.push(text);
      continue;
    }

    return { error: "Each property picture must be an image.", created: created };
  }

  return {
    paths: next,
    created: created,
    removed: currentPaths.filter(function(storedPath) {
      return !next.includes(storedPath);
    })
  };
}

function resolveLegacyImage(value, currentPaths) {
  if (value === undefined) {
    return { paths: currentPaths.slice(), created: [], removed: [] };
  }

  const current = currentPaths[0] || null;
  if (value == null || value === "") {
    return {
      paths: [],
      created: [],
      removed: currentPaths.slice()
    };
  }
  if (typeof value !== "string") {
    return { error: "Property image must be an image.", created: [] };
  }

  const text = value.trim();
  if (text.startsWith("data:")) {
    const saved = savePropertyImage(text);
    if (saved.error) return { error: saved.error, created: [] };
    return {
      paths: [saved.path],
      created: [saved.path],
      removed: currentPaths.filter(function(storedPath) {
        return storedPath !== saved.path;
      })
    };
  }
  if (current && text === current) {
    return {
      paths: [current],
      created: [],
      removed: currentPaths.filter(function(storedPath) {
        return storedPath !== current;
      })
    };
  }
  return { error: "Property image must be an image.", created: [] };
}

function cleanupImages(paths) {
  (paths || []).forEach(removePropertyImage);
}

async function currentImagePaths(property) {
  if (!property) return [];
  const rows = await PropertyImages.findAll({
    where: {
      property_id: property.id,
      company_id: String(property.company_id)
    },
    order: [["sort_order", "ASC"], ["id", "ASC"]]
  });
  if (rows.length) {
    return rows.map(function(row) {
      return row.path;
    });
  }
  return property.image ? [property.image] : [];
}

function ownedByCompany(id, ownerCompanyId) {
  return Properties.findOne({
    where: {
      id: id,
      company_id: ownerCompanyId
    }
  });
}

function parseProperty(body) {
  const errors = {};
  const rentSale = trimmed(body.rent_sale);
  if (rentSale !== "rent" && rentSale !== "sale") {
    errors.rent_sale = "Listing type must be rent or sale.";
  }

  const propertyType = trimmed(body.property_type) || "Villa";
  const price = requiredNumber(body.price, "Price", errors, "price", { min: 0 });
  const bedrooms = requiredNumber(body.bedrooms, "Bedrooms", errors, "bedrooms", { integer: true, min: 0 });
  const bathrooms = requiredNumber(body.bathrooms, "Bathrooms", errors, "bathrooms", { integer: true, min: 0 });
  const area = requiredNumber(body.area, "Area", errors, "area", { min: 0 });

  if (propertyType.toLowerCase() === "studio" && bedrooms !== null && bedrooms > 1) {
    errors.bedrooms = "Studio properties cannot have more than 1 bedroom.";
  }

  if (typeof body.maid_room !== "boolean") {
    errors.maid_room = "Maid room is required.";
  }

  const allowedNationalities = trimmed(body.allowed_nationalities);
  if (!allowedNationalities) {
    errors.allowed_nationalities = "Allowed nationalities is required.";
  }

  const lat = trimmed(body.lat);
  const longitude = trimmed(body.long);
  const latNumber = Number(lat);
  const longNumber = Number(longitude);
  if (!lat || !Number.isFinite(latNumber) || latNumber < -90 || latNumber > 90) {
    errors.lat = "Latitude is required.";
  }
  if (!longitude || !Number.isFinite(longNumber) || longNumber < -180 || longNumber > 180) {
    errors.long = "Longitude is required.";
  }

  let title = null;
  if (body.title != null && body.title !== "" && typeof body.title !== "string") {
    errors.title = "Property title must be text.";
  } else {
    title = trimmed(body.title);
    if (title.length > 255) {
      errors.title = "Property title must be 255 characters or fewer.";
      title = null;
    } else if (!title) {
      title = null;
    }
  }

  const description = trimmed(body.description);
  if (!description) {
    errors.description = "Description is required.";
  }

  const furnishing = trimmed(body.furnishing) || "unfurnished";
  if (!["furnished", "unfurnished", "semi-furnished"].includes(furnishing)) {
    errors.furnishing = "Furnishing must be furnished, unfurnished, or semi-furnished.";
  }

  const areaUnit = trimmed(body.area_unit) || "sqft";
  if (!["sqft", "sqm"].includes(areaUnit)) {
    errors.area_unit = "Area unit must be sqft or sqm.";
  }

  const status = trimmed(body.status) || "inactive";
  if (!["inactive", "active", "rented"].includes(status)) {
    errors.status = "Status must be active, inactive, or rented.";
  }

  let availableFrom = null;
  const availableFromInput = trimmed(body.available_from);
  if (availableFromInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(availableFromInput)) {
      errors.available_from = "Available from must be a valid date.";
    } else {
      availableFrom = availableFromInput;
    }
  }

  return {
    errors: errors,
    values: {
      rent_sale: rentSale,
      price: price,
      property_type: propertyType,
      bedrooms: bedrooms,
      maid_room: body.maid_room,
      bathrooms: bathrooms,
      furnishing: furnishing,
      area: area,
      area_unit: areaUnit,
      available_from: availableFrom,
      allowed_nationalities: allowedNationalities,
      status: status,
      lat: lat,
      long: longitude,
      title: title,
      description: description
    }
  };
}

function isBlank(value) {
  return value === "" || value === null || value === undefined;
}

function requiredId(value, label, errors, field) {
  if (isBlank(value)) {
    errors[field] = label + " is required.";
    return null;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    errors[field] = label + " is required.";
    return null;
  }

  return number;
}

function requiredDate(value, label, errors, field) {
  const date = trimmed(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors[field] = label + " is required.";
    return "";
  }
  return date;
}

function parseContract(body, status) {
  const errors = {};
  const brokerBlank = isBlank(body.broker_id);
  const ownerBlank = isBlank(body.owner_id);
  const tenantBlank = isBlank(body.tenant_id);
  const startBlank = !trimmed(body.contract_start_date);
  const endBlank = !trimmed(body.contract_end_date);
  const amountBlank = isBlank(body.amount);
  const anyFilled = !(brokerBlank && ownerBlank && tenantBlank && startBlank && endBlank && amountBlank);

  if (status !== "rented" && !anyFilled) {
    return { errors: errors, values: null };
  }

  const brokerId = requiredId(body.broker_id, "Broker who rented the property", errors, "broker_id");
  const ownerId = requiredId(body.owner_id, "Owner", errors, "owner_id");
  const tenantId = requiredId(body.tenant_id, "Tenant", errors, "tenant_id");
  const startDate = requiredDate(body.contract_start_date, "Contract start date", errors, "contract_start_date");
  const endDate = requiredDate(body.contract_end_date, "Contract end date", errors, "contract_end_date");
  const amount = requiredNumber(body.amount, "Amount", errors, "amount", { min: 0 });

  if (startDate && endDate && endDate < startDate) {
    errors.contract_end_date = "Contract end date must be on or after the start date.";
  }

  return {
    errors: errors,
    values: Object.keys(errors).length ? null : {
      broker_id: brokerId,
      owner_id: ownerId,
      tenant_id: tenantId,
      contract_start_date: startDate,
      contract_end_date: endDate,
      amount: amount
    }
  };
}

function contractPayload(contract) {
  if (!contract) return null;
  return {
    broker_id: contract.broker_id,
    owner_id: contract.owner_id,
    tenant_id: contract.tenant_id,
    contract_start_date: contract.contract_start_date,
    contract_end_date: contract.contract_end_date,
    amount: contract.amount
  };
}

async function withContract(property, ownerCompanyId) {
  const contract = await PropertyContracts.findOne({
    where: {
      property_id: property.id,
      company_id: ownerCompanyId
    }
  });
  const data = property.toJSON();
  data.contract = contractPayload(contract);
  data.images = await currentImagePaths(property);
  return data;
}

async function replacePropertyImages(propertyId, ownerCompanyId, paths, transaction) {
  await PropertyImages.destroy({
    where: {
      property_id: propertyId,
      company_id: ownerCompanyId
    },
    transaction: transaction
  });

  if (!paths.length) return;

  await PropertyImages.bulkCreate(paths.map(function(storedPath, index) {
    return {
      property_id: propertyId,
      company_id: ownerCompanyId,
      path: storedPath,
      sort_order: index
    };
  }), { transaction: transaction });
}

async function companyNameFor(ownerCompanyId, fallbackName) {
  const direct = trimmed(fallbackName);
  if (direct) return direct;
  const company = await Companies.findByPk(ownerCompanyId);
  return company ? trimmed(company.name) : "";
}

async function refreshBrochure(property, ownerCompanyId, companyName, imagePaths) {
  const previousPath = property.pdf_path || null;
  let createdPath = null;

  try {
    const brochure = await writePropertyBrochure({
      companyName: companyName,
      property: property,
      imagePaths: imagePaths
    });
    createdPath = brochure.path;
    await property.update({
      pdf_path: brochure.path,
      pdf_generated_at: new Date()
    });
    if (previousPath && previousPath !== brochure.path) {
      removeBrochure(previousPath);
    }
    return null;
  } catch (error) {
    if (createdPath) removeBrochure(createdPath);
    console.error("Property brochure generation failed:", error);
    return "The property was saved, but the PDF brochure could not be generated.";
  }
}

async function partyErrors(contract, ownerCompanyId) {
  if (!contract) return {};

  const errors = {};
  const broker = await Brokers.findOne({
    where: {
      id: contract.broker_id,
      company_id: ownerCompanyId
    }
  });
  const owner = await Owners.findOne({
    where: {
      id: contract.owner_id,
      company_id: ownerCompanyId
    }
  });
  const tenant = await Tenants.findOne({
    where: {
      id: contract.tenant_id,
      company_id: ownerCompanyId
    }
  });

  if (!broker) errors.broker_id = "Select a broker from your company.";
  if (!owner) errors.owner_id = "Select an owner from your company.";
  if (!tenant) errors.tenant_id = "Select a tenant from your company.";
  return errors;
}

async function saveContract(propertyId, ownerCompanyId, contract, transaction) {
  const existing = await PropertyContracts.findOne({
    where: {
      property_id: propertyId,
      company_id: ownerCompanyId
    },
    transaction: transaction
  });

  if (!contract) {
    if (existing) await existing.destroy({ transaction: transaction });
    return null;
  }

  const values = {
    broker_id: contract.broker_id,
    owner_id: contract.owner_id,
    tenant_id: contract.tenant_id,
    contract_start_date: contract.contract_start_date,
    contract_end_date: contract.contract_end_date,
    amount: contract.amount
  };

  if (existing) {
    await existing.update(values, { transaction: transaction });
    return existing;
  }

  return PropertyContracts.create(Object.assign({
    property_id: propertyId,
    company_id: ownerCompanyId
  }, values), { transaction: transaction });
}

async function writeProperty(req, res, property) {
  const parsed = parseProperty(req.body || {});
  const contract = parseContract(req.body || {}, parsed.values.status);
  Object.assign(parsed.errors, contract.errors);
  if (Object.keys(parsed.errors).length) {
    return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
  }

  const parties = await partyErrors(contract.values, companyId(req));
  if (Object.keys(parties).length) {
    return res.status(422).json({ error: "Validation failed.", fields: parties });
  }

  const ownerCompanyId = companyId(req);
  const currentPaths = await currentImagePaths(property);
  const body = req.body || {};
  const images = Array.isArray(body.images)
    ? resolveImageList(body.images, currentPaths)
    : resolveLegacyImage(body.image, currentPaths);
  if (images.error) {
    cleanupImages(images.created);
    return res.status(422).json({
      error: "Validation failed.",
      fields: { images: images.error }
    });
  }

  const descriptionChanged = !property || trimmed(property.description) !== parsed.values.description;
  const titleChanged = !property || trimmed(property.title) !== (parsed.values.title || "");
  const picturesChanged = !samePaths(currentPaths, images.paths);
  const brochureMissing = !property || !property.pdf_path;

  let saved;
  try {
    saved = await db.transaction(async function(transaction) {
      let record = property;
      const values = Object.assign({}, parsed.values, {
        image: images.paths[0] || null
      });
      if (record) {
        await record.update(values, { transaction: transaction });
      } else {
        record = await Properties.create(Object.assign({}, values, {
          company_id: ownerCompanyId
        }), { transaction: transaction });
      }
      await saveContract(record.id, ownerCompanyId, contract.values, transaction);
      await replacePropertyImages(record.id, ownerCompanyId, images.paths, transaction);
      return record;
    });
  } catch (error) {
    cleanupImages(images.created);
    throw error;
  }

  cleanupImages(images.removed);

  let pdfWarning = null;
  if (!property || descriptionChanged || titleChanged || picturesChanged || brochureMissing) {
    const name = await companyNameFor(ownerCompanyId, req.company && req.company.name);
    pdfWarning = await refreshBrochure(saved, ownerCompanyId, name, images.paths);
  }

  const payload = await withContract(saved, ownerCompanyId);
  if (pdfWarning) payload.pdf_warning = pdfWarning;
  return res.status(property ? 200 : 201).json(payload);
}

async function sendBrochure(req, res, ownerCompanyId) {
  const property = await ownedByCompany(req.params.id, ownerCompanyId);
  if (!property) {
    return res.status(404).json({ error: "Property not found." });
  }

  const filePath = resolveBrochureFile(property.pdf_path);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Brochure is not available for this property." });
  }

  const download = req.query.download === "1" || req.query.download === "true";
  const filename = path.basename(filePath);
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    (download ? "attachment" : "inline") +
      "; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodeURIComponent(filename)
  );
  res.setHeader("Cache-Control", "private, no-store");
  return fs.createReadStream(filePath).pipe(res);
}

module.exports = function(app) {
  app.get("/api/properties/types", requireCompanyAuth, async function(req, res) {
    try {
      const rows = await Properties.findAll({
        attributes: ["property_type"],
        where: {
          property_type: { [Op.ne]: "" }
        },
        group: ["property_type"],
        order: [["property_type", "ASC"]],
        raw: true
      });
      const propertyTypes = rows
        .map(function(row) {
          return trimmed(row.property_type);
        })
        .filter(Boolean);

      return res.status(200).json(propertyTypes);
    } catch (error) {
      console.error("Get property types failed:", error);
      return res.status(500).json({ error: "Unable to retrieve property types." });
    }
  });

  app.get("/api/broker/properties", requireBrokerAuth, async function(req, res) {
    try {
      const filter = propertyListWhere(req, {
        status: "active",
        company_id: req.broker.company_id || ""
      });
      if (filter.error) {
        return res.status(400).json({ error: filter.error });
      }

      const properties = await Properties.findAll({
        attributes: LIST_ATTRIBUTES,
        where: filter.where,
        order: [["createdAt", "DESC"]]
      });
      return res.status(200).json(properties);
    } catch (error) {
      console.error("Get broker properties failed:", error);
      return res.status(500).json({ error: "Unable to retrieve properties." });
    }
  });

  app.get("/api/properties", requireCompanyAuth, async function(req, res) {
    try {
      const filter = propertyListWhere(req, {
        company_id: companyId(req)
      });
      if (filter.error) {
        return res.status(400).json({ error: filter.error });
      }

      const properties = await Properties.findAll({
        attributes: LIST_ATTRIBUTES,
        where: filter.where,
        order: [["createdAt", "DESC"]]
      });
      return res.status(200).json(properties);
    } catch (error) {
      console.error("Get properties failed:", error);
      return res.status(500).json({ error: "Unable to retrieve properties." });
    }
  });

  app.get("/api/properties/:id/brochure", requireCompanyAuth, async function(req, res) {
    try {
      return await sendBrochure(req, res, companyId(req));
    } catch (error) {
      console.error("Open property brochure failed:", error);
      return res.status(500).json({ error: "Unable to open the brochure." });
    }
  });

  app.get("/api/broker/properties/:id/brochure", requireBrokerAuth, async function(req, res) {
    try {
      return await sendBrochure(req, res, String(req.broker.company_id || ""));
    } catch (error) {
      console.error("Open broker property brochure failed:", error);
      return res.status(500).json({ error: "Unable to open the brochure." });
    }
  });

  app.get("/api/properties/:id", requireCompanyAuth, async function(req, res) {
    try {
      const property = await ownedByCompany(req.params.id, companyId(req));
      if (!property) {
        return res.status(404).json({ error: "Property not found." });
      }
      return res.status(200).json(await withContract(property, companyId(req)));
    } catch (error) {
      console.error("Get property failed:", error);
      return res.status(500).json({ error: "Unable to retrieve property." });
    }
  });

  app.post("/api/properties", requireCompanyAuth, async function(req, res) {
    try {
      return await writeProperty(req, res, null);
    } catch (error) {
      console.error("Create property failed:", error);
      return res.status(400).json({ error: "Unable to create property." });
    }
  });

  app.patch("/api/properties/:id", requireCompanyAuth, async function(req, res) {
    try {
      const property = await ownedByCompany(req.params.id, companyId(req));
      if (!property) {
        return res.status(404).json({ error: "Property not found." });
      }

      return await writeProperty(req, res, property);
    } catch (error) {
      console.error("Update property failed:", error);
      return res.status(400).json({ error: "Unable to update property." });
    }
  });
};

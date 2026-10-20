const Properties = require("../modals/Properties");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");
const requireBrokerAuth = require("../middleware/requireBrokerAuth");
const { Op } = require("sequelize");

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
  "long"
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
  if (!["inactive", "active"].includes(status)) {
    errors.status = "Status must be active or inactive.";
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
      description: description
    }
  };
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

  app.get("/api/properties/:id", requireCompanyAuth, async function(req, res) {
    try {
      const property = await ownedByCompany(req.params.id, companyId(req));
      if (!property) {
        return res.status(404).json({ error: "Property not found." });
      }
      return res.status(200).json(property);
    } catch (error) {
      console.error("Get property failed:", error);
      return res.status(500).json({ error: "Unable to retrieve property." });
    }
  });

  app.post("/api/properties", requireCompanyAuth, async function(req, res) {
    try {
      const parsed = parseProperty(req.body || {});
      if (Object.keys(parsed.errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      const property = await Properties.create(Object.assign({}, parsed.values, {
        company_id: companyId(req)
      }));

      return res.status(201).json(property);
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

      const parsed = parseProperty(req.body || {});
      if (Object.keys(parsed.errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: parsed.errors });
      }

      await property.update(parsed.values);
      return res.status(200).json(property);
    } catch (error) {
      console.error("Update property failed:", error);
      return res.status(400).json({ error: "Unable to update property." });
    }
  });
};

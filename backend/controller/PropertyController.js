const Properties = require("../modals/Properties");
const requireCompanyAuth = require("../middleware/requireCompanyAuth");
const requireBrokerAuth = require("../middleware/requireBrokerAuth");

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
  "property_type",
  "price",
  "bedrooms",
  "bathrooms",
  "allowed_nationalities",
  "furnishing",
  "maid_room",
  "status"
];

module.exports = function(app) {
  app.get("/api/broker/properties", requireBrokerAuth, async function(req, res) {
    try {
      const properties = await Properties.findAll({
        attributes: LIST_ATTRIBUTES,
        where: { status: "active" },
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
      const properties = await Properties.findAll({
        attributes: LIST_ATTRIBUTES,
        order: [["createdAt", "DESC"]]
      });
      return res.status(200).json(properties);
    } catch (error) {
      console.error("Get properties failed:", error);
      return res.status(500).json({ error: "Unable to retrieve properties." });
    }
  });

  app.post("/api/properties", requireCompanyAuth, async function(req, res) {
    try {
      const body = req.body || {};
      const errors = {};

      const rentSale = trimmed(body.rent_sale);
      if (rentSale !== "rent" && rentSale !== "sale") {
        errors.rent_sale = "Listing type must be rent or sale.";
      }

      const price = requiredNumber(body.price, "Price", errors, "price", { min: 0 });
      const bedrooms = requiredNumber(body.bedrooms, "Bedrooms", errors, "bedrooms", { integer: true, min: 0 });
      const bathrooms = requiredNumber(body.bathrooms, "Bathrooms", errors, "bathrooms", { integer: true, min: 0 });
      const area = requiredNumber(body.area, "Area", errors, "area", { min: 0 });

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

      if (Object.keys(errors).length) {
        return res.status(422).json({ error: "Validation failed.", fields: errors });
      }

      const property = await Properties.create({
        rent_sale: rentSale,
        price: price,
        property_type: trimmed(body.property_type) || "Villa",
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
      });

      return res.status(201).json(property);
    } catch (error) {
      console.error("Create property failed:", error);
      return res.status(400).json({ error: "Unable to create property." });
    }
  });
};

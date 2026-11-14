const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "Properties",
  {
    rent_sale: {
      type: Sequelize.ENUM("rent", "sale"),
      allowNull: false,
    },

    price: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },

    property_type: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "Villa",
    },

    bedrooms: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },

    maid_room: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    bathrooms: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },

    furnishing: {
      type: Sequelize.ENUM(
        "furnished",
        "unfurnished",
        "semi-furnished"
      ),
      allowNull: false,
      defaultValue: "unfurnished",
    },

    area: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
    },

    area_unit: {
      type: Sequelize.ENUM("sqft", "sqm"),
      allowNull: false,
      defaultValue: "sqft",
    },

    available_from: {
      type: Sequelize.DATEONLY,
      allowNull: true,
    },

    allowed_nationalities: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    status: {
      type: Sequelize.ENUM("inactive", "active", "rented"),
      allowNull: false,
      defaultValue: "inactive",
    },

    lat: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    long: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    description: {
      type: Sequelize.TEXT,
      allowNull: true,
    },

    image: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    pdf_path: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    pdf_generated_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },

    company_id: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);
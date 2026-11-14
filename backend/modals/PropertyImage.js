const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "PropertyImages",
  {
    property_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },

    company_id: {
      type: Sequelize.STRING,
      allowNull: false
    },

    path: {
      type: Sequelize.STRING,
      allowNull: false
    },

    sort_order: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    tableName: "property_images",
    timestamps: true,
    indexes: [
      { fields: ["property_id", "company_id"] }
    ]
  }
);

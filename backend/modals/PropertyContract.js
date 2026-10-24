const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "PropertyContracts",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    property_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true,
    },

    broker_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },

    owner_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },

    tenant_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },

    contract_start_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },

    contract_end_date: {
      type: Sequelize.DATEONLY,
      allowNull: false,
    },

    amount: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
    },

    company_id: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "property_contracts",
    timestamps: true,
    underscored: true,
  }
);

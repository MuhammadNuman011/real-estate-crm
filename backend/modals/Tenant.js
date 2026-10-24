const db = require("../config/db");
const Sequelize = require("sequelize");

module.exports = db.define(
  "Tenants",
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    email: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },

    mobile: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    nationality: {
      type: Sequelize.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    national_id_front: {
      type: Sequelize.STRING,
      allowNull: false,
    },

    national_id_back: {
      type: Sequelize.STRING,
      allowNull: false,
    },

    status: {
      type: Sequelize.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },

    company_id: {
      type: Sequelize.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "tenants",
    timestamps: true,
    underscored: true,
  }
);
